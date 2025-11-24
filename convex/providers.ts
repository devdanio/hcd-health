import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const providers = await ctx.db
      .query('providers')
      .filter((q) => q.eq(q.field('companyId'), args.companyId))
      .collect()

    // Fetch service names for each provider
    const providersWithServices = await Promise.all(
      providers.map(async (provider) => {
        const service = await ctx.db.get(provider.service)
        return {
          ...provider,
          serviceName: service?.name || 'Unknown Service',
        }
      })
    )

    return providersWithServices
  },
})

export const create = mutation({
  args: {
    companyId: v.id('companies'),
    name: v.string(),
    service: v.id('services'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('providers', {
      companyId: args.companyId,
      name: args.name,
      service: args.service,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('providers'),
    name: v.optional(v.string()),
    service: v.optional(v.id('services')),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args
    await ctx.db.patch(id, updates)
  },
})

export const remove = mutation({
  args: {
    id: v.id('providers'),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
