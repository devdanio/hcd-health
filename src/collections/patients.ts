import { createServerFn } from '@tanstack/react-start'
import {
  createCollection,
  eq,
  parseLoadSubsetOptions,
} from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import type { QueryClient } from '@tanstack/react-query'
import { createContactSchema } from './contacts'
import { DataSource } from '@/generated/prisma/enums'

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
  contactId: z.string().nullable().optional(),
  email: z.email().nullable().optional(),
  phone: z.string(),
  fullName: z.string().nullable().optional(),
  firstName: z.string(),
  lastName: z.string().nullable().optional(),
})

export const updatePatientSchema = z.object({
  patientId: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
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
    return await prisma.profile.findMany({
      where: {
        person: {
          company_id: data.companyId,
        },
        source: {
          in: [
            DataSource.JASMINE,
            DataSource.CHIROTOUCH,
            DataSource.UNIFIED_PRACTICE,
          ],
        },
      },
      include: {
        person: {
          include: {
            purchases: true,
          },
        },
      },
      orderBy: { external_created_at: 'desc' },
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
 * Create a patient with contact (create new or upsert existing)
 *
 * Logic:
 * 1. If contact is null -> create new contact
 * 2. If contact.id exists -> upsert that contact (update only provided fields)
 * 3. If contact has email/phone -> try to match existing contact, then upsert
 * 4. Always create a new patient record
 */
export const createPatient = createServerFn({ method: 'POST' })
  .inputValidator(createPatientSchema)
  .handler(async ({ data }) => {
    const { companyId, contactId, ...patientData } = data

    let newContactId: string
    if (!contactId) {
      // Case 1: No contact provided, create a new empty contact
      const newContact = await prisma.contact.create({
        data: {
          companyId,
          email: null,
          phone: null,
          fullName: null,
          firstName: null,
          lastName: null,
        },
      })
      newContactId = newContact.id
    } else if (contactId) {
      // Case 2: Contact ID provided, upsert that contact
      // Only update fields that are actually provided (not null/undefined)
      const updateData: any = {}

      if (patientData.email !== undefined) updateData.email = patientData.email
      if (patientData.phone !== undefined) updateData.phone = patientData.phone
      if (patientData.fullName !== undefined)
        updateData.fullName = patientData.fullName
      if (patientData.firstName !== undefined)
        updateData.firstName = patientData.firstName
      if (patientData.lastName !== undefined)
        updateData.lastName = patientData.lastName

      // If there's data to update, update the contact
      if (Object.keys(updateData).length > 0) {
        await prisma.contact.update({
          where: { id: contactId },
          data: updateData,
        })
      }
    } else {
      // Case 3: Try to find existing contact by email or phone
      let existingContact = null

      if (patientData.email) {
        existingContact = await prisma.contact.findFirst({
          where: {
            companyId,
            email: patientData.email,
          },
        })
      }

      if (!existingContact && patientData.phone) {
        existingContact = await prisma.contact.findFirst({
          where: {
            companyId,
            phone: patientData.phone,
          },
        })
      }

      if (existingContact) {
        // Found existing contact, upsert it
        const updateData: any = {}

        if (patientData.email !== undefined)
          updateData.email = patientData.email
        if (patientData.phone !== undefined)
          updateData.phone = patientData.phone
        if (patientData.fullName !== undefined)
          updateData.fullName = patientData.fullName
        if (patientData.firstName !== undefined)
          updateData.firstName = patientData.firstName
        if (patientData.lastName !== undefined)
          updateData.lastName = patientData.lastName

        if (Object.keys(updateData).length > 0) {
          await prisma.contact.update({
            where: { id: existingContact.id },
            data: updateData,
          })
        }

        newContactId = existingContact.id
      } else {
        // No existing contact found, create new one
        const newContact = await prisma.contact.create({
          data: {
            companyId,
            email: patientData.email ?? null,
            phone: patientData.phone ?? null,
            fullName: patientData.fullName ?? null,
            firstName: patientData.firstName ?? null,
            lastName: patientData.lastName ?? null,
          },
        })
        newContactId = newContact.id
      }
    }

    // Always create the patient record
    return await prisma.patient.create({
      data: {
        contact: {
          connect: {
            id: contactId ?? newContactId,
          },
        },
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
    const { patientId, email, phone, fullName, firstName, lastName } = data

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

    // Return updated patient with contact
    return await prisma.patient.findUnique({
      where: { id: patientId },
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
      syncMode: 'on-demand',
      queryFn: async (ctx) => {
        const options = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions)
        const companyId = options?.filters.find((filter) =>
          filter.field.includes('companyId'),
        )?.value as string | undefined
        if (!companyId) return []
        return await getPatients({ data: { companyId } })
      },
      queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        const { modified } = transaction.mutations[0]
        await createPatient({
          data: modified,
        })
      },
      onUpdate: async ({ transaction }) => {
        const { original, modified } = transaction.mutations[0]
        await updatePatient({
          data: {
            patientId: original.id,
            ...modified,
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
