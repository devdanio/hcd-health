import { z } from 'zod'

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
