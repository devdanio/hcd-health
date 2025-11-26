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
  handler: httpAction(async () => {
    return new Response('Hello, world!', { status: 200 })
  }),
})

/**
 * OAuth callback endpoint for Google Ads integration
 * Handles redirect from Google OAuth consent screen
 */
http.route({
  path: '/oauth/google-ads/callback',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    // Handle user denial or errors from Google
    if (error) {
      console.error('OAuth error:', error)
      // Extract companyId from state if possible for better redirect
      let companyId = 'unknown'
      if (state) {
        try {
          const decoded = atob(state)
          companyId = decoded.split(':')[0]
        } catch (e) {
          // Ignore decode errors
        }
      }

      return new Response(null, {
        status: 302,
        headers: {
          Location: `/companies/${companyId}/settings?google_ads=denied&error=${encodeURIComponent(error)}`,
        },
      })
    }

    // Validate required params
    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    try {
      // Exchange code for tokens and store in database
      const result = await ctx.runAction(api.googleAds.handleOAuthCallback, {
        code,
        state,
      })

      // Redirect to settings page for account selection
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/companies/${result.companyId}/settings?google_ads=select_account&tab=integrations`,
        },
      })
    } catch (callbackError: any) {
      console.error('OAuth callback error:', callbackError)

      // Try to extract companyId for better redirect
      let companyId = 'unknown'
      if (state) {
        try {
          const decoded = atob(state)
          companyId = decoded.split(':')[0]
        } catch (e) {
          // Ignore decode errors
        }
      }

      return new Response(null, {
        status: 302,
        headers: {
          Location: `/companies/${companyId}/settings?google_ads=error&message=${encodeURIComponent(callbackError.message || 'Unknown error')}`,
        },
      })
    }
  }),
})

/**
 * Get CMS Pages by Company ID
 * Returns all CMS pages for a given company
 */
http.route({
  path: '/:companyId/pages',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const companyId = pathParts[0]

    // Validate companyId format (Convex IDs start with the table name)
    if (!companyId || !companyId.startsWith('companies|')) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid company ID format. Expected format: companies|<id>' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    try {
      // Query CMS pages for this company
      const pages = await ctx.runQuery(api.cmsPages.getPages, {
        companyId: companyId as any,
      })

      return new Response(JSON.stringify(pages), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      console.error('Error fetching CMS pages:', error)
      return new Response(
        JSON.stringify({ 
          error: error.message || 'Failed to fetch CMS pages' 
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }),
})

export default http
