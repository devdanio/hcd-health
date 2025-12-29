import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { DataSource, EventType } from '@/generated/prisma/enums'
import { prisma } from '@/server/db/client'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// This is for a known person that has been identified
// For anonymous events, use the /api/$locationID/event route

const PersonEventSchema = z.union([
  z.object({
    person_id: z.string(),
    external_id: z.string().optional(),
    source: z.enum(DataSource).optional(),
    event_type: z.enum(EventType),
    metadata: z.record(z.string(), z.any()),
  }),
  z.object({
    person_id: z.string().optional(),
    external_id: z.string(),
    source: z.enum(DataSource),
    event_type: z.enum(EventType),
    metadata: z.record(z.string(), z.any()),
  }),
])

export const Route = createFileRoute('/api/$locationID/person-event')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { locationID } = params

        const company = await prisma.company.findUnique({
          where: { id: locationID },
        })

        if (!company) {
          return new Response('Location not found', {
            status: 404,
            headers: corsHeaders,
          })
        }

        let body: unknown

        try {
          body = await request.json()
        } catch {
          return new Response('Invalid JSON', {
            status: 400,
            headers: corsHeaders,
          })
        }

        const parsed = PersonEventSchema.safeParse(body)
        if (!parsed.success) {
          console.error('invalid payload', parsed.error)
          return new Response('Invalid payload', {
            status: 400,
            headers: corsHeaders,
          })
        }

        const { event_type, metadata, external_id, source, person_id } =
          parsed.data

        // Determine the person_id to use
        let finalPersonId: string | null = null

        if (person_id) {
          // Direct person_id provided - verify it exists for this company
          const person = await prisma.person.findFirst({
            where: {
              id: person_id,
              company_id: locationID,
            },
          })

          if (!person) {
            return new Response('Person not found for this company', {
              status: 404,
              headers: corsHeaders,
            })
          }

          finalPersonId = person_id
        } else if (external_id && source) {
          // Look up person by external_id + source via profile
          const profile = await prisma.profile.findFirst({
            where: {
              source,
              external_id,
              person: {
                company_id: locationID,
              },
            },
            include: {
              person: true,
            },
          })

          if (!profile) {
            return new Response(
              'No person found with this external_id and source',
              {
                status: 404,
                headers: corsHeaders,
              },
            )
          }

          finalPersonId = profile.person_id
        } else {
          return new Response(
            'Must provide either person_id or (external_id + source)',
            {
              status: 400,
              headers: corsHeaders,
            },
          )
        }

        // Create the event
        try {
          await prisma.event.create({
            data: {
              company_id: locationID,
              person_id: finalPersonId,
              source: source as DataSource,
              type: event_type,
              timestamp: new Date(),
              metadata,
            },
          })

          return new Response(null, { status: 204, headers: corsHeaders })
        } catch (err) {
          console.error('Event creation error:', err)
          return new Response('Failed to create event', {
            status: 500,
            headers: corsHeaders,
          })
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
