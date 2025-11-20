import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { patientFields } from './schema'
import { Id } from './_generated/dataModel'

export const getPatients = query({
  args: {},
  handler: async (ctx) => {
    const patients = await ctx.db.query('patients').collect()
    return await Promise.all(
      patients.map(async (patient) => {
        let contact = null
        if (patient.contactId) {
          contact = await ctx.db.get(patient.contactId)
        }
        return {
          ...patient,
          contact,
        }
      }),
    )
  },
})

export const getPatient = query({
  args: { id: v.id('patients') },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.id)
    if (!patient) return null

    let contact = null
    if (patient.contactId) {
      contact = await ctx.db.get(patient.contactId)
    }

    return {
      ...patient,
      contact,
    }
  },
})

export const createPatient = mutation({
  args: {
    companyId: v.id('companies'),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    phone: v.string(),
    email: v.optional(v.string()),
    ...patientFields,
  },
  handler: async (ctx, args) => {
    const { companyId, firstName, lastName, phone, email, ...patientData } = args

    // Check for existing contact by phone
    let existingContact = await ctx.db
      .query('contacts')
      .withIndex('companyId_phone', (q) =>
        q.eq('companyId', companyId).eq('phone', phone),
      )
      .first()

    // If not found by phone, check by email if provided
    if (!existingContact && email) {
      existingContact = await ctx.db
        .query('contacts')
        .withIndex('companyId_email', (q) =>
          q.eq('companyId', companyId).eq('email', email),
        )
        .first()
    }

    let contactId: Id<'contacts'>

    if (existingContact) {
      // Update existing contact
      contactId = existingContact._id
      await ctx.db.patch(contactId, {
        firstName,
        lastName,
        phone,
        email: email || existingContact.email, // Keep existing email if not provided
        fullName: `${firstName} ${lastName || ''}`.trim(),
      })
    } else {
      // Create new contact
      contactId = await ctx.db.insert('contacts', {
        companyId,
        firstName,
        lastName,
        phone,
        email,
        fullName: `${firstName} ${lastName || ''}`.trim(),
      })
    }

    return await ctx.db.insert('patients', {
      contactId,
      ...patientData,
    })
  },
})

export const updatePatient = mutation({
  args: {
    id: v.id('patients'),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    ...patientFields,
  },
  handler: async (ctx, args) => {
    const { id, firstName, lastName, phone, email, contactId, ...patientData } = args
    
    // Get the patient to find the contact
    const patient = await ctx.db.get(id)
    if (!patient) {
      throw new Error('Patient not found')
    }

    // Update contact if contact fields are provided
    if (patient.contactId && (firstName !== undefined || lastName !== undefined || phone !== undefined || email !== undefined)) {
      const updates: any = {}
      if (firstName !== undefined) updates.firstName = firstName
      if (lastName !== undefined) updates.lastName = lastName
      if (phone !== undefined) updates.phone = phone
      if (email !== undefined) updates.email = email
      
      // Update fullName if firstName or lastName changed
      if (firstName !== undefined || lastName !== undefined) {
        const contact = await ctx.db.get(patient.contactId)
        const newFirstName = firstName !== undefined ? firstName : contact?.firstName || ''
        const newLastName = lastName !== undefined ? lastName : contact?.lastName || ''
        updates.fullName = `${newFirstName} ${newLastName}`.trim()
      }
      
      await ctx.db.patch(patient.contactId, updates)
    }

    // Update patient
    await ctx.db.patch(id, patientData)
  },
})

export const deletePatient = mutation({
  args: { id: v.id('patients') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
