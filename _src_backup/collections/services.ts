import { createServerFn } from '@tanstack/react-start'
import {
  createCollection,
  eq,
  parseLoadSubsetOptions,
} from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import { queryClient } from '@/lib/queryClient'
import { QueryClient } from '@tanstack/react-query'

// ============================================================================
// Schemas
// ============================================================================

export const listServicesSchema = z.object({
  companyId: z.string(),
})

export const createServiceSchema = z.object({
  companyId: z.string(),
  name: z.string().min(1, 'Name is required'),
})

export const updateServiceSchema = z.object({
  serviceId: z.string(),
  name: z.string().min(1, 'Name is required'),
})

export const removeServiceSchema = z.object({
  serviceId: z.string(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * List all services for a company
 */
export const listServices = createServerFn({ method: 'GET' })
  .inputValidator(listServicesSchema)
  .handler(async ({ data }) => {
    const dan = await prisma.service.findMany({
      where: { companyId: data.companyId },
      orderBy: { name: 'asc' },
    })

    console.log('dan', dan)

    return dan
  })

/**
 * Create a new service
 */
export const createService = createServerFn({ method: 'POST' })
  .inputValidator(createServiceSchema)
  .handler(async ({ data }) => {
    console.log('going to insert', data)
    const result = await prisma.service.create({
      data: {
        name: data.name,
        company: {
          connect: {
            id: data.companyId,
          },
        },
      },
    })

    console.log('result', result)

    return result
  })

/**
 * Update a service
 */
export const updateService = createServerFn({ method: 'POST' })
  .inputValidator(updateServiceSchema)
  .handler(async ({ data }) => {
    const { serviceId, ...updateData } = data

    return await prisma.service.update({
      where: { id: serviceId },
      data: updateData,
    })
  })

/**
 * Remove a service
 */
export const removeService = createServerFn({ method: 'POST' })
  .inputValidator(removeServiceSchema)
  .handler(async ({ data }) => {
    await prisma.service.delete({
      where: { id: data.serviceId },
    })

    return { success: true }
  })

// ============================================================================
// Collection
// ============================================================================

export function createServicesCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      id: 'services',
      queryKey: ['services'],
      syncMode: 'on-demand',
      queryFn: async (ctx) => {
        const options = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions)

        const companyId = options?.filters.find((filter) =>
          filter.field.includes('companyId'),
        )?.value as string | undefined
        if (!companyId) return []
        const result = await listServices({ data: { companyId } })
        return result
      },
      queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        const { modified } = transaction.mutations[0]
        await createService({
          data: {
            companyId: modified.companyId,
            name: modified.name,
          },
        })
      },
      onUpdate: async ({ transaction }) => {
        const { original, modified } = transaction.mutations[0]
        await updateService({
          data: {
            serviceId: original.id,
            name: modified.name,
          },
        })
      },
      onDelete: async ({ transaction }) => {
        const { original } = transaction.mutations[0]
        await removeService({ data: { serviceId: original.id } })
      },
    }),
  )
}
