/**
 * Leadalytics Iframe Tracker
 * Lightweight script for tracking conversions from within iframes
 */
(function () {
  'use strict'

  class LeadalyticsIframeTracker {
    constructor() {
      this.sessionData = null
      this.parentOrigin = '*' // Will be set when we receive session data
      this.requestSessionData()
    }

    // Request session data from parent
    requestSessionData() {
      if (window.parent === window) {
        console.warn(
          'Leadalytics Iframe Tracker: Not running in an iframe context'
        )
        return
      }

      // Request session data from parent
      window.parent.postMessage(
        {
          type: 'REQUEST_SESSION',
          leadalytics: true,
        },
        '*'
      )

      // Listen for response
      window.addEventListener('message', (event) => {
        if (!event.data || !event.data.leadalytics) return

        if (event.data.type === 'SESSION_DATA') {
          this.sessionData = {
            sessionId: event.data.sessionId,
            visitorId: event.data.visitorId,
            apiKey: event.data.apiKey,
            apiUrl: event.data.apiUrl,
          }
          this.parentOrigin = event.origin
          console.log('Leadalytics: Session data received from parent')
        }
      })
    }

    // Track conversion via parent
    trackConversion(eventName, options = {}) {
      if (!this.sessionData) {
        console.error(
          'Leadalytics: Session data not available. Ensure parent page has Leadalytics tracker installed.'
        )
        return
      }

      // Send to parent window
      window.parent.postMessage(
        {
          type: 'CONVERSION',
          leadalytics: true,
          eventName,
          revenue: options.revenue,
          metadata: options.metadata,
        },
        this.parentOrigin
      )

      // Also send directly to API (redundancy)
      this.trackConversionDirect(eventName, options)
    }

    // Track event via parent
    trackEvent(eventName, metadata = {}) {
      if (!this.sessionData) {
        console.error(
          'Leadalytics: Session data not available. Ensure parent page has Leadalytics tracker installed.'
        )
        return
      }

      // Send to parent window
      window.parent.postMessage(
        {
          type: 'EVENT',
          leadalytics: true,
          eventName,
          metadata,
        },
        this.parentOrigin
      )

      // Also send directly to API (redundancy)
      this.trackEventDirect(eventName, metadata)
    }

    // Identify visitor via parent
    identify(options = {}) {
      if (!this.sessionData) {
        console.error(
          'Leadalytics: Session data not available. Ensure parent page has Leadalytics tracker installed.'
        )
        return
      }

      // Send to parent window
      window.parent.postMessage(
        {
          type: 'IDENTIFY',
          leadalytics: true,
          email: options.email,
          phone: options.phone,
          userId: options.userId,
        },
        this.parentOrigin
      )

      // Also send directly to API (redundancy)
      this.identifyDirect(options)
    }

    // Direct API call for conversion (backup method)
    async trackConversionDirect(eventName, options = {}) {
      if (!this.sessionData) return

      try {
        await fetch(`${this.sessionData.apiUrl}/trackConversion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: this.sessionData.apiKey,
            sessionId: this.sessionData.sessionId,
            eventName,
            revenue: options.revenue,
            metadata: options.metadata,
          }),
        })
      } catch (error) {
        console.error('Leadalytics: Error tracking conversion directly', error)
      }
    }

    // Direct API call for event (backup method)
    async trackEventDirect(eventName, metadata = {}) {
      if (!this.sessionData) return

      try {
        await fetch(`${this.sessionData.apiUrl}/trackEvent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: this.sessionData.apiKey,
            sessionId: this.sessionData.sessionId,
            eventName,
            metadata,
          }),
        })
      } catch (error) {
        console.error('Leadalytics: Error tracking event directly', error)
      }
    }

    // Direct API call for identify (backup method)
    async identifyDirect(options = {}) {
      if (!this.sessionData) return

      const { email, phone, userId } = options

      // Validate that at least one identifier is provided
      if (!email && !phone && !userId) {
        console.error(
          'Leadalytics: identify() requires at least one of: email, phone, or userId'
        )
        return
      }

      try {
        await fetch(`${this.sessionData.apiUrl}/identifyVisitor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: this.sessionData.apiKey,
            visitorId: this.sessionData.visitorId,
            email,
            phone,
            userId,
          }),
        })
      } catch (error) {
        console.error('Leadalytics: Error identifying visitor directly', error)
      }
    }

    // Get session info
    getSessionInfo() {
      return this.sessionData
    }

    // Check if session data is ready
    isReady() {
      return this.sessionData !== null
    }

    // Wait for session data to be ready
    async waitForReady(timeout = 5000) {
      const startTime = Date.now()
      while (!this.isReady() && Date.now() - startTime < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return this.isReady()
    }
  }

  // Initialize iframe tracker
  const iframeTracker = new LeadalyticsIframeTracker()

  // Expose global API
  window.Leadalytics = {
    trackEvent: (eventName, metadata) =>
      iframeTracker.trackEvent(eventName, metadata),
    trackConversion: (eventName, options) =>
      iframeTracker.trackConversion(eventName, options),
    identify: (options) => iframeTracker.identify(options),
    getSessionInfo: () => iframeTracker.getSessionInfo(),
    isReady: () => iframeTracker.isReady(),
    waitForReady: (timeout) => iframeTracker.waitForReady(timeout),
  }

  // Also expose simplified methods
  window.trackConversion = window.Leadalytics.trackConversion
  window.identify = window.Leadalytics.identify
})()
