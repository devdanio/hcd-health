import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'

export const createAppointment = mutation({
  args: {
    companyId: v.optional(v.id('companies')),
    contactId: v.id('contacts'),
    patientName: v.optional(v.string()),
    dateOfService: v.optional(v.string()),
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
    dateOfService: v.optional(v.string()),
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
        dateOfService: v.optional(v.string()),
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
 * Get appointments analytics - count by day using dateOfService
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
    const now = Date.now()
    let startTime = 0

    // Calculate start time based on range
    if (timeRange !== 'all') {
      switch (timeRange) {
        case '7d':
          startTime = now - 7 * 24 * 60 * 60 * 1000
          break
        case '30d':
          startTime = now - 30 * 24 * 60 * 60 * 1000
          break
        case '90d':
          startTime = now - 90 * 24 * 60 * 60 * 1000
          break
      }
    }

    // Get all appointments for the company
    const appointments = await ctx.db
      .query('appointments')
      .filter((q) => q.eq(q.field('companyId'), args.companyId))
      .collect()

    // Parse date string (format: MM/DD/YYYY) and filter by time range
    const parseDate = (dateStr: string | undefined): number => {
      if (!dateStr) return 0
      const [month, day, year] = dateStr.split('/').map(Number)
      return new Date(year, month - 1, day).getTime()
    }

    const filteredAppointments = appointments.filter((apt) => {
      const aptDate = parseDate(apt.dateOfService)
      return aptDate >= startTime
    })

    // Format date based on groupBy parameter
    const formatDate = (dateStr: string | undefined) => {
      if (!dateStr) return ''
      const [month, day, year] = dateStr.split('/').map(Number)
      const date = new Date(year, month - 1, day)

      if (groupBy === 'day') {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      } else if (groupBy === 'week') {
        // Get ISO week number
        const tempDate = new Date(date)
        tempDate.setHours(0, 0, 0, 0)
        tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7))
        const week1 = new Date(tempDate.getFullYear(), 0, 4)
        const weekNum = Math.round(
          ((tempDate.getTime() - week1.getTime()) / 86400000 -
            3 +
            ((week1.getDay() + 6) % 7)) /
            7,
        )
        return `${year}-W${String(weekNum + 1).padStart(2, '0')}`
      } else {
        // month
        return `${year}-${String(month).padStart(2, '0')}`
      }
    }

    // Group appointments by day with proper typing
    const dataMap = new Map<string, Record<string, number>>()

    // Count appointments by day and serviceId
    for (const apt of filteredAppointments) {
      if (!apt.dateOfService) continue
      const dateKey = formatDate(apt.dateOfService)
      if (dateKey) {
        const current = dataMap.get(dateKey) || {}

        // Look up service name by serviceId
        let serviceName = 'Unknown'
        if (apt.serviceId) {
          const service = await ctx.db.get(apt.serviceId)
          if (service) {
            serviceName = service.name
          }
        }

        current[serviceName] = (current[serviceName] || 0) + 1
        dataMap.set(dateKey, current)
      }
    }

    // Convert to array format for charting and sort by date
    const result = Array.from(dataMap.entries())
      .map(([date, counts]) => ({
        date,
        ...counts,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return result
  },
})

/**
 * Get revenue by service - sum of charge amounts per service
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
    const now = Date.now()
    let startTime = 0

    // Calculate start time based on range
    if (timeRange !== 'all') {
      switch (timeRange) {
        case '7d':
          startTime = now - 7 * 24 * 60 * 60 * 1000
          break
        case '30d':
          startTime = now - 30 * 24 * 60 * 60 * 1000
          break
        case '90d':
          startTime = now - 90 * 24 * 60 * 60 * 1000
          break
      }
    }

    // Get all appointments for the company
    const appointments = await ctx.db
      .query('appointments')
      .filter((q) => q.eq(q.field('companyId'), args.companyId))
      .collect()

    // Parse date string (format: MM/DD/YYYY) and filter by time range
    const parseDate = (dateStr: string | undefined): number => {
      if (!dateStr) return 0
      const [month, day, year] = dateStr.split('/').map(Number)
      return new Date(year, month - 1, day).getTime()
    }

    const filteredAppointments = appointments.filter((apt) => {
      const aptDate = parseDate(apt.dateOfService)
      return aptDate >= startTime
    })

    // Get all procedures for these appointments
    const appointmentIds = filteredAppointments.map((apt) => apt._id)
    const allProcedures = await ctx.db.query('appointmentProcedures').collect()
    const procedures = allProcedures.filter((proc) =>
      appointmentIds.includes(proc.appointmentId),
    )

    // Sum charges by serviceId
    const revenueByServiceId = new Map<Id<'services'>, number>()

    for (const apt of filteredAppointments) {
      if (!apt.serviceId) continue

      // Get all procedures for this appointment
      const aptProcedures = procedures.filter(
        (proc) => proc.appointmentId === apt._id,
      )

      // Sum charge amounts for this appointment
      const totalCharge = aptProcedures.reduce(
        (sum, proc) => sum + proc.chargeAmount,
        0,
      )

      // Add to service total
      const currentTotal = revenueByServiceId.get(apt.serviceId) || 0
      revenueByServiceId.set(apt.serviceId, currentTotal + totalCharge)
    }

    // Fetch service names and build result
    const result: Array<{
      serviceId: Id<'services'>
      serviceName: string
      revenue: number
    }> = []

    for (const [serviceId, revenue] of revenueByServiceId.entries()) {
      const service = await ctx.db.get(serviceId)
      if (service) {
        result.push({
          serviceId,
          serviceName: service.name,
          revenue,
        })
      }
    }

    // Sort by revenue descending
    return result.sort((a, b) => b.revenue - a.revenue)
  },
})
