/**
 * High Country Health Attribution Tracker
 * Lightweight attribution tracking with automatic pageview tracking
 */
;(function () {
  'use strict'

  // Configuration
  const STORAGE_KEYS = {
    VISITOR_ID: '_hch_vid',
    SESSION_ID: '_hch_sid',
    SESSION_START: '_hch_sst',
    LAST_URL: '_hch_last_url',
    LAST_SESSION_ID: '_hch_last_session_id',
  }

  const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds

  // Initialize tracker
  class HCHTracker {
    constructor() {
      this.apiKey = null
      this.apiUrl = null
      this.visitorId = null
      this.sessionId = null
      this.sessionStart = null
      this.isNewSession = false
      this.initialPageViewSent = false

      // Get config from script tag
      this.loadConfig()

      if (this.apiKey && this.apiUrl) {
        this.init()
      } else {
        console.error('HCH: Missing apiKey or apiUrl configuration')
      }
    }

    loadConfig() {
      const scriptTag = document.currentScript || this.findScriptTag()
      if (scriptTag) {
        this.apiKey = scriptTag.getAttribute('data-api-key')
        this.apiUrl = scriptTag.getAttribute('data-api-url')
      }
    }

    findScriptTag() {
      const scripts = document.getElementsByTagName('script')
      for (let script of scripts) {
        if (
          script.src &&
          (script.src.includes('tracker.js') ||
            script.src.includes('hch'))
        ) {
          return script
        }
      }
      return null
    }

    async init() {
      // Get or create visitor ID
      this.visitorId = this.getOrCreateVisitorId()

      // Get or create session ID (sets this.isNewSession)
      this.sessionId = this.getOrCreateSessionId()

      // Track initial page view
      await this.trackInitialPageView()

      // Set up SPA listeners AFTER initial pageview completes
      this.setupListeners()

      // Set up activity tracking to extend session
      this.setupActivityTracking()
    }

    // Visitor ID management (persists forever in localStorage)
    getOrCreateVisitorId() {
      let visitorId = localStorage.getItem(STORAGE_KEYS.VISITOR_ID)
      if (!visitorId) {
        visitorId = this.generateUUID()
        localStorage.setItem(STORAGE_KEYS.VISITOR_ID, visitorId)
      }
      return visitorId
    }

    // Session ID management (30 min timeout)
    getOrCreateSessionId() {
      const existingSessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID)
      const sessionStart = parseInt(
        localStorage.getItem(STORAGE_KEYS.SESSION_START) || '0',
      )
      const now = Date.now()

      // Check if session is still valid
      if (
        existingSessionId &&
        sessionStart &&
        now - sessionStart < SESSION_TIMEOUT
      ) {
        this.sessionStart = sessionStart
        this.isNewSession = false
        return existingSessionId
      }

      // Create new session
      const newSessionId = this.generateUUID()
      this.sessionStart = now
      this.isNewSession = true
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, newSessionId)
      localStorage.setItem(STORAGE_KEYS.SESSION_START, String(now))
      return newSessionId
    }

    // Track initial page view with attribution data
    async trackInitialPageView() {
      if (this.initialPageViewSent) return

      this.initialPageViewSent = true
      const url = window.location.href

      // Check deduplication
      if (!this.shouldTrackPageView(url)) {
        return
      }

      try {
        const body = {
          apiKey: this.apiKey,
          visitorId: this.visitorId,
          sessionId: this.sessionId,
          type: 'pageview',
          metadata: {
            url: url,
            timestamp: Date.now(),
          },
        }

        // Include attribution data ONLY for new sessions
        if (this.isNewSession) {
          body.metadata = {
            // UTM parameters
            utm_source: this.getUrlParam('utm_source'),
            utm_medium: this.getUrlParam('utm_medium'),
            utm_campaign: this.getUrlParam('utm_campaign'),
            utm_content: this.getUrlParam('utm_content'),
            utm_term: this.getUrlParam('utm_term'),

            // Click IDs
            fbclid: this.getUrlParam('fbclid'),
            gclid: this.getUrlParam('gclid'),
            msclkid: this.getUrlParam('msclkid'),
            ttclid: this.getUrlParam('ttclid'),
            twclid: this.getUrlParam('twclid'),
            li_fat_id: this.getUrlParam('li_fat_id'),
            ScCid: this.getUrlParam('ScCid'),

            // Page data
            url: url,
            referrer: document.referrer || undefined,
            timestamp: Date.now(),
          }

          // Include device/browser info for new sessions
          body.userAgent = navigator.userAgent
          body.screenResolution = `${screen.width}x${screen.height}`
          body.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        }

        await fetch(`${this.apiUrl}/trackEvent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        // Update deduplication tracking
        this.updateLastTrackedUrl(url)
      } catch (error) {
        console.error('HCH: Error tracking page view', error)
      }
    }

    // Track subsequent page views (SPA navigation)
    async trackPageView(url = window.location.href) {
      // Check deduplication
      if (!this.shouldTrackPageView(url)) {
        return
      }

      try {
        const body = {
          apiKey: this.apiKey,
          visitorId: this.visitorId,
          sessionId: this.sessionId,
          type: 'pageview',
          metadata: {
            url: url,
            timestamp: Date.now(),
          },
        }

        await fetch(`${this.apiUrl}/trackEvent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        // Update deduplication tracking
        this.updateLastTrackedUrl(url)

        // Update session timestamp
        this.updateSessionTimestamp()
      } catch (error) {
        console.error('HCH: Error tracking page view', error)
      }
    }

    // Deduplication: prevent tracking same URL back-to-back
    shouldTrackPageView(url) {
      const lastUrl = localStorage.getItem(STORAGE_KEYS.LAST_URL)
      const lastSessionId = localStorage.getItem(STORAGE_KEYS.LAST_SESSION_ID)

      // Different session? Always track (new visit)
      if (this.sessionId !== lastSessionId) {
        return true
      }

      // Same URL as last tracked? Skip (prevents refresh duplicates)
      if (url === lastUrl) {
        return false
      }

      // Different URL in same session? Track it
      return true
    }

    // Update last tracked URL for deduplication
    updateLastTrackedUrl(url) {
      localStorage.setItem(STORAGE_KEYS.LAST_URL, url)
      localStorage.setItem(STORAGE_KEYS.LAST_SESSION_ID, this.sessionId)
    }

    // Set up SPA route change listeners
    setupListeners() {
      const originalPushState = history.pushState
      const originalReplaceState = history.replaceState
      const self = this

      // Override pushState for SPA navigation
      history.pushState = function () {
        originalPushState.apply(this, arguments)
        self.trackPageView(window.location.href)
      }

      // Override replaceState for SPA navigation
      history.replaceState = function () {
        originalReplaceState.apply(this, arguments)
        self.trackPageView(window.location.href)
      }

      // Handle back/forward button
      window.addEventListener('popstate', () => {
        self.trackPageView(window.location.href)
      })
    }

    // Set up activity tracking to extend session lifetime
    setupActivityTracking() {
      const updateSession = () => {
        this.updateSessionTimestamp()
      }

      // Debounced session update
      let sessionUpdateTimeout
      window.addEventListener('click', () => {
        clearTimeout(sessionUpdateTimeout)
        sessionUpdateTimeout = setTimeout(updateSession, 1000)
      })

      window.addEventListener('scroll', () => {
        clearTimeout(sessionUpdateTimeout)
        sessionUpdateTimeout = setTimeout(updateSession, 1000)
      })
    }

    // Update session timestamp to extend session
    updateSessionTimestamp() {
      const now = Date.now()
      localStorage.setItem(STORAGE_KEYS.SESSION_START, String(now))
    }

    // Utility: Get URL parameter
    getUrlParam(name) {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get(name) || undefined
    }

    // Utility: Generate UUID
    generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        function (c) {
          const r = (Math.random() * 16) | 0
          const v = c === 'x' ? r : (r & 0x3) | 0x8
          return v.toString(16)
        },
      )
    }

    // Public API: Get session info (read-only)
    getSessionInfo() {
      return {
        visitorId: this.visitorId,
        sessionId: this.sessionId,
        sessionStart: this.sessionStart,
        isNewSession: this.isNewSession,
      }
    }
  }

  // Initialize tracker
  const tracker = new HCHTracker()

  // Expose minimal read-only API
  window.HCH = {
    getSessionInfo: () => tracker.getSessionInfo(),
  }
})()
