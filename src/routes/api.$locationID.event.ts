import { DataSource, EventType } from '@/generated/prisma/enums'
import { prisma } from '@/server/db/client'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { sanitizeEmail, sanitizePhone } from '@/utils/helpers'

const EventSchema = z.object({
  type: z.enum(EventType),
  timestamp: z.string().pipe(z.coerce.date()),
  metadata: z.record(z.string(), z.any()),
})

const PayloadSchema = z.object({
  anonymous_id: z.uuid(),
  session_id: z.uuid(),
  events: z.array(EventSchema).min(1),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400', // 24 hours
}

export const Route = createFileRoute('/api/$locationID/event')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { locationID } = params

        // Verify location (company) exists
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

        const parsed = PayloadSchema.safeParse(body)
        if (!parsed.success) {
          console.error('invalid payload', parsed.error)
          return new Response('Invalid payload', {
            status: 400,
            headers: corsHeaders,
          })
        }

        const { anonymous_id, session_id, events } = parsed.data

        // Hard limit to prevent abuse
        if (events.length > 50) {
          return new Response('Too many events', {
            status: 413,
            headers: corsHeaders,
          })
        }

        // Check if there's an IDENTIFY event
        const identifyEvent = events.find((e) => e.type === EventType.IDENTIFY)

        if (identifyEvent) {
          // Validate that IDENTIFY event has email or phone
          const email = sanitizeEmail(
            (identifyEvent.metadata as Record<string, unknown>)
              ?.email as string,
          )
          const phone = sanitizePhone(
            (identifyEvent.metadata as Record<string, unknown>)
              ?.phone as string,
          )

          if (!email && !phone) {
            return new Response(
              'IDENTIFY event requires email or phone in metadata',
              {
                status: 400,
                headers: corsHeaders,
              },
            )
          }

          // Look up person by email or phone
          let person = await prisma.person.findFirst({
            where: {
              company_id: locationID,
              OR: [
                ...(email ? [{ email }] : []),
                ...(phone ? [{ phone }] : []),
              ],
            },
          })

          // If not found in person table, check profile table
          if (!person && (email || phone)) {
            const profile = await prisma.profile.findFirst({
              where: {
                person: {
                  company_id: locationID,
                },
                OR: [
                  ...(email ? [{ email }] : []),
                  ...(phone ? [{ phone }] : []),
                ],
              },
              include: {
                person: true,
              },
            })

            if (profile) {
              person = profile.person
            }
          }

          let personId: string

          if (person) {
            // Person exists - use their ID
            personId = person.id
          } else {
            // Create new person and profile
            const firstName = (
              identifyEvent.metadata as Record<string, unknown>
            )?.firstName as string | undefined
            const lastName = (identifyEvent.metadata as Record<string, unknown>)
              ?.lastName as string | undefined

            const fullName = (identifyEvent.metadata as Record<string, unknown>)
              ?.fullName as string | undefined

            person = await prisma.person.create({
              data: {
                company_id: locationID,
                email: email || undefined,
                phone: phone || undefined,
                first_name: firstName || undefined,
                last_name: lastName || undefined,
                full_name: fullName || undefined,
                profiles: {
                  create: {
                    source: DataSource.TRACKING,
                    external_id: anonymous_id,
                    email: email || undefined,
                    phone: phone || undefined,
                    first_name: firstName || undefined,
                    last_name: lastName || undefined,
                    full_name: fullName || undefined,
                    raw: identifyEvent.metadata,
                  },
                },
              },
            })

            personId = person.id
          }

          // Get all profiles for this person to find all possible event matches
          const allProfiles = await prisma.profile.findMany({
            where: {
              person_id: personId,
            },
            select: {
              source: true,
              external_id: true,
            },
          })

          // Build OR conditions for all profile matches
          const profileMatches = allProfiles.map((profile) => ({
            AND: [
              { company_id: locationID },
              { source: profile.source },
              {
                metadata: {
                  path: ['external_id'],
                  equals: profile.external_id,
                },
              },
            ],
          }))

          // Update all events that match:
          // 1. Same company + anonymous_id (current session)
          // 2. Same company + person_id (already linked events)
          // 3. Same company + profile source + external_id (events from other sources)
          await prisma.event.updateMany({
            where: {
              OR: [
                {
                  company_id: locationID,
                  anonymous_id,
                },
                {
                  company_id: locationID,
                  person_id: personId,
                },
                ...profileMatches,
              ],
            },
            data: {
              person_id: personId,
            },
          })

          // Create the IDENTIFY event
          await prisma.event.create({
            data: {
              source: DataSource.TRACKING,
              type: identifyEvent.type,
              timestamp: identifyEvent.timestamp,
              anonymous_id,
              session_id,
              company_id: locationID,
              person_id: personId,
              metadata: identifyEvent.metadata,
            },
          })

          // Process other events (non-IDENTIFY)
          const otherEvents = events.filter(
            (e) => e.type !== EventType.IDENTIFY,
          )

          if (otherEvents.length > 0) {
            const rows = otherEvents.map((event) => ({
              source: DataSource.TRACKING,
              type: event.type,
              timestamp: event.timestamp,
              anonymous_id,
              session_id,
              company_id: locationID,
              person_id: personId,
              metadata: event.metadata,
            }))

            await prisma.event.createMany({
              data: rows,
              skipDuplicates: false,
            })
          }
        } else {
          // No IDENTIFY event - process events normally
          const rows = events.map((event) => ({
            source: DataSource.TRACKING,
            type: event.type,
            timestamp: event.timestamp,
            anonymous_id,
            session_id,
            company_id: locationID,
            metadata: event.metadata,
          }))

          try {
            await prisma.event.createMany({
              data: rows,
              skipDuplicates: false,
            })
          } catch (err) {
            console.error('Event ingestion error:', err)
            return new Response('Failed to persist events', {
              status: 500,
              headers: corsHeaders,
            })
          }
        }

        return new Response(null, { status: 204, headers: corsHeaders })
      },
      OPTIONS: async () => {
        return new Response(null, { status: 204, headers: corsHeaders })
      },
    },
  },
})
