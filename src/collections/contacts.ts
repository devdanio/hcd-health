import { createServerFn } from '@tanstack/react-start'
import {
  createCollection,
  eq,
  parseLoadSubsetOptions,
} from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import type { QueryClient } from '@tanstack/react-query'

// ============================================================================
// Schemas
// ============================================================================

export const getContactsSchema = z.object({
  companyId: z.string(),
  limit: z.number().optional(),
  sortBy: z.enum(['createdAt', 'email', 'fullName']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export const getMostRecentContactSchema = z.object({
  companyId: z.string(),
})

export const getContactsAnalyticsSchema = z.object({
  companyId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
})

export const getContactCountsByFirstServiceSchema = z.object({
  companyId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
})

export const createContactSchema = z.object({
  companyId: z.string(),
  email: z.email().nullable(),
  phone: z.string().nullable(),
  fullName: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  ghlContactId: z.string().nullable(),
  chirotouchAccountId: z.string().nullable(),
})

export const updateContactSchema = z.object({
  contactId: z.string(),
  email: z.email().nullable(),
  phone: z.string().nullable(),
  fullName: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
})

export const deleteContactSchema = z.object({
  contactId: z.string(),
})

export const upsertContactByChirotouchAccountIdSchema = z.object({
  companyId: z.string(),
  chirotouchAccountId: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})

// ============================================================================
// Server Functions
// ============================================================================

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
 * Update a contact
 */
export const updateContact = createServerFn({ method: 'POST' })
  .inputValidator(updateContactSchema)
  .handler(async ({ data }) => {
    const { contactId, ...updateData } = data

    return await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
    })
  })

/**
 * Delete a contact
 */
export const deleteContact = createServerFn({ method: 'POST' })
  .inputValidator(deleteContactSchema)
  .handler(async ({ data }) => {
    await prisma.contact.delete({
      where: { id: data.contactId },
    })

    return { success: true }
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

// ============================================================================
// Collection
// ============================================================================

export function createContactsCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      id: 'contacts',
      queryKey: ['contacts'],
      syncMode: 'on-demand',
      queryFn: async (ctx) => {
        const options = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions)
        const companyId = options?.filters.find((filter) =>
          filter.field.includes('companyId'),
        )?.value as string | undefined
        if (!companyId) return []
        return await getContacts({ data: { companyId } })
      },
      queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        const { modified } = transaction.mutations[0]
        const { createdAt, updatedAt, ...data } = modified
        await createContact({
          data,
        })
      },
      onUpdate: async ({ transaction }) => {
        const { original, modified } = transaction.mutations[0]

        await updateContact({
          data: {
            contactId: original.id,
            ...modified,
          },
        })
      },
      onDelete: async ({ transaction }) => {
        const { original } = transaction.mutations[0]
        await deleteContact({ data: { contactId: original.id } })
      },
    }),
  )
}
