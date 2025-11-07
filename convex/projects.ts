import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

/**
 * Create a new tracking project
 */
export const createProject = mutation({
  args: {
    name: v.string(),
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    // Generate API key
    const apiKey = generateApiKey()

    const projectId = await ctx.db.insert('projects', {
      name: args.name,
      domain: args.domain,
      apiKey,
    })

    return { projectId, apiKey }
  },
})

/**
 * Get all projects
 */
export const getProjects = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('projects').collect()
  },
})

/**
 * Get project by ID
 */
export const getProject = query({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId)
  },
})

/**
 * Get project by API key
 */
export const getProjectByApiKey = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('projects')
      .withIndex('apiKey', (q) => q.eq('apiKey', args.apiKey))
      .first()
  },
})

/**
 * Update project
 */
export const updateProject = mutation({
  args: {
    projectId: v.id('projects'),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { projectId, ...updates } = args
    await ctx.db.patch(projectId, updates)
    return { projectId }
  },
})

/**
 * Delete project
 */
export const deleteProject = mutation({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.projectId)
    return { success: true }
  },
})

/**
 * Regenerate API key for a project
 */
export const regenerateApiKey = mutation({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const apiKey = generateApiKey()
    await ctx.db.patch(args.projectId, { apiKey })
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
