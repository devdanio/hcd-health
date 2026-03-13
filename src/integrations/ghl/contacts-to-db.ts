import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import dayjs from 'dayjs'
import dotenv from 'dotenv'
import { Prisma } from '../../generated/prisma/client'
import { sanitizeEmail, sanitizePhone } from '../../utils/helpers'
import {
  getClientConfigOrThrow,
  type ClientConfig,
} from '../../../client-config'

const BATCH_SIZE = 500
const CONCURRENCY = 25
const TX_TIMEOUT_MS = 120000
const LOG_EVERY = 500

type ThriveJsonldContact = {
  id: string
  locationId?: string
  contactName?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  dateAdded?: string
  dateUpdated?: string
  attributions?: unknown
  [key: string]: unknown
}

type GhlAttribution = {
  utmSessionSource?: string
  utmSource?: string
  utmCampaign?: string
  utmCampaignId?: string
  utmContent?: string
  utmTerm?: string
  utmKeyword?: string
  utmGclid?: string
  gclid?: string
  fbclid?: string
  utmFbclid?: string
  utmMedium?: string
  medium?: string
  referrer?: string
  url?: string
  pageUrl?: string
  isFirst?: boolean
  isLast?: boolean
  [key: string]: unknown
}

type LeadInsert = {
  organization_id: string
  phone: string | null
  name: string | null
  email: string | null
  qualified: boolean
  raw_payload: Prisma.InputJsonValue
}

type LeadEventInsert = {
  organization_id: string
  event_type: 'import'
  occurred_at: Date
  phone: string | null
  name: string | null
  platform: string | null
  campaign_id: string | null
  gclid: string | null
  fbclid: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  referrer: string | null
  landing_page: string | null
  raw_payload: Prisma.InputJsonValue
}

type AttributionSnapshot = {
  platform: string | null
  campaign_id: string | null
  gclid: string | null
  fbclid: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  referrer: string | null
  landing_page: string | null
}

type LeadBatchEntry = {
  lead: LeadInsert
  leadEvent: LeadEventInsert
}

function getLatestJsonldFileOrThrow(directoryPath: string): string {
  if (!directoryPath || directoryPath.trim().length === 0) {
    throw new Error(
      'Missing GHL_RAW_DIR in client-config.ts for this client.',
    )
  }
  if (!fs.existsSync(directoryPath)) {
    throw new Error(`Configured GHL_RAW_DIR does not exist: ${directoryPath}`)
  }

  const candidates = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.jsonld'))
    .map((entry) => path.resolve(directoryPath, entry.name))

  if (candidates.length === 0) {
    throw new Error(
      `No .jsonld files found in configured GHL_RAW_DIR: ${directoryPath}`,
    )
  }

  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
  return candidates[0]
}

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function lower(value: string | null): string {
  return (value ?? '').toLowerCase()
}

function getAttributions(attributions: unknown): GhlAttribution[] {
  if (!Array.isArray(attributions)) return []
  return attributions.filter((item): item is GhlAttribution => {
    return typeof item === 'object' && item !== null
  })
}

function pickPrimaryAttribution(
  attributions: GhlAttribution[],
): GhlAttribution | null {
  if (attributions.length === 0) return null
  const first = attributions.find((attr) => attr.isFirst === true)
  return first ?? attributions[0]
}

function inferPlatform(attribution: GhlAttribution | null): string | null {
  if (!attribution) return null
  const sessionSource = lower(normalizeString(attribution.utmSessionSource))
  const utmSource = lower(normalizeString(attribution.utmSource))
  const gclid = normalizeString(attribution.utmGclid ?? attribution.gclid)
  const fbclid = normalizeString(attribution.fbclid ?? attribution.utmFbclid)

  if (
    utmSource === 'adwords' ||
    sessionSource.includes('paid search') ||
    !!gclid
  ) {
    return 'google_ads'
  }

  if (
    sessionSource.includes('paid social') ||
    utmSource.includes('facebook') ||
    utmSource.includes('instagram') ||
    utmSource === 'fb' ||
    !!fbclid
  ) {
    return 'facebook_ads'
  }

  return null
}

