import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import dotenv from 'dotenv'
import { sanitizeEmail, sanitizePhone } from '../../utils/helpers'
import {
  getClientConfigOrThrow,
  type ClientConfig,
} from '../../../client-config'
import type { Prisma } from '../../generated/prisma/client'
import type { PatientRecord as ChiroTouchRecord } from '../chirotouch/proccess-new-patients-excel'

dayjs.extend(customParseFormat)

const BATCH_SIZE = 200
const TX_TIMEOUT_MS = 120000
const LOG_EVERY = 500

type RawPatient = {
  id?: string
  external_id?: string
  externalId?: string
  patientId?: string
  firstApt?: string | null
  lastApt?: string | null
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  dateOfBirth?: string | null
  date_of_birth?: string | null
  dob?: string | null
  created_at?: string
  createdAt?: string
  created_at_source?: string
  createdAtSource?: string
  [key: string]: unknown
}

type ImportContext = {
  sourceSystem: string
  sourceFileName: string
  sourceFileDate: string | null
}

type PatientInsert = {
  organization_id: string
  external_id: string
  name: string | null
  phone: string | null
  email: string | null
  created_at_source: Date | null
  raw_payload: Prisma.InputJsonValue
}

type PatientBatchEntry = {
  patient: PatientInsert
}

