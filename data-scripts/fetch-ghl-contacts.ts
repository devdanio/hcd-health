import dayjs from 'dayjs'
import 'dotenv/config'
import { ConvexHttpClient } from 'convex/browser'
import { api } from 'convex/_generated/api'
import { HighLevel } from '@gohighlevel/api-client'
import { Id } from 'convex/_generated/dataModel'

const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL!)

const thriveGHLLocationId = 'k571hxg3t4h7wmyjq4t24vrc317vgdsw'
const ehiGHLLocationId = 'hRKablZc2NUdNQhD5qmy'
const ehiConvexId = 'k574qfrbgzt526cbatkjzcn2dd7vcq00'
const paomConvexId = 'k57b750v8kpvhp563zztq8tp057vgypq'
export interface GHLContact {
  id: string
  locationId: string
  contactName: string
  firstName: string
  lastName: string
  companyName: any
  email: any
  phone: string
  dnd: boolean
  type: string
  source: any
  assignedTo: string
  city: string
  state: string
  postalCode: string
  address1: any
  dateAdded: string
  dateUpdated: string
  dateOfBirth: any
  tags: string[]
  country: string
  website: any
  timezone: any
  lastActivity: number
  customField: CustomField[]
}

export interface CustomField {
  id: string
  value: any
}

export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  dateAdded: string
  dateUpdated: string
  dateOfBirth: string
  source: string | null
  customField: {
    id: string
    value: any
  }[]
}

async function fetchContactsUntilOld() {
  let currentUrl = 'https://rest.gohighlevel.com/v1/contacts/'
  let insertedCount = 0

  // Get the most recent contact from Convex
  const mostRecentContact = await convex.query(
    api.contacts.getMostRecentContact,
    {
      companyId: paomConvexId as Id<'companies'>,
    },
  )
  const mostRecentDate = mostRecentContact
    ? dayjs(mostRecentContact.createdAt)
    : dayjs().subtract(90, 'days')

  console.log(
    `Looking for contacts newer than: ${mostRecentDate.format('YYYY-MM-DD HH:mm:ss')}`,
  )

  try {
    while (currentUrl) {
      console.log(`Fetching: ${currentUrl}`)

      const response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.GHL_PAOM_API_KEY}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status} - ${response.statusText}`,
        )
      }

      const data = (await response.json()) as { contacts: GHLContact[] }

      console.log('got the response', JSON.stringify(data, null, 2))

      if (!data.contacts || data.contacts.length === 0) {
        console.log('No more contacts found')
        break
      }

      console.log(`Found ${data.contacts.length} contacts on this page`)

      // Check each contact's age
      let foundOldContact = false
      for (const contact of data.contacts) {
        const contactDate = dayjs(contact.dateAdded)
        const isNewerThanMostRecent = contactDate.isAfter(mostRecentDate)

        console.log(
          `Contact ${contact.id}: ${contactDate.format('YYYY-MM-DD HH:mm:ss')} - ${isNewerThanMostRecent ? 'NEWER' : 'older or same'}`,
        )

        if (isNewerThanMostRecent) {
          // Insert the contact into Convex
          try {
            await convex.mutation(api.contacts.createContact, {
              contact: {
                companyId: paomConvexId as Id<'companies'>,
                fullName: contact.contactName || undefined,
                firstName: contact.firstName || undefined,
                lastName: contact.lastName || undefined,
                email: contact.email || undefined,
                phone: contact.phone || undefined,
              },
              ghlContact: {
                ...contact,
                dateAdded: dayjs(contact.dateAdded).valueOf(),
                dateUpdated: dayjs(contact.dateUpdated).valueOf(),
              },
            })
            insertedCount++
            console.log(
              `✅ Inserted contact: ${contact.firstName} ${contact.lastName}`,
            )
          } catch (error) {
            console.error(`❌ Failed to insert contact ${contact.id}:`, error)
          }
        } else {
          console.log(
            `\n✅ Found contact older than most recent: ${contact.id}`,
          )
          console.log(
            `Contact date: ${contactDate.format('YYYY-MM-DD HH:mm:ss')}`,
          )
          console.log(`Total contacts inserted: ${insertedCount}`)
          foundOldContact = true
          break
        }
      }

      if (foundOldContact) {
        break
      }

      // Move to next page
      if (data.meta && data.meta.nextPageUrl) {
        currentUrl = data.meta.nextPageUrl.replace('http', 'https')
        console.log(`Moving to next page (${data.meta.nextPage})`)
      } else {
        console.log('No more pages available')
        break
      }

      // Add a small delay to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  } catch (error) {
    console.error(
      'Error fetching contacts:',
      error instanceof Error ? error.message : String(error),
    )
    throw error
  }

  return insertedCount
}

// Usage example
async function main() {
  try {
    const insertedCount = await fetchContactsUntilOld()

    console.log(`\n📊 Summary:`)
    console.log(`Total contacts inserted: ${insertedCount}`)

    return insertedCount
  } catch (error) {
    console.error(
      'Script failed:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

// Run the script
main()

// initGHL()
