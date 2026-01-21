import {
  ChannelDefinition,
  SOURCE_DEFINITIONS,
  MEDIUM_DEFINITIONS,
} from './channelDefinitions'

export type TrafficCategory =
  | 'organic_search'
  | 'paid_search'
  | 'organic_social'
  | 'paid_social'
  | 'email'
  | 'referral'
  | 'display'
  | 'affiliate'
  | 'sms'
  | 'push'
  | 'shopping'
  | 'video'
  | 'direct'

export type ChannelResolution = {
  source: string
  category: TrafficCategory
  icon: string
  domain?: string
  medium?: string
}

type TouchPoint = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  fbclid?: string
  gclid?: string
  msclkid?: string
  ttclid?: string
  twclid?: string
  li_fat_id?: string
  ScCid?: string
  url: string
  referrer?: string
  timestamp: number
}

// Map PostHog channel types to our categories
function mapPostHogTypeToCategory(
  postHogType: string | null,
  isPaid: boolean,
): TrafficCategory {
  if (!postHogType) return 'direct'

  const type = postHogType.toLowerCase()

  // Handle paid vs organic
  if (type.includes('paid search') || (type === 'search' && isPaid)) {
    return 'paid_search'
  }
  if (type === 'search' || type.includes('organic search')) {
    return 'organic_search'
  }

  if (type.includes('paid social') || (type === 'social' && isPaid)) {
    return 'paid_social'
  }
  if (type === 'social' || type.includes('organic social')) {
    return 'organic_social'
  }

  if (type === 'email') return 'email'
  if (type === 'display') return 'display'
  if (type === 'affiliate') return 'affiliate'
  if (type === 'referral') return 'referral'
  if (type === 'push') return 'push'
  if (type === 'sms') return 'sms'
  if (type.includes('shopping')) return 'shopping'
  if (type.includes('video')) return 'video'
  if (type === 'audio') return 'direct' // Audio maps to direct for now

  return 'direct'
}

// Extract and normalize domain from URL
function extractDomain(url: string | undefined): string | null {
  if (!url) return null
  try {
    const urlObj = new URL(url)
    let hostname = urlObj.hostname.toLowerCase()
    // Remove www. prefix
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4)
    }
    return hostname
  } catch {
    // Try to extract domain from string if URL parsing fails
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/i)
    if (match) {
      return match[1].toLowerCase()
    }
    return null
  }
}

// Find channel definition for a domain
function findSourceDefinition(domain: string): ChannelDefinition | null {
  if (!domain) return null

  const normalized = domain.toLowerCase()

  // Try exact match first
  let def = SOURCE_DEFINITIONS.get(normalized)
  if (def) return def

  // Try subdomain matching (e.g., m.facebook.com -> facebook.com)
  const parts = normalized.split('.')
  if (parts.length > 2) {
    // Try removing first subdomain
    const withoutSubdomain = parts.slice(1).join('.')
    def = SOURCE_DEFINITIONS.get(withoutSubdomain)
    if (def) return def

    // Try removing multiple subdomains (e.g., m.mobile.facebook.com -> facebook.com)
    if (parts.length > 3) {
      const rootDomain = parts.slice(-2).join('.')
      def = SOURCE_DEFINITIONS.get(rootDomain)
      if (def) return def
    }
  }

  // Try app identifier matching (reverse domain notation)
  // e.g., com.facebook.katana -> check for com.facebook.katana and facebook.com
  if (normalized.includes('.')) {
    const reversed = normalized.split('.').reverse().join('.')
    def = SOURCE_DEFINITIONS.get(reversed)
    if (def) return def

    // Also try finding the app identifier directly
    def = SOURCE_DEFINITIONS.get(normalized)
    if (def && def[5] === true) {
      // is_app flag is true
      return def
    }
  }

  return null
}

// Find medium definition
function findMediumDefinition(medium: string): ChannelDefinition | null {
  if (!medium) return null
  return MEDIUM_DEFINITIONS.get(medium.toLowerCase()) || null
}

// Check if touchpoint has paid click IDs
function hasPaidClickId(touchPoint: TouchPoint): boolean {
  return !!(
    touchPoint.gclid ||
    touchPoint.msclkid ||
    touchPoint.fbclid ||
    touchPoint.ttclid ||
    touchPoint.twclid ||
    touchPoint.li_fat_id ||
    touchPoint.ScCid
  )
}

// Normalize source name for display
function normalizeSourceName(source: string): string {
  const normalized = source.toLowerCase()
  const nameMap: Record<string, string> = {
    'google.com': 'Google',
    google: 'Google',
    'bing.com': 'Bing',
    bing: 'Bing',
    'yahoo.com': 'Yahoo',
    yahoo: 'Yahoo',
    'duckduckgo.com': 'DuckDuckGo',
    duckduckgo: 'DuckDuckGo',
    'facebook.com': 'Facebook',
    facebook: 'Facebook',
    'instagram.com': 'Instagram',
    instagram: 'Instagram',
    'twitter.com': 'Twitter',
    twitter: 'Twitter',
    'x.com': 'X',
    x: 'X',
    'linkedin.com': 'LinkedIn',
    linkedin: 'LinkedIn',
    'tiktok.com': 'TikTok',
    tiktok: 'TikTok',
    'youtube.com': 'YouTube',
    youtube: 'YouTube',
  }

  // Handle app identifiers (e.g., com.facebook.katana -> Facebook)
  if (normalized.includes('.')) {
    const parts = normalized.split('.')
    // Try to find a recognizable app name
    for (const part of parts) {
      if (nameMap[part]) {
        return nameMap[part]
      }
    }
  }

  return nameMap[normalized] || source.charAt(0).toUpperCase() + source.slice(1)
}

