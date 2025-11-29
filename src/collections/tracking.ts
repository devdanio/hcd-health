import { createServerFn } from '@tanstack/react-start'
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import { resolveChannel } from '@/server/lib/channel-resolver'
import type { QueryClient } from '@tanstack/react-query'

// ============================================================================
// Schemas
// ============================================================================

// Attribution data schema
export const attributionSchema = z.object({
  // UTM parameters
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_content: z.string().optional(),
  utm_term: z.string().optional(),

  // Click IDs
  fbclid: z.string().optional(),
  gclid: z.string().optional(),
  msclkid: z.string().optional(),
  ttclid: z.string().optional(),
  twclid: z.string().optional(),
  li_fat_id: z.string().optional(),
  ScCid: z.string().optional(),

  // Page data
  url: z.string().url(),
  referrer: z.string().optional(),
  timestamp: z.number().optional(),
})

export type AttributionData = z.infer<typeof attributionSchema>

// Track page view schema
export const trackPageViewSchema = z.object({
  apiKey: z.string(),
  visitorId: z.string(),
  sessionId: z.string(),
  data: attributionSchema,
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  screenResolution: z.string().optional(),
  timezone: z.string().optional(),
})

// Get sessions schema
export const getSessionsSchema = z.object({
  companyId: z.string(),
  limit: z.number().optional(),
})

// Get session page views schema
export const getSessionPageViewsSchema = z.object({
  sessionId: z.string(),
})

// Get visitor analytics schema
export const getVisitorAnalyticsSchema = z.object({
  companyId: z.string(),
  timeRange: z.enum(['24h', '7d', '30d', '90d']),
})

// Get category analytics schema
export const getCategoryAnalyticsSchema = z.object({
  companyId: z.string(),
  timeRange: z.enum(['24h', '7d', '30d', '90d']).optional(),
})

// Get session details schema
export const getSessionDetailsSchema = z.object({
  sessionId: z.string(),
})

// Get top pages schema
export const getTopPagesSchema = z.object({
  companyId: z.string(),
  timeRange: z.enum(['24h', '7d', '30d', '90d']),
})

