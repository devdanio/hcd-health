import { createServerFn } from '@tanstack/react-start'
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
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
})

export const updateCompanySchema = z.object({
  companyId: z.string(),
  name: z.string().min(1).optional(),
})

export const deleteCompanySchema = z.object({
  companyId: z.string(),
})

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
      orderBy: { created_at: 'desc' },
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
 * Create a new company
 */
export const createCompany = createServerFn({ method: 'POST' })
  .inputValidator(createCompanySchema)
  .handler(async ({ data }) => {
    return await prisma.company.create({
      data: {
        name: data.name,
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
 * Delete a company
 */
export const deleteCompany = createServerFn({ method: 'POST' })
  .inputValidator(deleteCompanySchema)
  .handler(async ({ data }) => {
    await prisma.company.delete({
      where: { id: data.companyId },
    })

    return { success: true }
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
        return result
      },
      queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        const { modified } = transaction.mutations[0]
        await createCompany({
          data: {
            name: modified.name,
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
