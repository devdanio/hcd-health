import { internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { faker } from '@faker-js/faker'

export const clearSeedData = internalMutation({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const { companyId } = args
    console.log(`Clearing seed data for company ${companyId}...`)

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('companyId', (q) => q.eq('companyId', companyId))
      .collect()

    for (const session of sessions) {
      await ctx.db.delete(session._id)
    }

    const events = await ctx.db
      .query('events')
      .withIndex('companyId', (q) => q.eq('companyId', companyId))
      .collect()

    for (const event of events) {
      await ctx.db.delete(event._id)
    }

    console.log(`Deleted ${sessions.length} sessions and ${events.length} events.`)
  },
})

export const generateSeedData = internalMutation({
  args: {
    companyId: v.id('companies'),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const count = args.count ?? 100
    const companyId = args.companyId

    // 1. Get or create contacts
    let contacts = await ctx.db
      .query('contacts')
      .withIndex('companyId', (q) => q.eq('companyId', companyId))
      .take(20)

    if (contacts.length === 0) {
      console.log('No contacts found, creating 50 dummy contacts...')
      for (let i = 0; i < 50; i++) {
        const contactId = await ctx.db.insert('contacts', {
          companyId,
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          email: faker.internet.email(),
          phone: faker.phone.number(),
        })
        const contact = await ctx.db.get(contactId)
        if (contact) contacts.push(contact)
      }
    }

    console.log(`Generating ${count} sessions for company ${companyId}...`)

    const sources = [
      { type: 'Organic Facebook', utm_source: 'facebook', utm_medium: 'social', referrer: 'https://facebook.com' },
      { type: 'Paid Facebook', utm_source: 'facebook', utm_medium: 'cpc', referrer: 'https://facebook.com' },
      { type: 'Organic Google', utm_source: 'google', utm_medium: 'organic', referrer: 'https://google.com' },
      { type: 'Paid Google', utm_source: 'google', utm_medium: 'cpc', referrer: 'https://google.com' },
      { type: 'Email Referral', utm_source: 'newsletter', utm_medium: 'email', referrer: undefined },
      { type: 'Direct', utm_source: undefined, utm_medium: undefined, referrer: undefined },
    ]

    const pages = [
      '/',
      '/about',
      '/blog/why-i-love-acupuncture',
      '/contact',
      '/service/acupuncture',
      '/services/physical-therapy',
    ]

    for (let i = 0; i < count; i++) {
      const contact = faker.helpers.arrayElement(contacts)
      const contactId = contact._id
      const source = faker.helpers.arrayElement(sources)

      // Generate random timestamp within the last 30 days
      const sessionTimestamp = faker.date.recent({ days: 30 }).getTime()

      // Attribution data
      const attribution = {
        url: faker.helpers.arrayElement(pages),
        referrer: source.referrer,
        timestamp: sessionTimestamp,
        utm_source: source.utm_source,
        utm_medium: source.utm_medium,
        utm_campaign: source.utm_source ? faker.lorem.slug() : undefined,
        utm_content: source.utm_source ? faker.lorem.word() : undefined,
        utm_term: source.utm_source ? faker.lorem.word() : undefined,
      }

      const ipAddress = faker.internet.ip()
      const userAgent = faker.internet.userAgent()

      const sessionId = await ctx.db.insert('sessions', {
        browserSessionId: faker.string.uuid(),
        companyId,
        contactId,
        userAgent,
        ipAddress,
        screenResolution: `${faker.number.int({ min: 800, max: 2560 })}x${faker.number.int({ min: 600, max: 1440 })}`,
        timezone: faker.location.timeZone(),
        events: [], // Will update later
        firstSessionAttribution: attribution,
        lastSessionAttribution: attribution,
      })

      // Generate 1-5 page view events
      const numEvents = faker.number.int({ min: 1, max: 5 })
      const eventIds = []

      for (let j = 0; j < numEvents; j++) {
        // Events happen slightly after the session start
        const eventTimestamp = sessionTimestamp + j * faker.number.int({ min: 1000, max: 60000 })
        
        // For subsequent events, pick a random page. First event uses session entry URL.
        const pageUrl = j === 0 ? attribution.url : faker.helpers.arrayElement(pages)

        const eventId = await ctx.db.insert('events', {
          companyId,
          contactId,
          sessionId,
          type: 'pageview',
          metadata: {
            ...attribution,
            url: pageUrl,
            timestamp: eventTimestamp,
          },
        })
        eventIds.push(eventId)
      }

      // Update session with event IDs
      await ctx.db.patch(sessionId, {
        events: eventIds,
      })
    }

    console.log('Seed data generation complete!')
  },
})

export const seedProvidersAndServices = internalMutation({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const { companyId } = args
    console.log(`Seeding services and providers for company ${companyId}...`)

    const servicesList = ['Acu', 'Chiro', 'PT', 'OT']
    const serviceIds: Record<string, any> = {}

    // 1. Create Services
    for (const serviceName of servicesList) {
      const existingService = await ctx.db
        .query('services')
        // Schema doesn't have index on name/companyId, so we have to scan or just insert if we don't care about dupes.
        // But let's try to avoid dupes if possible.
        // Since there is no index on name, we'll just query all services for the company and filter in memory.
        .filter((q) => q.eq(q.field('companyId'), companyId))
        .collect()
      
      const found = existingService.find(s => s.name === serviceName)
      
      if (found) {
        serviceIds[serviceName] = found._id
      } else {
        const id = await ctx.db.insert('services', {
          companyId,
          name: serviceName,
        })
        serviceIds[serviceName] = id
      }
    }

    // 2. Create Providers
    const providersList = [
      { name: 'Arthur Adamczyk', service: 'Acu' },
      { name: 'Brian Matfus', service: 'Chiro' },
      { name: 'Clint J Price', service: 'Acu' },
      { name: 'Daniel Van Clef', service: 'OT' },
      { name: 'Edward J. Kinsella', service: 'PT' },
      { name: 'Elizabeth Dziuba', service: 'OT' },
      { name: 'Joseph Marchitelli', service: 'Chiro' },
      { name: 'Ryan Ribeiro', service: 'PT' },
      { name: 'Shannon Moloughney', service: 'PT' },
      { name: 'Stephen Bruno', service: 'Chiro' },
      { name: 'Thomas Abrams', service: 'Chiro' },
      { name: 'Thomas Corbisiero', service: 'PT' },
      { name: 'Tyler DiGiovanni', service: 'Chiro' },
      { name: 'Vincent Zappola', service: 'Chiro' },
    ]

    for (const provider of providersList) {
      const serviceId = serviceIds[provider.service]
      if (!serviceId) {
        console.error(`Service ID not found for ${provider.service}`)
        continue
      }

      // Check if provider exists
      const existingProviders = await ctx.db
        .query('providers')
        .filter((q) => q.eq(q.field('companyId'), companyId))
        .collect()
      
      const found = existingProviders.find(p => p.name === provider.name)

      if (!found) {
        await ctx.db.insert('providers', {
          companyId,
          name: provider.name,
          service: serviceId,
        })
      }
    }

    console.log('Services and providers seeded successfully.')
  },
})
