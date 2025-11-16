import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

export const createAppointment = mutation({
  args: {
    companyId: v.optional(v.id('companies')),
    patientName: v.string(),
    dateOfService: v.optional(v.string()),
    service: v.union(v.literal('acupuncture'), v.literal('consultation')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('appointments', args)
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

    // Format date as YYYY-MM-DD
    const formatDate = (dateStr: string | undefined) => {
      if (!dateStr) return ''
      const [month, day, year] = dateStr.split('/').map(Number)
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }

    // Group appointments by day with proper typing
    const dataMap = new Map<
      string,
      { acupuncture: number; consultation: number }
    >()

    // Count appointments by day and type
    for (const apt of filteredAppointments) {
      if (!apt.dateOfService) continue
      const dateKey = formatDate(apt.dateOfService)
      if (dateKey) {
        const current = dataMap.get(dateKey) || {
          acupuncture: 0,
          consultation: 0,
        }
        if (apt.service === 'consultation') {
          current.consultation += 1
        } else {
          current.acupuncture += 1
        }
        dataMap.set(dateKey, current)
      }
    }

    // Convert to array format for charting and sort by date
    const result = Array.from(dataMap.entries())
      .map(([date, counts]) => ({
        date,
        acupuncture: counts.acupuncture,
        consultation: counts.consultation,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return result
  },
})
