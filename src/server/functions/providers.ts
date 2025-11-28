import { createServerFn } from '@tanstack/react-start'

import { prisma } from '../db/client'
import {
  listProvidersSchema,
  createProviderSchema,
  updateProviderSchema,
  removeProviderSchema,
} from '../schemas/providers'

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
