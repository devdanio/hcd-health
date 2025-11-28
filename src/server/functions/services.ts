import { createServerFn } from '@tanstack/react-start'

import { prisma } from '../db/client'
import {
  listServicesSchema,
  createServiceSchema,
  updateServiceSchema,
  removeServiceSchema,
} from '../schemas/services'

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
