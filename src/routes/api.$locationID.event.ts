import { DataSource, EventType } from '@/generated/prisma/enums'
import { prisma } from '@/server/db/client'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

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

export const Route = createFileRoute('/api/$locationID/event')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { locationID } = params
        console.log('got this far')

        // Verify location (company) exists
        const company = await prisma.company.findUnique({
          where: { id: locationID },
        })

        if (!company) {
          return new Response('Location not found', { status: 404 })
        }

        console.log('company', company)

        let body: unknown

        try {
          body = await request.json()
        } catch {
          return new Response('Invalid JSON', { status: 400 })
        }

        const parsed = PayloadSchema.safeParse(body)
        if (!parsed.success) {
          console.error('invalid payload', parsed.error)
          return new Response('Invalid payload', { status: 400 })
        }

        const { anonymous_id, session_id, events } = parsed.data

        // Hard limit to prevent abuse
        if (events.length > 50) {
          return new Response('Too many events', { status: 413 })
        }

        // Build Prisma rows
        const rows = events.map((event) => ({
          source: DataSource.TRACKING,
          type: event.type,
          timestamp: event.timestamp,
          anonymous_id,
          session_id,
          company_id: locationID,
          metadata: {
            ...event.metadata,
          },
        }))

        try {
          await prisma.event.createMany({
            data: rows,
            skipDuplicates: false,
          })
        } catch (err) {
          console.error('Event ingestion error:', err)
          return new Response('Failed to persist events', { status: 500 })
        }

        return new Response(null, { status: 204 })
      },
      OPTIONS: async () => {
        return new Response(null, { status: 204 })
      },
    },
  },
})
