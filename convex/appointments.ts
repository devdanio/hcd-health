// @ts-nocheck
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'
import dayjs from 'dayjs'
import weekOfYear from 'dayjs/plugin/weekOfYear'

dayjs.extend(weekOfYear)

export const createAppointment = mutation({
  args: {
    companyId: v.optional(v.id('companies')),
    contactId: v.id('contacts'),
    patientName: v.optional(v.string()),
    dateOfService: v.optional(v.number()),
    service: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('appointments', args)
  },
})

export const createAppointmentWithContact = mutation({
  args: {
    companyId: v.optional(v.id('companies')),
    contactId: v.id('contacts'),
    patientName: v.optional(v.string()),
    dateOfService: v.optional(v.number()),
    service: v.optional(v.string()),
    serviceId: v.optional(v.id('services')),
    providerId: v.optional(v.id('providers')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('appointments', {
      companyId: args.companyId,
      contactId: args.contactId,
      patientName: args.patientName,
      dateOfService: args.dateOfService,
      service: args.service,
      serviceId: args.serviceId,
      providerId: args.providerId,
    })
  },
})

export const createAppointmentProcedure = mutation({
  args: {
    appointmentId: v.id('appointments'),
    procedureCode: v.string(),
    chargeAmount: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('appointmentProcedures', {
      appointmentId: args.appointmentId,
      procedureCode: args.procedureCode,
      chargeAmount: args.chargeAmount,
    })
  },
})

export const bulkCreate = mutation({
  args: {
    appointments: v.array(
      v.object({
        companyId: v.optional(v.id('companies')),
        contactId: v.id('contacts'),
        patientName: v.optional(v.string()),
        dateOfService: v.optional(v.number()),
        service: v.optional(v.string()),
        serviceId: v.optional(v.id('services')),
        providerId: v.optional(v.id('providers')),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const apt of args.appointments) {
      await ctx.db.insert('appointments', apt)
    }
  },
})

export const deleteRecentAppointments = mutation({
  args: {
    companyId: v.id('companies'),
    minutes: v.number(),
  },
  handler: async (ctx, args) => {
    const { companyId, minutes } = args
    const cutoffTime = Date.now() - minutes * 60 * 1000

    const appointments = await ctx.db
      .query('appointments')
      .filter((q) =>
        q.and(
          q.eq(q.field('companyId'), companyId),
          q.gte(q.field('_creationTime'), cutoffTime),
        ),
      )
      .take(1000)

    console.log(`Found ${appointments.length} appointments to delete (batch).`)

    for (const apt of appointments) {
      await ctx.db.delete(apt._id)
    }

    return appointments.length
  },
})

export const getAppointments = query({
  args: {
    companyId: v.id('companies'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 1000

    const appointments = await ctx.db
      .query('appointments')
      .filter((q) => q.eq(q.field('companyId'), args.companyId))
      .order('desc')
      .take(limit)

    return appointments
  },
})

/**
 * Get appointments analytics - uses agg_chargAmountByServiceAndDate for revenue data
 */
export const getAppointmentsAnalytics = query({
  args: {
    companyId: v.id('companies'),
    timeRange: v.optional(
      v.union(
        v.literal('7d'),
        v.literal('30d'),
        v.literal('90d'),
        v.literal('all'),
      ),
    ),
    groupBy: v.optional(
      v.union(v.literal('day'), v.literal('week'), v.literal('month')),
    ),
  },
  handler: async (ctx, args) => {
    const groupBy = args.groupBy || 'day'
    const timeRange = args.timeRange || '30d'
    const now = dayjs()
    let startDate = dayjs(0) // Unix epoch for 'all'

    // Calculate start time based on range using dayjs
    if (timeRange !== 'all') {
      switch (timeRange) {
        case '7d':
          startDate = now.subtract(7, 'day').startOf('day')
          break
        case '30d':
          startDate = now.subtract(30, 'day').startOf('day')
          break
        case '90d':
          startDate = now.subtract(90, 'day').startOf('day')
          break
      }
    }

    const startTime = startDate.valueOf()

    // Get all aggregated data for the company within time range
    const aggregatedData = await ctx.db
      .query('agg_chargAmountByServiceAndDate')
      .withIndex('date_serviceId', (q) => q.gte('date', startTime))
      .collect()

    // Get all services for this company to filter the aggregated data
    const services = await ctx.db
      .query('services')
      .filter((q) => q.eq(q.field('companyId'), args.companyId))
      .collect()

    const serviceIdToName = new Map<Id<'services'>, string>()
    const companyServiceIds = new Set<Id<'services'>>()

    for (const service of services) {
      serviceIdToName.set(service._id, service.name)
      companyServiceIds.add(service._id)
    }

    // Filter aggregated data to only include this company's services
    const companyAggregatedData = aggregatedData.filter((agg) =>
      companyServiceIds.has(agg.serviceId),
    )

    // Format date based on groupBy parameter (timestamp -> string key)
    const formatDate = (timestamp: number) => {
      const date = dayjs(timestamp)

      if (groupBy === 'day') {
        return date.format('YYYY-MM-DD')
      } else if (groupBy === 'week') {
        // Get ISO week number
        const year = date.year()
        const week = date.week()
        return `${year}-W${String(week).padStart(2, '0')}`
      } else {
        // month
        return date.format('YYYY-MM')
      }
    }

    // Group revenue by date and service
    const dataMap = new Map<string, Record<string, number>>()

    for (const agg of companyAggregatedData) {
      const dateKey = formatDate(agg.date)
      const serviceName = serviceIdToName.get(agg.serviceId) || 'Unknown'
      const current = dataMap.get(dateKey) || {}

      current[serviceName] = (current[serviceName] || 0) + agg.chargeAmount
      dataMap.set(dateKey, current)
    }

    // Convert to array format for charting and sort by date
    const result = Array.from(dataMap.entries())
      .map(([date, revenue]) => ({
        date,
        ...revenue,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return result
  },
})

/**
 * Get revenue by service - uses agg_chargAmountByServiceAndDate for efficient aggregation
 */
export const getRevenueByService = query({
  args: {
    companyId: v.id('companies'),
    timeRange: v.optional(
      v.union(
        v.literal('7d'),
        v.literal('30d'),
        v.literal('90d'),
        v.literal('all'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const timeRange = args.timeRange || '30d'
    const now = dayjs()
    let startDate = dayjs(0) // Unix epoch for 'all'

    // Calculate start time based on range using dayjs
    if (timeRange !== 'all') {
      switch (timeRange) {
        case '7d':
          startDate = now.subtract(7, 'day').startOf('day')
          break
        case '30d':
          startDate = now.subtract(30, 'day').startOf('day')
          break
        case '90d':
          startDate = now.subtract(90, 'day').startOf('day')
          break
      }
    }

    const startTime = startDate.valueOf()

    // Get all aggregated data within time range
    const aggregatedData = await ctx.db
      .query('agg_chargAmountByServiceAndDate')
      .withIndex('date_serviceId', (q) => q.gte('date', startTime))
      .collect()

    // Get all services for this company
    const services = await ctx.db
      .query('services')
      .filter((q) => q.eq(q.field('companyId'), args.companyId))
      .collect()

    const companyServiceIds = new Set(services.map((s) => s._id))
    const serviceIdToName = new Map(services.map((s) => [s._id, s.name]))

    // Sum charges by serviceId (only for this company's services)
    const revenueByServiceId = new Map<Id<'services'>, number>()

    for (const agg of aggregatedData) {
      if (!companyServiceIds.has(agg.serviceId)) continue

      const currentTotal = revenueByServiceId.get(agg.serviceId) || 0
      revenueByServiceId.set(agg.serviceId, currentTotal + agg.chargeAmount)
    }

    // Build result array
    const result: Array<{
      serviceId: Id<'services'>
      serviceName: string
      revenue: number
    }> = []

    for (const [serviceId, revenue] of revenueByServiceId.entries()) {
      const serviceName = serviceIdToName.get(serviceId)
      if (serviceName) {
        result.push({
          serviceId,
          serviceName,
          revenue,
        })
      }
    }

    // Sort by revenue descending
    return result.sort((a, b) => b.revenue - a.revenue)
  },
})
