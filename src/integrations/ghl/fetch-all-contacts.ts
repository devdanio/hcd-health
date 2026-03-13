import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import dayjs from 'dayjs'
import {
  getClientConfigOrThrow,
  type ClientConfig,
} from '../../../client-config'

interface GHLContact {
  id: string
  locationId: string
  contactName: string
  firstName: string
  lastName: string
  companyName: string | null
  email: string | null
  phone: string
  dnd: boolean
  type: string
  source: string | null
  assignedTo: string
  city: string
  state: string
  postalCode: string
  address1: string | null
  dateAdded: string
  dateUpdated: string
  dateOfBirth: string | null
  tags: string[]
  country: string
  website: string | null
  timezone: string | null
  lastActivity: number
  customField: { id: string; value: unknown }[]
}

const BASE_URL = 'https://services.leadconnectorhq.com/contacts/'
const API_VERSION = '2021-07-28'
const LIMIT = 100

type FetchConfig = {
  locationId: string
  apiKey: string
  outputPath: string
}

async function fetchAllContacts(config: FetchConfig) {
  let totalFetched = 0
  let startAfterId: string | undefined
  let startAfter: number | undefined

  // Clear/create the file
  fs.mkdirSync(path.dirname(config.outputPath), { recursive: true })
  fs.writeFileSync(config.outputPath, '')

  while (true) {
    const params = new URLSearchParams({
      limit: String(LIMIT),
      locationId: config.locationId,
    })
    if (startAfterId && startAfter) {
      params.set('startAfterId', startAfterId)
      params.set('startAfter', String(startAfter))
    }

    const url = `${BASE_URL}?${params.toString()}`
    console.log(`Fetching: ${url}`)
    console.log('config.apiKey', config.apiKey)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
        Version: API_VERSION,
      },
    })

    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status} - ${response.statusText}`,
      )
    }

    const data = (await response.json()) as {
      contacts: GHLContact[]
      meta?: { startAfterId?: string; startAfter?: number; total?: number }
    }

    if (!data.contacts || data.contacts.length === 0) {
      console.log('No more contacts found')
      break
    }

    // Append each contact as a JSON line
    const lines = data.contacts
      .map((contact) => JSON.stringify(contact))
      .join('\n')
    fs.appendFileSync(config.outputPath, lines + '\n')

    totalFetched += data.contacts.length
    console.log(
      `Fetched ${data.contacts.length} contacts (total: ${totalFetched})`,
    )

    // Set cursor for next page
    if (data.meta?.startAfterId && data.meta?.startAfter) {
      startAfterId = data.meta.startAfterId
      startAfter = data.meta.startAfter
    } else {
      // Fallback: use the last contact in the batch
      const last = data.contacts[data.contacts.length - 1]
      if (last) {
        startAfterId = last.id
        startAfter = dayjs(last.dateAdded).valueOf()
      } else {
        break
      }
    }

    // Stop if we got fewer than the limit (last page)
    if (data.contacts.length < LIMIT) {
      console.log('Last page reached')
      break
    }

    // Rate limit delay
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }

  return totalFetched
}

async function main() {
  const args = process.argv.slice(2)
  let clientName: string | undefined
  let outputPathArg: string | undefined
  let envFile = '.env.prod'

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--env-file') {
      const next = args[i + 1]
      if (!next) {
        console.error('Missing value for --env-file')
        process.exit(1)
      }
      envFile = next
      i += 1
      continue
    }

    if (arg.startsWith('--env-file=')) {
      envFile = arg.split('=').slice(1).join('=')
      continue
    }

    if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`)
      process.exit(1)
    }

    if (!clientName) {
      clientName = arg
      continue
    }

    if (!outputPathArg) {
      outputPathArg = arg
      continue
    }
  }

  if (!clientName) {
    console.error(
      'Usage: pnpm exec tsx src/integrations/ghl/fetch-all-contacts.ts <clientName> [outputPath] [--env-file <path>]',
    )
    process.exit(1)
  }

  const resolvedEnvFile = path.resolve(process.cwd(), envFile)
  if (!fs.existsSync(resolvedEnvFile)) {
    console.error(`Env file not found: ${resolvedEnvFile}`)
    process.exit(1)
  }

  dotenv.config({ path: resolvedEnvFile, override: true })

  let client: ClientConfig
  try {
    client = getClientConfigOrThrow(clientName)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  const apiKey = process.env[client.GHL_API_KEY_ENV]
  if (!apiKey) {
    console.error(
      `Missing env var "${client.GHL_API_KEY_ENV}" for client "${clientName}"`,
    )
    process.exit(1)
  }

  const outputPath =
    outputPathArg ??
    path.resolve(
      client.GHL_RAW_DIR,
      `${dayjs().format('MM-DD-YYYY-HHmmss')}.contacts.jsonld`,
    )

  try {
    console.log(`Env file: ${resolvedEnvFile}`)
    console.log(`Client: ${clientName}`)
    console.log(`Location ID: ${client.GHL_LOCATION_ID}`)
    console.log(`Output: ${outputPath}`)
    const total = await fetchAllContacts({
      locationId: client.GHL_LOCATION_ID,
      apiKey,
      outputPath,
    })
    console.log(`\nDone. ${total} contacts saved to ${outputPath}`)
  } catch (error) {
    console.error(
      'Script failed:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

main()
