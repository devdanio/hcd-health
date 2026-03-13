import { runTsxScript } from './utils'

type CommandDefinition = {
  description: string
  scriptPath: string
}

const commands: Record<string, CommandDefinition> = {
  'fetch-contacts': {
    description: 'Download all GHL contacts for a client.',
    scriptPath: 'pipeline/fetch-all-contacts.ts',
  },
  'contacts-to-db': {
    description: 'Insert GHL contacts JSONLD into leads + lead_events.',
    scriptPath: 'pipeline/contacts-to-db.ts',
  },
  'ehr-preprocess': {
    description: 'Normalize raw EHR export into canonical patients JSONLD.',
    scriptPath: 'pipeline/ehr-preprocess.ts',
  },
  'preprocess-ehr': {
    description: 'Alias for ehr-preprocess.',
    scriptPath: 'pipeline/preprocess-ehr.ts',
  },
  'patients-to-db': {
    description: 'Insert normalized patient JSONLD into patients table.',
    scriptPath: 'pipeline/patients-to-db.ts',
  },
  'link-patients': {
    description: 'Link leads to patients for a client.',
    scriptPath: 'pipeline/link-leads-to-patients.ts',
  },
  'reset-client': {
    description: 'Delete client lead/patient/link data before refresh.',
    scriptPath: 'pipeline/reset-client-data.ts',
  },
  'run-client': {
    description: 'Run the full pipeline for one client.',
    scriptPath: 'pipeline/run-client.ts',
  },
  'run-all': {
    description: 'Run the full pipeline for all configured clients.',
    scriptPath: 'pipeline/run-all-clients.ts',
  },
}

function printHelp(): void {
  console.log('Usage:')
  console.log('  pnpm run pipeline -- <command> [...args]\n')
  console.log('Commands:')
  for (const [command, definition] of Object.entries(commands)) {
    console.log(`  ${command.padEnd(16)} ${definition.description}`)
  }
  console.log('\nExamples:')
  console.log('  pnpm run pipeline -- fetch-contacts paom --env-file .env')
  console.log('  pnpm run pipeline -- ehr-preprocess paom')
  console.log('  pnpm run pipeline -- patients-to-db paom --env-file .env')
  console.log('  pnpm run pipeline -- link-patients paom --env-file .env')
  console.log('  pnpm run pipeline -- run-client paom --env-file .env')
  console.log('  pnpm run pipeline -- run-all --env-file .env')
}

async function main() {
  const filteredArgs = process.argv.slice(2).filter((arg) => arg !== '--')
  const [command, ...commandArgs] = filteredArgs

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    process.exit(0)
  }

  const definition = commands[command]
  if (!definition) {
    console.error(`Unknown pipeline command: ${command}\n`)
    printHelp()
    process.exit(1)
  }

  await runTsxScript([definition.scriptPath, ...commandArgs])
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
