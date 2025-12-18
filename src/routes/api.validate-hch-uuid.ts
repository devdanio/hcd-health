import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import { createFileRoute } from '@tanstack/react-router'

const validateHchUuidSchema = z.object({
  apiKey: z.string(),
  hchUuid: z.string(),
})

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
            return json({ error: 'Invalid API key' }, { status: 401 })
          }

          // Check if contact exists for this company
          const contact = await prisma.contact.findFirst({
            where: {
              id: hchUuid,
              companyId: company.id,
            },
          })

          return json({
            valid: !!contact,
            contactId: contact?.id,
          })
        } catch (error) {
          console.error('[API] Validate hch_uuid error:', error)
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Internal server error',
              valid: false,
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
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        })
      },
    },
  },
})