// Get icon for source/category
function getIconForCategory(
  category: TrafficCategory,
  source?: string,
): string {
  const iconMap: Record<TrafficCategory, string> = {
    organic_search: 'Search',
    paid_search: 'Search',
    organic_social: 'Users',
    paid_social: 'Users',
    email: 'Mail',
    referral: 'ExternalLink',
    display: 'Monitor',
    affiliate: 'Link',
    sms: 'MessageCircle',
    push: 'MessageCircle',
    shopping: 'ExternalLink', // Using ExternalLink as ShoppingBag not available
    video: 'Video',
    direct: 'Globe',
  }

  // Override for specific sources
  if (source) {
    const normalized = source.toLowerCase()
    if (normalized.includes('linkedin')) return 'Briefcase'
    if (normalized.includes('youtube') || normalized.includes('tiktok'))
      return 'Video'
  }

  return iconMap[category] || 'ExternalLink'
}

// Main channel resolution function
export function resolveChannel(touchPoint: TouchPoint): ChannelResolution {
  const hasClickId = hasPaidClickId(touchPoint)
  const utmSource = touchPoint.utm_source?.toLowerCase() || ''
  const utmMedium = touchPoint.utm_medium?.toLowerCase() || ''
  const referrerDomain = extractDomain(touchPoint.referrer)

  // Priority 1: Click IDs (strongest paid indicator)
  if (touchPoint.gclid) {
    return {
      source: normalizeSourceName('Google'),
      category: 'paid_search',
      icon: getIconForCategory('paid_search', 'google'),
    }
  }

  if (touchPoint.msclkid) {
    return {
      source: normalizeSourceName('Bing'),
      category: 'paid_search',
      icon: getIconForCategory('paid_search', 'bing'),
    }
  }

  if (touchPoint.fbclid) {
    return {
      source: normalizeSourceName('Facebook'),
      category: 'paid_social',
      icon: getIconForCategory('paid_social', 'facebook'),
    }
  }

  if (touchPoint.ttclid) {
    return {
      source: normalizeSourceName('TikTok'),
      category: 'paid_social',
      icon: getIconForCategory('paid_social', 'tiktok'),
    }
  }

  if (touchPoint.twclid) {
    return {
      source: normalizeSourceName('Twitter'),
      category: 'paid_social',
      icon: getIconForCategory('paid_social', 'twitter'),
    }
  }

  if (touchPoint.li_fat_id) {
    return {
      source: normalizeSourceName('LinkedIn'),
      category: 'paid_social',
      icon: getIconForCategory('paid_social', 'linkedin'),
    }
  }

  // Priority 2: UTM Medium with channel definitions
  if (utmMedium) {
    const mediumDef = findMediumDefinition(utmMedium)
    if (mediumDef) {
      const [, , , typeIfPaid, typeIfOrganic] = mediumDef
      const channelType = hasClickId
        ? typeIfPaid || typeIfOrganic
        : typeIfOrganic || typeIfPaid

      const category = mapPostHogTypeToCategory(channelType, hasClickId)
      const source = normalizeSourceName(utmSource || mediumDef[0])

      return {
        source,
        category,
        icon: getIconForCategory(category, source),
        medium: utmMedium,
      }
    }
  }

  // Priority 3: Referrer domain lookup
  if (referrerDomain) {
    const sourceDef = findSourceDefinition(referrerDomain)
    if (sourceDef) {
      const [domain, , domainType, typeIfPaid, typeIfOrganic] = sourceDef
      const channelType = hasClickId
        ? typeIfPaid || typeIfOrganic || domainType
        : typeIfOrganic || typeIfPaid || domainType

      const category = mapPostHogTypeToCategory(channelType, hasClickId)
      const source = normalizeSourceName(domain)

      return {
        source,
        category,
        icon: getIconForCategory(category, source),
        domain: referrerDomain,
      }
    }
  }

  // Priority 4: UTM Source lookup (if no referrer)
  if (utmSource && !referrerDomain) {
    const sourceDef = findSourceDefinition(utmSource)
    if (sourceDef) {
      const [domain, , domainType, typeIfPaid, typeIfOrganic] = sourceDef
      const channelType = hasClickId
        ? typeIfPaid || typeIfOrganic || domainType
        : typeIfOrganic || typeIfPaid || domainType

      const category = mapPostHogTypeToCategory(channelType, hasClickId)
      const source = normalizeSourceName(domain)

      return {
        source,
        category,
        icon: getIconForCategory(category, source),
      }
    }
  }

  // Priority 5: UTM Medium fallback (common patterns not in definitions)
  if (utmMedium === 'email' || utmMedium === 'newsletter') {
    return {
      source: normalizeSourceName(utmSource || 'Email'),
      category: 'email',
      icon: getIconForCategory('email'),
      medium: utmMedium,
    }
  }

  if (utmMedium === 'cpc' || utmMedium === 'ppc') {
    if (utmSource === 'google' || utmSource === 'bing') {
      return {
        source: normalizeSourceName(utmSource),
        category: 'paid_search',
        icon: getIconForCategory('paid_search', utmSource),
      }
    }
    return {
      source: normalizeSourceName(utmSource || 'Display'),
      category: 'display',
      icon: getIconForCategory('display'),
    }
  }

  if (utmMedium === 'sms' || utmMedium === 'text') {
    return {
      source: normalizeSourceName(utmSource || 'SMS'),
      category: 'sms',
      icon: getIconForCategory('sms'),
      medium: utmMedium,
    }
  }

  // Priority 6: Fallback to direct
  return {
    source: 'Direct/None',
    category: 'direct',
    icon: getIconForCategory('direct'),
  }
}
