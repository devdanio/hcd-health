import { z } from 'zod'

export const getContactsSchema = z.object({
  companyId: z.string(),
  limit: z.number().optional(),
  sortBy: z.enum(['createdAt', 'email', 'fullName']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export const getMostRecentContactSchema = z.object({
  companyId: z.string(),
})

export const getContactsAnalyticsSchema = z.object({
  companyId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
})

export const getContactCountsByFirstServiceSchema = z.object({
  companyId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
})

export const createContactSchema = z.object({
  companyId: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  ghlContactId: z.string().optional(),
  chirotouchAccountId: z.string().optional(),
  firstServiceId: z.string().optional(),
})

export const upsertContactByChirotouchAccountIdSchema = z.object({
  companyId: z.string(),
  chirotouchAccountId: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})
