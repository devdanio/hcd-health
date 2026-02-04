import { createFileRoute } from '@tanstack/react-router'
import {
  extractBearerToken,
  getOrganizationIdForApiKey,
} from '@/server/ri/apiKeys'
import { ingestEvent } from '@/server/ri/ingest'

const corsHeaders: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

export const Route = createFileRoute('/api/ingest/events')({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const token = extractBearerToken(request.headers.get('authorization'))
        if (!token) return json(401, { error: 'Missing Authorization header' })

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json(400, { error: 'Invalid JSON body' })
        }

        let orgIdResult: { organizationId: string }
        try {
          orgIdResult = await getOrganizationIdForApiKey(token)
        } catch {
          return json(401, { error: 'Invalid API key' })
        }

        const inputOrgId =
          typeof body === 'object' && body && 'organization_id' in body
            ? (body as { organization_id?: unknown }).organization_id
            : undefined
        if (
          typeof inputOrgId === 'string' &&
          inputOrgId.length > 0 &&
          inputOrgId !== orgIdResult.organizationId
        ) {
          return json(403, { error: 'organization_id does not match API key' })
        }

        try {
          const result = await ingestEvent({
            organizationId: orgIdResult.organizationId,
            payload: body,
          })
          return json(200, {
            ok: true,
            lead_id: result.leadId,
            lead_event_id: result.leadEventId,
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          return json(400, { error: message })
        }
      },
    },
  },
})

