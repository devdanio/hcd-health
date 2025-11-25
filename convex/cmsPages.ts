import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const getPages = query({
  args: { companyId: v.id('companies') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('cmsPages')
      .withIndex('companyId', (q) => q.eq('companyId', args.companyId))
      .collect()
  },
})

export const getPage = query({
  args: { id: v.id('cmsPages') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const createPage = mutation({
  args: {
    companyId: v.id('companies'),
    h1: v.string(),
    pageTitle: v.string(),
    pageDescription: v.string(),
    slug: v.string(),
    markdownContent: v.string(),
    jsonSchema: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('cmsPages', args)
  },
})

export const updatePage = mutation({
  args: {
    id: v.id('cmsPages'),
    h1: v.optional(v.string()),
    pageTitle: v.optional(v.string()),
    pageDescription: v.optional(v.string()),
    slug: v.optional(v.string()),
    markdownContent: v.optional(v.string()),
    jsonSchema: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args
    await ctx.db.patch(id, updates)
  },
})

export const deletePage = mutation({
  args: { id: v.id('cmsPages') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
