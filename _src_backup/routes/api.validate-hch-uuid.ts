import { z } from 'zod'
import { prisma } from '@/server/db/client'
import { createFileRoute } from '@tanstack/react-router'

const validateHchUuidSchema = z.object({
  apiKey: z.string(),
  hchUuid: z.string(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const Route = createFileRoute('/api/validate-hch-uuid')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { apiKey, hchUuid } = validateHchUuidSchema.parse(body)

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

          // Check if contact exists for this company
          const contact = await prisma.contact.findFirst({
            where: {
              id: hchUuid,
              companyId: company.id,
            },
          })

          return new Response(
            JSON.stringify({
              valid: !!contact,
              contactId: contact?.id,
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
          console.error('[API] Validate hch_uuid error:', error)
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Internal server error',
              valid: false,
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
