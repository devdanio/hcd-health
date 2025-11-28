import { z } from 'zod'

export const getPagesSchema = z.object({
  companyId: z.string(),
})

export const getPageSchema = z.object({
  pageId: z.string(),
})

export const createPageSchema = z.object({
  companyId: z.string(),
  h1: z.string().min(1, 'H1 is required'),
  pageTitle: z.string().min(1, 'Page title is required'),
  pageDescription: z.string().min(1, 'Page description is required'),
  slug: z.string().min(1, 'Slug is required'),
  markdownContent: z.string().min(1, 'Content is required'),
  jsonSchema: z.string().optional().refine(
    (val) => {
      if (!val) return true
      try {
        JSON.parse(val)
        return true
      } catch {
        return false
      }
    },
    { message: 'Invalid JSON Schema' }
  ),
})

export const updatePageSchema = z.object({
  pageId: z.string(),
  h1: z.string().min(1).optional(),
  pageTitle: z.string().min(1).optional(),
  pageDescription: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  markdownContent: z.string().min(1).optional(),
  jsonSchema: z.string().optional().refine(
    (val) => {
      if (!val) return true
      try {
        JSON.parse(val)
        return true
      } catch {
        return false
      }
    },
    { message: 'Invalid JSON Schema' }
  ),
})

export const deletePageSchema = z.object({
  pageId: z.string(),
})
