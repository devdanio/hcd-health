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

export const getRevenueByAgeSchema = z.object({
  companyId: z.string(),
})

export const getRevenuePerPatientByServiceSchema = z.object({
  companyId: z.string(),
})

export const getPatientsByServiceCountSchema = z.object({
  companyId: z.string(),
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
    const limit = data.limit ?? 10000
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
 * Get revenue by age group (0-10, 10-20, 20-30, etc.)
 */
export const getRevenueByAge = createServerFn({ method: 'GET' })
  .inputValidator(getRevenueByAgeSchema)
  .handler(async ({ data }) => {
    // Use raw SQL to calculate age and aggregate revenue
    const results = await prisma.$queryRaw<
      Array<{ age_group: string; revenue: number; count: number }>
    >`
      WITH contact_ages AS (
        SELECT
          c.id,
          EXTRACT(YEAR FROM AGE(c."dateOfBirth"))::int as age
        FROM "Contact" c
        WHERE c."companyId" = ${data.companyId}
          AND c."dateOfBirth" IS NOT NULL
      ),
      age_groups AS (
        SELECT
          ca.id,
          ca.age,
          CASE
            WHEN ca.age >= 0 AND ca.age < 10 THEN '0-10'
            WHEN ca.age >= 10 AND ca.age < 20 THEN '10-20'
            WHEN ca.age >= 20 AND ca.age < 30 THEN '20-30'
            WHEN ca.age >= 30 AND ca.age < 40 THEN '30-40'
            WHEN ca.age >= 40 AND ca.age < 50 THEN '40-50'
            WHEN ca.age >= 50 AND ca.age < 60 THEN '50-60'
            WHEN ca.age >= 60 AND ca.age < 70 THEN '60-70'
            WHEN ca.age >= 70 AND ca.age < 80 THEN '70-80'
            WHEN ca.age >= 80 AND ca.age < 90 THEN '80-90'
            WHEN ca.age >= 90 AND ca.age < 100 THEN '90-100'
            ELSE '100+'
          END as age_group
        FROM contact_ages ca
        WHERE ca.age >= 0 AND ca.age < 100
      )
      SELECT
        ag.age_group,
        COALESCE(SUM(ap."chargeAmount"), 0)::float as revenue,
        COUNT(DISTINCT ag.id)::int as count
      FROM age_groups ag
      LEFT JOIN "Appointment" a ON a."contactId" = ag.id
      LEFT JOIN "AppointmentProcedure" ap ON ap."appointmentId" = a.id
      GROUP BY ag.age_group
      ORDER BY
        CASE ag.age_group
          WHEN '0-10' THEN 1
          WHEN '10-20' THEN 2
          WHEN '20-30' THEN 3
          WHEN '30-40' THEN 4
          WHEN '40-50' THEN 5
          WHEN '50-60' THEN 6
          WHEN '60-70' THEN 7
          WHEN '70-80' THEN 8
          WHEN '80-90' THEN 9
          WHEN '90-100' THEN 10
          ELSE 11
        END
    `

    return results.map((row) => ({
      ageGroup: row.age_group,
      revenue: row.revenue,
      count: row.count,
    }))
  })

/**
 * Get revenue per patient by service
 * Calculates total revenue and distinct patient count for each service
 */
export const getRevenuePerPatientByService = createServerFn({ method: 'GET' })
  .inputValidator(getRevenuePerPatientByServiceSchema)
  .handler(async ({ data }) => {
    // Use raw SQL to calculate revenue per patient by service
    const results = await prisma.$queryRaw<
      Array<{
        service_id: string
        service_name: string
        total_revenue: number
        patient_count: number
        revenue_per_patient: number
      }>
    >`
      SELECT
        s.id as service_id,
        s.name as service_name,
        COALESCE(SUM(ap."chargeAmount"), 0)::float as total_revenue,
        COUNT(DISTINCT a."contactId")::int as patient_count,
        CASE
          WHEN COUNT(DISTINCT a."contactId") > 0
          THEN (COALESCE(SUM(ap."chargeAmount"), 0) / COUNT(DISTINCT a."contactId"))::float
          ELSE 0
        END as revenue_per_patient
      FROM "Service" s
      LEFT JOIN "Appointment" a ON a."serviceId" = s.id
      LEFT JOIN "AppointmentProcedure" ap ON ap."appointmentId" = a.id
      WHERE s."companyId" = ${data.companyId}
      GROUP BY s.id, s.name
      ORDER BY revenue_per_patient DESC
    `

    return results.map((row) => ({
      serviceId: row.service_id,
      serviceName: row.service_name,
      totalRevenue: row.total_revenue,
      patientCount: row.patient_count,
      revenuePerPatient: row.revenue_per_patient,
    }))
  })

/**
 * Get distribution of patients by number of unique services they've received
 */
export const getPatientsByServiceCount = createServerFn({ method: 'GET' })
  .inputValidator(getPatientsByServiceCountSchema)
  .handler(async ({ data }) => {
    // First, get the total number of services offered by the company
    const totalServices = await prisma.service.count({
      where: { companyId: data.companyId },
    })

    // Use raw SQL to count unique services per patient
    const results = await prisma.$queryRaw<
      Array<{
        service_count: number
        patient_count: number
      }>
    >`
      WITH contact_service_counts AS (
        SELECT
          a."contactId",
          COUNT(DISTINCT a."serviceId") as service_count
        FROM "Appointment" a
        WHERE a."companyId" = ${data.companyId}
          AND a."serviceId" IS NOT NULL
        GROUP BY a."contactId"
      )
      SELECT
        service_count::int,
        COUNT(*)::int as patient_count
      FROM contact_service_counts
      GROUP BY service_count
      ORDER BY service_count ASC
    `

    // Create a map from the results
    const resultMap = new Map(
      results.map((r) => [r.service_count, r.patient_count]),
    )

    // Fill in all service counts from 1 to totalServices (even if 0 patients)
    const distribution = []
    for (let i = 1; i <= totalServices; i++) {
      distribution.push({
        serviceCount: i,
        patientCount: resultMap.get(i) || 0,
      })
    }

    return distribution
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
