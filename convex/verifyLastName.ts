import { query } from './_generated/server'
import { v } from 'convex/values'

export const verifyLastName = query({
  args: { companyId: v.id('companies'), phone: v.string() },
  handler: async (ctx, args) => {
    const contact = await ctx.db
      .query('contacts')
      .withIndex('companyId_phone', (q) =>
        q.eq('companyId', args.companyId).eq('phone', args.phone),
      )
      .first()
    
    return contact
  },
})
