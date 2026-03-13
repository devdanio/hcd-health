import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PrismaPg } from '@prisma/adapter-pg'
// @ts-ignore - Importing from generated file
import { PrismaClient } from '../src/generated/prisma/client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config({ path: join(__dirname, '../.env') })
// Also try .env.local if .env doesn't exist or doesn't have the token
config({ path: join(__dirname, '../.env.local') })

const connectionString = `${process.env.DATABASE_URL}`
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })
const accessToken = process.env.VITE_MAPBOX_TOKEN

async function main() {
  if (!accessToken) {
    console.error('VITE_MAPBOX_TOKEN is not set')
    process.exit(1)
  }

  console.log('Fetching unique city/state combinations from patients...')

  // Get all patients with city and state
  const patients = await prisma.patient.findMany({
    where: {
      AND: [
        { city: { not: null } },
        { city: { not: '' } },
        { state: { not: null } },
        { state: { not: '' } },
      ],
    },
    select: {
      city: true,
      state: true,
    },
  })

  // Get unique combinations
  const uniqueLocations = new Set<string>()
  const locationsToProcess: { city: string; state: string }[] = []

  patients.forEach((p: any) => {
    if (p.city && p.state) {
      const key = `${p.city.toLowerCase()}|${p.state.toLowerCase()}`
      if (!uniqueLocations.has(key)) {
        uniqueLocations.add(key)
        locationsToProcess.push({ city: p.city, state: p.state })
      }
    }
  })

  console.log(`Found ${locationsToProcess.length} unique locations to process.`)

  for (const [index, location] of locationsToProcess.entries()) {
    const { city, state } = location
    const query = `${city}, ${state}`

    // Wait 200ms before each fetch (except the first one)
    if (index > 0) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    console.log(
      `[${index + 1}/${locationsToProcess.length}] Processing: ${query}`,
    )

    // Check if location already exists in CityLatLng
    const existing = await prisma.cityLatLng.findUnique({
      where: {
        city_state: {
          city: city,
          state: state,
        },
      },
    })

    if (existing) {
      console.log(
        `  -> Already exists: ${existing.latitude}, ${existing.longitude}`,
      )
      continue
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${accessToken}&limit=1&types=place,locality`,
      )

      if (!response.ok) {
        console.error(`Failed to fetch for ${query}: ${response.statusText}`)
        continue
      }

      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center
        console.log(`  -> Found: ${lat}, ${lng}`)

        // Write immediately after fetching
        await prisma.cityLatLng.upsert({
          where: {
            city_state: {
              city: city,
              state: state,
            },
          },
          update: {
            latitude: lat,
            longitude: lng,
          },
          create: {
            city: city,
            state: state,
            latitude: lat,
            longitude: lng,
          },
        })

        console.log(`  -> Saved to CityLatLng`)
      } else {
        console.log('  -> Location not found')
      }
    } catch (error) {
      console.error(`Error processing ${query}:`, error)
    }
  }

  console.log('Done!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
