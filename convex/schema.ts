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
  companies: defineTable({
    name: v.string(),
    domain: v.string(),
    apiKey: v.string(), // For authenticating tracking requests
  }).index('apiKey', ['apiKey']),

  user: defineTable({
    companyId: v.id('companies'),
    userId: v.string(), // Browser-generated anonymous ID
    firstSeen: v.number(),
    lastSeen: v.number(),
    // Optional identified data
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    fullName: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  })
    .index('companyId_userId', ['companyId', 'userId'])
    .index('companyId_email', ['companyId', 'email'])
    .index('companyId_phone', ['companyId', 'phone'])
    .index('companyId', ['companyId']),

  sessions: defineTable({
    companyId: v.id('companies'),
    userId: v.id('user'),
    sessionId: v.string(), // Browser-generated session ID
    touchPoints: v.array(touchPointSchema),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
    pageViews: v.number(),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    screenResolution: v.optional(v.string()),
    timezone: v.optional(v.string()),
    firstSessionSource: v.optional(v.string()), // Channel source from first touchpoint
    lastSessionSource: v.optional(v.string()), // Channel source from last touchpoint
  })
    .index('companyId_sessionId', ['companyId', 'sessionId'])
    .index('companyId_userId', ['companyId', 'userId'])
    .index('companyId', ['companyId'])
    .index('userId', ['userId']),

  events: defineTable({
    companyId: v.id('companies'),
    userId: v.id('user'),
    sessionId: v.id('sessions'),
    type: v.union(v.literal('pageview'), v.literal('custom_event')),
    name: v.optional(v.string()), // Event name for custom events
    url: v.optional(v.string()), // URL for pageviews
    metadata: v.optional(v.any()), // Custom event data
  })
    .index('sessionId', ['sessionId'])
    .index('companyId_type', ['companyId', 'type'])
    .index('companyId', ['companyId']),
})
