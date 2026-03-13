import { createFileRoute } from '@tanstack/react-router'
import crypto from 'crypto'
import { z } from 'zod'

function hashValue(val: string) {
  return crypto
    .createHash('sha256')
    .update(val.trim().toLowerCase())
    .digest('hex')
}

const bodySchema = z.object({
  eventName: z.string().min(1),
  fbCLID: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  eventTimestamp: z.number().int().optional(),
})

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export const Route = createFileRoute('/api/fb-conversion/$companyName')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        console.log('FB conversion request received')
        const { companyName } = params

        if (companyName !== 'paom') {
          return json(404, { error: `Unknown company: ${companyName}` })
        }

        const companyKey = companyName.toUpperCase()
        const pixelId = process.env[`FB_ADS_${companyKey}_PIXEL_ID`]
        const accessToken = process.env[`FB_ADS_${companyKey}_ACCESS_TOKEN`]

        if (!pixelId || !accessToken) {
          return json(500, {
            error: 'FB conversion not configured for this company',
          })
        }

        let rawBody: unknown
        try {
          rawBody = await request.json()
        } catch {
          return json(400, { error: 'Invalid JSON body' })
        }

        const parsed = bodySchema.safeParse(rawBody)
        if (!parsed.success) {
          return json(400, { error: parsed.error.flatten() })
        }

        const input = parsed.data
        const eventTime = input.eventTimestamp ?? Math.floor(Date.now() / 1000)

        const userData: Record<string, unknown> = {
          fbc: input.fbCLID,
        }
        if (input.email) userData.em = [hashValue(input.email)]
        if (input.phone) userData.ph = [hashValue(input.phone)]
        if (input.firstName) userData.fn = hashValue(input.firstName)
        if (input.lastName) userData.ln = hashValue(input.lastName)
        if (input.ipAddress) userData.client_ip_address = input.ipAddress
        if (input.userAgent) userData.client_user_agent = input.userAgent

        const payload = [
          {
            event_name: input.eventName,
            event_time: eventTime,
            user_data: userData,
            action_source: 'website',
          },
        ]

        const formData = new URLSearchParams()
        formData.append('data', JSON.stringify(payload))
        formData.append('access_token', accessToken)

        const graphVersion = process.env.FACEBOOK_GRAPH_VERSION ?? 'v24.0'
        const fbResponse = await fetch(
          `https://graph.facebook.com/${graphVersion}/${pixelId}/events`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
          },
        )

        const fbResult = await fbResponse.json()
        if (!fbResponse.ok) {
          return json(502, { error: 'Facebook API error', details: fbResult })
        }

        return json(200, { ok: true, result: fbResult })
      },
    },
  },
})
