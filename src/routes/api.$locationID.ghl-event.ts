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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const Route = createFileRoute('/api/$locationID/ghl-event')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { locationID } = params

        try {
          const body = await request.json()

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

          // Create contact event
          const contactEvent = await prisma.gHLEvent.create({
            data: {
              companyId: company.id,
              data: body as Record<string, any>,
            },
          })

          console.log('[API] Created contact event:', contactEvent.id)

          return new Response(
            JSON.stringify({
              success: true,
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