function getCampaignIdFromLandingPage(urlValue: string | null): string | null {
  if (!urlValue) return null

  try {
    const parsed = new URL(urlValue)
    return normalizeString(parsed.searchParams.get('gad_campaignid'))
  } catch {
    const queryStart = urlValue.indexOf('?')
    if (queryStart === -1) return null
    const hashStart = urlValue.indexOf('#', queryStart)
    const query = urlValue.slice(
      queryStart + 1,
      hashStart === -1 ? undefined : hashStart,
    )
    const params = new URLSearchParams(query)
    return normalizeString(params.get('gad_campaignid'))
  }
}

function buildAttributionSnapshot(
  attribution: GhlAttribution | null,
): AttributionSnapshot {
  const landingPage = normalizeString(attribution?.pageUrl)
  const campaignId =
    normalizeString(attribution?.utmCampaignId) ??
    getCampaignIdFromLandingPage(landingPage)

  return {
    platform: inferPlatform(attribution),
    campaign_id: campaignId,
    gclid: normalizeString(attribution?.utmGclid ?? attribution?.gclid),
    fbclid: normalizeString(attribution?.fbclid ?? attribution?.utmFbclid),
    utm_source: normalizeString(attribution?.utmSource),
    utm_medium: normalizeString(attribution?.utmMedium ?? attribution?.medium),
    utm_campaign: normalizeString(attribution?.utmCampaign),
    utm_content: normalizeString(attribution?.utmContent),
    utm_term: normalizeString(attribution?.utmTerm ?? attribution?.utmKeyword),
    referrer: normalizeString(attribution?.referrer),
    landing_page: landingPage,
  }
}

function buildName(contact: ThriveJsonldContact): string | null {
  const contactName = normalizeString(contact.contactName)
  if (contactName) return contactName

  const firstName = normalizeString(contact.firstName)
  const lastName = normalizeString(contact.lastName)
  if (!firstName && !lastName) return null
  return [firstName, lastName].filter(Boolean).join(' ')
}

function buildLeadInsert(
  contact: ThriveJsonldContact,
  organizationId: string,
): LeadInsert | null {
  const phone = sanitizePhone(normalizeString(contact.phone)) ?? null
  const email = sanitizeEmail(normalizeString(contact.email)) ?? null

  if (!phone && !email) return null

  return {
    organization_id: organizationId,
    phone,
    name: buildName(contact),
    email,
    qualified: false,
    raw_payload: asJsonValue(contact),
  }
}

function buildLeadEventInsert(
  contact: ThriveJsonldContact,
  organizationId: string,
  snapshot: AttributionSnapshot,
  attribution: GhlAttribution | null,
): LeadEventInsert | null {
  const phone = sanitizePhone(normalizeString(contact.phone)) ?? null
  const email = normalizeString(contact.email)
  if (!phone && !email) return null

  const dateAdded = normalizeString(contact.dateAdded)
  const dateUpdated = normalizeString(contact.dateUpdated) ?? dateAdded
  const primaryDate = dateAdded ?? dateUpdated
  if (!primaryDate) return null

  return {
    organization_id: organizationId,
    event_type: 'import',
    occurred_at: dayjs(primaryDate).toDate(),
    phone,
    name: buildName(contact),
    platform: snapshot.platform,
    campaign_id: snapshot.campaign_id,
    gclid: snapshot.gclid,
    fbclid: snapshot.fbclid,
    utm_source: snapshot.utm_source,
    utm_medium: snapshot.utm_medium,
    utm_campaign: snapshot.utm_campaign,
    utm_content: snapshot.utm_content,
    utm_term: snapshot.utm_term,
    referrer: snapshot.referrer,
    landing_page: snapshot.landing_page,
    raw_payload: asJsonValue({ contact, attribution }),
  }
}


async function getPrisma() {
  const module = await import('../../db')
  return module.prisma
}

