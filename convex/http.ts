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
  path: '/trackPageView',
  method: 'OPTIONS',
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get('origin') || undefined),
    })
  }),
})

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

http.route({
  path: '/trackConversion',
  method: 'OPTIONS',
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get('origin') || undefined),
    })
  }),
})

http.route({
  path: '/identifyVisitor',
  method: 'OPTIONS',
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get('origin') || undefined),
    })
  }),
})

/**
 * Track Page View Endpoint
 * Consolidates session creation and page view tracking
 */
http.route({
  path: '/trackPageView',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin') || undefined

    // Extract HTTP headers for referrer and user agent
    const refererHeader =
      request.headers.get('referer') ||
      request.headers.get('Referer') ||
      undefined
    const userAgentHeader =
      request.headers.get('user-agent') ||
      request.headers.get('User-Agent') ||
      undefined

    try {
      const body = await request.json()

      // If touchPoint is provided, use document.referrer as primary source
      // with HTTP referer header as fallback
      let touchPoint = body.touchPoint
      if (touchPoint) {
        touchPoint = {
          ...touchPoint,
          referrer: touchPoint.referrer || refererHeader || undefined,
        }
      }

      // Use HTTP User-Agent header if available, fallback to client-provided
      const userAgent = userAgentHeader || body.userAgent || undefined

      const result = await ctx.runMutation(api.tracking.trackPageView, {
        apiKey: body.apiKey,
        visitorId: body.visitorId,
        sessionId: body.sessionId,
        url: body.url,
        touchPoint,
        userAgent,
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
      console.error('Error tracking page view:', error)
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

/**
 * Track Event Endpoint
 */
http.route({
  path: '/trackEvent',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin') || undefined

    try {
      const body = await request.json()

      const result = await ctx.runMutation(api.tracking.trackEvent, {
        apiKey: body.apiKey,
        sessionId: body.sessionId,
        eventName: body.eventName,
        metadata: body.metadata,
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

/**
 * Track Conversion Endpoint
 */
http.route({
  path: '/trackConversion',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin') || undefined

    try {
      const body = await request.json()

      const result = await ctx.runMutation(api.tracking.trackConversion, {
        apiKey: body.apiKey,
        sessionId: body.sessionId,
        eventName: body.eventName,
        revenue: body.revenue,
        metadata: body.metadata,
      })

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      })
    } catch (error: any) {
      console.error('Error tracking conversion:', error)
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

/**
 * Identify Visitor Endpoint
 * Identifies a visitor by email or phone number
 */
http.route({
  path: '/identifyVisitor',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get('origin') || undefined

    try {
      const body = await request.json()

      const result = await ctx.runMutation(api.tracking.identifyVisitor, {
        apiKey: body.apiKey,
        visitorId: body.visitorId,
        email: body.email,
        phone: body.phone,
        userId: body.userId,
      })

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      })
    } catch (error: any) {
      console.error('Error identifying visitor:', error)
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
