/**
 * Leadalytics Attribution Tracker
 * Lightweight, iOS-compatible attribution tracking script
 */
;(function () {
  'use strict'

  // Configuration
  const STORAGE_KEYS = {
    VISITOR_ID: '_la_vid',
    SESSION_ID: '_la_sid',
    SESSION_START: '_la_sst',
  }

  const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds
  const COOKIE_EXPIRY_DAYS = 365 // 1 year for visitor ID
  const SESSION_COOKIE_EXPIRY_DAYS = 7 // 7 days for iOS ITP compliance

  // Initialize tracker
  class LeadalyticsTracker {
    constructor() {
      this.apiKey = null
      this.apiUrl = null
      this.visitorId = null
      this.sessionId = null
      this.sessionStart = null
      this.isInitialized = false
      this.queue = []
      this.initialPageViewSent = false // Prevent duplicate initial pageview

      // Get config from script tag
      this.loadConfig()

      if (this.apiKey && this.apiUrl) {
        this.init()
      } else {
        console.error('Leadalytics: Missing apiKey or apiUrl configuration')
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
            script.src.includes('leadalytics'))
        ) {
          return script
        }
      }
      return null
    }

    init() {
      // Get or create visitor ID
      this.visitorId = this.getOrCreateVisitorId()

      // Get or create session ID
      this.sessionId = this.getOrCreateSessionId()

      // Capture initial attribution data
      this.captureAttribution()

      // Set up event listeners
      this.setupListeners()

      // Listen for iframe messages
      this.setupIframeListener()

      this.isInitialized = true

      // Process queued events
      this.processQueue()
    }

    // Visitor ID management (long-lived, 1 year)
    getOrCreateVisitorId() {
      let visitorId = this.getCookie(STORAGE_KEYS.VISITOR_ID)
      if (!visitorId) {
        visitorId = this.generateUUID()
        this.setCookie(STORAGE_KEYS.VISITOR_ID, visitorId, COOKIE_EXPIRY_DAYS)
      }
      return visitorId
    }

    // Session ID management (30 min timeout)
    getOrCreateSessionId() {
      const existingSessionId = this.getCookie(STORAGE_KEYS.SESSION_ID)
      const sessionStart = parseInt(
        this.getCookie(STORAGE_KEYS.SESSION_START) || '0',
      )
      const now = Date.now()

      // Check if session is still valid
      if (
        existingSessionId &&
        sessionStart &&
        now - sessionStart < SESSION_TIMEOUT
      ) {
        this.sessionStart = sessionStart
        return existingSessionId
      }

      // Create new session
      const newSessionId = this.generateUUID()
      this.sessionStart = now
      this.setCookie(
        STORAGE_KEYS.SESSION_ID,
        newSessionId,
        SESSION_COOKIE_EXPIRY_DAYS,
      )
      this.setCookie(
        STORAGE_KEYS.SESSION_START,
        String(now),
        SESSION_COOKIE_EXPIRY_DAYS,
      )
      return newSessionId
    }

    // Capture attribution data from URL and referrer
    captureAttribution() {
      // Track initial page view with attribution data
      // This will create the session if it doesn't exist
      // Only send once per page load
      if (!this.initialPageViewSent) {
        this.initialPageViewSent = true
        this.trackPageView(window.location.href, true)
      }
    }

    // Track page view
    // isInitialPage: true for the first pageview (includes attribution data)
    async trackPageView(url = window.location.href, isInitialPage = false) {
      if (!this.isInitialized) {
        this.queue.push({ type: 'pageview', url, isInitialPage })
        return
      }

      try {
        const body = {
          apiKey: this.apiKey,
          visitorId: this.visitorId,
          sessionId: this.sessionId,
          url,
        }

        // Include attribution data for initial pageview or when URL changes
        if (isInitialPage) {
          body.touchPoint = {
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

          // Include device/browser info for initial pageview
          body.userAgent = navigator.userAgent
          body.screenResolution = `${screen.width}x${screen.height}`
          body.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        }

        await fetch(`${this.apiUrl}/trackPageView`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
      } catch (error) {
        console.error('Leadalytics: Error tracking page view', error)
      }
    }

    // Track custom event
    async trackEvent(eventName, metadata = {}) {
      if (!this.isInitialized) {
        this.queue.push({ type: 'event', eventName, metadata })
        return
      }

      try {
        await fetch(`${this.apiUrl}/trackEvent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: this.apiKey,
            sessionId: this.sessionId,
            eventName,
            metadata,
          }),
        })
      } catch (error) {
        console.error('Leadalytics: Error tracking event', error)
      }
    }

    // Track conversion
    async trackConversion(eventName, options = {}) {
      if (!this.isInitialized) {
        this.queue.push({ type: 'conversion', eventName, options })
        return
      }

      try {
        await fetch(`${this.apiUrl}/trackConversion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: this.apiKey,
            sessionId: this.sessionId,
            eventName,
            revenue: options.revenue,
            metadata: options.metadata,
          }),
        })
      } catch (error) {
        console.error('Leadalytics: Error tracking conversion', error)
      }
    }

    // Set up event listeners
    setupListeners() {
      // Track route changes for SPAs
      const originalPushState = history.pushState
      const originalReplaceState = history.replaceState
      const self = this

      history.pushState = function () {
        originalPushState.apply(this, arguments)
        self.trackPageView(window.location.href)
      }

      history.replaceState = function () {
        originalReplaceState.apply(this, arguments)
        self.trackPageView(window.location.href)
      }

      window.addEventListener('popstate', () => {
        self.trackPageView(window.location.href)
      })

      // Update session timestamp on activity
      const updateSession = () => {
        const now = Date.now()
        this.setCookie(
          STORAGE_KEYS.SESSION_START,
          String(now),
          SESSION_COOKIE_EXPIRY_DAYS,
        )
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

    // Set up iframe listener for cross-domain tracking
    setupIframeListener() {
      window.addEventListener('message', (event) => {
        // Validate message format
        if (!event.data || typeof event.data !== 'object') return

        const { type, leadalytics } = event.data
        if (!leadalytics) return // Not a leadalytics message

        switch (type) {
          case 'REQUEST_SESSION':
            // Iframe is requesting session data
            event.source.postMessage(
              {
                type: 'SESSION_DATA',
                leadalytics: true,
                sessionId: this.sessionId,
                visitorId: this.visitorId,
                apiKey: this.apiKey,
                apiUrl: this.apiUrl,
              },
              event.origin,
            )
            break

          case 'CONVERSION':
            // Iframe is reporting a conversion
            this.trackConversion(event.data.eventName, {
              revenue: event.data.revenue,
              metadata: event.data.metadata,
            })
            break

          case 'EVENT':
            // Iframe is reporting a custom event
            this.trackEvent(event.data.eventName, event.data.metadata)
            break
        }
      })
    }

    // Process queued events
    processQueue() {
      while (this.queue.length > 0) {
        const item = this.queue.shift()
        switch (item.type) {
          case 'pageview':
            this.trackPageView(item.url, item.isInitialPage || false)
            break
          case 'event':
            this.trackEvent(item.eventName, item.metadata)
            break
          case 'conversion':
            this.trackConversion(item.eventName, item.options)
            break
        }
      }
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

    // Utility: Get cookie
    getCookie(name) {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop().split(';').shift()
      return null
    }

    // Utility: Set cookie
    setCookie(name, value, days) {
      const expires = new Date()
      expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
      document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`
    }

    // Public API: Get session info
    getSessionInfo() {
      return {
        visitorId: this.visitorId,
        sessionId: this.sessionId,
        sessionStart: this.sessionStart,
      }
    }
  }

  // Initialize tracker
  const tracker = new LeadalyticsTracker()

  // Expose global API
  window.Leadalytics = {
    trackEvent: (eventName, metadata) =>
      tracker.trackEvent(eventName, metadata),
    trackConversion: (eventName, options) =>
      tracker.trackConversion(eventName, options),
    trackPageView: (url) => tracker.trackPageView(url),
    getSessionInfo: () => tracker.getSessionInfo(),
  }

  // Also expose simplified conversion tracking
  window.trackConversion = window.Leadalytics.trackConversion
})()
