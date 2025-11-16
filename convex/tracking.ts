import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { resolveChannel, type TrafficCategory } from './channelResolver'

// Attribution schema validator for mutations (matches schema.ts)
const attributionValidator = v.object({
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
  timestamp: v.number(),
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
    url: v.string(),
    touchPoint: v.optional(attributionValidator),
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

    // Prepare attribution data
    const attribution = args.touchPoint || {
      url: args.url,
      referrer: undefined,
      timestamp: now,
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
 * Track a custom event
 */
export const trackEvent = mutation({
  args: {
    apiKey: v.string(),
    sessionId: v.string(), // Browser-generated session ID
    eventName: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db
      .query('companies')
      .withIndex('apiKey', (q) => q.eq('apiKey', args.apiKey))
      .first()

    if (!company) {
      throw new Error('Invalid API key')
    }

    // Find session by browserSessionId
    const session = await ctx.db
      .query('sessions')
      .withIndex('companyId', (q) => q.eq('companyId', company._id))
      .filter((q) => q.eq(q.field('browserSessionId'), args.sessionId))
      .first()

    if (!session) {
      throw new Error('Session not found')
    }

    // Create custom event with metadata including event name
    const eventMetadata = {
      eventName: args.eventName,
      ...args.metadata,
    }

    const eventId = await ctx.db.insert('events', {
      companyId: company._id,
      contactId: session.contactId,
      sessionId: session._id,
      type: 'custom_event',
      metadata: eventMetadata,
    })

    // Add event to session's events array
    await ctx.db.patch(session._id, {
      events: [...session.events, eventId],
    })

    return { eventId }
  },
})

/**
 * Track a conversion event
 */
export const trackConversion = mutation({
  args: {
    apiKey: v.string(),
    sessionId: v.string(), // Browser-generated session ID
    eventName: v.string(),
    revenue: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db
      .query('companies')
      .withIndex('apiKey', (q) => q.eq('apiKey', args.apiKey))
      .first()

    if (!company) {
      throw new Error('Invalid API key')
    }

    // Find session by browserSessionId
    const session = await ctx.db
      .query('sessions')
      .withIndex('companyId', (q) => q.eq('companyId', company._id))
      .filter((q) => q.eq(q.field('browserSessionId'), args.sessionId))
      .first()

    if (!session) {
      throw new Error('Session not found')
    }

    // Create conversion event with metadata
    const eventMetadata = {
      eventName: args.eventName,
      revenue: args.revenue,
      ...args.metadata,
    }

    const eventId = await ctx.db.insert('events', {
      companyId: company._id,
      contactId: session.contactId,
      sessionId: session._id,
      type: 'custom_event',
      metadata: eventMetadata,
    })

    // Add event to session's events array
    await ctx.db.patch(session._id, {
      events: [...session.events, eventId],
    })

    return { eventId }
  },
})

/**
 * Identify a contact by email or phone number
 * Updates the contact record with the provided identification data
 */
export const identifyContact = mutation({
  args: {
    apiKey: v.string(),
    visitorId: v.string(), // Not used in new schema, but kept for API compatibility
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    userId: v.optional(v.string()),
    fullName: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
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

    // Validate that at least one identifier is provided
    if (!args.email && !args.phone && !args.userId) {
      throw new Error('At least one of email, phone, or userId must be provided')
    }

    // Try to find existing contact by email or phone
    let contact = null

    if (args.email) {
      contact = await ctx.db
        .query('contacts')
        .withIndex('companyId_email', (q) =>
          q.eq('companyId', company._id).eq('email', args.email),
        )
        .first()
    }

    if (!contact && args.phone) {
      contact = await ctx.db
        .query('contacts')
        .withIndex('companyId_phone', (q) =>
          q.eq('companyId', company._id).eq('phone', args.phone),
        )
        .first()
    }

    // If no existing contact found, create a new one
    if (!contact) {
      const contactId = await ctx.db.insert('contacts', {
        companyId: company._id,
        email: args.email,
        phone: args.phone,
        fullName: args.fullName,
        firstName: args.firstName,
        lastName: args.lastName,
      })
      contact = await ctx.db.get(contactId)
      if (!contact) {
        throw new Error('Failed to create contact')
      }
    } else {
      // Update existing contact with new information
      const updateData: {
        email?: string
        phone?: string
        fullName?: string
        firstName?: string
        lastName?: string
      } = {}

      if (args.email) updateData.email = args.email
      if (args.phone) updateData.phone = args.phone
      if (args.fullName) updateData.fullName = args.fullName
      if (args.firstName) updateData.firstName = args.firstName
      if (args.lastName) updateData.lastName = args.lastName

      await ctx.db.patch(contact._id, updateData)
    }

    return {
      contactId: contact._id,
      identified: true,
      email: contact.email,
      phone: contact.phone,
      fullName: contact.fullName,
      firstName: contact.firstName,
      lastName: contact.lastName,
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
          lastActivity: latestEvent?._creationTime || session._creationTime,
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
      .filter((q) => q.gte(q.field('_creationTime'), startTime))
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
      const bucketKey = bucketFormat(session._creationTime)

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
      .filter((q) => q.gte(q.field('_creationTime'), startTime))
      .collect()

    // Group sessions by category
    const categoryMap = new Map<TrafficCategory, number>()

    // Process each session
    for (const session of sessions) {
      const channel = resolveChannel(session.firstSessionAttribution)
      const category = channel.category

      categoryMap.set(category, (categoryMap.get(category) || 0) + 1)
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
 * Get conversions for a company
 * Conversions are tracked as custom_event type events
 */
export const getConversions = query({
  args: {
    companyId: v.id('companies'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100

    // Get custom events (which include conversions)
    const events = await ctx.db
      .query('events')
      .withIndex('companyId_type', (q) =>
        q.eq('companyId', args.companyId).eq('type', 'custom_event'),
      )
      .order('desc')
      .take(limit)

    // Enrich with session data for attribution
    const enrichedEvents = await Promise.all(
      events.map(async (event) => {
        const session = await ctx.db.get(event.sessionId)
        return {
          ...event,
          session: session
            ? {
                firstSessionAttribution: session.firstSessionAttribution,
                lastSessionAttribution: session.lastSessionAttribution,
                eventsCount: session.events.length,
              }
            : null,
        }
      }),
    )

    return enrichedEvents
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

    // Separate pageviews and conversions
    const pageviews = events.filter((e) => e.type === 'pageview')
    const conversions = events.filter((e) => e.type === 'custom_event')

    return {
      ...session,
      events,
      pageviews,
      conversions,
    }
  },
})
