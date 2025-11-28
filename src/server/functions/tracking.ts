import { createServerFn } from '@tanstack/react-start'

import { prisma } from '../db/client'
import {
  trackPageViewSchema,
  getSessionsSchema,
  getVisitorAnalyticsSchema,
  getCategoryAnalyticsSchema,
  getSessionDetailsSchema,
  getTopPagesSchema,
  getLast24HoursVisitorsSchema,
  getSessionPageViewsSchema,
  type AttributionData,
} from '../schemas/tracking'
import { resolveChannel } from '../lib/channel-resolver'

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
      ...data.metadata,
      timestamp: data.metadata.timestamp || now.getTime(),
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
        metadata: attribution as any,
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
      const metadata = latestEvent?.metadata as any

      return {
        ...session,
        eventsCount: session.events.length, // This will only be 1 with current query
        lastActivity:
          metadata?.timestamp ||
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
      const metadata = event.metadata as any
      const channel = resolveChannel(metadata)

      return {
        ...event,
        url: metadata.url,
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
      const metadata = event.metadata as any
      if (!metadata.url) continue

      try {
        const urlObj = new URL(metadata.url)
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
