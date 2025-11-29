import { createServerFn } from '@tanstack/react-start'
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import type { QueryClient } from '@tanstack/react-query'

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

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all CMS pages for a company
 */
export const getPages = createServerFn({ method: 'GET' })
  .inputValidator(getPagesSchema)
  .handler(async ({ data }) => {
    return await prisma.cmsPage.findMany({
      where: { companyId: data.companyId },
      orderBy: { createdAt: 'desc' },
    })
  })

/**
 * Get a single CMS page
 */
export const getPage = createServerFn({ method: 'GET' })
  .inputValidator(getPageSchema)
  .handler(async ({ data }) => {
    const page = await prisma.cmsPage.findUnique({
      where: { id: data.pageId },
    })

    if (!page) {
      throw new Error('Page not found')
    }

    return page
  })

/**
 * Create a new CMS page
 */
export const createPage = createServerFn({ method: 'POST' })
  .inputValidator(createPageSchema)
  .handler(async ({ data }) => {
    const { jsonSchema, ...pageData } = data

    return await prisma.cmsPage.create({
      data: {
        ...pageData,
        jsonSchema: jsonSchema ? JSON.parse(jsonSchema) : null,
      },
    })
  })

/**
 * Update a CMS page
 */
export const updatePage = createServerFn({ method: 'POST' })
  .inputValidator(updatePageSchema)
  .handler(async ({ data }) => {
    const { pageId, jsonSchema, ...updateData } = data

    return await prisma.cmsPage.update({
      where: { id: pageId },
      data: {
        ...updateData,
        jsonSchema: jsonSchema ? JSON.parse(jsonSchema) : undefined,
      },
    })
  })

/**
 * Delete a CMS page
 */
export const deletePage = createServerFn({ method: 'POST' })
  .inputValidator(deletePageSchema)
  .handler(async ({ data }) => {
    await prisma.cmsPage.delete({
      where: { id: data.pageId },
    })

    return { success: true }
  })

// ============================================================================
// Collection
// ============================================================================

export function createCmsPagesCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      id: 'cmsPages',
      queryKey: ['cmsPages'],
      queryFn: async (ctx) => {
        const companyId = ctx.meta?.companyId as string | undefined
        if (!companyId) return []
        return await getPages({ data: { companyId } })
      },
      queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        const { modified } = transaction.mutations[0]
        await createPage({
          data: {
            companyId: modified.companyId,
            h1: modified.h1,
            pageTitle: modified.pageTitle,
            pageDescription: modified.pageDescription,
            slug: modified.slug,
            markdownContent: modified.markdownContent,
            jsonSchema: modified.jsonSchema,
          },
        })
      },
      onUpdate: async ({ transaction }) => {
        const { original, modified } = transaction.mutations[0]
        await updatePage({
          data: {
            pageId: original.id,
            h1: modified.h1,
            pageTitle: modified.pageTitle,
            pageDescription: modified.pageDescription,
            slug: modified.slug,
            markdownContent: modified.markdownContent,
            jsonSchema: modified.jsonSchema,
          },
        })
      },
      onDelete: async ({ transaction }) => {
        const { original } = transaction.mutations[0]
        await deletePage({ data: { pageId: original.id } })
      },
    }),
  )
}