function getLatestPatientInputFileOrThrow(directoryPath: string): string {
  if (!directoryPath || directoryPath.trim().length === 0) {
    throw new Error(
      'Missing EHR_NORMALIZED_DIR in client-config.ts for this client.',
    )
  }
  if (!fs.existsSync(directoryPath)) {
    throw new Error(
      `Configured EHR_NORMALIZED_DIR does not exist: ${directoryPath}`,
    )
  }

  const candidates = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isFile()) return false
      const lower = entry.name.toLowerCase()
      if (lower.includes('.rejects.')) return false
      if (lower.endsWith('.patients.jsonld') || lower.endsWith('.patients.json')) {
        return true
      }
      return lower.endsWith('.jsonld') || lower.endsWith('.json')
    })
    .map((entry) => path.resolve(directoryPath, entry.name))

  if (candidates.length === 0) {
    throw new Error(
      `No .jsonld/.json files found in configured EHR_NORMALIZED_DIR: ${directoryPath}`,
    )
  }

  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
  return candidates[0]
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeToken(value: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

function buildName(record: RawPatient): string | null {
  const explicit = normalizeString(record.name)
  if (explicit) return explicit
  const first = normalizeString(record.firstName)
  const last = normalizeString(record.lastName)
  if (!first && !last) return null
  return [first, last].filter(Boolean).join(' ')
}

function extractExternalId(record: RawPatient): string | null {
  const explicit =
    normalizeString(record.external_id) ??
    normalizeString(record.externalId) ??
    normalizeString(record.patientId) ??
    normalizeString(record.id)

  return explicit ?? null
}

function extractCreatedAt(record: RawPatient): string | null {
  return (
    normalizeString(record.firstApt) ??
    normalizeString(record.lastApt) ??
    normalizeString(record.created_at_source) ??
    normalizeString(record.createdAtSource) ??
    normalizeString(record.created_at) ??
    normalizeString(record.createdAt)
  )
}

function extractDateOfBirth(record: RawPatient): string | null {
  return (
    normalizeString(record.date_of_birth) ??
    normalizeString(record.dateOfBirth) ??
    normalizeString(record.dob)
  )
}

function parseDateFromFileName(fileName: string): string | null {
  const match = fileName.match(/\b(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-(20\d{2})\b/)
  if (!match) return null
  const parsed = dayjs(match[0], 'MM-DD-YYYY', true)
  if (!parsed.isValid()) return null
  return parsed.toISOString()
}

function toDateOrNull(value: string | null): Date | null {
  if (!value) return null

  const formats = [
    'MM/DD/YYYY',
    'M/D/YYYY',
    'MM/DD/YY',
    'M/D/YY',
    'YYYY-MM-DD',
  ]
  for (const format of formats) {
    const parsed = dayjs(value, format, true)
    if (parsed.isValid()) return parsed.toDate()
  }

  const fallback = dayjs(value)
  return fallback.isValid() ? fallback.toDate() : null
}

function convertChiroTouchRecord(record: ChiroTouchRecord): RawPatient {
  return {
    firstName: record.firstName || null,
    lastName: record.lastName || null,
    email: record.email || null,
    phone: record.phone ? String(record.phone) : null,
    created_at_source: record.firstAppt || undefined,
  }
}

function buildDeterministicExternalId(
  record: RawPatient,
  sourceSystem: string,
  normalizedPhone: string | null,
  normalizedEmail: string | null,
): { externalId: string; usedSourceExternal: boolean } {
  const source = normalizeToken(sourceSystem).replace(/[^a-z0-9]+/g, '-')
  const explicitExternalId = extractExternalId(record)
  if (explicitExternalId) {
    const token = normalizeToken(explicitExternalId)
    return {
      externalId: `${source}:external:${token}`,
      usedSourceExternal: true,
    }
  }

  const firstName = normalizeToken(normalizeString(record.firstName))
  const lastName = normalizeToken(normalizeString(record.lastName))
  const dob = normalizeToken(extractDateOfBirth(record))
  const fingerprint = [
    source,
    normalizeToken(normalizedPhone),
    normalizeToken(normalizedEmail),
    firstName,
    lastName,
    dob,
  ].join('|')
  const hash = crypto
    .createHash('sha256')
    .update(fingerprint)
    .digest('hex')
    .slice(0, 32)

  return {
    externalId: `${source}:hash:${hash}`,
    usedSourceExternal: false,
  }
}

function buildPatientInsert(
  record: RawPatient,
  organizationId: string,
  context: ImportContext,
): { patient: PatientInsert; usedSourceExternal: boolean } | null {
  const phone = sanitizePhone(normalizeString(record.phone)) ?? null
  const email = sanitizeEmail(normalizeString(record.email)) ?? null

  if (!phone && !email) return null

  const createdAt = extractCreatedAt(record)
  const dedupe = buildDeterministicExternalId(
    record,
    context.sourceSystem,
    phone,
    email,
  )

  return {
    usedSourceExternal: dedupe.usedSourceExternal,
    patient: {
      organization_id: organizationId,
      external_id: dedupe.externalId,
      name: buildName(record),
      phone,
      email,
      created_at_source: toDateOrNull(createdAt),
      raw_payload: toInputJsonValue({
        ...record,
        _pipeline: {
          source_system: context.sourceSystem,
          source_file_name: context.sourceFileName,
          source_file_date: context.sourceFileDate,
          dedupe_external_id: dedupe.externalId,
        },
      }),
    },
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
  let sourceSystemArg: string | undefined
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

    if (arg === '--source-system') {
      const next = args[i + 1]
      if (!next) {
        console.error('Missing value for --source-system')
        process.exit(1)
      }
      sourceSystemArg = next
      i += 1
      continue
    }

    if (arg.startsWith('--env-file=')) {
      envFile = arg.split('=').slice(1).join('=')
      continue
    }

    if (arg.startsWith('--source-system=')) {
      sourceSystemArg = arg.split('=').slice(1).join('=')
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
      'Usage: pnpm exec tsx src/integrations/patients/patients-to-db.ts <clientName> [filePath (.jsonld or .json)] [--source-system <name>] [--env-file <path>]',
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
      : getLatestPatientInputFileOrThrow(client.EHR_NORMALIZED_DIR)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
  const isJsonArray = filePath.endsWith('.json')

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const sourceSystem = sourceSystemArg ?? client.EHR_SYSTEM
  if (!sourceSystem) {
    console.error(
      `Missing source system. Add EHR_SYSTEM in client-config.ts or pass --source-system.`,
    )
    process.exit(1)
  }
  const sourceFileName = path.basename(filePath)
  const sourceFileDate = parseDateFromFileName(sourceFileName)
  const context: ImportContext = {
    sourceSystem,
    sourceFileName,
    sourceFileDate,
  }

  console.log(`Loaded env file: ${resolvedEnvFile}`)
  console.log(`Writing to DB in batches of ${BATCH_SIZE}...`)
  console.log(`Client: ${clientName}`)
  console.log(`Source system: ${sourceSystem}`)
  console.log(`Reading ${isJsonArray ? 'JSON' : 'JSONLD'}: ${filePath}`)
  console.log(`Source file date: ${sourceFileDate ?? 'not detected'}\n`)

  const prisma = await getPrisma()

  let processed = 0
  let created = 0
  let updated = 0
  let skippedMissingIdentifiers = 0
  let usingSourceExternalId = 0
  let usingHashedExternalId = 0
  let parseErrors = 0
  const batch: PatientBatchEntry[] = []

  async function flushBatch() {
    if (batch.length === 0) return
    const entries = batch.splice(0, batch.length)

    const batchStart = Date.now()
    let batchCreated = 0
    let batchUpdated = 0

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i]
      if (i > 0 && i % 50 === 0) {
        console.log(`[batch] ${i}/${entries.length} processed...`)
      }

      await prisma.$transaction(
        async (tx) => {
          const existing = await tx.patients.findUnique({
            where: {
              organization_id_external_id: {
                organization_id: entry.patient.organization_id,
                external_id: entry.patient.external_id,
              },
            },
            select: { id: true },
          })

          if (!existing) {
            await tx.patients.create({
              data: entry.patient,
              select: { id: true },
            })
            batchCreated += 1
            return
          }

          await tx.patients.update({
            where: { id: existing.id },
            data: {
              name: entry.patient.name,
              phone: entry.patient.phone,
              email: entry.patient.email,
              created_at_source: entry.patient.created_at_source,
              raw_payload: entry.patient.raw_payload,
            },
            select: { id: true },
          })
          batchUpdated += 1
        },
        { timeout: TX_TIMEOUT_MS, maxWait: TX_TIMEOUT_MS },
      )
    }

    const batchElapsed = Date.now() - batchStart
    console.log(
      `[batch] done size=${entries.length} created=${batchCreated} updated=${batchUpdated} ms=${batchElapsed}`,
    )
    created += batchCreated
    updated += batchUpdated
  }

  function processRecord(record: RawPatient) {
    const patientResult = buildPatientInsert(record, client.HCD_ORG_ID, context)

    if (!patientResult) {
      skippedMissingIdentifiers += 1
      return
    }

    if (patientResult.usedSourceExternal) {
      usingSourceExternalId += 1
    } else {
      usingHashedExternalId += 1
    }

    batch.push({ patient: patientResult.patient })
  }

  const startTime = Date.now()

  if (isJsonArray) {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const records = JSON.parse(raw) as ChiroTouchRecord[]
    console.log(`Loaded ${records.length} records from JSON array\n`)

    for (const ctRecord of records) {
      processed += 1
      if (processed % LOG_EVERY === 0) {
        const elapsed = Date.now() - startTime
        console.log(
          `[progress] processed=${processed} created=${created} updated=${updated} elapsed_ms=${elapsed}`,
        )
      }

      const record = convertChiroTouchRecord(ctRecord)
      processRecord(record)

      if (batch.length >= BATCH_SIZE) {
        await flushBatch()
      }
    }
  } else {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    for await (const line of rl) {
      const trimmed = line.trim()
      if (!trimmed) continue

      processed += 1
      if (processed % LOG_EVERY === 0) {
        const elapsed = Date.now() - startTime
        console.log(
          `[progress] processed=${processed} created=${created} updated=${updated} elapsed_ms=${elapsed}`,
        )
      }
      let record: RawPatient
      try {
        record = JSON.parse(trimmed) as RawPatient
      } catch (error) {
        parseErrors += 1
        console.warn(`Parse error on line ${processed}:`, error)
        continue
      }

      processRecord(record)

      if (batch.length >= BATCH_SIZE) {
        await flushBatch()
      }
    }
  }

  await flushBatch()

  console.log('\nSummary')
  console.log(`Processed: ${processed}`)
  console.log(`Created: ${created}`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped (missing phone/email): ${skippedMissingIdentifiers}`)
  console.log(`Records using source external ID: ${usingSourceExternalId}`)
  console.log(`Records using hashed external ID: ${usingHashedExternalId}`)
  console.log(`Parse errors: ${parseErrors}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
