import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import {
  getClientConfigOrThrow,
  type ClientConfig,
} from '../client-config'

async function getPrisma() {
  const module = await import('../src/db')
  return module.prisma
}

async function main() {
  const args = process.argv.slice(2)
  let clientName: string | undefined
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
  }

  if (!clientName) {
    console.error(
      'Usage: pnpm exec tsx pipeline/reset-client-data.ts <clientName> [--env-file <path>]',
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

  const prisma = await getPrisma()
  const organizationId = client.HCD_ORG_ID

  console.log(`Client: ${clientName}`)
  console.log(`Organization: ${organizationId}`)
  console.log('Deleting lead links, values, events, patients, and leads...')

  const result = await prisma.$transaction(async (tx) => {
    const linkDeleted = await tx.lead_patient_links.deleteMany({
      where: { organization_id: organizationId },
    })
    const patientValuesDeleted = await tx.patient_values.deleteMany({
      where: { organization_id: organizationId },
    })
    const leadEventsDeleted = await tx.lead_events.deleteMany({
      where: { organization_id: organizationId },
    })
    const patientsDeleted = await tx.patients.deleteMany({
      where: { organization_id: organizationId },
    })
    const leadsDeleted = await tx.leads.deleteMany({
      where: { organization_id: organizationId },
    })

    return {
      linkDeleted: linkDeleted.count,
      patientValuesDeleted: patientValuesDeleted.count,
      leadEventsDeleted: leadEventsDeleted.count,
      patientsDeleted: patientsDeleted.count,
      leadsDeleted: leadsDeleted.count,
    }
  })

  console.log('Reset complete.')
  console.log(`lead_patient_links deleted: ${result.linkDeleted}`)
  console.log(`patient_values deleted: ${result.patientValuesDeleted}`)
  console.log(`lead_events deleted: ${result.leadEventsDeleted}`)
  console.log(`patients deleted: ${result.patientsDeleted}`)
  console.log(`leads deleted: ${result.leadsDeleted}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
