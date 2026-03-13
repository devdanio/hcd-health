import fs from 'node:fs'
import path from 'node:path'
import {
  getClientConfigOrThrow,
  type ClientConfig,
} from '../client-config'
import {
  buildRunId,
  confirmStep,
  ensureDir,
  findLatestDatedFile,
  runTsxScript,
} from './utils'

type PipelineStep = {
  scriptPath: string
  args: string[]
  summary: string
  using: string[]
}

function normalizeSourceSystem(sourceSystem: string): string {
  return sourceSystem
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function allowedExtensionsForEhr(sourceSystem: string): string[] {
  const normalized = normalizeSourceSystem(sourceSystem)
  if (normalized === 'chirotouch') return ['.xls', '.xlsx']
  if (normalized === 'unifiedpractice') return ['.csv']
  return ['.csv', '.xls', '.xlsx', '.json', '.jsonld']
}

async function main() {
  const args = process.argv.slice(2)
  let clientName: string | undefined
  let envFile = '.env.prod'
  let sourceSystemArg: string | undefined
  let ehrFileArg: string | undefined
  let fullRefresh = false
  let autoConfirm = false

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

    if (arg === '--ehr-file') {
      const next = args[i + 1]
      if (!next) {
        console.error('Missing value for --ehr-file')
        process.exit(1)
      }
      ehrFileArg = next
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

    if (arg.startsWith('--ehr-file=')) {
      ehrFileArg = arg.split('=').slice(1).join('=')
      continue
    }

    if (arg === '--full-refresh') {
      fullRefresh = true
      continue
    }

    if (arg === '--yes') {
      autoConfirm = true
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
  }

  if (!clientName) {
    console.error(
      'Usage: pnpm exec tsx pipeline/run-client.ts <clientName> [--full-refresh] [--source-system <name>] [--ehr-file <path>] [--env-file <path>] [--yes]',
    )
    process.exit(1)
  }

  let client: ClientConfig
  try {
    client = getClientConfigOrThrow(clientName)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  const sourceSystem = sourceSystemArg ?? client.EHR_SYSTEM
  const runId = buildRunId()
  const envFilePath = path.resolve(process.cwd(), envFile)
  if (!fs.existsSync(envFilePath)) {
    console.error(`Env file not found: ${envFilePath}`)
    process.exit(1)
  }

  const ghlRawDir = client.GHL_RAW_DIR
  const ehrNormalizedDir = client.EHR_NORMALIZED_DIR
  ensureDir(ghlRawDir)
  ensureDir(ehrNormalizedDir)

  const ghlRawOutputPath = path.resolve(ghlRawDir, `${runId}.contacts.jsonld`)
  const ehrNormalizedOutputPath = path.resolve(
    ehrNormalizedDir,
    `${runId}.patients.jsonld`,
  )

  const resolvedEhrFilePath = ehrFileArg
    ? path.resolve(process.cwd(), ehrFileArg)
    : (() => {
        const latest = findLatestDatedFile(
          client.EHR_RAW_DIR,
          allowedExtensionsForEhr(sourceSystem),
        )
        if (!latest) return null
        return latest.filePath
      })()

  if (!resolvedEhrFilePath || !fs.existsSync(resolvedEhrFilePath)) {
    console.error(`No EHR file found for client "${clientName}".`)
    console.error(`Expected directory: ${client.EHR_RAW_DIR}`)
    console.error('Expected filename date format: MM-DD-YYYY')
    process.exit(1)
  }

  const steps: PipelineStep[] = []

  if (fullRefresh) {
    steps.push({
      scriptPath: 'pipeline/reset-client-data.ts',
      args: [clientName, '--env-file', envFile],
      summary:
        'delete lead links, patient values, lead events, patients, and leads for this client before re-import.',
      using: [`env file: ${envFilePath}`],
    })
  }

  steps.push(
    {
      scriptPath: 'pipeline/fetch-all-contacts.ts',
      args: [clientName, ghlRawOutputPath, '--env-file', envFile],
      summary: 'fetch all GHL contacts and save them as JSONLD.',
      using: [ghlRawOutputPath],
    },
    {
      scriptPath: 'pipeline/contacts-to-db.ts',
      args: [clientName, ghlRawOutputPath, '--env-file', envFile],
      summary: 'insert fetched GHL contacts into leads and lead_events.',
      using: [ghlRawOutputPath, `env file: ${envFilePath}`],
    },
    {
      scriptPath: 'pipeline/ehr-preprocess.ts',
      args: [
        clientName,
        resolvedEhrFilePath,
        ehrNormalizedOutputPath,
        '--source-system',
        sourceSystem,
      ],
      summary:
        'run the EHR preprocessor dispatcher and route to the configured EHR-specific parser.',
      using: [resolvedEhrFilePath, ehrNormalizedOutputPath],
    },
    {
      scriptPath: 'pipeline/patients-to-db.ts',
      args: [
        clientName,
        ehrNormalizedOutputPath,
        '--source-system',
        sourceSystem,
        '--env-file',
        envFile,
      ],
      summary:
        'upsert patients into the database using deterministic external IDs for idempotency.',
      using: [ehrNormalizedOutputPath, `env file: ${envFilePath}`],
    },
    {
      scriptPath: 'pipeline/link-leads-to-patients.ts',
      args: [clientName, '--env-file', envFile],
      summary: 'link imported leads to imported patients.',
      using: [`env file: ${envFilePath}`],
    },
  )

  console.log(`Client: ${clientName}`)
  console.log(`Source system: ${sourceSystem}`)
  console.log(`Mode: ${fullRefresh ? 'full-refresh' : 'refresh'}`)
  console.log(`Run ID: ${runId}`)
  console.log(`Latest EHR file selected: ${resolvedEhrFilePath}`)
  console.log(`GHL output file: ${ghlRawOutputPath}`)
  console.log(`Normalized EHR output file: ${ehrNormalizedOutputPath}\n`)

  for (const step of steps) {
    const preview = [
      `I'm going to run ${step.scriptPath}.`,
      `It will ${step.summary}`,
      `Using: ${step.using.join(' | ')}`,
      `Command: pnpm exec tsx ${step.scriptPath} ${step.args.join(' ')}`,
    ].join('\n')

    await confirmStep(preview, autoConfirm)
    await runTsxScript([step.scriptPath, ...step.args])
    console.log('')
  }

  console.log('Pipeline completed successfully.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
