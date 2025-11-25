import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const ghlContact = defineTable({
  id: v.string(),
  locationId: v.string(),
  contactName: v.union(v.null(), v.string()),
  firstName: v.union(v.null(), v.string()),
  lastName: v.union(v.null(), v.string()),
  companyName: v.union(v.null(), v.string()),
  email: v.union(v.null(), v.string()),
  phone: v.union(v.null(), v.string()),
  dnd: v.boolean(),
  type: v.union(v.null(), v.string()),
  source: v.union(v.null(), v.string()),
  assignedTo: v.union(v.null(), v.string()),
  city: v.union(v.null(), v.string()),
  state: v.union(v.null(), v.string()),
  postalCode: v.union(v.null(), v.string()),
  address1: v.union(v.null(), v.string()),
  dateAdded: v.number(),
  dateUpdated: v.number(),
  dateOfBirth: v.any(),
  tags: v.array(v.string()),
  country: v.union(v.null(), v.string()),
  website: v.union(v.null(), v.string()),
  timezone: v.union(v.null(), v.string()),
  lastActivity: v.optional(v.number()),
  customField: v.array(
    v.object({
      id: v.string(),
      value: v.any(),
    }),
  ),
})

// Attribution tracking data structure
const attribution = v.object({
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

export const contact = defineTable({
  companyId: v.optional(v.id('companies')),
  // Optional identified data
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  fullName: v.optional(v.string()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  ghlContactId: v.optional(v.id('ghlContacts')),
})
  .index('companyId_email', ['companyId', 'email'])
  .index('companyId_phone', ['companyId', 'phone'])
  .index('companyId_ghlContactId', ['companyId', 'ghlContactId'])
  .index('companyId', ['companyId'])
  .index('ghlContactId', ['ghlContactId'])

export const patientFields = {
  contactId: v.optional(v.id('contacts')),
  dateOfBirth: v.optional(v.string()),
  gender: v.optional(v.string()),
  payerName: v.optional(v.string()),
  memberId: v.optional(v.string()),
  groupId: v.optional(v.string()),
  emergencyContactName: v.optional(v.string()),
  emergencyContactPhone: v.optional(v.string()),
  emergencyContactRelation: v.optional(v.string()),
}

export const patientProfile = defineTable(patientFields)

// This is for the reporting version of the app not the EHR
export const appointments = defineTable({
  companyId: v.optional(v.id('companies')),
  patientName: v.string(),
  // Todo: attempt to find the contct, will need a separate report from the unified practice api for this
  // contactId: v.optional(v.id('contacts')),
  dateOfService: v.optional(v.string()),
  service: v.string(),
  providerId: v.optional(v.id('providers')),
}).index('companyId_patientName_dateOfService_appointmentType', [
  'companyId',
  'patientName',
  'dateOfService',
  'service',
])

export const patientAppointments = defineTable({
  companyId: v.optional(v.id('companies')),
  patientId: v.id('patients'),
  dateTime: v.number(),
  serviceId: v.id('services'),
}).index('comanyId_patientId', ['companyId', 'patientId'])
// This is the unique index for the appointments table

export const services = defineTable({
  companyId: v.optional(v.id('companies')),
  name: v.string(),
})

export const providers = defineTable({
  companyId: v.optional(v.id('companies')),
  name: v.string(),
  service: v.id('services'),
})

// OAuth state management for Google Ads
export const oauthStates = defineTable({
  state: v.string(), // Cryptographic state parameter for CSRF protection
  companyId: v.id('companies'),
  expiresAt: v.number(), // Cleanup after 10 minutes
}).index('state', ['state'])

export const companies = defineTable({
  name: v.string(),
  domain: v.string(),
  companyBrief: v.optional(v.string()),
  apiKey: v.string(), // For authenticating tracking requests
  ehr: v.optional(v.union(v.literal('unified-practice'), v.literal('ghl'))),
  // Google Ads OAuth integration
  googleAds: v.optional(
    v.object({
      // OAuth tokens (encrypted)
      accessToken: v.string(),
      refreshToken: v.string(),
      tokenExpiresAt: v.number(), // Unix timestamp (ms)

      // Account identifiers (set after user selects account)
      customerId: v.optional(v.string()), // Google Ads Customer ID (no hyphens)

      // Account metadata
      accountName: v.optional(v.string()),
      currencyCode: v.optional(v.string()),
      timeZone: v.optional(v.string()),

      // Status tracking
      connectedAt: v.number(),
      accountSelectedAt: v.optional(v.number()), // When user selected account
      lastSyncedAt: v.optional(v.number()),
      lastError: v.optional(v.string()),
      lastErrorAt: v.optional(v.number()),
    }),
  ),
}).index('apiKey', ['apiKey'])

export const sessions = defineTable({
  browserSessionId: v.string(),
  companyId: v.optional(v.id('companies')),
  contactId: v.id('contacts'),
  userAgent: v.optional(v.string()),
  ipAddress: v.optional(v.string()),
  screenResolution: v.optional(v.string()),
  timezone: v.optional(v.string()),
  events: v.array(v.id('events')),
  firstSessionAttribution: attribution,
  lastSessionAttribution: attribution,
})
  .index('companyId_contactId', ['companyId', 'contactId'])
  .index('companyId', ['companyId'])

export const events = defineTable({
  companyId: v.optional(v.id('companies')),
  contactId: v.id('contacts'),
  sessionId: v.id('sessions'),
  type: v.union(
    v.literal('pageview'),
    v.literal('conversion'),
    v.literal('custom_event'),
  ),
  // Attribution if type === 'pageview
  metadata: v.union(attribution, v.any()),
})
  .index('sessionId', ['sessionId'])
  .index('companyId_type', ['companyId', 'type'])
  .index('companyId', ['companyId'])

// export const messages = defineTable({
//   companyId: v.id('companies'),
//   contactId: v.id('contacts'),
//   sessionId: v.id('sessions'),
//   message: v.any,
// })
export const cmsPages = defineTable({
  companyId: v.id('companies'),
  h1: v.string(),
  pageTitle: v.string(),
  pageDescription: v.string(),
  jsonSchema: v.optional(v.any()),
  slug: v.string(),
  markdownContent: v.string(),
})
  .index('companyId', ['companyId'])
  .index('slugId_slug', ['companyId', 'slug'])

export default defineSchema({
  // Attribution Tracking Tables
  companies: companies,
  ghlContacts: ghlContact,
  contacts: contact,

  sessions: sessions,

  events: events,
  appointments: appointments,
  patientAppointments,
  providers: providers,
  services: services,
  patients: patientProfile.index('contactId', ['contactId']),

  // OAuth state management
  oauthStates: oauthStates,
  cmsPages,
})
