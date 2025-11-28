import { createServerFn } from '@tanstack/react-start'

import { prisma } from '../db/client'
import {
  getPagesSchema,
  getPageSchema,
  createPageSchema,
  updatePageSchema,
  deletePageSchema,
} from '../schemas/cms'

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
