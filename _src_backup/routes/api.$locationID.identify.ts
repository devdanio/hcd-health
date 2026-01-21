// import { DataSource, EventType } from '@/generated/prisma/enums'
// import { prisma } from '@/server/db/client'
// import { createFileRoute } from '@tanstack/react-router'
// import { z } from 'zod'
// import { sanitizeEmail, sanitizePhone } from '@/utils/helpers'

// const EventSchema = z.object({
//   type: z.enum(EventType),
//   timestamp: z.string().pipe(z.coerce.date()),
//   metadata: z.record(z.string(), z.any()),
// })

// const PayloadSchema = z.object({
//   anonymous_id: z.uuid(),
//   email: z.email().optional(),
//   phone: z.string().optional(),
//   first_name: z.string().optional(),
//   last_name: z.string().optional(),
//   full_name: z.string().optional(),
//   events: z.array(EventSchema).min(1),
//   source: z.enum(DataSource),
// })

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Methods': 'POST, OPTIONS',
//   'Access-Control-Allow-Headers': 'Content-Type',
//   'Access-Control-Max-Age': '86400', // 24 hours
// }

// export const Route = createFileRoute('/api/$locationID/identify')({
//   server: {
//     handlers: {
//       POST: async ({ request, params }) => {
//         const { locationID } = params

//         // Verify location (company) exists
//         const company = await prisma.company.findUnique({
//           where: { id: locationID },
//         })

//         if (!company) {
//           return new Response('Location not found', {
//             status: 404,
//             headers: corsHeaders,
//           })
//         }

//         let body: unknown

//         try {
//           body = await request.json()
//         } catch {
//           return new Response('Invalid JSON', {
//             status: 400,
//             headers: corsHeaders,
//           })
//         }

//         const parsed = PayloadSchema.safeParse(body)
//         if (!parsed.success) {
//           console.error('invalid payload', parsed.error)
//           return new Response('Invalid payload', {
//             status: 400,
//             headers: corsHeaders,
//           })
//         }

//         const {
//           anonymous_id,
//           email,
//           phone,
//           first_name,
//           last_name,
//         } = parsed.data

//         if (!email && !phone) {
//           throw new Error('identify requires email or phone')
//         }

//         return await prisma.$transaction(async (tx) => {
//           // 1️⃣ Find existing person by strongest identifiers
//           let person = await tx.person.findFirst({
//             where: {
//               company_id: locationID,
//               OR: [
//                 ...(email ? [{ email }] : []),
//                 ...(phone ? [{ phone }] : []),
//               ],
//             },
//           })

//           // 2️⃣ Create person if not found
//           if (!person) {
//             person = await tx.person.create({
//               data: {
//                 company_id: locationID,
//                 email,
//                 phone,
//                 first_name,
//                 last_name,
//               },
//             })
//           } else {
//             // 3️⃣ Enrich person if new traits arrived
//             await tx.person.update({
//               where: { id: person.id },
//               data: {
//                 email: person.email ?? email,
//                 phone: person.phone ?? phone,
//                 first_name: person.first_name ?? first_name,
//                 last_name: person.last_name ?? last_name,
//               },
//             })
//           }

//           // 4️⃣ Link anonymous identity (if present)
//           if (anonymous_id) {
//             await tx.profile.upsert({
//               where: {
//                 : {
//                   company_id,
//                   anonymous_id,
//                 },
//               },
//               update: {
//                 person_id: person.id,
//               },
//               create: {
//                 company_id,
//                 anonymous_id,
//                 person_id: person.id,
//               },
//             })
//           }

//           return { person_id: person.id }
//         })
//       },
//       OPTIONS: async () => {
//         return new Response(null, { status: 204, headers: corsHeaders })
//       },
//     },
//   },
// })
