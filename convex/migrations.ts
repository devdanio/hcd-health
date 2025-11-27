import { Migrations } from '@convex-dev/migrations'
import { components } from './_generated/api.js'
import { DataModel } from './_generated/dataModel.js'

export const migrations = new Migrations<DataModel>(components.migrations)
export const run = migrations.runner()

export const setContactFirstServiceId = migrations.define({
  table: 'contacts',

  migrateOne: async (ctx, doc) => {
    if (doc.firstServiceId === undefined) {
      const apt = await ctx.db
        .query('appointments')
        .withIndex('contactId', (q) => q.eq('contactId', doc._id))
        .order('asc')
        .first()
      if (apt) {
        await ctx.db.patch(doc._id, { firstServiceId: apt.serviceId })
      }
    }
  },
})
