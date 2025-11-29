import { createServerFn } from '@tanstack/react-start'
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import type { QueryClient } from '@tanstack/react-query'

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
    return await prisma.service.findMany({
      where: { companyId: data.companyId },
      orderBy: { name: 'asc' },
    })
  })

/**
 * Create a new service
 */
export const createService = createServerFn({ method: 'POST' })
  .inputValidator(createServiceSchema)
  .handler(async ({ data }) => {
    return await prisma.service.create({
      data,
    })
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
      queryFn: async (ctx) => {
        const companyId = ctx.meta?.companyId as string | undefined
        if (!companyId) return []
        return await listServices({ data: { companyId } })
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
