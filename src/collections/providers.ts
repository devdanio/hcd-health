import { createServerFn } from '@tanstack/react-start'
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import type { QueryClient } from '@tanstack/react-query'

// ============================================================================
// Schemas
// ============================================================================

export const listProvidersSchema = z.object({
  companyId: z.string(),
})

export const createProviderSchema = z.object({
  companyId: z.string(),
  name: z.string().min(1, 'Name is required'),
  serviceId: z.string(),
})

export const updateProviderSchema = z.object({
  providerId: z.string(),
  name: z.string().min(1, 'Name is required'),
  serviceId: z.string(),
})

export const removeProviderSchema = z.object({
  providerId: z.string(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * List all providers for a company with service names
 */
export const listProviders = createServerFn({ method: 'GET' })
  .inputValidator(listProvidersSchema)
  .handler(async ({ data }) => {
    return await prisma.provider.findMany({
      where: { companyId: data.companyId },
      include: {
        service: {
          select: { name: true },
        },
      },
      orderBy: { name: 'asc' },
    })
  })

/**
 * Create a new provider
 */
export const createProvider = createServerFn({ method: 'POST' })
  .inputValidator(createProviderSchema)
  .handler(async ({ data }) => {
    return await prisma.provider.create({
      data,
    })
  })

/**
 * Update a provider
 */
export const updateProvider = createServerFn({ method: 'POST' })
  .inputValidator(updateProviderSchema)
  .handler(async ({ data }) => {
    const { providerId, ...updateData } = data

    return await prisma.provider.update({
      where: { id: providerId },
      data: updateData,
    })
  })

/**
 * Remove a provider
 */
export const removeProvider = createServerFn({ method: 'POST' })
  .inputValidator(removeProviderSchema)
  .handler(async ({ data }) => {
    await prisma.provider.delete({
      where: { id: data.providerId },
    })

    return { success: true }
  })

// ============================================================================
// Collection
// ============================================================================

export function createProvidersCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      id: 'providers',
      queryKey: ['providers'],
      queryFn: async (ctx) => {
        const companyId = ctx.meta?.companyId as string | undefined
        if (!companyId) return []
        return await listProviders({ data: { companyId } })
      },
      queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        const { modified } = transaction.mutations[0]
        await createProvider({
          data: {
            companyId: modified.companyId,
            name: modified.name,
            serviceId: modified.serviceId,
          },
        })
      },
      onUpdate: async ({ transaction }) => {
        const { original, modified } = transaction.mutations[0]
        await updateProvider({
          data: {
            providerId: original.id,
            name: modified.name,
            serviceId: modified.serviceId,
          },
        })
      },
      onDelete: async ({ transaction }) => {
        const { original } = transaction.mutations[0]
        await removeProvider({ data: { providerId: original.id } })
      },
    }),
  )
}
