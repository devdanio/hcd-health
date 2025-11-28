import { createServerFn } from '@tanstack/react-start'

import { prisma } from '../db/client'
import {
  getContactsSchema,
  getMostRecentContactSchema,
  getContactsAnalyticsSchema,
  getContactCountsByFirstServiceSchema,
  createContactSchema,
  upsertContactByChirotouchAccountIdSchema,
} from '../schemas/contacts'

/**
 * Get all contacts for a company with GHL enrichment
 */
export const getContacts = createServerFn({ method: 'GET' })
  .inputValidator(getContactsSchema)
  .handler(async ({ data }) => {
    const limit = data.limit ?? 100
    const sortBy = data.sortBy ?? 'createdAt'
    const sortOrder = data.sortOrder ?? 'desc'

    const contacts = await prisma.contact.findMany({
      where: { companyId: data.companyId },
      include: {
        ghlContact: true,
        firstService: {
          select: { name: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      take: limit,
    })

    return contacts
  })

/**
 * Get most recent contact with GHL data
 */
export const getMostRecentContact = createServerFn({ method: 'GET' })
  .inputValidator(getMostRecentContactSchema)
  .handler(async ({ data }) => {
    return await prisma.contact.findFirst({
      where: { companyId: data.companyId },
      include: {
        ghlContact: true,
        firstService: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

/**
 * Get contacts analytics grouped by day
 */
export const getContactsAnalytics = createServerFn({ method: 'GET' })
  .inputValidator(getContactsAnalyticsSchema)
  .handler(async ({ data }) => {
    const contacts = await prisma.contact.findMany({
      where: {
        companyId: data.companyId,
        createdAt: {
          gte: data.startDate,
          lte: data.endDate,
        },
      },
      select: {
        createdAt: true,
      },
    })

    // Group by day
    const groupedByDay = new Map<string, number>()

    for (const contact of contacts) {
      const day = contact.createdAt.toISOString().split('T')[0]
      groupedByDay.set(day, (groupedByDay.get(day) || 0) + 1)
    }

    return Array.from(groupedByDay.entries()).map(([date, count]) => ({
      date,
      count,
    }))
  })

/**
 * Get contact counts by first service
 */
export const getContactCountsByFirstService = createServerFn({ method: 'GET' })
  .inputValidator(getContactCountsByFirstServiceSchema)
  .handler(async ({ data }) => {
    const contacts = await prisma.contact.findMany({
      where: {
        companyId: data.companyId,
        createdAt: {
          gte: data.startDate,
          lte: data.endDate,
        },
        firstServiceId: {
          not: null,
        },
      },
      include: {
        firstService: {
          select: { name: true },
        },
      },
    })

    // Group by service
    const groupedByService = new Map<string, number>()

    for (const contact of contacts) {
      const serviceName = contact.firstService?.name || 'Unknown'
      groupedByService.set(
        serviceName,
        (groupedByService.get(serviceName) || 0) + 1,
      )
    }

    return Array.from(groupedByService.entries()).map(([service, count]) => ({
      service,
      count,
    }))
  })

/**
 * Create a new contact
 */
export const createContact = createServerFn({ method: 'POST' })
  .inputValidator(createContactSchema)
  .handler(async ({ data }) => {
    return await prisma.contact.create({
      data,
    })
  })

/**
 * Upsert contact by Chirotouch account ID
 */
export const upsertContactByChirotouchAccountId = createServerFn({
  method: 'POST',
})
  .inputValidator(upsertContactByChirotouchAccountIdSchema)
  .handler(async ({ data }) => {
    const { companyId, chirotouchAccountId, ...contactData } = data

    return await prisma.contact.upsert({
      where: { chirotouchAccountId },
      update: contactData,
      create: {
        companyId,
        chirotouchAccountId,
        ...contactData,
      },
    })
  })