async function main() {
  const args = process.argv.slice(2)
  let clientName: string | undefined
  let jsonldPath: string | undefined
  let envFile = '.env'

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

    if (arg.startsWith('--env=')) {
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

    if (!jsonldPath) {
      jsonldPath = arg
      continue
    }
  }

  if (!clientName) {
    console.error(
      'Usage: pnpm exec tsx src/integrations/ghl/contacts-to-db.ts <clientName> [jsonldPath] [--env-file <path>]',
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

  let filePath: string
  try {
    filePath = jsonldPath
      ? path.resolve(process.cwd(), jsonldPath)
      : getLatestJsonldFileOrThrow(client.GHL_RAW_DIR)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  console.log(`Loaded env file: ${resolvedEnvFile}`)
  console.log(`Writing to DB in batches of ${BATCH_SIZE}...`)
  console.log(`Client: ${clientName}`)
  console.log(`Reading JSONLD: ${filePath}\n`)

  const prisma = await getPrisma()

  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  let processed = 0
  let inserted = 0
  let skippedMissingIdentifiers = 0
  let skippedMissingDate = 0
  let skippedDuplicates = 0
  let parseErrors = 0
  const batch: LeadBatchEntry[] = []

  type InsertResult = { status: 'created' } | { status: 'duplicate' }

  async function insertLeadWithEvent(
    entry: LeadBatchEntry,
  ): Promise<InsertResult> {
    try {
      await prisma.$transaction(
        async (tx) => {
          const lead = await tx.leads.create({
            data: entry.lead,
            select: { id: true },
          })
          await tx.lead_events.create({
            data: {
              ...entry.leadEvent,
              lead_id: lead.id,
            },
            select: { id: true },
          })
        },
        { timeout: TX_TIMEOUT_MS, maxWait: TX_TIMEOUT_MS },
      )
      return { status: 'created' }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { status: 'duplicate' }
      }
      throw error
    }
  }

  async function flushBatch() {
    if (batch.length === 0) return
    const entries = batch.splice(0, batch.length)

    const batchStart = Date.now()
    let createdLeads = 0
    let duplicateLeads = 0

    for (let i = 0; i < entries.length; i += CONCURRENCY) {
      const chunk = entries.slice(i, i + CONCURRENCY)
      const results = await Promise.allSettled(
        chunk.map((entry) => insertLeadWithEvent(entry)),
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.status === 'created') {
            createdLeads += 1
          } else {
            duplicateLeads += 1
          }
        } else {
          throw result.reason
        }
      }
    }

    const batchElapsed = Date.now() - batchStart
    console.log(
      `[batch] done size=${entries.length} leads=${createdLeads} duplicates=${duplicateLeads} ms=${batchElapsed}`,
    )
    inserted += createdLeads
    skippedDuplicates += duplicateLeads
  }

  const startTime = Date.now()

  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue

    processed += 1
    if (processed % LOG_EVERY === 0) {
      const elapsed = Date.now() - startTime
      console.log(
        `[progress] processed=${processed} inserted=${inserted} elapsed_ms=${elapsed}`,
      )
    }
    let contact: ThriveJsonldContact
    try {
      contact = JSON.parse(trimmed) as ThriveJsonldContact
    } catch (error) {
      parseErrors += 1
      console.warn(`Parse error on line ${processed}:`, error)
      continue
    }

    const attributions = getAttributions(contact.attributions)
    const primaryAttribution = pickPrimaryAttribution(attributions)
    const snapshot = buildAttributionSnapshot(primaryAttribution)

    const lead = buildLeadInsert(contact, client.HCD_ORG_ID)
    const leadEvent = buildLeadEventInsert(
      contact,
      client.HCD_ORG_ID,
      snapshot,
      primaryAttribution,
    )

    if (!lead) {
      skippedMissingIdentifiers += 1
      continue
    }

    if (!leadEvent) {
      skippedMissingDate += 1
      continue
    }

    batch.push({ lead, leadEvent })

    if (batch.length >= BATCH_SIZE) {
      await flushBatch()
    }
  }

  await flushBatch()

  console.log('\nSummary')
  console.log(`Processed: ${processed}`)
  console.log(`Inserted (valid leads): ${inserted}`)
  console.log(`Skipped (missing phone/email): ${skippedMissingIdentifiers}`)
  console.log(`Skipped (missing date): ${skippedMissingDate}`)
  console.log(`Skipped (duplicates): ${skippedDuplicates}`)
  console.log(`Parse errors: ${parseErrors}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
