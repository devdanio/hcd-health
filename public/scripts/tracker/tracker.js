;(function () {
  const API_ENDPOINT = 'https://app.highcountryhealth.com/api/event'
  const STORAGE_KEY = '_hch_uuid'
  const SESSION_KEY = '_hch_session_id'
  const FLUSH_INTERVAL = 5000
  const MAX_BATCH_SIZE = 20

  // ---------- Utilities ----------

  function uuid() {
    return crypto.randomUUID()
  }

  function now() {
    return new Date().toISOString()
  }

  function getOrCreate(key) {
    let value = localStorage.getItem(key)
    if (!value) {
      value = uuid()
      localStorage.setItem(key, value)
    }
    return value
  }

  function getSessionId() {
    let sid = sessionStorage.getItem(SESSION_KEY)
    if (!sid) {
      sid = uuid()
      sessionStorage.setItem(SESSION_KEY, sid)
    }
    return sid
  }

  function getUTMs() {
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

  // ---------- State ----------

  const anonId = getOrCreate(STORAGE_KEY)
  const sessionId = getSessionId()
  const utms = getUTMs()
  const queue = []

  // ---------- Core Send Logic ----------

  function send(events) {
    if (!events.length) return

    navigator.sendBeacon(
      API_ENDPOINT,
      JSON.stringify({
        anonymous_id: anonId,
        session_id: sessionId,
        events,
      }),
    )
  }

  function flush() {
    if (!queue.length) return
    const batch = queue.splice(0, MAX_BATCH_SIZE)
    send(batch)
  }

  setInterval(flush, FLUSH_INTERVAL)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })

  // ---------- Public API ----------

  function track(type, metadata = {}) {
    queue.push({
      type,
      timestamp: now(),
      metadata: {
        ...utms,
        ...metadata,
        url: window.location.href,
        referrer: document.referrer || null,
      },
    })

    if (queue.length >= MAX_BATCH_SIZE) {
      flush()
    }
  }

  // ---------- Default Events ----------

  // Track landing page only (not every SPA route)
  track('page_view', {
    path: window.location.pathname,
  })

  // ---------- Expose API ----------

  w.__HCH = {
    track,

    identify(identity) {
      // identity = { email, phone }
      track('identify', {
        email: identity.email || null,
        phone: identity.phone || null,
      })
    },
  }
})()
