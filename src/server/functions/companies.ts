import { createServerFn } from '@tanstack/react-start'
// import { queryClient } from '@/queryClient'
import { prisma } from '../db/client'
import {
  getCompanySchema,
  getCompaniesSchema,
  createCompanySchema,
  updateCompanySchema,
  deleteCompanySchema,
  regenerateApiKeySchema,
  getCompanyByApiKeySchema,
} from '../schemas/companies'
import { randomBytes } from 'crypto'
// import { createCollection } from '@tanstack/db'
// import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { Prisma } from '@/generated/prisma/client'
import { z } from 'zod'
import { api } from 'convex/_generated/api'
import { queryClient } from '@/queryClient'
import { createCollection } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

// Generate a secure API key
function generateApiKey(): string {
  return randomBytes(32).toString('hex')
}

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

// export const companiesCollection = createCollection(
//   queryCollectionOptions({
//     queryKey: ['todos'],
//     queryFn: async () => getCompanies({ data: {} }),
//     queryClient,
//     getKey: (item) => item.id,
//   }),
// )
