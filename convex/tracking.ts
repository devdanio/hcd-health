import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { resolveChannel, type TrafficCategory } from './channelResolver'

// Touch point validator for mutations
const touchPointValidator = v.object({
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
 * Initialize or update a session with attribution data
 */
export const trackSession = mutation({
  args: {
    apiKey: v.string(),
    visitorId: v.string(),
    sessionId: v.string(),
    touchPoint: touchPointValidator,
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

    // Get or create visitor
    let visitor = await ctx.db
      .query('visitors')
      .withIndex('companyId_visitorId', (q) =>
        q.eq('companyId', company._id).eq('visitorId', args.visitorId),
      )
      .first()

    const now = Date.now()

    if (!visitor) {
      const newVisitorId = await ctx.db.insert('visitors', {
        companyId: company._id,
        visitorId: args.visitorId,
        firstSeen: now,
        lastSeen: now,
      })
      visitor = await ctx.db.get(newVisitorId)
      if (!visitor) {
        throw new Error('Failed to create visitor')
      }
    } else {
      await ctx.db.patch(visitor._id, {
        lastSeen: now,
      })
    }

    // Get or create session
    let session = await ctx.db
      .query('sessions')
      .withIndex('companyId_sessionId', (q) =>
        q.eq('companyId', company._id).eq('sessionId', args.sessionId),
      )
      .first()

    if (!session) {
      // New session - create with first touchpoint
      // Compute channel source for first touchpoint
      const firstChannel = resolveChannel(args.touchPoint)
      const firstSessionSource = `${firstChannel.source} (${firstChannel.category})`

      const sessionId = await ctx.db.insert('sessions', {
        companyId: company._id,
        visitorId: visitor._id,
        sessionId: args.sessionId,
        touchPoints: [args.touchPoint],
        startedAt: args.touchPoint.timestamp,
        pageViews: 0, // Will be incremented by trackPageView
        userAgent: args.userAgent,
        screenResolution: args.screenResolution,
        timezone: args.timezone,
        firstSessionSource,
        lastSessionSource: firstSessionSource, // First touchpoint is also the last initially
      })

      return { sessionId, visitorId: visitor._id, isNew: true }
    } else {
      // Existing session - add touchpoint if URL changed or has new attribution data
      const lastTouchPoint = session.touchPoints[session.touchPoints.length - 1]
      const shouldAddTouchPoint =
        lastTouchPoint.url !== args.touchPoint.url ||
        hasNewAttributionData(lastTouchPoint, args.touchPoint)

      if (shouldAddTouchPoint) {
        // Compute channel source for the new (last) touchpoint
        const lastChannel = resolveChannel(args.touchPoint)
        const lastSessionSource = `${lastChannel.source} (${lastChannel.category})`

        await ctx.db.patch(session._id, {
          touchPoints: [...session.touchPoints, args.touchPoint],
          // pageViews is now incremented by trackPageView, not here
          endedAt: args.touchPoint.timestamp,
          duration: Math.floor(
            (args.touchPoint.timestamp - session.startedAt) / 1000,
          ),
          lastSessionSource, // Update last session source
        })
      } else {
        // Just update session activity
        await ctx.db.patch(session._id, {
          endedAt: args.touchPoint.timestamp,
          duration: Math.floor(
            (args.touchPoint.timestamp - session.startedAt) / 1000,
          ),
        })
      }

      return { sessionId: session._id, visitorId: visitor._id, isNew: false }
    }
  },
})

/**
 * Track a page view event
 * Creates session if it doesn't exist (consolidates trackSession functionality)
 */
export const trackPageView = mutation({
  args: {
    apiKey: v.string(),
    visitorId: v.string(),
    sessionId: v.string(),
    url: v.string(),
    touchPoint: v.optional(touchPointValidator), // Only needed for first pageview or when attribution changes
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

    // Get or create visitor
    let visitor = await ctx.db
      .query('visitors')
      .withIndex('companyId_visitorId', (q) =>
        q.eq('companyId', company._id).eq('visitorId', args.visitorId),
      )
      .first()

    const now = Date.now()

    if (!visitor) {
      const newVisitorId = await ctx.db.insert('visitors', {
        companyId: company._id,
        visitorId: args.visitorId,
        firstSeen: now,
        lastSeen: now,
      })
      visitor = await ctx.db.get(newVisitorId)
      if (!visitor) {
        throw new Error('Failed to create visitor')
      }
    } else {
      await ctx.db.patch(visitor._id, {
        lastSeen: now,
      })
    }

    // Get or create session
    let session = await ctx.db
      .query('sessions')
      .withIndex('companyId_sessionId', (q) =>
        q.eq('companyId', company._id).eq('sessionId', args.sessionId),
      )
      .first()

    if (!session) {
      // Create new session with first touchpoint
      // If no touchpoint provided, create a minimal one from the URL
      const touchPoint = args.touchPoint || {
        url: args.url,
        timestamp: now,
      }

      // Compute channel source for first touchpoint
      const firstChannel = resolveChannel(touchPoint)
      const firstSessionSource = `${firstChannel.source} (${firstChannel.category})`

      const sessionId = await ctx.db.insert('sessions', {
        companyId: company._id,
        visitorId: visitor._id,
        sessionId: args.sessionId,
        touchPoints: [touchPoint],
        startedAt: touchPoint.timestamp,
        pageViews: 0, // Will be incremented after creating the event
        userAgent: args.userAgent,
        screenResolution: args.screenResolution,
        timezone: args.timezone,
        firstSessionSource,
        lastSessionSource: firstSessionSource, // First touchpoint is also the last initially
      })

      session = await ctx.db.get(sessionId)
      if (!session) {
        throw new Error('Failed to create session')
      }
    } else {
      // Existing session - update touchpoint if URL changed or has new attribution data
      if (args.touchPoint) {
        const lastTouchPoint = session.touchPoints[session.touchPoints.length - 1]
        const shouldAddTouchPoint =
          lastTouchPoint.url !== args.touchPoint.url ||
          hasNewAttributionData(lastTouchPoint, args.touchPoint)

        if (shouldAddTouchPoint) {
          // Compute channel source for the new (last) touchpoint
          const lastChannel = resolveChannel(args.touchPoint)
          const lastSessionSource = `${lastChannel.source} (${lastChannel.category})`

          await ctx.db.patch(session._id, {
            touchPoints: [...session.touchPoints, args.touchPoint],
            endedAt: args.touchPoint.timestamp,
            duration: Math.floor(
              (args.touchPoint.timestamp - session.startedAt) / 1000,
            ),
            lastSessionSource, // Update last session source
          })
        } else {
          // Just update session activity
          await ctx.db.patch(session._id, {
            endedAt: args.touchPoint.timestamp,
            duration: Math.floor(
              (args.touchPoint.timestamp - session.startedAt) / 1000,
            ),
          })
        }
      } else {
        // No touchpoint provided, just update session activity
        await ctx.db.patch(session._id, {
          endedAt: now,
          duration: Math.floor((now - session.startedAt) / 1000),
        })
      }
    }

    // Check if the most recent pageview has the same URL (prevent duplicate on refresh)
    const recentPageViews = await ctx.db
      .query('events')
      .withIndex('sessionId', (q) => q.eq('sessionId', session._id))
      .filter((q) => q.eq(q.field('type'), 'pageview'))
      .order('desc')
      .take(1)

    const mostRecentPageView = recentPageViews[0]
    const isDuplicate =
      mostRecentPageView &&
      mostRecentPageView.url === args.url &&
      // Only consider it a duplicate if it's within the last 5 seconds (refresh scenario)
      now - mostRecentPageView._creationTime < 5000

    let eventId = null

    if (!isDuplicate) {
      // Create the pageview event
      eventId = await ctx.db.insert('events', {
        companyId: company._id,
        visitorId: visitor._id,
        sessionId: session._id,
        type: 'pageview',
        url: args.url,
      })

      // Increment pageViews count
      await ctx.db.patch(session._id, {
        pageViews: session.pageViews + 1,
      })
    }

    // Always update session activity (endedAt and duration) even for duplicates
    await ctx.db.patch(session._id, {
      endedAt: now,
      duration: Math.floor((now - session.startedAt) / 1000),
    })

    return {
      eventId,
      sessionId: session._id,
      visitorId: visitor._id,
      isDuplicate: isDuplicate || false,
    }
  },
})

/**
 * Track a custom event
 */
export const trackEvent = mutation({
  args: {
    apiKey: v.string(),
    sessionId: v.string(),
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

    const session = await ctx.db
      .query('sessions')
      .withIndex('companyId_sessionId', (q) =>
        q.eq('companyId', company._id).eq('sessionId', args.sessionId),
      )
      .first()

    if (!session) {
      throw new Error('Session not found')
    }

    const eventId = await ctx.db.insert('events', {
      companyId: company._id,
      visitorId: session.visitorId,
      sessionId: session._id,
      type: 'event',
      name: args.eventName,
      metadata: args.metadata,
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
    sessionId: v.string(),
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

    const session = await ctx.db
      .query('sessions')
      .withIndex('companyId_sessionId', (q) =>
        q.eq('companyId', company._id).eq('sessionId', args.sessionId),
      )
      .first()

    if (!session) {
      throw new Error('Session not found')
    }

    // Create conversion event
    const eventId = await ctx.db.insert('events', {
      companyId: company._id,
      visitorId: session.visitorId,
      sessionId: session._id,
      type: 'conversion',
      name: args.eventName,
      metadata: args.metadata,
    })

    // Create conversion record
    const conversionId = await ctx.db.insert('conversions', {
      companyId: company._id,
      visitorId: session.visitorId,
      sessionId: session._id,
      eventId,
      eventName: args.eventName,
      revenue: args.revenue,
      metadata: args.metadata,
    })

    return { conversionId, eventId }
  },
})

/**
 * Identify a visitor by email or phone number
 * Updates the visitor record with the provided identification data
 */
export const identifyVisitor = mutation({
  args: {
    apiKey: v.string(),
    visitorId: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    userId: v.optional(v.string()),
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
    if (!args.email && !args.phone) {
      throw new Error('Either email or phone must be provided')
    }

    // Find the visitor by visitorId
    let visitor = await ctx.db
      .query('visitors')
      .withIndex('companyId_visitorId', (q) =>
        q.eq('companyId', company._id).eq('visitorId', args.visitorId),
      )
      .first()

    if (!visitor) {
      throw new Error('Visitor not found')
    }

    // Check if another visitor already has this email or phone
    let existingVisitorByEmail = null
    let existingVisitorByPhone = null

    if (args.email) {
      existingVisitorByEmail = await ctx.db
        .query('visitors')
        .withIndex('companyId_email', (q) =>
          q.eq('companyId', company._id).eq('email', args.email),
        )
        .first()
    }

    if (args.phone) {
      existingVisitorByPhone = await ctx.db
        .query('visitors')
        .withIndex('companyId_phone', (q) =>
          q.eq('companyId', company._id).eq('phone', args.phone),
        )
        .first()
    }

    // If we found existing visitors with the same email/phone but different visitorId,
    // we'll update the current visitor (in a production system, you might want to merge them)
    const updateData: {
      email?: string
      phone?: string
      userId?: string
    } = {}

    if (args.email) {
      // Only update if no other visitor has this email, or if it's the same visitor
      if (!existingVisitorByEmail || existingVisitorByEmail._id === visitor._id) {
        updateData.email = args.email
      } else {
        // Another visitor already has this email - we could merge here, but for now just update
        // In production, you might want to merge the visitors
        updateData.email = args.email
      }
    }

    if (args.phone) {
      // Only update if no other visitor has this phone, or if it's the same visitor
      if (!existingVisitorByPhone || existingVisitorByPhone._id === visitor._id) {
        updateData.phone = args.phone
      } else {
        // Another visitor already has this phone - we could merge here, but for now just update
        updateData.phone = args.phone
      }
    }

    if (args.userId) {
      updateData.userId = args.userId
    }

    // Update the visitor with identification data
    await ctx.db.patch(visitor._id, updateData)

    return {
      visitorId: visitor._id,
      identified: true,
      email: updateData.email || visitor.email,
      phone: updateData.phone || visitor.phone,
      userId: updateData.userId || visitor.userId,
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

    return sessions
  },
})

/**
 * Get visitor analytics grouped by time period and traffic source
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
      .filter((q) => q.gte(q.field('startedAt'), startTime))
      .collect()

    // Group sessions by time bucket and category
    const dataMap = new Map<string, Map<string, Set<string>>>()

    // Determine bucket size based on time range
    let bucketSize: number
    let bucketFormat: (timestamp: number) => string

    if (args.timeRange === '24h') {
      // Hourly buckets for 24h view
      bucketSize = 60 * 60 * 1000 // 1 hour
      bucketFormat = (timestamp: number) => {
        const date = new Date(timestamp)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`
      }
    } else {
      // Daily buckets for other views
      bucketSize = 24 * 60 * 60 * 1000 // 1 day
      bucketFormat = (timestamp: number) => {
        const date = new Date(timestamp)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      }
    }

    // Process each session
    for (const session of sessions) {
      // Get the first touchpoint to determine traffic source
      const firstTouchPoint = session.touchPoints[0]
      if (!firstTouchPoint) continue

      // Categorize the traffic source
      const channel = resolveChannel(firstTouchPoint)
      const category = channel.category

      // Only include the specified categories
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
      const bucketKey = bucketFormat(session.startedAt)

      // Initialize maps if needed
      if (!dataMap.has(bucketKey)) {
        dataMap.set(bucketKey, new Map())
      }
      const categoryMap = dataMap.get(bucketKey)!

      if (!categoryMap.has(category)) {
        categoryMap.set(category, new Set())
      }

      // Add unique visitor to this bucket/category
      categoryMap.get(category)!.add(session.visitorId)
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
 * Get conversions for a company
 */
export const getConversions = query({
  args: {
    companyId: v.id('companies'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100

    const conversions = await ctx.db
      .query('conversions')
      .withIndex('companyId', (q) => q.eq('companyId', args.companyId))
      .order('desc')
      .take(limit)

    // Enrich with session data for attribution
    const enrichedConversions = await Promise.all(
      conversions.map(async (conversion) => {
        const session = await ctx.db.get(conversion.sessionId)
        return {
          ...conversion,
          session: session
            ? {
                touchPoints: session.touchPoints,
                startedAt: session.startedAt,
                pageViews: session.pageViews,
              }
            : null,
        }
      }),
    )

    return enrichedConversions
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

    const conversions = await ctx.db
      .query('conversions')
      .withIndex('sessionId', (q) => q.eq('sessionId', args.sessionId))
      .collect()

    return {
      ...session,
      events,
      conversions,
    }
  },
})

/**
 * Get all pageview events for a session by Convex session ID
 * Includes channel information for each pageview
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

    const allEvents = await ctx.db
      .query('events')
      .withIndex('sessionId', (q) => q.eq('sessionId', args.sessionId))
      .collect()

    // Filter to only pageview events and sort by creation time
    const pageViews = allEvents
      .filter((event) => event.type === 'pageview')
      .sort((a, b) => a._creationTime - b._creationTime)

    // Enrich pageviews with channel information
    // Match each pageview to the most recent touchpoint before it
    const enrichedPageViews = pageViews.map((pageView) => {
      // Find the touchpoint that was active when this pageview occurred
      // Use the most recent touchpoint before or at the pageview time
      let matchingTouchPoint = session.touchPoints[0] // Default to first

      for (let i = session.touchPoints.length - 1; i >= 0; i--) {
        const touchPoint = session.touchPoints[i]
        if (touchPoint.timestamp <= pageView._creationTime) {
          matchingTouchPoint = touchPoint
          break
        }
      }

      // Resolve channel for this touchpoint
      const channel = resolveChannel(matchingTouchPoint)

      return {
        ...pageView,
        channel: {
          source: channel.source,
          category: channel.category,
          icon: channel.icon,
        },
      }
    })

    return enrichedPageViews
  },
})

/**
 * Get traffic sources grouped by source and category
 */
export const getTrafficSources = query({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('companyId', (q) => q.eq('companyId', args.companyId))
      .collect()

    // Map to track source + category combinations
    const sourceMap = new Map<
      string,
      { category: TrafficCategory; icon: string; count: number }
    >()

    // Process each session's first touchPoint
    for (const session of sessions) {
      if (session.touchPoints.length === 0) continue

      const firstTouchPoint = session.touchPoints[0]
      const categorized = categorizeTrafficSource(firstTouchPoint)

      // Create a unique key for source + category
      const key = `${categorized.source}|${categorized.category}`

      if (sourceMap.has(key)) {
        const existing = sourceMap.get(key)!
        existing.count += 1
      } else {
        sourceMap.set(key, {
          category: categorized.category,
          icon: categorized.icon,
          count: 1,
        })
      }
    }

    // Convert map to array and sort by count (descending)
    const results = Array.from(sourceMap.entries())
      .map(([key, value]) => {
        const [source] = key.split('|')
        return {
          source,
          category: value.category,
          icon: value.icon,
          sessionCount: value.count,
        }
      })
      .sort((a, b) => b.sessionCount - a.sessionCount)

    return results
  },
})

// Traffic source categorization types (imported from channelResolver)
type TrafficSourceInfo = {
  source: string
  category: TrafficCategory
  icon: string
}

// Main categorization function using PostHog-style channel definitions
function categorizeTrafficSource(touchPoint: any): TrafficSourceInfo {
  const resolution = resolveChannel(touchPoint)
  return {
    source: resolution.source,
    category: resolution.category,
    icon: resolution.icon,
  }
}

// Helper function to check if touchpoint has new attribution data
function hasNewAttributionData(
  oldTouchPoint: any,
  newTouchPoint: any,
): boolean {
  const attributionFields = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'fbclid',
    'gclid',
    'msclkid',
    'ttclid',
    'twclid',
    'li_fat_id',
    'ScCid',
  ]

  return attributionFields.some((field) => {
    const oldValue = oldTouchPoint[field]
    const newValue = newTouchPoint[field]
    return newValue && newValue !== oldValue
  })
}
