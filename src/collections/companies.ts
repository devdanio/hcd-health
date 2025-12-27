import { createServerFn } from '@tanstack/react-start'
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import { randomBytes } from 'crypto'
import type { QueryClient } from '@tanstack/react-query'

// ============================================================================
// Schemas
// ============================================================================

export const getCompanySchema = z.object({
  companyId: z.string(),
})

export const getCompaniesSchema = z.object({})

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  domain: z.string().min(1, 'Domain is required'),
  companyBrief: z.string().optional(),
  ehr: z.enum(['UNIFIED_PRACTICE', 'JASMINE', 'CHIROTOUCH']).optional(),
})

export const updateCompanySchema = z.object({
  companyId: z.string(),
  name: z.string().min(1).optional(),
  domain: z.string().optional(),
  companyBrief: z.string().optional().nullable(),
  ehr: z
    .enum(['UNIFIED_PRACTICE', 'JASMINE', 'CHIROTOUCH'])
    .optional()
    .nullable(),
})

export const deleteCompanySchema = z.object({
  companyId: z.string(),
})

export const regenerateApiKeySchema = z.object({
  companyId: z.string(),
})

export const getCompanyByApiKeySchema = z.object({
  apiKey: z.string(),
})

// ============================================================================
// Helper Functions
// ============================================================================

function generateApiKey(): string {
  return randomBytes(32).toString('hex')
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all companies
 */
export const getCompanies = createServerFn({ method: 'GET' })
  .inputValidator(getCompaniesSchema)
  .handler(async () => {
    return await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
    })
  })

/**
 * Get a single company by ID
 */
export const getCompany = createServerFn({ method: 'GET' })
  .inputValidator(getCompanySchema)
  .handler(async ({ data }) => {
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
    })

    if (!company) {
      throw new Error('Company not found')
    }

    return company
  })

/**
 * Get company by API key (for tracking authentication)
 */
export const getCompanyByApiKey = createServerFn({ method: 'GET' })
  .inputValidator(getCompanyByApiKeySchema)
  .handler(async ({ data }) => {
    const company = await prisma.company.findUnique({
      where: { apiKey: data.apiKey },
    })

    if (!company) {
      throw new Error('Invalid API key')
    }

    return company
  })

/**
 * Create a new company
 */
export const createCompany = createServerFn({ method: 'POST' })
  .inputValidator(createCompanySchema)
  .handler(async ({ data }) => {
    const apiKey = generateApiKey()

    return await prisma.company.create({
      data: {
        name: data.name,
        domain: data.domain,
        companyBrief: data.companyBrief,
        ehr: data.ehr,
        apiKey,
      },
    })
  })

/**
 * Update a company
 */
export const updateCompany = createServerFn({ method: 'POST' })
  .inputValidator(updateCompanySchema)
  .handler(async ({ data }) => {
    const { companyId, ...updateData } = data

    return await prisma.company.update({
      where: { id: companyId },
      data: updateData,
    })
  })

/**
 * Delete a company (cascades to all related data)
 */
export const deleteCompany = createServerFn({ method: 'POST' })
  .inputValidator(deleteCompanySchema)
  .handler(async ({ data }) => {
    await prisma.company.delete({
      where: { id: data.companyId },
    })

    return { success: true }
  })

/**
 * Regenerate API key for a company
 */
export const regenerateApiKey = createServerFn({ method: 'POST' })
  .inputValidator(regenerateApiKeySchema)
  .handler(async ({ data }) => {
    const newApiKey = generateApiKey()

    return await prisma.company.update({
      where: { id: data.companyId },
      data: { apiKey: newApiKey },
    })
  })

// ============================================================================
// Collection
// ============================================================================

export function createCompaniesCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      id: 'companies',
      queryKey: ['companies'],
      queryFn: async () => {
        const result = await getCompanies({ data: {} })
        console.log('result', result)
        return result
      },
      queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        const { modified } = transaction.mutations[0]
        console.log('modified', modified)
        await createCompany({
          data: {
            name: modified.name,
            domain: modified.domain,
          },
        })
      },
      onUpdate: async ({ transaction }) => {
        const { original, modified } = transaction.mutations[0]
        await updateCompany({
          data: {
            companyId: original.id,
            ...modified,
          },
        })
      },
      onDelete: async ({ transaction }) => {
        const { original } = transaction.mutations[0]
        await deleteCompany({ data: { companyId: original.id } })
      },
    }),
  )
}
