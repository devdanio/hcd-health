import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { contact, ghlContact } from './schema'
import { Id } from './_generated/dataModel'
import dayjs from 'dayjs'

export const getMostRecentContact = query({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('contacts')
      .filter((q) =>
        q.and(
          q.neq(q.field('ghlContactId'), null) &&
            q.eq(q.field('companyId'), args.companyId),
        ),
      )
      .order('desc')
      .first()
  },
})

export const createContact = mutation({
  args: {
    contact: contact.validator,
    ghlContact: v.optional(ghlContact.validator),
  },
  handler: async (ctx, args) => {
    let ghlContactId: Id<'ghlContacts'> | undefined
    if (args.ghlContact) {
      const ghlContact = await ctx.db.insert('ghlContacts', args.ghlContact)
      if (!ghlContact) {
        throw new Error('Failed to create ghl contact')
      }
      ghlContactId = ghlContact as Id<'ghlContacts'>
    }
    return await ctx.db.insert('contacts', {
      ...args.contact,
      ghlContactId,
    })
  },
})

/**
 * Get all contacts for a company with GHL data
 */
export const getContacts = query({
  args: {
    companyId: v.id('companies'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 1000

    // Get all contacts for the company
    const contacts = await ctx.db
      .query('contacts')
      .withIndex('companyId', (q) => q.eq('companyId', args.companyId))
      .collect()

    // Enrich with GHL contact data
    const enrichedContacts = await Promise.all(
      contacts.map(async (contact) => {
        if (!contact.ghlContactId) {
          return {
            ...contact,
            ghlContact: null,
          }
        }

        const ghlContact = await ctx.db.get(contact.ghlContactId)
        return {
          ...contact,
          ghlContact,
        }
      }),
    )

    // Filter out contacts without GHL data and sort by dateAdded
    const contactsWithGHL = enrichedContacts
      .filter((c) => c.ghlContact !== null)
      .sort((a, b) => {
        const aDate = a.ghlContact?.dateAdded ?? 0
        const bDate = b.ghlContact?.dateAdded ?? 0
        return bDate - aDate // Most recent first
      })
      .slice(0, limit)

    return contactsWithGHL
  },
})

/**
 * Get contacts analytics - count by day using GHL dateAdded
 */
export const getContactsAnalytics = query({
  args: {
    companyId: v.id('companies'),
    timeRange: v.optional(
      v.union(
        v.literal('7d'),
        v.literal('30d'),
        v.literal('90d'),
        v.literal('all'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const timeRange = args.timeRange || '30d'
    const now = Date.now()
    let startTime = 0

    // Calculate start time based on range
    if (timeRange !== 'all') {
      switch (timeRange) {
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
    }

    // Get all contacts for the company
    const contacts = await ctx.db
      .query('contacts')
      .withIndex('companyId', (q) => q.eq('companyId', args.companyId))
      .collect()

    // Enrich with GHL contact data
    const enrichedContacts = await Promise.all(
      contacts.map(async (contact) => {
        if (!contact.ghlContactId) {
          return null
        }
        const ghlContact = await ctx.db.get(contact.ghlContactId)
        return ghlContact
      }),
    )

    // Filter out null values and apply time range filter
    const ghlContacts = enrichedContacts.filter(
      (c) => c !== null && c.dateAdded >= startTime,
    )

    // Group contacts by day using dateAdded
    const dataMap = new Map<string, number>()

    // Format date as YYYY-MM-DD
    const formatDate = (timestamp: number) => {
      const date = new Date(timestamp)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    // Count contacts by day
    for (const ghlContact of ghlContacts) {
      if (!ghlContact) continue
      const dateKey = formatDate(ghlContact.dateAdded)
      dataMap.set(dateKey, (dataMap.get(dateKey) || 0) + 1)
    }

    // Convert to array format for charting and sort by date
    const result = Array.from(dataMap.entries())
      .map(([date, count]) => ({
        date,
        contacts: count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return result
  },
})

export const upsertContactByChirotouchAccountId = mutation({
  args: {
    companyId: v.id('companies'),
    chirotouchAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if contact exists by chirotouchAccountId
    const existingContact = await ctx.db
      .query('contacts')
      .withIndex('chirotouchAccountId', (q) =>
        q.eq('chirotouchAccountId', args.chirotouchAccountId),
      )
      .first()

    if (existingContact) {
      // Update companyId if needed
      if (existingContact.companyId !== args.companyId) {
        await ctx.db.patch(existingContact._id, {
          companyId: args.companyId,
        })
      }
      return existingContact._id
    }

    // Create new contact
    const contactId = await ctx.db.insert('contacts', {
      companyId: args.companyId,
      chirotouchAccountId: args.chirotouchAccountId,
    })
    return contactId
  },
})

/**
 * Get contact counts by first service ID within a date range
 */
export const getContactCountsByFirstService = query({
  args: {
    companyId: v.id('companies'),
    timeRange: v.optional(
      v.union(
        v.literal('7d'),
        v.literal('30d'),
        v.literal('90d'),
        v.literal('all'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const timeRange = args.timeRange || '30d'
    const now = dayjs()
    let startDate = dayjs(0) // Unix epoch for 'all'

    // Calculate start time based on range using dayjs
    if (timeRange !== 'all') {
      switch (timeRange) {
        case '7d':
          startDate = now.subtract(7, 'day').startOf('day')
          break
        case '30d':
          startDate = now.subtract(30, 'day').startOf('day')
          break
        case '90d':
          startDate = now.subtract(90, 'day').startOf('day')
          break
      }
    }

    const startTime = startDate.valueOf()

    // Get all contacts for the company
    const contacts = await ctx.db
      .query('contacts')
      .withIndex('companyId', (q) => q.eq('companyId', args.companyId))
      .collect()

    // Filter contacts by date range using GHL dateAdded
    const contactsInRange = []
    for (const contact of contacts) {
      if (!contact.ghlContactId) continue

      const ghlContact = await ctx.db.get(contact.ghlContactId)
      if (!ghlContact) continue

      // Check if contact is within date range
      if (ghlContact.dateAdded >= startTime) {
        contactsInRange.push(contact)
      }
    }

    // Count contacts by firstServiceId
    const countsByService = new Map<Id<'services'>, number>()

    for (const contact of contactsInRange) {
      if (!contact.firstServiceId) continue

      const currentCount = countsByService.get(contact.firstServiceId) || 0
      countsByService.set(contact.firstServiceId, currentCount + 1)
    }

    // Get service names and build result
    const result: Array<{
      serviceId: Id<'services'>
      serviceName: string
      count: number
    }> = []

    for (const [serviceId, count] of countsByService.entries()) {
      const service = await ctx.db.get(serviceId)
      if (service) {
        result.push({
          serviceId,
          serviceName: service.name,
          count,
        })
      }
    }

    // Sort by count descending
    return result.sort((a, b) => b.count - a.count)
  },
})
