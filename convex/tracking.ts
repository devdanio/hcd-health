import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { resolveChannel, type TrafficCategory } from './channelResolver'

// Metadata schema validator for pageview events
const metadataValidator = v.object({
  utm_source: v.optional(v.string()),
  utm_medium: v.optional(v.string()),
  utm_campaign: v.optional(v.string()),
  utm_content: v.optional(v.string()),
  utm_term: v.optional(v.string()),
  fbclid: v.optional(v.string()),
  gclid: v.optional(v.string()),
  msclkid: v.optional(v.string()),
  ttclid: v.optional(v.string()),
  twclid: v.optional(v.string()),
  li_fat_id: v.optional(v.string()),
  ScCid: v.optional(v.string()),
  url: v.string(),
  referrer: v.optional(v.string()),
  timestamp: v.optional(v.number()),
})

/**
 * Track a page view event
 * Creates contact and session if they don't exist
 */
export const trackPageView = mutation({
  args: {
    apiKey: v.string(),
    visitorId: v.string(), // Browser-generated visitor ID
    sessionId: v.string(), // Browser-generated session ID
    metadata: metadataValidator,
    userAgent: v.optional(v.string()),
    screenResolution: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Authenticate company
    const company = await ctx.db
      .query('companies')
      .withIndex('apiKey', (q) => q.eq('apiKey', args.apiKey))
      .first()

    if (!company) {
      throw new Error('Invalid API key')
    }

    const now = Date.now()

    // Get or create contact
    let contact = await ctx.db
      .query('contacts')
      .withIndex('companyId', (q) => q.eq('companyId', company._id))
      .filter((q) => q.eq(q.field('email'), args.visitorId)) // TODO: Need better way to find contact
      .first()

    if (!contact) {
      const contactId = await ctx.db.insert('contacts', {
        companyId: company._id,
      })
      contact = await ctx.db.get(contactId)
      if (!contact) {
        throw new Error('Failed to create contact')
      }
    }

    // Use metadata as attribution data, ensuring timestamp is present
    const attribution = {
      ...args.metadata,
      timestamp: args.metadata.timestamp || now,
    }

    // Get or create session by browserSessionId
    let session = await ctx.db
      .query('sessions')
      .withIndex('companyId', (q) => q.eq('companyId', company._id))
      .filter((q) => q.eq(q.field('browserSessionId'), args.sessionId))
      .first()

    let isNewSession = false

    if (!session) {
      // Create new session
      isNewSession = true
      const sessionDbId = await ctx.db.insert('sessions', {
        browserSessionId: args.sessionId,
        companyId: company._id,
        contactId: contact._id,
        userAgent: args.userAgent,
        screenResolution: args.screenResolution,
        timezone: args.timezone,
        events: [], // Will be updated when we add the event
        firstSessionAttribution: attribution,
        lastSessionAttribution: attribution,
      })

      session = await ctx.db.get(sessionDbId)
      if (!session) {
        throw new Error('Failed to create session')
      }
    }

    // Create the pageview event
    const eventId = await ctx.db.insert('events', {
      companyId: company._id,
      contactId: contact._id,
      sessionId: session._id,
      type: 'pageview',
      metadata: attribution,
    })

    // Update session: add event to events array and update lastSessionAttribution
    await ctx.db.patch(session._id, {
      events: [...session.events, eventId],
      lastSessionAttribution: attribution,
    })

    return {
      eventId,
      sessionId: session._id,
      contactId: contact._id,
      isNewSession,
    }
  },
})

/**
 * Get sessions for a company
 */
export const getSessions = query({
  args: {
    companyId: v.id('companies'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('companyId', (q) => q.eq('companyId', args.companyId))
      .order('desc')
      .take(limit)

    // Enrich sessions with contact identity data and event count
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        const contact = await ctx.db.get(session.contactId)

        // Get the latest event for this session to determine last activity
        const latestEvent = await ctx.db
          .query('events')
          .withIndex('sessionId', (q) => q.eq('sessionId', session._id))
          .order('desc')
          .first()

        return {
          ...session,
          contact: contact
            ? {
                email: contact.email,
                phone: contact.phone,
                fullName: contact.fullName,
                firstName: contact.firstName,
                lastName: contact.lastName,
              }
            : null,
          eventsCount: session.events.length,
          lastActivity: latestEvent?.metadata?.timestamp || session.lastSessionAttribution?.timestamp || session._creationTime,
        }
      }),
    )

    return enrichedSessions
  },
})

/**
 * Get session page views by session ID
 */
