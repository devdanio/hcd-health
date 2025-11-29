import { createServerFn } from '@tanstack/react-start'
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import type { QueryClient } from '@tanstack/react-query'

// ============================================================================
// Schemas
// ============================================================================

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

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all patients with contact enrichment
 */
export const getPatients = createServerFn({ method: 'GET' })
  .inputValidator(getPatientsSchema)
  .handler(async ({ data }) => {
    return await prisma.patient.findMany({
      where: {
        contact: {
          companyId: data.companyId,
        },
      },
      include: {
        contact: {
          select: {
            email: true,
            phone: true,
            fullName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

/**
 * Get a single patient with contact
 */
export const getPatient = createServerFn({ method: 'GET' })
  .inputValidator(getPatientSchema)
  .handler(async ({ data }) => {
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      include: {
        contact: true,
      },
    })

    if (!patient) {
      throw new Error('Patient not found')
    }

    return patient
  })

/**
 * Create a patient with contact
 */
export const createPatient = createServerFn({ method: 'POST' })
  .inputValidator(createPatientSchema)
  .handler(async ({ data }) => {
    const {
      companyId,
      email,
      phone,
      fullName,
      firstName,
      lastName,
      ...patientData
    } = data

    // First, find or create contact
    let contact = null

    if (email) {
      contact = await prisma.contact.findFirst({
        where: {
          companyId,
          email,
        },
      })
    } else if (phone) {
      contact = await prisma.contact.findFirst({
        where: {
          companyId,
          phone,
        },
      })
    }

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          companyId,
          email,
          phone,
          fullName,
          firstName,
          lastName,
        },
      })
    }

    // Create patient
    return await prisma.patient.create({
      data: {
        contactId: contact.id,
        ...patientData,
      },
      include: {
        contact: true,
      },
    })
  })

/**
 * Update a patient and related contact
 */
export const updatePatient = createServerFn({ method: 'POST' })
  .inputValidator(updatePatientSchema)
  .handler(async ({ data }) => {
    const {
      patientId,
      email,
      phone,
      fullName,
      firstName,
      lastName,
      ...patientData
    } = data

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    })

    if (!patient) {
      throw new Error('Patient not found')
    }

    // Update contact if any contact fields provided
    if (email || phone || fullName || firstName || lastName) {
      await prisma.contact.update({
        where: { id: patient.contactId },
        data: {
          email,
          phone,
          fullName,
          firstName,
          lastName,
        },
      })
    }

    // Update patient
    return await prisma.patient.update({
      where: { id: patientId },
      data: patientData,
      include: {
        contact: true,
      },
    })
  })

/**
 * Delete a patient
 */
export const deletePatient = createServerFn({ method: 'POST' })
  .inputValidator(deletePatientSchema)
  .handler(async ({ data }) => {
    await prisma.patient.delete({
      where: { id: data.patientId },
    })

    return { success: true }
  })

// ============================================================================
// Collection
// ============================================================================

export function createPatientsCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      id: 'patients',
      queryKey: ['patients'],
      queryFn: async (ctx) => {
        const companyId = ctx.meta?.companyId as string | undefined
        if (!companyId) return []
        return await getPatients({ data: { companyId } })
      },
      queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        const { modified } = transaction.mutations[0]
        await createPatient({
          data: {
            companyId: modified.contact.companyId,
            email: modified.contact.email,
            phone: modified.contact.phone,
            fullName: modified.contact.fullName,
            firstName: modified.contact.firstName,
            lastName: modified.contact.lastName,
            dateOfBirth: modified.dateOfBirth,
            gender: modified.gender,
            payerName: modified.payerName,
            memberId: modified.memberId,
            groupId: modified.groupId,
            emergencyContactName: modified.emergencyContactName,
            emergencyContactPhone: modified.emergencyContactPhone,
            emergencyContactRelation: modified.emergencyContactRelation,
          },
        })
      },
      onUpdate: async ({ transaction }) => {
        const { original, modified } = transaction.mutations[0]
        await updatePatient({
          data: {
            patientId: original.id,
            email: modified.contact?.email,
            phone: modified.contact?.phone,
            fullName: modified.contact?.fullName,
            firstName: modified.contact?.firstName,
            lastName: modified.contact?.lastName,
            dateOfBirth: modified.dateOfBirth,
            gender: modified.gender,
            payerName: modified.payerName,
            memberId: modified.memberId,
            groupId: modified.groupId,
            emergencyContactName: modified.emergencyContactName,
            emergencyContactPhone: modified.emergencyContactPhone,
            emergencyContactRelation: modified.emergencyContactRelation,
          },
        })
      },
      onDelete: async ({ transaction }) => {
        const { original } = transaction.mutations[0]
        await deletePatient({ data: { patientId: original.id } })
      },
    }),
  )
}
