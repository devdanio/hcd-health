import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

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
    // Authenticate project
    const project = await ctx.db
      .query('projects')
      .withIndex('apiKey', (q) => q.eq('apiKey', args.apiKey))
      .first()

    if (!project) {
      throw new Error('Invalid API key')
    }

    // Get or create visitor
    let visitor = await ctx.db
      .query('visitors')
      .withIndex('projectId_visitorId', (q) =>
        q.eq('projectId', project._id).eq('visitorId', args.visitorId)
      )
      .first()

    const now = Date.now()

    if (!visitor) {
      const newVisitorId = await ctx.db.insert('visitors', {
        projectId: project._id,
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
      .withIndex('projectId_sessionId', (q) =>
        q.eq('projectId', project._id).eq('sessionId', args.sessionId)
      )
      .first()

    if (!session) {
      // New session - create with first touchpoint
      const sessionId = await ctx.db.insert('sessions', {
        projectId: project._id,
        visitorId: visitor._id,
        sessionId: args.sessionId,
        touchPoints: [args.touchPoint],
        startedAt: args.touchPoint.timestamp,
        pageViews: 1,
        userAgent: args.userAgent,
        screenResolution: args.screenResolution,
        timezone: args.timezone,
      })

      return { sessionId, visitorId: visitor._id, isNew: true }
    } else {
      // Existing session - add touchpoint if URL changed or has new attribution data
      const lastTouchPoint = session.touchPoints[session.touchPoints.length - 1]
      const shouldAddTouchPoint =
        lastTouchPoint.url !== args.touchPoint.url ||
        hasNewAttributionData(lastTouchPoint, args.touchPoint)

      if (shouldAddTouchPoint) {
        await ctx.db.patch(session._id, {
          touchPoints: [...session.touchPoints, args.touchPoint],
          pageViews: session.pageViews + 1,
          endedAt: args.touchPoint.timestamp,
          duration: Math.floor(
            (args.touchPoint.timestamp - session.startedAt) / 1000
          ),
        })
      } else {
        // Just update session activity
        await ctx.db.patch(session._id, {
          endedAt: args.touchPoint.timestamp,
          duration: Math.floor(
            (args.touchPoint.timestamp - session.startedAt) / 1000
          ),
        })
      }

      return { sessionId: session._id, visitorId: visitor._id, isNew: false }
    }
  },
})

/**
 * Track a page view event
 */
export const trackPageView = mutation({
  args: {
    apiKey: v.string(),
    sessionId: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query('projects')
      .withIndex('apiKey', (q) => q.eq('apiKey', args.apiKey))
      .first()

    if (!project) {
      throw new Error('Invalid API key')
    }

    const session = await ctx.db
      .query('sessions')
      .withIndex('projectId_sessionId', (q) =>
        q.eq('projectId', project._id).eq('sessionId', args.sessionId)
      )
      .first()

    if (!session) {
      throw new Error('Session not found')
    }

    const eventId = await ctx.db.insert('events', {
      projectId: project._id,
      visitorId: session.visitorId,
      sessionId: session._id,
      type: 'pageview',
      url: args.url,
    })

    return { eventId }
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
    const project = await ctx.db
      .query('projects')
      .withIndex('apiKey', (q) => q.eq('apiKey', args.apiKey))
      .first()

    if (!project) {
      throw new Error('Invalid API key')
    }

    const session = await ctx.db
      .query('sessions')
      .withIndex('projectId_sessionId', (q) =>
        q.eq('projectId', project._id).eq('sessionId', args.sessionId)
      )
      .first()

    if (!session) {
      throw new Error('Session not found')
    }

    const eventId = await ctx.db.insert('events', {
      projectId: project._id,
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
    const project = await ctx.db
      .query('projects')
      .withIndex('apiKey', (q) => q.eq('apiKey', args.apiKey))
      .first()

    if (!project) {
      throw new Error('Invalid API key')
    }

    const session = await ctx.db
      .query('sessions')
      .withIndex('projectId_sessionId', (q) =>
        q.eq('projectId', project._id).eq('sessionId', args.sessionId)
      )
      .first()

    if (!session) {
      throw new Error('Session not found')
    }

    // Create conversion event
    const eventId = await ctx.db.insert('events', {
      projectId: project._id,
      visitorId: session.visitorId,
      sessionId: session._id,
      type: 'conversion',
      name: args.eventName,
      metadata: args.metadata,
    })

    // Create conversion record
    const conversionId = await ctx.db.insert('conversions', {
      projectId: project._id,
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
 * Get sessions for a project
 */
export const getSessions = query({
  args: {
    projectId: v.id('projects'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('projectId', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .take(limit)

    return sessions
  },
})

/**
 * Get conversions for a project
 */
export const getConversions = query({
  args: {
    projectId: v.id('projects'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100

    const conversions = await ctx.db
      .query('conversions')
      .withIndex('projectId', (q) => q.eq('projectId', args.projectId))
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
      })
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

// Helper function to check if touchpoint has new attribution data
function hasNewAttributionData(
  oldTouchPoint: any,
  newTouchPoint: any
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
