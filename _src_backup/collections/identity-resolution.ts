import { createServerFn } from '@tanstack/react-start'
import {
  createCollection,
} from '@tanstack/react-db'
import { z } from 'zod'
import { prisma } from '@/server/db/client'

// ============================================================================
// Schemas
// ============================================================================

export const resolveIdentitySchema = z.object({
  companyId: z.string(),
  hchUuid: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  externalId: z.string().optional(),
  externalSource: z.enum(['POSTHOG', 'GHL', 'CHIROTOUCH', 'SHOPIFY', 'UNIFIED_PRACTICE', 'JASMINE']).optional(),
})

export const createContactForTrackingSchema = z.object({
  companyId: z.string(),
})

export const validateHchUuidSchema = z.object({
  companyId: z.string(),
  hchUuid: z.string(),
})

export const attachExternalIdSchema = z.object({
  contactId: z.string(),
  externalId: z.string(),
  source: z.string(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Resolve identity with priority:
 * 1. hchUuid (contact.id)
 * 2. Email
 * 3. Phone
 * 4. External ID
 * 5. Create new
 */
export const resolveIdentity = createServerFn({ method: 'POST' })
  .validator(resolveIdentitySchema)
  .handler(async ({ data }) => {
    const { companyId, hchUuid, email, phone, externalId, externalSource } = data

    // Priority 1: hchUuid (contact.id)
    if (hchUuid) {
      const contact = await prisma.contact.findFirst({
        where: { id: hchUuid, companyId },
        include: { externalIds: true },
      })
      if (contact) {
        return {
          contactId: contact.id,
          isNew: false,
          contact,
        }
      }
    }

    // Priority 2: Email match
    if (email) {
      const contact = await prisma.contact.findFirst({
        where: { companyId, email },
        include: { externalIds: true },
      })
      if (contact) {
        return {
          contactId: contact.id,
          isNew: false,
          contact,
        }
      }
    }

    // Priority 3: Phone match
    if (phone) {
      const contact = await prisma.contact.findFirst({
        where: { companyId, phone },
        include: { externalIds: true },
      })
      if (contact) {
        return {
          contactId: contact.id,
          isNew: false,
          contact,
        }
      }
    }

    // Priority 4: External ID match
    if (externalId && externalSource) {
      const extId = await prisma.externalId.findUnique({
        where: { externalId },
        include: { contact: { include: { externalIds: true } } },
      })
      if (extId && extId.contact.companyId === companyId) {
        return {
          contactId: extId.contactId,
          isNew: false,
          contact: extId.contact,
        }
      }
    }

    // Priority 5: Create new contact
    const newContact = await prisma.contact.create({
      data: {
        companyId,
        email: email || null,
        phone: phone || null,
      },
      include: { externalIds: true },
    })

    // If external ID provided, create ExternalId record
    if (externalId && externalSource) {
      await prisma.externalId.create({
        data: {
          contactId: newContact.id,
          externalId,
          source: externalSource,
        },
      })
    }

    return {
      contactId: newContact.id,
      isNew: true,
      contact: newContact,
    }
  })

/**
 * Create anonymous contact for tracking
 * Returns contact.id to be used as hch_uuid
 */
export const createContactForTracking = createServerFn({ method: 'POST' })
  .validator(createContactForTrackingSchema)
  .handler(async ({ data }) => {
    const contact = await prisma.contact.create({
      data: { companyId: data.companyId },
    })

    return { contactId: contact.id }
  })

/**
 * Validate that hch_uuid exists in database
 */
export const validateHchUuid = createServerFn({ method: 'POST' })
  .validator(validateHchUuidSchema)
  .handler(async ({ data }) => {
    const contact = await prisma.contact.findFirst({
      where: { id: data.hchUuid, companyId: data.companyId },
    })

    return {
      valid: !!contact,
      contactId: contact?.id,
    }
  })

/**
 * Attach external ID to contact
 * Handles conflicts by logging and not auto-merging
 */
export const attachExternalId = createServerFn({ method: 'POST' })
  .validator(attachExternalIdSchema)
  .handler(async ({ data }) => {
    // Check for conflicts
    const existing = await prisma.externalId.findUnique({
      where: { externalId: data.externalId },
    })

    if (existing && existing.contactId !== data.contactId) {
      console.warn(
        `[Identity Resolution] ExternalId conflict: ${data.externalId} already attached to contact ${existing.contactId}, requested for contact ${data.contactId}`
      )
      return {
        success: false,
        conflict: true,
        existingContactId: existing.contactId,
      }
    }

    if (existing) {
      // Already exists for this contact, just update timestamp
      const updated = await prisma.externalId.update({
        where: { externalId: data.externalId },
        data: { updatedAt: new Date() },
      })
      return {
        success: true,
        conflict: false,
        externalId: updated,
      }
    }

    // Create new external ID
    const created = await prisma.externalId.create({ data })
    return {
      success: true,
      conflict: false,
      externalId: created,
    }
  })

// ============================================================================
// Collection
// ============================================================================

export const identityResolutionCollection = createCollection({
  id: 'identity-resolution',
  fns: {
    resolveIdentity,
    createContactForTracking,
    validateHchUuid,
    attachExternalId,
  },
})
