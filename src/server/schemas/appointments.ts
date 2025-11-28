import { z } from 'zod'

export const getAppointmentsSchema = z.object({
  companyId: z.string(),
})

export const getAppointmentsAnalyticsSchema = z.object({
  companyId: z.string(),
  timeRange: z.enum(['7d', '30d', '90d', 'all']).optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
})

export const getRevenueByServiceSchema = z.object({
  companyId: z.string(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
})

export const createAppointmentSchema = z.object({
  companyId: z.string(),
  contactId: z.string(),
  patientName: z.string().optional(),
  dateOfService: z.date(),
  service: z.string().optional(),
  serviceId: z.string().optional(),
  providerId: z.string().optional(),
})

export const createAppointmentWithContactSchema = z.object({
  companyId: z.string(),
  contactId: z.string(),
  serviceId: z.string(),
  providerId: z.string(),
  dateOfService: z.date(),
})

export const createAppointmentProcedureSchema = z.object({
  appointmentId: z.string(),
  procedureCode: z.string(),
  chargeAmount: z.number(),
})

export const bulkCreateAppointmentsSchema = z.object({
  companyId: z.string(),
  appointments: z.array(
    z.object({
      contactId: z.string(),
      dateOfService: z.date(),
      serviceId: z.string().optional(),
      providerId: z.string().optional(),
      patientName: z.string().optional(),
    })
  ),
})

export const deleteRecentAppointmentsSchema = z.object({
  companyId: z.string(),
  minutesAgo: z.number(),
})
