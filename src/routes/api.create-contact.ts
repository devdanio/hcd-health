import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '@/server/db/client'

const createContactSchema = z.object({
  apiKey: z.string(),
})

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
            return json({ error: 'Invalid API key' }, { status: 401 })
          }

          // Create anonymous contact
          const contact = await prisma.contact.create({
            data: { companyId: company.id },
          })

          return json({
            contactId: contact.id,
          })
        } catch (error) {
          console.error('[API] Create contact error:', error)
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Internal server error',
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
