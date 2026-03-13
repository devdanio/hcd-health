import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Path to temp-data/thrive.jsonld (project root) */
const THRIVE_JSONLD_PATH = path.join(
  import.meta.dir,
  '../../../temp-data/thrive.jsonld',
)

/**
 * Type for one contact record from thrive.jsonld (one JSON object per line).
 * Each line is a GHL-style contact with id, contactName, email, phone, tags, attributions, etc.
 */
export type ThriveJsonldContact = {
  id: string
  locationId: string
  contactName: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  dateAdded: string
  dateUpdated: string
  tags: string[]
  source: string | null
  [key: string]: unknown
}

/**
 * Reads temp-data/thrive.jsonld line-by-line. Each line is a JSON object.
 * Calls onLine(parsedObject, lineNumber) for each non-empty line.
 * Uses streaming so the full file is not loaded into memory.
 */
export async function readThriveJsonldByLine(
  onLine: (
    obj: ThriveJsonldContact,
    lineNumber: number,
  ) => void | Promise<void>,
  filePath: string = THRIVE_JSONLD_PATH,
): Promise<{ count: number; errors: { line: number; error: unknown }[] }> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  let count = 0
  const errors: { line: number; error: unknown }[] = []

  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const lineNumber = count + 1
    try {
      const obj = JSON.parse(trimmed) as ThriveJsonldContact
      await onLine(obj, lineNumber)
      count++
    } catch (error) {
      errors.push({ line: lineNumber, error })
    }
  }

  return { count, errors }
}

/** Attribution entry; may have utmCampaign without utmCampaignId */
type Attribution = {
  utmCampaign?: string
  utmCampaignId?: string
  [key: string]: unknown
}

function hasUtmCampaignButNoUtmCampaignId(attributions: unknown): boolean {
  if (!Array.isArray(attributions)) return false
  return (attributions as Attribution[]).some(
    (a) =>
      a != null &&
      a.utmCampaign !== undefined &&
      a.utmCampaign !== '' &&
      (a.utmCampaignId === undefined ||
        a.utmCampaignId === null ||
        a.utmCampaignId === ''),
  )
}

/**
 * CLI: run with pnpm exec tsx src/integrations/ghl/contacts-analyzer.ts
 * Loops through each line of temp-data/thrive.jsonld and parses it as JSON.
 * Logs all contacts that have at least one attribution with utmCampaign but no utmCampaignId.
 */
async function main() {
  const filePath = process.argv[2] ?? THRIVE_JSONLD_PATH

  console.log(`Reading ${filePath} (one JSON object per line)...\n`)

  const matches: { lineNumber: number; obj: ThriveJsonldContact }[] = []

  const { count, errors } = await readThriveJsonldByLine((obj, lineNumber) => {
    const attributions = obj.attributions as unknown
    if (hasUtmCampaignButNoUtmCampaignId(attributions)) {
      matches.push({ lineNumber, obj })
    }
  }, filePath)

  console.log(`Processed ${count} objects.`)
  if (errors.length > 0) {
    console.error(`Parse errors: ${errors.length}`, errors.slice(0, 5))
  }

  console.log(
    `\nContacts with attributions[].utmCampaign but no attributions[].utmCampaignId: ${matches.length}`,
  )
  for (const { lineNumber, obj } of matches) {
    console.log(
      JSON.stringify(
        {
          lineNumber,
          id: obj.id,
          contactName: obj.contactName,
          attributions: obj.attributions,
        },
        null,
        2,
      ),
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
