import { mutation } from './_generated/server'
import { v } from 'convex/values'
import dayjs from 'dayjs'

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
    const batchSize = args.batchSize ?? 100

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

export const migrateChargeAmountByServiceAndDate = mutation({
  args: {
    companyId: v.id('companies'),
    date: v.number(), // Unix timestamp for the day (at midnight)
  },
  handler: async (ctx, args) => {
    const { companyId, date } = args

    // Calculate start and end of the day (ignoring time, just by calendar day)
    const dayStart = dayjs(date).startOf('day')
    const dayEnd = dayjs(date).endOf('day')
    const startOfDayTimestamp = dayStart.valueOf()
    const endOfDayTimestamp = dayEnd.valueOf()

    console.log(
      `Processing appointments for ${dayStart.format('YYYY-MM-DD')}`,
    )

    // Get all appointments for this company on this specific day
    const appointments = await ctx.db
      .query('appointments')
      .withIndex('companyId_dateOfService', (q) =>
        q.eq('companyId', companyId).gte('dateOfService', startOfDayTimestamp),
      )
      .filter((q) => q.lte(q.field('dateOfService'), endOfDayTimestamp))
      .collect()

    console.log(`Found ${appointments.length} appointments`)

    // Group charge amounts by serviceId
    const chargesByService = new Map<string, number>()

    // Process each appointment and its procedures
    for (const appointment of appointments) {
      // Skip appointments without a serviceId
      if (!appointment.serviceId) {
        console.log(
          `Skipping appointment ${appointment._id} - no serviceId`,
        )
        continue
      }

      // Get all procedures for this appointment
      const procedures = await ctx.db
        .query('appointmentProcedures')
        .withIndex('appointmentId', (q) =>
          q.eq('appointmentId', appointment._id),
        )
        .collect()

      // Sum up the charge amounts for this serviceId
      const serviceId = appointment.serviceId
      const currentTotal = chargesByService.get(serviceId) ?? 0

      const procedureTotal = procedures.reduce(
        (sum, proc) => sum + proc.chargeAmount,
        0,
      )

      chargesByService.set(serviceId, currentTotal + procedureTotal)
    }

    console.log(
      `Aggregated charges for ${chargesByService.size} different services`,
    )

    // Get all services for this company to filter deletion
    const companyServices = await ctx.db
      .query('services')
      .filter((q) => q.eq(q.field('companyId'), companyId))
      .collect()

    const companyServiceIds = new Set(
      companyServices.map((service) => service._id),
    )

    // Delete existing records for this date, but only for services belonging to this company
    const existingRecords = await ctx.db
      .query('agg_chargAmountByServiceAndDate')
      .withIndex('date_serviceId', (q) => q.eq('date', startOfDayTimestamp))
      .collect()

    let deletedCount = 0
    for (const record of existingRecords) {
      // Only delete if this service belongs to the company we're processing
      if (companyServiceIds.has(record.serviceId)) {
        await ctx.db.delete(record._id)
        deletedCount++
      }
    }

    console.log(
      `Deleted ${deletedCount} existing records for this date and company`,
    )

    // Insert new aggregated records
    let insertedCount = 0
    for (const [serviceId, chargeAmount] of chargesByService.entries()) {
      await ctx.db.insert('agg_chargAmountByServiceAndDate', {
        serviceId: serviceId as any, // Type assertion needed for Map key
        chargeAmount,
        date: startOfDayTimestamp,
      })
      insertedCount++
    }

    console.log(`Inserted ${insertedCount} new aggregated records`)

    return {
      date: dayjs(date).format('YYYY-MM-DD'),
      appointmentsProcessed: appointments.length,
      servicesAggregated: chargesByService.size,
      recordsInserted: insertedCount,
    }
  },
})
