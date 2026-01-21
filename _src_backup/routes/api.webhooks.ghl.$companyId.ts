import { createFileRoute } from '@tanstack/react-router'

import { json } from '@tanstack/react-start'
import { prisma } from '@/server/db/client'
import crypto from 'crypto'

/**
 * GHL Webhook Handler
 *
 * Route: /api/webhooks/ghl/:companyId
 * Each company gets a unique webhook URL with their company ID
 *
 * Supported webhook types:
 * - ContactCreate / ContactUpdate
 * - AppointmentCreate
 */

/**
 * Verify GHL webhook signature
 */
function verifyGhlSignature(
  body: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(body)
  const computedSignature = hmac.digest('hex')

  return computedSignature === signature
}

export const Route = createFileRoute('/api/webhooks/ghl/$companyId')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { companyId } = params

        try {
          // Get raw body for signature verification
          const body = await request.text()
          const signature = request.headers.get('x-ghl-signature')
          const secret = process.env.GHL_SECRET_TOKEN

          // Verify signature if secret is configured
          if (secret && !verifyGhlSignature(body, signature, secret)) {
            console.error('[GHL Webhook] Invalid signature')
            return json({ error: 'Invalid signature' }, { status: 401 })
          }

          // Parse webhook payload
          const data = JSON.parse(body)

          // Verify company exists
          const company = await prisma.company.findUnique({
            where: { id: companyId },
          })

          if (!company) {
            console.error('[GHL Webhook] Company not found:', companyId)
            return json({ error: 'Company not found' }, { status: 404 })
          }

          // Route based on webhook type
          if (data.type === 'ContactCreate' || data.type === 'ContactUpdate') {
            await handleGhlContact(company.id, data)
          } else if (data.type === 'AppointmentCreate') {
            await handleGhlAppointment(company.id, data)
          } else {
            console.log('[GHL Webhook] Unhandled webhook type:', data.type)
          }

          return json({ success: true })
        } catch (error) {
          console.error('[GHL Webhook] Error:', error)
          return json(
            {
              error: error instanceof Error ? error.message : 'Internal error',
            },
            { status: 500 },
          )
        }
      },

      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-ghl-signature',
          },
        })
      },
    },
  },
})

/**
 * Handle ContactCreate / ContactUpdate webhook
 */
async function handleGhlContact(companyId: string, data: any) {
  const { contact } = data

  console.log('[GHL Webhook] Processing contact:', contact.id)

  // Extract hchuuid from custom fields
  let hchuuid: string | undefined
  if (Array.isArray(contact.customField)) {
    const hchField = contact.customField.find(
      (f: any) =>
        f.key === 'hchuuid' || f.field_key === 'hchuuid' || f.id === 'hchuuid',
    )
    hchuuid = hchField?.value
  }

  console.log('[GHL Webhook] Extracted hchuuid:', hchuuid)

  // Resolve identity (priority: hchuuid → email → phone → create new)
  let resolvedContact

  if (hchuuid) {
    // Try to find by hchuuid first
    resolvedContact = await prisma.contact.findFirst({
      where: { id: hchuuid, companyId },
    })
  }

  if (!resolvedContact && contact.email) {
    // Try to find by email
    resolvedContact = await prisma.contact.findFirst({
      where: { companyId, email: contact.email },
    })
  }

  if (!resolvedContact && contact.phone) {
    // Try to find by phone
    resolvedContact = await prisma.contact.findFirst({
      where: { companyId, phone: contact.phone },
    })
  }

  if (!resolvedContact) {
    // Create new contact
    resolvedContact = await prisma.contact.create({
      data: {
        companyId,
        email: contact.email || null,
        phone: contact.phone || null,
        firstName: contact.firstName || null,
        lastName: contact.lastName || null,
        fullName: contact.contactName || null,
      },
    })
    console.log('[GHL Webhook] Created new contact:', resolvedContact.id)
  } else {
    // Update existing contact with GHL data
    resolvedContact = await prisma.contact.update({
      where: { id: resolvedContact.id },
      data: {
        email: contact.email || resolvedContact.email,
        phone: contact.phone || resolvedContact.phone,
        firstName: contact.firstName || resolvedContact.firstName,
        lastName: contact.lastName || resolvedContact.lastName,
        fullName: contact.contactName || resolvedContact.fullName,
      },
    })
    console.log('[GHL Webhook] Updated existing contact:', resolvedContact.id)
  }

  // Attach GHL contact ID to ExternalId table
  const existingExternalId = await prisma.externalId.findUnique({
    where: { externalId: contact.id },
  })

  if (
    existingExternalId &&
    existingExternalId.contactId !== resolvedContact.id
  ) {
    console.warn(
      `[GHL Webhook] ExternalId conflict: GHL contact ${contact.id} already linked to different contact ${existingExternalId.contactId}`,
    )
  } else if (!existingExternalId) {
    await prisma.externalId.create({
      data: {
        contactId: resolvedContact.id,
        externalId: contact.id,
        source: 'GHL',
      },
    })
    console.log('[GHL Webhook] Created ExternalId for GHL contact:', contact.id)
  } else {
    // Update timestamp
    await prisma.externalId.update({
      where: { externalId: contact.id },
      data: { updatedAt: new Date() },
    })
  }

  // Create event for contact creation/update
  await prisma.event.create({
    data: {
      companyId,
      contactId: resolvedContact.id,
      sessionId: '', // No session for webhook events
      type: 'custom_event',
      data: {
        source: 'ghl',
        eventName:
          data.type === 'ContactCreate'
            ? 'ghl_contact_created'
            : 'ghl_contact_updated',
        ghlContactId: contact.id,
        timestamp: new Date().toISOString(),
      },
    },
  })

  console.log('[GHL Webhook] Contact processed successfully')
}

/**
 * Handle AppointmentCreate webhook
 */
async function handleGhlAppointment(companyId: string, data: any) {
  const { appointment } = data

  console.log('[GHL Webhook] Processing appointment:', appointment.id)

  // Find contact by GHL contact ID via ExternalId
  const externalId = await prisma.externalId.findUnique({
    where: { externalId: appointment.contactId },
    include: { contact: true },
  })

  if (!externalId) {
    console.error(
      '[GHL Webhook] No contact found for GHL contact ID:',
      appointment.contactId,
    )
    // Don't fail the webhook, just log and continue
    return
  }

  console.log('[GHL Webhook] Found contact:', externalId.contact.id)

  // Create appointment
  const createdAppointment = await prisma.appointment.create({
    data: {
      companyId,
      contactId: externalId.contactId,
      dateOfService: new Date(
        appointment.startTime || appointment.appointmentDate,
      ),
      service: appointment.title || appointment.appointmentType || null,
    },
  })

  console.log('[GHL Webhook] Created appointment:', createdAppointment.id)

  // Create conversion event
  await prisma.event.create({
    data: {
      companyId,
      contactId: externalId.contactId,
      sessionId: '', // No session for webhook events
      type: 'conversion',
      data: {
        source: 'ghl',
        eventName: 'appointment_booked',
        ghlAppointmentId: appointment.id,
        appointmentId: createdAppointment.id,
        service: appointment.title || appointment.appointmentType,
        timestamp: new Date().toISOString(),
      },
    },
  })

  console.log('[GHL Webhook] Appointment processed successfully')
}
