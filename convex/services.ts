import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('services')
      .filter((q) => q.eq(q.field('companyId'), args.companyId))
      .collect()
  },
})

export const create = mutation({
  args: {
    companyId: v.id('companies'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('services', {
      companyId: args.companyId,
      name: args.name,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('services'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      name: args.name,
    })
  },
})

export const remove = mutation({
  args: {
    id: v.id('services'),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
