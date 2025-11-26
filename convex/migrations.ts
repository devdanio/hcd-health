import { mutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * Step 1: Migrate dateOfService from string (MM/DD/YYYY) to number (Unix timestamp)
 * This mutation is no longer needed - migration already completed
 */
export const migrateDateOfServiceToNumber = mutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return {
      migratedCount: 0,
      errorCount: 0,
      remaining: false,
      total: 0,
      message:
        'Migration already completed - dateOfService is now a number type',
    }
  },
})

/**
 * Remove old dateOfService string field from all appointments
 */
export const removeOldDateOfServiceField = mutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 1000

    // Get appointments with pagination
    const result = await ctx.db.query('appointments').paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize,
    })

    console.log('appointment count', result.page.length)

    // Batch the patches for better performance
    const promises = []
    for (const appointment of result.page) {
      promises.push(
        ctx.db.patch(appointment._id, {
          // @ts-ignore - removing old field
          dateOfServiceNumber: undefined,
        }),
      )
    }

    await Promise.all(promises)

    console.log(`Removed dateOfService from ${result.page.length} appointments`)

    return {
      updatedCount: result.page.length,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    }
  },
})
