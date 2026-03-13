import { clients } from '../client-config'
import { runTsxScript } from './utils'

async function main() {
  const args = process.argv.slice(2)
  let envFile = '.env.prod'
  let sourceSystemArg: string | undefined
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

    if (arg.startsWith('--env-file=')) {
      envFile = arg.split('=').slice(1).join('=')
      continue
    }

    if (arg.startsWith('--source-system=')) {
      sourceSystemArg = arg.split('=').slice(1).join('=')
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
  }

  const clientNames = Object.keys(clients)
  if (clientNames.length === 0) {
    console.error('No clients found in client-config.ts.')
    process.exit(1)
  }

  console.log(
    `Running pipeline for ${clientNames.length} clients (${fullRefresh ? 'full-refresh' : 'refresh'} mode).\n`,
  )

  for (const clientName of clientNames) {
    const stepArgs = ['pipeline/run-client.ts', clientName]
    if (fullRefresh) stepArgs.push('--full-refresh')
    if (sourceSystemArg) stepArgs.push('--source-system', sourceSystemArg)
    stepArgs.push('--env-file', envFile)
    if (autoConfirm) stepArgs.push('--yes')

    console.log(`Starting client: ${clientName}`)
    await runTsxScript(stepArgs)
    console.log(`Finished client: ${clientName}\n`)
  }

  console.log('All clients completed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
