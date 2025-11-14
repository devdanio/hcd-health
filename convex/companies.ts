import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

/**
 * Create a new tracking company
 */
export const createCompany = mutation({
  args: {
    name: v.string(),
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    // Generate API key
    const apiKey = generateApiKey()

    const companyId = await ctx.db.insert('companies', {
      name: args.name,
      domain: args.domain,
      apiKey,
    })

    return { companyId, apiKey }
  },
})

/**
 * Get all companies
 */
export const getCompanies = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('companies').collect()
  },
})

/**
 * Get company by ID
 */
export const getCompany = query({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.companyId)
  },
})

/**
 * Get company by API key
 */
export const getCompanyByApiKey = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('companies')
      .withIndex('apiKey', (q) => q.eq('apiKey', args.apiKey))
      .first()
  },
})

/**
 * Update company
 */
export const updateCompany = mutation({
  args: {
    companyId: v.id('companies'),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { companyId, ...updates } = args
    await ctx.db.patch(companyId, updates)
    return { companyId }
  },
})

/**
 * Delete company
 */
export const deleteCompany = mutation({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.companyId)
    return { success: true }
  },
})

/**
 * Regenerate API key for a company
 */
export const regenerateApiKey = mutation({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const apiKey = generateApiKey()
    await ctx.db.patch(args.companyId, { apiKey })
    return { apiKey }
  },
})

// Helper to generate a secure API key
function generateApiKey(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'la_' // prefix for "leadalytics"
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
