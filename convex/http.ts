import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { api } from './_generated/api'

const http = httpRouter()

/**
 * CORS helper
 */
function corsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Handle CORS preflight requests
 */
http.route({
  path: '/trackEvent',
  method: 'OPTIONS',
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get('origin') || undefined),
    })
  }),
})

/**
 * Track Event Endpoint
 * Handles pageview events with session creation and attribution tracking
 */
http.route({
  path: '/trackEvent',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin') || undefined

    const userAgentHeader =
      request.headers.get('user-agent') ||
      request.headers.get('User-Agent') ||
      undefined

    // Extract IP address from request headers
    // Check common proxy headers in order of preference
    const getClientIp = () => {
      // Cloudflare
      const cfIp = request.headers.get('cf-connecting-ip')
      if (cfIp) return cfIp

      // X-Forwarded-For (may contain multiple IPs, take the first one)
      const xForwardedFor = request.headers.get('x-forwarded-for')
      if (xForwardedFor) {
        // X-Forwarded-For can contain multiple IPs separated by commas
        // The first one is usually the original client IP
        return xForwardedFor.split(',')[0].trim()
      }

      // X-Real-IP
      const xRealIp = request.headers.get('x-real-ip')
      if (xRealIp) return xRealIp

      // Fallback: try to get from request (may not work in all environments)
      return undefined
    }

    const ipAddress = getClientIp()

    try {
      const body = await request.json()

      // Validate event type
      if (body.type !== 'pageview') {
        return new Response(
          JSON.stringify({ error: 'Only pageview events are supported' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders(origin),
            },
          },
        )
      }

      // Use HTTP User-Agent header if available, fallback to client-provided
      const userAgent = userAgentHeader || body.userAgent || undefined

      const result = await ctx.runMutation(api.tracking.trackPageView, {
        apiKey: body.apiKey,
        visitorId: body.visitorId,
        sessionId: body.sessionId,
        metadata: body.metadata,
        userAgent,
        ipAddress,
        screenResolution: body.screenResolution,
        timezone: body.timezone,
      })

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      })
    } catch (error: any) {
      console.error('Error tracking event:', error)
      return new Response(
        JSON.stringify({ error: error.message || 'Internal server error' }),
        {
          status: error.message === 'Invalid API key' ? 401 : 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        },
      )
    }
  }),
})

http.route({
  path: '/test',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    return new Response('Hello, world!', { status: 200 })
  }),
})
export default http
