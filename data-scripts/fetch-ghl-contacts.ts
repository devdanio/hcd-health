// import fs from 'node:fs'
// import path from 'node:path'
// import 'dotenv/config'

// // const thriveGHLLocationId = 'k571hxg3t4h7wmyjq4t24vrc317vgdsw'
// // const ehiGHLLocationId = 'hRKablZc2NUdNQhD5qmy'
// // const ehiConvexId = 'k574qfrbgzt526cbatkjzcn2dd7vcq00'
// // const paomConvexId = 'k57b750v8kpvhp563zztq8tp057vgypq'
// const OUTPUT_PATH = path.resolve(__dirname, '../temp-data/thrive.jsonld')
// const API_KEY = process.env.GHL_THRIVE_API_KEY!

// interface GHLContact {
//   id: string
//   locationId: string
//   contactName: string
//   firstName: string
//   lastName: string
//   companyName: any
//   email: any
//   phone: string
//   dnd: boolean
//   type: string
//   source: any
//   assignedTo: string
//   city: string
//   state: string
//   postalCode: string
//   address1: any
//   dateAdded: string
//   dateUpdated: string
//   dateOfBirth: any
//   tags: string[]
//   country: string
//   website: any
//   timezone: any
//   lastActivity: number
//   customField: { id: string; value: any }[]
// }

// async function fetchAllContacts() {
//   let currentUrl = 'https://services.leadconnectorhq.com/contacts/'
//   let totalFetched = 0

//   // Clear/create the file
//   fs.writeFileSync(OUTPUT_PATH, '')

//   while (currentUrl) {
//     console.log(`Fetching: ${currentUrl}`)

//     const response = await fetch(currentUrl, {
//       method: 'GET',
//       headers: {
//         Authorization: `Bearer ${API_KEY}`,
//         'Content-Type': 'application/json',
//         Version: '2021-07-28',
//       },
//     })

//     if (!response.ok) {
//       throw new Error(
//         `HTTP error! status: ${response.status} - ${response.statusText}`,
//       )
//     }

//     const data = (await response.json()) as {
//       contacts: GHLContact[]
//       meta?: { nextPageUrl?: string; nextPage?: number }
//     }

//     if (!data.contacts || data.contacts.length === 0) {
//       console.log('No more contacts found')
//       break
//     }

//     // Append each contact as a JSON line
//     const lines = data.contacts
//       .map((contact) => JSON.stringify(contact))
//       .join('\n')
//     fs.appendFileSync(OUTPUT_PATH, lines + '\n')

//     totalFetched += data.contacts.length
//     console.log(
//       `Fetched ${data.contacts.length} contacts (total: ${totalFetched})`,
//     )

//     // Move to next page
//     if (data.meta?.nextPageUrl) {
//       currentUrl = data.meta.nextPageUrl.replace('http', 'https')
//     } else {
//       console.log('No more pages available')
//       break
//     }

//     // Rate limit delay
//     await new Promise((resolve) => setTimeout(resolve, 1500))
//   }

//   return totalFetched
// }

// async function main() {
//   try {
//     const total = await fetchAllContacts()
//     console.log(`\nDone. ${total} contacts saved to ${OUTPUT_PATH}`)
//   } catch (error) {
//     console.error(
//       'Script failed:',
//       error instanceof Error ? error.message : String(error),
//     )
//     process.exit(1)
//   }
// }

// main()
