import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import {
  EventType,
  ExternalIdSource,
  EventSource,
} from '@/generated/prisma/enums'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/**
 * Removes all non-numerical characters from a phone number string
 * @param phone - The phone number string to sanitize
 * @returns The phone number with only digits, or undefined if input is undefined/null
 */
function sanitizePhone(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined
  return phone.replace(/\D/g, '')
}

const createEventSchema = z.object({
  eventType: z.enum(EventType),
  email: z.string().optional(),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  ghlContactId: z.string(),
})

export const Route = createFileRoute('/api/$locationID/ghl-event')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { locationID } = params

        try {
          const body = await request.json()

          if (!body.customData) {
            return new Response(
              JSON.stringify({ error: 'ghl-event: customData is required' }),
              { status: 400 },
            )
          }

          const validatedData = createEventSchema.parse(body.customData)

          const {
            email: rawEmail,
            phone: rawPhone,
            eventType,
            ghlContactId,
            firstName,
            lastName,
          } = validatedData

          const phone = sanitizePhone(rawPhone)
          let email: string | undefined = undefined
          if (rawEmail && rawEmail.trim() !== '') {
            const trimmedEmail = rawEmail.trim()
            // Use zod to check email validity
            if (z.email().safeParse(trimmedEmail).success) {
              email = trimmedEmail
            }
          }

          if (!email && !phone) {
            return new Response(
              JSON.stringify({ error: 'Either email or phone is required' }),
              { status: 400 },
            )
          }

          // Verify company exists
          const company = await prisma.company.findUnique({
            where: { id: locationID },
          })

          if (!company) {
            return new Response(
              JSON.stringify({ error: 'Location not found' }),
              {
                status: 404,
                headers: {
                  'Content-Type': 'application/json',
                  ...corsHeaders,
                },
              },
            )
          }

          // Find contact by GHL external ID
          const existingExternalId = await prisma.externalId.findUnique({
            where: {
              externalId: ghlContactId,
            },
            include: {
              contact: true,
            },
          })

          let contact

          if (
            existingExternalId &&
            existingExternalId.source === ExternalIdSource.GHL &&
            existingExternalId.contact.companyId === company.id
          ) {
            // Contact exists - update it
            console.log('[API] Updating existing contact:', ghlContactId)
            contact = await prisma.contact.update({
              where: { id: existingExternalId.contactId },
              data: {
                email,
                phone,
                firstName,
                lastName,
                events: {
                  create: {
                    eventSource: EventSource.GHL,
                    type: eventType,
                    data: body,
                  },
                },
              },
              include: {
                events: true,
              },
            })
          } else {
            // Try to find existing contact by phone/email
            const whereConditions = []
            if (phone) whereConditions.push({ phone })
            if (email) whereConditions.push({ email })

            if (whereConditions.length > 0) {
              contact = await prisma.contact.findFirst({
                where: {
                  companyId: company.id,
                  OR: whereConditions,
                },
              })
            }

            if (contact) {
              // Contact exists - update and add GHL external ID
              console.log(
                '[API] Found existing contact by phone/email, adding GHL ID:',
                ghlContactId,
              )

              // Purposely leaving out firstName and lastName here.  Assuming theyre coming from Jasmine and are more accurate.
              contact = await prisma.contact.update({
                where: { id: contact.id },
                data: {
                  email,
                  phone,
                  firstSeenAt: body.date_created,
                  externalIds: {
                    create: {
                      externalId: ghlContactId,
                      source: ExternalIdSource.GHL,
                    },
                  },
                  events: {
                    create: {
                      eventSource: EventSource.GHL,
                      type: eventType,
                      data: body,
                    },
                  },
                },
                include: {
                  events: true,
                },
              })
            } else {
              // Contact truly doesn't exist - create it
              console.log('[API] Creating new contact:', ghlContactId)
              contact = await prisma.contact.create({
                data: {
                  email,
                  phone,
                  firstName,
                  lastName,
                  firstSeenAt: body.date_created,
                  company: {
                    connect: {
                      id: company.id,
                    },
                  },
                  externalIds: {
                    create: {
                      externalId: ghlContactId,
                      source: ExternalIdSource.GHL,
                    },
                  },
                  events: {
                    create: {
                      eventSource: EventSource.GHL,
                      type: eventType,
                      data: body,
                    },
                  },
                },
                include: {
                  events: true,
                },
              })
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              eventId: contact.id,
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            },
          )
        } catch (error) {
          console.error('[API] Contact event error:', error)

          // Handle Zod validation errors
          if (error instanceof z.ZodError) {
            return new Response(
              JSON.stringify({
                error: 'Invalid request data',
                details: error.issues,
              }),
              {
                status: 400,
                headers: {
                  'Content-Type': 'application/json',
                  ...corsHeaders,
                },
              },
            )
          }

          return new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Internal server error',
            }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            },
          )
        }
      },

      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        })
      },
    },
  },
})
