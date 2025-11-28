import { z } from 'zod'

export const getPatientsSchema = z.object({
  companyId: z.string(),
})

export const getPatientSchema = z.object({
  patientId: z.string(),
})

export const createPatientSchema = z.object({
  companyId: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  payerName: z.string().optional(),
  memberId: z.string().optional(),
  groupId: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
})

export const updatePatientSchema = z.object({
  patientId: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  payerName: z.string().optional(),
  memberId: z.string().optional(),
  groupId: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
})

export const deletePatientSchema = z.object({
  patientId: z.string(),
})