export const getSessionPageViews = query({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      return []
    }

    const events = await ctx.db
      .query('events')
      .withIndex('sessionId', (q) => q.eq('sessionId', args.sessionId))
      .filter((q) => q.eq(q.field('type'), 'pageview'))
      .collect()

    // Sort by creation time
    const sortedEvents = events.sort((a, b) => a._creationTime - b._creationTime)

    // Enrich with channel information from metadata
    const enrichedEvents = sortedEvents.map((event) => {
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

    return enrichedEvents
  },
})

/**
 * Get visitor analytics grouped by time period
 */
export const getVisitorAnalytics = query({
  args: {
    companyId: v.id('companies'),
    timeRange: v.union(
      v.literal('24h'),
      v.literal('7d'),
      v.literal('30d'),
      v.literal('90d'),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    let startTime = now

    // Calculate start time based on range
    switch (args.timeRange) {
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000
        break
      case '7d':
        startTime = now - 7 * 24 * 60 * 60 * 1000
        break
      case '30d':
        startTime = now - 30 * 24 * 60 * 60 * 1000
        break
      case '90d':
        startTime = now - 90 * 24 * 60 * 60 * 1000
        break
    }

    // Get all sessions within the time range
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('companyId', (q) => q.eq('companyId', args.companyId))
      .filter((q) => q.gte(q.field('firstSessionAttribution.timestamp'), startTime))
      .collect()

    // Group sessions by time bucket and category
    const dataMap = new Map<string, Map<string, Set<string>>>()

    // Determine bucket format based on time range
    let bucketFormat: (timestamp: number) => string

    if (args.timeRange === '24h') {
      // Hourly buckets for 24h view
      bucketFormat = (timestamp: number) => {
        const date = new Date(timestamp)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`
      }
    } else {
      // Daily buckets for other views
      bucketFormat = (timestamp: number) => {
        const date = new Date(timestamp)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      }
    }

    // Process each session
    for (const session of sessions) {
      // Get the first session attribution to determine traffic source
      const channel = resolveChannel(session.firstSessionAttribution)
      const category = channel.category

      // Only include specified categories
      if (
        category !== 'organic_search' &&
        category !== 'paid_search' &&
        category !== 'organic_social' &&
        category !== 'email' &&
        category !== 'direct'
      ) {
        continue
      }

      // Determine time bucket
      const bucketKey = bucketFormat(session.firstSessionAttribution.timestamp)

      // Initialize maps if needed
      if (!dataMap.has(bucketKey)) {
        dataMap.set(bucketKey, new Map())
      }
      const categoryMap = dataMap.get(bucketKey)!

      if (!categoryMap.has(category)) {
        categoryMap.set(category, new Set())
      }

      // Add unique contact to this bucket/category
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
  },
})

/**
 * Get traffic sources grouped by category over time
 */
export const getCategoryAnalytics = query({
  args: {
    companyId: v.id('companies'),
    timeRange: v.optional(
      v.union(
        v.literal('24h'),
        v.literal('7d'),
        v.literal('30d'),
        v.literal('90d'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const timeRange = args.timeRange || '30d'
    let startTime = now

    // Calculate start time based on range
    switch (timeRange) {
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000
        break
      case '7d':
        startTime = now - 7 * 24 * 60 * 60 * 1000
        break
      case '30d':
        startTime = now - 30 * 24 * 60 * 60 * 1000
        break
      case '90d':
        startTime = now - 90 * 24 * 60 * 60 * 1000
        break
    }

    // Get all sessions within the time range
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('companyId', (q) => q.eq('companyId', args.companyId))
      .filter((q) => q.gte(q.field('firstSessionAttribution.timestamp'), startTime))
      .collect()

    // Group sessions by granular category
    const categoryMap = new Map<string, number>()

    // Process each session
    for (const session of sessions) {
      const channel = resolveChannel(session.firstSessionAttribution)
      let label = 'Other'

      if (channel.source === 'Google') {
        label = channel.category === 'paid_search' ? 'Paid Google' : 'Organic Google'
      } else if (channel.source === 'Facebook') {
        label = channel.category === 'paid_social' ? 'Paid Facebook' : 'Organic Facebook'
      } else if (channel.category === 'email') {
        label = 'Email'
      } else if (channel.category === 'direct') {
        label = 'Direct'
      } else {
        // Fallback for other sources
        label = channel.source || 'Other'
      }

      categoryMap.set(label, (categoryMap.get(label) || 0) + 1)
    }

    // Convert to array format
    const result = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      sessions: count,
    }))

    return result
  },
})

/**
 * Get session details with all events
 */
export const getSessionDetails = query({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      return null
    }

    const events = await ctx.db
      .query('events')
      .withIndex('sessionId', (q) => q.eq('sessionId', args.sessionId))
      .collect()

    // Get only pageviews
    const pageviews = events.filter((e) => e.type === 'pageview')

    return {
      ...session,
      events,
      pageviews,
    }
  },
})
