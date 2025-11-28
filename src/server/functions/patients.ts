import { createServerFn } from '@tanstack/react-start'

import { prisma } from '../db/client'
import {
  getPatientsSchema,
  getPatientSchema,
  createPatientSchema,
  updatePatientSchema,
  deletePatientSchema,
} from '../schemas/patients'

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
