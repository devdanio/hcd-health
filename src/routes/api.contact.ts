import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const resendEndpoint = 'https://api.resend.com/emails'
const recipientEmail = 'dan@highcountrydigital.io'

const contactFormSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  organization: z.string().trim().max(200).optional(),
  interest: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
})

export const Route = createFileRoute('/api/contact')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const resendApiKey = process.env.RESEND_API_KEY
        const resendFromEmail = process.env.RESEND_FROM_EMAIL

        if (!resendApiKey || !resendFromEmail) {
          return Response.json(
            { error: 'Email service is not configured on the server.' },
            { status: 500 },
          )
        }

        const rawData: unknown = await request.json().catch(() => null)
        const parseResult = contactFormSchema.safeParse(rawData)

        if (!parseResult.success) {
          return Response.json(
            { error: 'Invalid contact form submission.' },
            { status: 400 },
          )
        }

        const data = parseResult.data
        const organization = data.organization || 'Not provided'
        const interest = data.interest || 'Not provided'

        const textBody = [
          `Name: ${data.name}`,
          `Email: ${data.email}`,
          `Practice or Organization: ${organization}`,
          `Interest: ${interest}`,
          '',
          'Message:',
          data.message,
        ].join('\n')

        const resendResponse = await fetch(resendEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: resendFromEmail,
            to: [recipientEmail],
            reply_to: data.email,
            subject: `New contact form inquiry from ${data.name}`,
            text: textBody,
          }),
        })

        if (!resendResponse.ok) {
          const errorBody = await resendResponse.text().catch(() => '')
          console.error('Resend API error', {
            status: resendResponse.status,
            body: errorBody,
          })

          return Response.json(
            { error: 'Unable to send message right now. Please try again.' },
            { status: 502 },
          )
        }

        return Response.json({ ok: true })
      },
    },
  },
})
