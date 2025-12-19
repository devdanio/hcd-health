import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { prisma } from '@/server/db/client'

/**
 * Contact Event API Handler
 *
 * Route: /api/:locationID/event
 * Creates custom events for contacts, creating the contact if needed
 *
 * Request body:
 * - email or phone (at least one required)
 * - eventType: string identifier for the event
 * - data: JSON payload with event details
 */

const createEventSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }).optional(),
  phone: z.string().optional(),
  eventType: z.string().min(1, 'Event type is required'),
  data: z.record(z.string(), z.any()),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/**
 * Normalize phone number by removing all special characters
 * Used for consistent phone matching
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export const Route = createFileRoute('/api/$locationID/event')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { locationID } = params

        try {
          const body = await request.json()
          const validatedData = createEventSchema.parse(body)

          const { email, phone, eventType, data } = validatedData

          // At least one identifier required
          if (!email && !phone) {
            return new Response(
              JSON.stringify({
                error: 'Either email or phone is required',
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

          // Find or create contact
          let contact = null

          // Try to find by email first
          if (email) {
            contact = await prisma.contact.findFirst({
              where: {
                companyId: company.id,
                email,
              },
            })
          }

          // If not found and phone provided, try to find by normalized phone
          if (!contact && phone) {
            const normalizedPhone = normalizePhone(phone)

            // Find all contacts with phone numbers for this company
            const contactsWithPhone = await prisma.contact.findMany({
              where: {
                companyId: company.id,
                phone: {
                  not: null,
                },
              },
            })

            // Find match by normalized phone
            contact =
              contactsWithPhone.find((c) => {
                if (!c.phone) return false
                return normalizePhone(c.phone) === normalizedPhone
              }) || null
          }

          // Create contact if not found
          if (!contact) {
            contact = await prisma.contact.create({
              data: {
                companyId: company.id,
                email: email || null,
                phone: phone || null,
              },
            })
            console.log('[API] Created new contact:', contact.id)
          }

          // Create contact event
          const contactEvent = await prisma.contactEvent.create({
            data: {
              contactId: contact.id,
              companyId: company.id,
              eventType,
              data: data as Record<string, any>,
            },
          })

          console.log(
            '[API] Created contact event:',
            contactEvent.id,
            'for contact:',
            contact.id,
          )

          return new Response(
            JSON.stringify({
              success: true,
              contactId: contact.id,
              eventId: contactEvent.id,
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
