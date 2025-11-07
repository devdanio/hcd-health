import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Attribution tracking data structure
const touchPointSchema = v.object({
  // UTM parameters
  utm_source: v.optional(v.string()),
  utm_medium: v.optional(v.string()),
  utm_campaign: v.optional(v.string()),
  utm_content: v.optional(v.string()),
  utm_term: v.optional(v.string()),

  // Click IDs
  fbclid: v.optional(v.string()),
  gclid: v.optional(v.string()),
  msclkid: v.optional(v.string()),
  ttclid: v.optional(v.string()),
  twclid: v.optional(v.string()),
  li_fat_id: v.optional(v.string()),
  ScCid: v.optional(v.string()),

  // Page data
  url: v.string(),
  referrer: v.optional(v.string()),
  timestamp: v.number(),
})

export default defineSchema({
  // Attribution Tracking Tables
  projects: defineTable({
    name: v.string(),
    domain: v.string(),
    apiKey: v.string(), // For authenticating tracking requests
  }).index('apiKey', ['apiKey']),

  visitors: defineTable({
    projectId: v.id('projects'),
    visitorId: v.string(), // Client-generated UUID
    firstSeen: v.number(),
    lastSeen: v.number(),
    // Optional identified data
    email: v.optional(v.string()),
    userId: v.optional(v.string()),
  })
    .index('projectId_visitorId', ['projectId', 'visitorId'])
    .index('projectId', ['projectId']),

  sessions: defineTable({
    projectId: v.id('projects'),
    visitorId: v.id('visitors'),
    sessionId: v.string(), // Client-generated session ID
    touchPoints: v.array(touchPointSchema),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    pageViews: v.number(),
    duration: v.optional(v.number()), // in seconds
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    screenResolution: v.optional(v.string()),
    timezone: v.optional(v.string()),
    firstSessionSource: v.optional(v.string()), // Channel source from first touchpoint
    lastSessionSource: v.optional(v.string()), // Channel source from last touchpoint
  })
    .index('projectId_sessionId', ['projectId', 'sessionId'])
    .index('visitorId', ['visitorId'])
    .index('projectId', ['projectId']),

  events: defineTable({
    projectId: v.id('projects'),
    visitorId: v.id('visitors'),
    sessionId: v.id('sessions'),
    type: v.union(
      v.literal('pageview'),
      v.literal('event'),
      v.literal('conversion')
    ),
    name: v.optional(v.string()), // Event name for custom events
    url: v.optional(v.string()), // URL for pageviews
    metadata: v.optional(v.any()), // Custom event data
  })
    .index('sessionId', ['sessionId'])
    .index('projectId_type', ['projectId', 'type'])
    .index('projectId', ['projectId']),

  conversions: defineTable({
    projectId: v.id('projects'),
    visitorId: v.id('visitors'),
    sessionId: v.id('sessions'),
    eventId: v.id('events'),
    eventName: v.string(),

    // Simplified: Attribution is derived from session.touchPoints
    // First touch = touchPoints[0]
    // Last touch = touchPoints[touchPoints.length - 1]

    revenue: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index('sessionId', ['sessionId'])
    .index('projectId', ['projectId']),

  // Demo tables (can be removed later)
  products: defineTable({
    title: v.string(),
    imageId: v.string(),
    price: v.number(),
  }),
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),
})
