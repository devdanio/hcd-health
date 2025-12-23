import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import { EventType } from '@/generated/prisma/enums'

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
  email: z.email().optional(),
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
            email,
            phone: rawPhone,
            eventType,
            ghlContactId,
            firstName,
            lastName,
          } = validatedData

          const phone = sanitizePhone(rawPhone)

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

          let contact = await prisma.contact.findFirst({
            where: {
              OR: [
                {
                  externalIds: {
                    some: {
                      externalId: ghlContactId,
                      source: 'GHL',
                    },
                  },
                  companyId: company.id,
                },
                {
                  email: email,
                  companyId: company.id,
                },
                {
                  phone: phone,
                  companyId: company.id,
                },
              ],
            },
            include: {
              events: true,
            },
          })

          const previouslyCreatedContact = contact?.events.find(
            (event) => event.type === 'CONTACT_CREATED',
          )
          if (previouslyCreatedContact) {
            console.log('[API] Contact already created:', ghlContactId)
            return new Response(
              JSON.stringify({ error: 'Contact already created' }),
              { status: 400 },
            )
          }

          if (!contact) {
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
                    source: 'GHL',
                  },
                },

                events: {
                  create: {
                    eventSource: 'GHL',
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
            console.log('[API] Updating existing contact:', ghlContactId)
            contact = await prisma.contact.update({
              where: { id: contact.id },
              data: {
                events: {
                  create: {
                    eventSource: 'GHL',
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
