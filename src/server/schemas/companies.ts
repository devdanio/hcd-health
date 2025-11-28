import { z } from 'zod'

export const getCompanySchema = z.object({
  companyId: z.string(),
})

export const getCompaniesSchema = z.object({})

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  domain: z.string().min(1, 'Domain is required'),
  companyBrief: z.string().optional(),
  ehr: z.enum(['unified_practice', 'ghl']).optional(),
})

export const updateCompanySchema = z.object({
  companyId: z.string(),
  name: z.string().min(1).optional(),
  domain: z.string().optional(),
  companyBrief: z.string().optional(),
  ehr: z.enum(['unified_practice', 'ghl']).optional(),
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
