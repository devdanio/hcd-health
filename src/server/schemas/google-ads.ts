import { z } from 'zod'

export const generateOAuthUrlSchema = z.object({
  companyId: z.string(),
})

export const handleOAuthCallbackSchema = z.object({
  code: z.string(),
  state: z.string(),
})

export const listAccessibleAccountsSchema = z.object({
  companyId: z.string(),
})

export const selectAccountSchema = z.object({
  companyId: z.string(),
  customerId: z.string(),
})

export const refreshAccessTokenSchema = z.object({
  companyId: z.string(),
})

export const disconnectGoogleAdsSchema = z.object({
  companyId: z.string(),
})

export const getCampaignsSchema = z.object({
  companyId: z.string(),
})

export const ensureValidTokenSchema = z.object({
  companyId: z.string(),
})
