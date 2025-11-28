import { z } from 'zod'

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
  metadata: attributionSchema,
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
