/**
 * High Country Health Identity Tracker
 *
 * Purpose: Ensure every visitor has an hch_uuid (Contact.id)
 *
 * What it does:
 * - Creates/validates hch_uuid
 * - Stores in cookies + localStorage
 * - Identifies user in PostHog with hch_uuid
 * - Exposes window.HCH.getUuid() for GHL iframe usage
 *
 * What it DOESN'T do:
 * - Event tracking (PostHog does this)
 * - Page view tracking (PostHog does this)
 * - Session tracking (PostHog does this)
 * - Analytics (PostHog does this)
 */

interface TrackerConfig {
  apiKey: string
  apiUrl?: string
}

const STORAGE_KEY = 'hch_uuid'
const COOKIE_EXPIRY_DAYS = 365

class HCHTracker {
  private apiKey: string
  private apiUrl: string
  private hchUuid: string | null = null
  private initialized = false

  constructor(config: TrackerConfig) {
    this.apiKey = config.apiKey
    this.apiUrl = config.apiUrl || window.location.origin
    this.init()
  }

  /**
   * Initialize tracker - create/validate hch_uuid and identify in PostHog
   */
  async init() {
    if (this.initialized) return

    try {
      // Get or create hch_uuid
      this.hchUuid = await this.getOrCreateHchUuid()

      // Identify in PostHog
      this.identifyInPostHog()

      // Expose globally for GHL iframe usage
      this.exposeGlobally()

      this.initialized = true
      console.log('[HCH] Initialized with uuid:', this.hchUuid)
    } catch (error) {
      console.error('[HCH] Initialization failed:', error)
    }
  }

  /**
   * Get or create hch_uuid (Contact.id)
   */
  private async getOrCreateHchUuid(): Promise<string> {
    // Check cookies AND localStorage
    let hchUuid =
      this.getCookie(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY)

    if (hchUuid) {
      // Validate with server
      const isValid = await this.validateHchUuid(hchUuid)
      if (isValid) {
        return hchUuid
      }
      console.warn('[HCH] Existing uuid invalid, creating new one')
    }

    // Create new contact
    const { contactId } = await this.createContact()

    // Store in BOTH cookies and localStorage
    this.setCookie(STORAGE_KEY, contactId, COOKIE_EXPIRY_DAYS)
    localStorage.setItem(STORAGE_KEY, contactId)

    return contactId
  }

  /**
   * Validate hch_uuid with server
   */
  private async validateHchUuid(hchUuid: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/api/validate-hch-uuid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: this.apiKey,
          hchUuid,
        }),
      })

      if (!response.ok) return false

      const { valid } = await response.json()
      return valid
    } catch (error) {
      console.error('[HCH] Validation failed:', error)
      return false
    }
  }

  /**
   * Create new contact (returns contact.id)
   */
  private async createContact(): Promise<{ contactId: string }> {
    const response = await fetch(`${this.apiUrl}/api/create-contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.apiKey }),
    })

    if (!response.ok) {
      throw new Error('Failed to create contact')
    }

    return await response.json()
  }

  /**
   * Identify user in PostHog with hch_uuid
   */
  private identifyInPostHog() {
    if (
      typeof window !== 'undefined' &&
      (window as any).posthog &&
      this.hchUuid
    ) {
      try {
        ;(window as any).posthog.identify(this.hchUuid, {
          hch_uuid: this.hchUuid,
        })
        console.log('[HCH] PostHog identified with uuid:', this.hchUuid)
      } catch (error) {
        console.error('[HCH] PostHog identify failed:', error)
      }
    }
  }

  /**
   * Expose globally for GHL iframe usage
   */
  private exposeGlobally() {
    if (typeof window !== 'undefined') {
      ;(window as any).HCH = {
        getUuid: () => this.hchUuid,
        tracker: this,
      }
    }
  }

  /**
   * Cookie utilities
   */
  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null

    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null
    }
    return null
  }

  private setCookie(name: string, value: string, days: number) {
    if (typeof document === 'undefined') return

    const expires = new Date()
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`
  }

  /**
   * Public API: Get current hch_uuid
   */
  getUuid(): string | null {
    return this.hchUuid
  }
}

// Auto-initialize if config is available
if (typeof window !== 'undefined' && (window as any).HCH_CONFIG) {
  const tracker = new HCHTracker((window as any).HCH_CONFIG)
  ;(window as any).hchTracker = tracker
}

export default HCHTracker
