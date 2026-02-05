/**
 * High Country Digital Tracker
 *
 * Robust, class-based tracking system for comprehensive user analytics.
 *
 * Features:
 * - Tracks every page view (initial load + all SPA navigation)
 * - Persistent anonymous ID stored indefinitely in localStorage
 * - Immediate event sending (no batching)
 * - Automatic retry of failed events when back online
 * - Tracks page title changes
 * - Captures UTM parameters and click IDs (gclid, fbclid)
 *
 * Usage:
 *
 * 1. Auto-initialization (via data attributes):
 *    <script src="/tracker.js" data-location-id="YOUR_LOCATION_ID"></script>
 *    // With custom API endpoint:
 *    <script src="/tracker.js" data-location-id="YOUR_LOCATION_ID" data-api-endpoint="https://example.com/api/events"></script>
 *    // Access via window.__HCH.track('event_name', { custom: 'data' })
 *
 * 2. Manual initialization:
 *    <script src="/tracker.js"></script>
 *    <script>
 *      const tracker = new window.HCHTracker('YOUR_LOCATION_ID', 'https://example.com/api/events')
 *      tracker.track('custom_event', { foo: 'bar' })
 *      tracker.identify({ email: 'user@example.com', phone: '+1234567890', metadata: { fullName: 'John Doe', firstName: 'John', lastName: 'Doe' } })
 *    </script>
 */
;(function () {
  class Tracker {
    private locationId: string
    private apiEndpoint: string
    private storageKey: string = '_hch_uuid'
    private sessionKey: string = '_hch_session_id'
    private anonymousId: string
    private sessionId: string
    private utms: Record<string, string | null>
    private lastTrackedPath: string = ''

    constructor(locationId: string, apiEndpoint?: string) {
      this.locationId = locationId
      // Use custom API endpoint or build from locationId
      this.apiEndpoint =
        apiEndpoint ||
        `${window.location.protocol}//${window.location.host}/api/${locationId}/event`
      this.anonymousId = this.getOrCreateAnonymousId()
      this.sessionId = this.getOrCreateSessionId()
      this.utms = this.captureUTMs()
      this.init()
    }

    private init(): void {
      // Track initial page view
      this.trackPageView()

      // Intercept SPA navigation
      this.interceptNavigation()

      // Handle online/offline for robustness
      this.setupOnlineHandlers()
    }

    private uuid(): string {
      return crypto.randomUUID()
    }

    private now(): string {
      return new Date().toISOString()
    }

    /**
     * Get or create anonymous ID (persists indefinitely)
     */
    private getOrCreateAnonymousId(): string {
      let value = localStorage.getItem(this.storageKey)

      if (!value) {
        value = this.uuid()
        localStorage.setItem(this.storageKey, value)
      }

      return value
    }

    private getOrCreateSessionId(): string {
      let sid = sessionStorage.getItem(this.sessionKey)
      if (!sid) {
        sid = this.uuid()
        sessionStorage.setItem(this.sessionKey, sid)
      }
      return sid
    }

    private captureUTMs(): Record<string, string | null> {
      const params = new URLSearchParams(window.location.search)
      return {
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
        utm_term: params.get('utm_term'),
        utm_content: params.get('utm_content'),
        gclid: params.get('gclid'),
        fbclid: params.get('fbclid'),
      }
    }

    /**
     * Send event immediately (no batching/queuing)
     */
    private async send(event: Record<string, any>): Promise<void> {
      try {
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            anonymous_id: this.anonymousId,
            session_id: this.sessionId,
            events: [event],
          }),
          keepalive: true, // Ensures request completes even if page is closing
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
      } catch (error) {
        console.error('[HCH Tracker] Failed to send event:', error)
        // Store failed event for retry
        this.queueFailedEvent(event)
      }
    }

    /**
     * Queue failed events to retry later
     */
    private queueFailedEvent(event: Record<string, any>): void {
      try {
        const queueKey = '_hch_failed_events'
        const queue = JSON.parse(localStorage.getItem(queueKey) || '[]')
        queue.push(event)
        // Keep only last 50 failed events
        const trimmed = queue.slice(-50)
        localStorage.setItem(queueKey, JSON.stringify(trimmed))
      } catch (e) {
        // Ignore storage errors
      }
    }

    /**
     * Retry failed events
     */
    private async retryFailedEvents(): Promise<void> {
      try {
        const queueKey = '_hch_failed_events'
        const queue = JSON.parse(localStorage.getItem(queueKey) || '[]')

        if (queue.length === 0) return

        for (const event of queue) {
          await this.send(event)
        }

        // Clear queue on success
        localStorage.removeItem(queueKey)
      } catch (e) {
        // Will retry next time
      }
    }

    private trackPageView(): void {
      const currentPath = window.location.pathname

      // Avoid duplicate tracking of the same path
      if (currentPath === this.lastTrackedPath) return

      this.lastTrackedPath = currentPath

      this.track('PAGE_VIEW', {
        path: currentPath,
        title: document.title,
      })
    }

    /**
     * Intercept all navigation methods to track every page view
     */
    private interceptNavigation(): void {
      // Save original methods
      const originalPushState = history.pushState.bind(history)
      const originalReplaceState = history.replaceState.bind(history)

      // Override pushState
      history.pushState = (...args: any[]) => {
        originalPushState(...args)
        // Use setTimeout to ensure DOM updates (especially title) are complete
        setTimeout(() => this.trackPageView(), 100)
      }

      // Override replaceState
      history.replaceState = (...args: any[]) => {
        originalReplaceState(...args)
        setTimeout(() => this.trackPageView(), 100)
      }

      // Handle popstate (back/forward buttons)
      window.addEventListener('popstate', () => {
        setTimeout(() => this.trackPageView(), 100)
      })

      // Handle hash changes (for hash-based routing)
      window.addEventListener('hashchange', () => {
        setTimeout(() => this.trackPageView(), 100)
      })

      // MutationObserver to catch dynamic title changes
      const observer = new MutationObserver(() => {
        // Re-track if title changes
        if (document.title !== this.lastTrackedPath) {
          this.trackPageView()
        }
      })

      observer.observe(document.querySelector('title') || document.head, {
        childList: true,
        characterData: true,
        subtree: true,
      })
    }

    /**
     * Setup online/offline handlers for robustness
     */
    private setupOnlineHandlers(): void {
      window.addEventListener('online', () => {
        // Retry failed events when coming back online
        this.retryFailedEvents()
      })
    }

    /**
     * Public API: Track custom event
     */
    track(type: string, metadata: Record<string, any> = {}): void {
      const event = {
        type,
        timestamp: this.now(),
        metadata: {
          ...this.utms,
          ...metadata,
          url: window.location.href,
          referrer: document.referrer || null,
          title: document.title,
        },
      }

      this.send(event)
    }

    /**
     * Public API: Identify user
     */
    identify(identity: { email?: string; phone?: string }): void {
      this.track('IDENTIFY', {
        email: identity.email || null,
        phone: identity.phone || null,
      })
    }
  }

  // Expose Tracker class globally
  ;(window as any).HCHTracker = Tracker

  // Auto-initialize if script has data-location-id attribute
  const script = document.currentScript as HTMLScriptElement
  if (script && script.dataset.locationId) {
    const locationId = script.dataset.locationId
    const apiEndpoint = script.dataset.apiEndpoint || undefined
    ;(window as any).__HCH = new Tracker(locationId, apiEndpoint)
  }
})()
