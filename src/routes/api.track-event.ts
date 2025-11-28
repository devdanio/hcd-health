// import { createFileRoute } from '@tanstack/react-router'
// import { json } from '@tanstack/react-start'
// import { createAPIFileRoute } from '@tanstack/react-start/api'
// import { trackPageView } from '@/server/functions/tracking'
// import { z } from 'zod'

// const trackEventSchema = z.object({
//   apiKey: z.string(),
//   eventType: z.enum(['page_view', 'conversion']),
//   url: z.string().url(),
//   referrer: z.string().optional(),
//   utm_source: z.string().optional(),
//   utm_medium: z.string().optional(),
//   utm_campaign: z.string().optional(),
//   utm_term: z.string().optional(),
//   utm_content: z.string().optional(),
//   gclid: z.string().optional(),
//   fbclid: z.string().optional(),
//   msclkid: z.string().optional(),
//   ttclid: z.string().optional(),
//   li_fat_id: z.string().optional(),
//   twclid: z.string().optional(),
//   email: z.string().email().optional(),
//   phone: z.string().optional(),
//   fullName: z.string().optional(),
//   firstName: z.string().optional(),
//   lastName: z.string().optional(),
//   browserSessionId: z.string(),
// })

// export const Route = createAPIFileRoute('/api/track-event')({
//   POST: async ({ request }) => {
//     try {
//       const body = await request.json()
//       const validatedData = trackEventSchema.parse(body)

//       if (validatedData.eventType === 'page_view') {
//         await trackPageView({
//           data: {
//             apiKey: validatedData.apiKey,
//             url: validatedData.url,
//             referrer: validatedData.referrer,
//             utm_source: validatedData.utm_source,
//             utm_medium: validatedData.utm_medium,
//             utm_campaign: validatedData.utm_campaign,
//             utm_term: validatedData.utm_term,
//             utm_content: validatedData.utm_content,
//             gclid: validatedData.gclid,
//             fbclid: validatedData.fbclid,
//             msclkid: validatedData.msclkid,
//             ttclid: validatedData.ttclid,
//             li_fat_id: validatedData.li_fat_id,
//             twclid: validatedData.twclid,
//             email: validatedData.email,
//             phone: validatedData.phone,
//             fullName: validatedData.fullName,
//             firstName: validatedData.firstName,
//             lastName: validatedData.lastName,
//             browserSessionId: validatedData.browserSessionId,
//           },
//         })

//         return json({ success: true }, {
//           headers: {
//             'Access-Control-Allow-Origin': '*',
//             'Access-Control-Allow-Methods': 'POST, OPTIONS',
//             'Access-Control-Allow-Headers': 'Content-Type',
//           },
//         })
//       }

//       return json({ error: 'Unsupported event type' }, { status: 400 })
//     } catch (error) {
//       console.error('Track event error:', error)
//       return json(
//         {
//           error: error instanceof Error ? error.message : 'Internal server error',
//         },
//         { status: 500 },
//       )
//     }
//   },
//   OPTIONS: async () => {
//     return new Response(null, {
//       status: 204,
//       headers: {
//         'Access-Control-Allow-Origin': '*',
//         'Access-Control-Allow-Methods': 'POST, OPTIONS',
//         'Access-Control-Allow-Headers': 'Content-Type',
//       },
//     })
//   },
// })
