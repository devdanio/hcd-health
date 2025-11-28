import { z } from 'zod'

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
