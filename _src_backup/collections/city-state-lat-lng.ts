import { createServerFn } from '@tanstack/react-start'
import {
  createCollection,
  eq,
  parseLoadSubsetOptions,
} from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import type { QueryClient } from '@tanstack/react-query'
import { getPages } from './cms'

// ============================================================================
// Schemas
// ============================================================================

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
  jsonSchema: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true
        try {
          JSON.parse(val)
          return true
        } catch {
          return false
        }
      },
      { message: 'Invalid JSON Schema' },
    ),
})

export const updatePageSchema = z.object({
  pageId: z.string(),
  h1: z.string().min(1).optional(),
  pageTitle: z.string().min(1).optional(),
  pageDescription: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  markdownContent: z.string().min(1).optional(),
  jsonSchema: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true
        try {
          JSON.parse(val)
          return true
        } catch {
          return false
        }
      },
      { message: 'Invalid JSON Schema' },
    ),
})

export const deletePageSchema = z.object({
  pageId: z.string(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all CMS pages for a company
 */
export const getCityStateLatLng = createServerFn({ method: 'GET' }).handler(
  async ({ data }) => {
    return await prisma.cityLatLng.findMany()
  },
)

// ============================================================================
// Collection
// ============================================================================

export function createCityStateLatLngCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      id: 'cityStateLatLng',
      queryKey: ['cityStateLatLng'],
      syncMode: 'on-demand',
      queryFn: async () => {
        return await getCityStateLatLng()
      },
      queryClient,
      getKey: (item) => `${item.city}-${item.state}`,
    }),
  )
}