// Get last 24h visitors schema
export const getLast24HoursVisitorsSchema = z.object({
  companyId: z.string(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Track a page view event
 * Creates contact and session if they don't exist
 */
export const trackPageView = createServerFn({ method: 'POST' })
  .inputValidator(trackPageViewSchema)
  .handler(async ({ data }) => {
    // 1. Authenticate company by API key
    const company = await prisma.company.findUnique({
      where: { apiKey: data.apiKey },
    })

    if (!company) {
      throw new Error('Invalid API key')
    }

    const now = new Date()
    const attribution: AttributionData = {
      ...data.data,
      timestamp: data.data.timestamp || now.getTime(),
    }

    // 2. Get or create contact (simplified - TODO: better visitor ID logic)
    let contact = await prisma.contact.findFirst({
      where: { companyId: company.id },
    })

    if (!contact) {
      contact = await prisma.contact.create({
        data: { companyId: company.id },
      })
    }

    // 3. Get or create session by browserSessionId
    let session = await prisma.session.findUnique({
      where: { browserSessionId: data.sessionId },
    })

    let isNewSession = false

    if (!session) {
      // Create new session
      isNewSession = true
      session = await prisma.session.create({
        data: {
          browserSessionId: data.sessionId,
          companyId: company.id,
          contactId: contact.id,
          userAgent: data.userAgent,
          ipAddress: data.ipAddress,
          screenResolution: data.screenResolution,
          timezone: data.timezone,
          firstSessionAttribution: attribution as any,
          lastSessionAttribution: attribution as any,
        },
      })
    } else {
      // Update last session attribution
      await prisma.session.update({
        where: { id: session.id },
        data: {
          lastSessionAttribution: attribution as any,
          ipAddress: session.ipAddress || data.ipAddress,
        },
      })
    }

    // 4. Create pageview event
    const event = await prisma.event.create({
      data: {
        companyId: company.id,
        contactId: contact.id,
        sessionId: session.id,
        type: 'pageview',
        data: attribution as any,
      },
    })

    return {
      eventId: event.id,
      sessionId: session.id,
      contactId: contact.id,
      isNewSession,
    }
  })

/**
 * Get sessions for a company with contact enrichment
 */
export const getSessions = createServerFn({ method: 'GET' })
  .inputValidator(getSessionsSchema)
  .handler(async ({ data }) => {
    const limit = data.limit ?? 100

    const sessions = await prisma.session.findMany({
      where: { companyId: data.companyId },
      include: {
        contact: {
          select: {
            email: true,
            phone: true,
            fullName: true,
            firstName: true,
            lastName: true,
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // Transform to match Convex response format
    return sessions.map((session) => {
      const latestEvent = session.events[0]
      const data = latestEvent?.data as any

      return {
        ...session,
        eventsCount: session.events.length, // This will only be 1 with current query
        lastActivity:
          data?.timestamp ||
          (session.lastSessionAttribution as any)?.timestamp ||
          session.createdAt.getTime(),
      }
    })
  })

/**
 * Get visitor count for the last 24 hours
 */
export const getLast24HoursVisitors = createServerFn({ method: 'GET' })
  .inputValidator(getLast24HoursVisitorsSchema)
  .handler(async ({ data }) => {
    const startTime = new Date()
    startTime.setHours(startTime.getHours() - 24)

    const count = await prisma.session.count({
      where: {
        companyId: data.companyId,
        createdAt: {
          gte: startTime,
        },
      },
    })

    return count
  })

/**
 * Get session page views by session ID with channel info
 */
export const getSessionPageViews = createServerFn({ method: 'GET' })
  .inputValidator(getSessionPageViewsSchema)
  .handler(async ({ data }) => {
    const events = await prisma.event.findMany({
      where: {
        sessionId: data.sessionId,
        type: 'pageview',
      },
      orderBy: { createdAt: 'asc' },
    })

    // Enrich with channel information
    return events.map((event) => {
      const data = event.data as any
      const channel = resolveChannel(data)

      return {
        ...event,
        url: data.url,
        channel: {
          source: channel.source,
          category: channel.category,
        },
      }
    })
  })

/**
 * Get visitor analytics grouped by time period and category
 */
export const getVisitorAnalytics = createServerFn({ method: 'GET' })
  .inputValidator(getVisitorAnalyticsSchema)
  .handler(async ({ data }) => {
    const hours = { '24h': 24, '7d': 168, '30d': 720, '90d': 2160 }[
      data.timeRange
    ]
    const startTime = new Date()
    startTime.setHours(startTime.getHours() - hours)

    // Get all sessions within the time range
    const sessions = await prisma.session.findMany({
      where: {
        companyId: data.companyId,
        createdAt: { gte: startTime },
      },
    })

    // Group sessions by time bucket and category
    const dataMap = new Map<string, Map<string, Set<string>>>()

    // Determine bucket format
    const bucketFormat = (date: Date) => {
      if (data.timeRange === '24h') {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`
      }
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    // Process each session
    for (const session of sessions) {
      const attribution = session.firstSessionAttribution as any
      const channel = resolveChannel(attribution)
      const category = channel.category

      // Only include specific categories
      if (
        ![
          'organic_search',
          'paid_search',
          'organic_social',
          'email',
          'direct',
        ].includes(category)
      ) {
        continue
      }

      const bucketKey = bucketFormat(session.createdAt)

      if (!dataMap.has(bucketKey)) {
        dataMap.set(bucketKey, new Map())
      }
      const categoryMap = dataMap.get(bucketKey)!

      if (!categoryMap.has(category)) {
        categoryMap.set(category, new Set())
      }

      categoryMap.get(category)!.add(session.contactId)
    }

    // Convert to array format for charting
    const result = Array.from(dataMap.entries())
      .map(([date, categoryMap]) => {
        const entry: any = { date }
        for (const [category, visitorSet] of categoryMap.entries()) {
          entry[category] = visitorSet.size
        }
        // Fill in 0 for missing categories
        for (const cat of [
          'organic_search',
          'paid_search',
          'organic_social',
          'email',
          'direct',
        ]) {
          if (!(cat in entry)) {
            entry[cat] = 0
          }
        }
        return entry
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    return result
  })

/**
 * Get traffic sources grouped by category
 */
export const getCategoryAnalytics = createServerFn({ method: 'GET' })
  .inputValidator(getCategoryAnalyticsSchema)
  .handler(async ({ data }) => {
    const timeRange = data.timeRange || '30d'
    const hours = { '24h': 24, '7d': 168, '30d': 720, '90d': 2160 }[timeRange]
    const startTime = new Date()
    startTime.setHours(startTime.getHours() - hours)

    const sessions = await prisma.session.findMany({
      where: {
        companyId: data.companyId,
        createdAt: { gte: startTime },
      },
    })

    // Group sessions by granular category
    const categoryMap = new Map<string, number>()

    for (const session of sessions) {
      const attribution = session.firstSessionAttribution as any
      const channel = resolveChannel(attribution)
      let label = 'Other'

      if (channel.source === 'Google') {
        label =
          channel.category === 'paid_search' ? 'Paid Google' : 'Organic Google'
      } else if (channel.source === 'Facebook') {
        label =
          channel.category === 'paid_social'
            ? 'Paid Facebook'
            : 'Organic Facebook'
      } else if (channel.category === 'email') {
        label = 'Email'
      } else if (channel.category === 'direct') {
        label = 'Direct'
      } else {
        label = channel.source || 'Other'
      }

      categoryMap.set(label, (categoryMap.get(label) || 0) + 1)
    }

    return Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      sessions: count,
    }))
  })

/**
 * Get session details with all events
 */
export const getSessionDetails = createServerFn({ method: 'GET' })
  .inputValidator(getSessionDetailsSchema)
  .handler(async ({ data }) => {
    const session = await prisma.session.findUnique({
      where: { id: data.sessionId },
      include: {
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!session) {
      return null
    }

    const pageviews = session.events.filter((e) => e.type === 'pageview')

    return {
      ...session,
      events: session.events,
      pageviews,
    }
  })

/**
 * Get top 3 pages by session count
 */
export const getTopPages = createServerFn({ method: 'GET' })
  .inputValidator(getTopPagesSchema)
  .handler(async ({ data }) => {
    const hours = { '24h': 24, '7d': 168, '30d': 720, '90d': 2160 }[
      data.timeRange
    ]
    const startTime = new Date()
    startTime.setHours(startTime.getHours() - hours)

    const events = await prisma.event.findMany({
      where: {
        companyId: data.companyId,
        type: 'pageview',
        createdAt: { gte: startTime },
      },
    })

    // Aggregate sessions by pathname
    const pageMap = new Map<string, Set<string>>()

    for (const event of events) {
      const data = event.data as any
      if (!data.url) continue

      try {
        const urlObj = new URL(data.url)
        const pathname = urlObj.pathname

        if (!pageMap.has(pathname)) {
          pageMap.set(pathname, new Set())
        }
        pageMap.get(pathname)!.add(event.sessionId)
      } catch (e) {
        // Ignore invalid URLs
        continue
      }
    }

    // Convert to array and sort
    return Array.from(pageMap.entries())
      .map(([pathname, sessionSet]) => ({
        pathname,
        sessions: sessionSet.size,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 3)
  })

// ============================================================================
// Collection
// ============================================================================

export function createSessionsCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      id: 'sessions',
      queryKey: ['sessions'],
      queryFn: async (ctx) => {
        const companyId = ctx.meta?.companyId as string | undefined
        const limit = ctx.meta?.limit as number | undefined
        if (!companyId) return []
        return await getSessions({ data: { companyId, limit: limit || 500 } })
      },
      queryClient,
      getKey: (item) => item.id,
      // Read-only collection - no mutations
    }),
  )
}
