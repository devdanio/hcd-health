import { createServerFn } from '@tanstack/react-start'

import { prisma } from '../db/client'
import { Prisma } from '@prisma/client'
import {
  getAppointmentsSchema,
  getAppointmentsAnalyticsSchema,
  getRevenueByServiceSchema,
  createAppointmentSchema,
  createAppointmentWithContactSchema,
  createAppointmentProcedureSchema,
  bulkCreateAppointmentsSchema,
  deleteRecentAppointmentsSchema,
} from '../schemas/appointments'

/**
 * Get appointments for a company
 */
export const getAppointments = createServerFn({ method: 'GET' })
  .inputValidator(getAppointmentsSchema)
  .handler(async ({ data }) => {
    return await prisma.appointment.findMany({
      where: { companyId: data.companyId },
      include: {
        contact: {
          select: {
            email: true,
            fullName: true,
            firstName: true,
            lastName: true,
          },
        },
        serviceRel: {
          select: { name: true },
        },
        provider: {
          select: { name: true },
        },
        procedures: true,
      },
      orderBy: { dateOfService: 'desc' },
    })
  })

/**
 * Get appointments analytics with revenue aggregation
 * Uses PostgreSQL CTEs to replace agg_chargAmountByServiceAndDate table
 */
export const getAppointmentsAnalytics = createServerFn({ method: 'GET' })
  .inputValidator(getAppointmentsAnalyticsSchema)
  .handler(async ({ data }) => {
    const { companyId, timeRange = '30d', groupBy = 'day' } = data

    // Calculate start date
    let startDate = new Date(0)
    if (timeRange !== 'all') {
      const days = { '7d': 7, '30d': 30, '90d': 90 }[timeRange]
      startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
    }

    // Use raw SQL with CTEs for aggregation
    const results = await prisma.$queryRaw<
      Array<{ date: string; service_name: string; revenue: number }>
    >`
      WITH revenue_by_date AS (
        SELECT
          a.service_id,
          s.name as service_name,
          a.date_of_service,
          SUM(ap.charge_amount) as total_charge
        FROM "AppointmentProcedure" ap
        JOIN "Appointment" a ON ap.appointment_id = a.id
        LEFT JOIN "Service" s ON a.service_id = s.id
        WHERE a.company_id = ${companyId}
          AND a.date_of_service >= ${startDate}
        GROUP BY a.service_id, s.name, a.date_of_service
      )
      SELECT
        CASE
          WHEN ${groupBy} = 'day' THEN TO_CHAR(date_of_service, 'YYYY-MM-DD')
          WHEN ${groupBy} = 'week' THEN TO_CHAR(date_of_service, 'IYYY-"W"IW')
          WHEN ${groupBy} = 'month' THEN TO_CHAR(date_of_service, 'YYYY-MM')
        END as date,
        COALESCE(service_name, 'Unknown') as service_name,
        SUM(total_charge)::float as revenue
      FROM revenue_by_date
      GROUP BY date, service_name
      ORDER BY date ASC
    `

    // Transform to chart-friendly format
    const dataMap = new Map<string, any>()

    for (const row of results) {
      if (!dataMap.has(row.date)) {
        dataMap.set(row.date, { date: row.date })
      }
      dataMap.get(row.date)[row.service_name] = row.revenue
    }

    return Array.from(dataMap.values())
  })

/**
 * Get revenue by service
 */
export const getRevenueByService = createServerFn({ method: 'GET' })
  .inputValidator(getRevenueByServiceSchema)
  .handler(async ({ data }) => {
    const { companyId, startDate, endDate } = data

    const whereClause: Prisma.AppointmentWhereInput = {
      companyId,
    }

    if (startDate || endDate) {
      whereClause.dateOfService = {}
      if (startDate) whereClause.dateOfService.gte = startDate
      if (endDate) whereClause.dateOfService.lte = endDate
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        procedures: true,
        serviceRel: {
          select: { name: true },
        },
      },
    })

    // Group revenue by service
    const revenueByService = new Map<string, number>()

    for (const appointment of appointments) {
      const serviceName = appointment.serviceRel?.name || 'Unknown'
      const revenue = appointment.procedures.reduce(
        (sum, proc) => sum + proc.chargeAmount,
        0,
      )
      revenueByService.set(
        serviceName,
        (revenueByService.get(serviceName) || 0) + revenue,
      )
    }

    return Array.from(revenueByService.entries()).map(([service, revenue]) => ({
      service,
      revenue,
    }))
  })

/**
 * Create an appointment
 */
export const createAppointment = createServerFn({ method: 'POST' })
  .inputValidator(createAppointmentSchema)
  .handler(async ({ data }) => {
    return await prisma.appointment.create({
      data,
    })
  })

/**
 * Create appointment with service and provider
 */
export const createAppointmentWithContact = createServerFn({ method: 'POST' })
  .inputValidator(createAppointmentWithContactSchema)
  .handler(async ({ data }) => {
    return await prisma.appointment.create({
      data,
    })
  })

/**
 * Create appointment procedure
 */
export const createAppointmentProcedure = createServerFn({ method: 'POST' })
  .inputValidator(createAppointmentProcedureSchema)
  .handler(async ({ data }) => {
    return await prisma.appointmentProcedure.create({
      data,
    })
  })

/**
 * Bulk create appointments
 */
export const bulkCreateAppointments = createServerFn({ method: 'POST' })
  .inputValidator(bulkCreateAppointmentsSchema)
  .handler(async ({ data }) => {
    const { companyId, appointments } = data

    const created = await prisma.appointment.createMany({
      data: appointments.map((apt) => ({
        ...apt,
        companyId,
      })),
    })

    return { count: created.count }
  })

/**
 * Delete recent appointments (for cleanup/testing)
 */
export const deleteRecentAppointments = createServerFn({ method: 'POST' })
  .inputValidator(deleteRecentAppointmentsSchema)
  .handler(async ({ data }) => {
    const cutoffTime = new Date()
    cutoffTime.setMinutes(cutoffTime.getMinutes() - data.minutesAgo)

    const deleted = await prisma.appointment.deleteMany({
      where: {
        companyId: data.companyId,
        createdAt: {
          gte: cutoffTime,
        },
      },
    })

    return { count: deleted.count }
  })
