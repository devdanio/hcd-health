import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { prisma } from '@/server/db/client'

const createContactSchema = z.object({
  apiKey: z.string(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const Route = createFileRoute('/api/create-contact')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { apiKey } = createContactSchema.parse(body)

          // Authenticate company by API key
          const company = await prisma.company.findUnique({
            where: { apiKey },
          })

          if (!company) {
            return new Response(JSON.stringify({ error: 'Invalid API key' }), {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            })
          }

          // Create anonymous contact
          const contact = await prisma.contact.create({
            data: { companyId: company.id },
          })

          return new Response(
            JSON.stringify({
              contactId: contact.id,
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
          console.error('[API] Create contact error:', error)
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
