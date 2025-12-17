/**
 * High Country Health Iframe Tracker
 * Lightweight script for tracking conversions from within iframes
 */
(function () {
  'use strict'

  class HCHIframeTracker {
    constructor() {
      this.sessionData = null
      this.parentOrigin = '*' // Will be set when we receive session data
      this.requestSessionData()
    }

    // Request session data from parent
    requestSessionData() {
      if (window.parent === window) {
        console.warn(
          'HCH Iframe Tracker: Not running in an iframe context'
        )
        return
      }

      // Request session data from parent
      window.parent.postMessage(
        {
          type: 'REQUEST_SESSION',
          hch: true,
        },
        '*'
      )

      // Listen for response
      window.addEventListener('message', (event) => {
        if (!event.data || !event.data.hch) return

        if (event.data.type === 'SESSION_DATA') {
          this.sessionData = {
            sessionId: event.data.sessionId,
            visitorId: event.data.visitorId,
            apiKey: event.data.apiKey,
            apiUrl: event.data.apiUrl,
          }
          this.parentOrigin = event.origin
          console.log('HCH: Session data received from parent')
        }
      })
    }

    // Track conversion via parent
    trackConversion(eventName, options = {}) {
      if (!this.sessionData) {
        console.error(
          'HCH: Session data not available. Ensure parent page has HCH tracker installed.'
        )
        return
      }

      // Send to parent window
      window.parent.postMessage(
        {
          type: 'CONVERSION',
          hch: true,
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
          'HCH: Session data not available. Ensure parent page has HCH tracker installed.'
        )
        return
      }

      // Send to parent window
      window.parent.postMessage(
        {
          type: 'EVENT',
          hch: true,
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
          'HCH: Session data not available. Ensure parent page has HCH tracker installed.'
        )
        return
      }

      // Send to parent window
      window.parent.postMessage(
        {
          type: 'IDENTIFY',
          hch: true,
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
        console.error('HCH: Error tracking conversion directly', error)
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
        console.error('HCH: Error tracking event directly', error)
      }
    }

    // Direct API call for identify (backup method)
    async identifyDirect(options = {}) {
      if (!this.sessionData) return

      const { email, phone, userId } = options

      // Validate that at least one identifier is provided
      if (!email && !phone && !userId) {
        console.error(
          'HCH: identify() requires at least one of: email, phone, or userId'
        )
        return
      }

      try {
        await fetch(`${this.sessionData.apiUrl}/identifyContact`, {
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
        console.error('HCH: Error identifying contact directly', error)
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
  const iframeTracker = new HCHIframeTracker()

  // Expose global API
  window.HCH = {
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
  window.trackConversion = window.HCH.trackConversion
  window.identify = window.HCH.identify
})()
