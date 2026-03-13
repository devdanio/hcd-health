import path from 'node:path'
import fs from 'node:fs'
import dotenv from 'dotenv'
import {
  getClientConfigOrThrow,
  type ClientConfig,
} from '../../../client-config'
import { sanitizeEmail, sanitizePhone } from '../../utils/helpers'
import type { Prisma } from '../../generated/prisma/client'

const BATCH_SIZE = 500
const TX_TIMEOUT_MS = 120_000

type PatientRow = {
  id: string
  phone: string | null
  email: string | null
  created_at_source: Date | null
}

type LeadRow = {
  id: string
  phone: string | null
  email: string | null
}

type LinkStats = {
  matchedByPhone: number
  matchedByEmail: number
  unmatched: number
  multipleLeadMatches: number
  multiplePatientMatches: number
  conflictingMatches: number
}

async function getPrisma() {
  const module = await import('../../db')
  return module.prisma
}

async function linkBatch(
  tx: Prisma.TransactionClient,
  organizationId: string,
  patients: PatientRow[],
  leadsByPhone: Map<string, LeadRow>,
  leadsByEmail: Map<string, LeadRow>,
  stats: LinkStats,
  linksByLeadId: Map<string, Set<string>>,
  linksByPatientId: Map<string, Set<string>>,
) {
  const bestByLeadId = new Map<string, { patient: PatientRow; link_reason: string }>()
  const leadById = new Map<string, LeadRow>()
  for (const lead of leadsByPhone.values()) {
    leadById.set(lead.id, lead)
  }
  for (const lead of leadsByEmail.values()) {
    leadById.set(lead.id, lead)
  }

  for (const patient of patients) {
    const normalizedPhone = sanitizePhone(patient.phone)
    const normalizedEmail = sanitizeEmail(patient.email)
    const leadByPhone = normalizedPhone
      ? leadsByPhone.get(normalizedPhone)
      : undefined
    const leadByEmail = normalizedEmail
      ? leadsByEmail.get(normalizedEmail)
      : undefined

    if (leadByPhone && leadByEmail && leadByPhone.id !== leadByEmail.id) {
      stats.conflictingMatches += 1
      console.warn(
        `[link] conflicting match for patient=${patient.id} phone=${normalizedPhone ?? 'n/a'} email=${normalizedEmail ?? 'n/a'} leadByPhone=${leadByPhone.id} leadByEmail=${leadByEmail.id}`,
      )
    }

    const lead = leadByPhone ?? leadByEmail

    if (!lead) {
      stats.unmatched++
      continue
    }

    const linkReason = leadByPhone ? 'phone' : 'email'
    const existing = bestByLeadId.get(lead.id)
    if (!existing) {
      bestByLeadId.set(lead.id, { patient, link_reason: linkReason })
      continue
    }

    const existingDate = existing.patient.created_at_source
    const candidateDate = patient.created_at_source
    if (!existingDate && !candidateDate) {
      continue
    }
    if (!existingDate && candidateDate) {
      bestByLeadId.set(lead.id, { patient, link_reason: linkReason })
      continue
    }
    if (existingDate && candidateDate && candidateDate < existingDate) {
      bestByLeadId.set(lead.id, { patient, link_reason: linkReason })
    }
  }

  for (const [leadId, best] of bestByLeadId.entries()) {
    const patient = best.patient
    const lead = leadById.get(leadId)

    if (!lead) continue

    if (best.link_reason === 'phone') {
      stats.matchedByPhone++
    } else {
      stats.matchedByEmail++
    }

    const existingLeadLinks = linksByLeadId.get(lead.id)
    const existingPatientLinks = linksByPatientId.get(patient.id)

    await tx.lead_patient_links.upsert({
      where: {
        organization_id_lead_id_patient_id: {
          organization_id: organizationId,
          lead_id: lead.id,
          patient_id: patient.id,
        },
      },
      create: {
        organization_id: organizationId,
        lead_id: lead.id,
        patient_id: patient.id,
        link_reason: best.link_reason,
      },
      update: {
        link_reason: best.link_reason,
      },
    })

    const candidates = patients.filter((p) => {
      const phoneMatch =
        patient.phone &&
        p.phone &&
        sanitizePhone(p.phone) === sanitizePhone(patient.phone)
      const emailMatch =
        patient.email &&
        p.email &&
        sanitizeEmail(p.email) === sanitizeEmail(patient.email)
      return phoneMatch || emailMatch
    })

    if (candidates.length > 1) {
      stats.multiplePatientMatches += 1
      console.warn(
        `[link] lead ${lead.id} matched ${candidates.length} patients; linked earliest patient ${patient.id}`,
      )
    }

    if (!existingLeadLinks) {
      linksByLeadId.set(lead.id, new Set([patient.id]))
    } else {
      existingLeadLinks.add(patient.id)
    }

    if (!existingPatientLinks) {
      linksByPatientId.set(patient.id, new Set([lead.id]))
    } else {
      existingPatientLinks.add(lead.id)
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  let clientName: string | undefined
  let envFile = '.env.prod'

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--env-file') {
      const next = args[i + 1]
      if (!next) {
        console.error('Missing value for --env-file')
        process.exit(1)
      }
      envFile = next
      i++
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
      'Usage: pnpm exec tsx src/integrations/patients/link-leads-to-patients.ts <clientName> [--env-file <path>]',
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

  const organizationId = client.HCD_ORG_ID

  console.log(`Env file: ${resolvedEnvFile}`)
  console.log(`Client: ${clientName}`)
  console.log(`Organization: ${organizationId}\n`)

  const prisma = await getPrisma()

  // Load all leads for the org
  console.log('Loading leads...')
  const leads = await prisma.leads.findMany({
    where: { organization_id: organizationId },
    select: {
      id: true,
      phone: true,
      email: true,
    },
  })
  console.log(`  Found ${leads.length} leads`)

  // Build lead lookup maps (normalized phone keys)
  const leadsByPhone = new Map<string, LeadRow>()
  const leadsByEmail = new Map<string, LeadRow>()

  for (const lead of leads) {
    const normalizedPhone = sanitizePhone(lead.phone)
    if (normalizedPhone) leadsByPhone.set(normalizedPhone, lead)
    const normalizedEmail = sanitizeEmail(lead.email)
    if (normalizedEmail) leadsByEmail.set(normalizedEmail, lead)
  }

  console.log(`  Leads with phone: ${leadsByPhone.size}`)
  console.log(`  Leads with email: ${leadsByEmail.size}\n`)

  // Load all patients for the org
  console.log('Loading patients...')
  const patients = await prisma.patients.findMany({
    where: { organization_id: organizationId },
    select: {
      id: true,
      phone: true,
      email: true,
      created_at_source: true,
    },
  })
  console.log(`  Found ${patients.length} patients\n`)

  // Check existing links
  const existingLinks = await prisma.lead_patient_links.findMany({
    where: { organization_id: organizationId },
    select: { lead_id: true, patient_id: true },
  })
  const existingLinkCount = existingLinks.length
  console.log(`Existing links before run: ${existingLinkCount}\n`)

  const stats: LinkStats = {
    matchedByPhone: 0,
    matchedByEmail: 0,
    unmatched: 0,
    multipleLeadMatches: 0,
    multiplePatientMatches: 0,
    conflictingMatches: 0,
  }

  const linksByLeadId = new Map<string, Set<string>>()
  const linksByPatientId = new Map<string, Set<string>>()
  for (const link of existingLinks) {
    const leadSet = linksByLeadId.get(link.lead_id) ?? new Set<string>()
    leadSet.add(link.patient_id)
    linksByLeadId.set(link.lead_id, leadSet)

    const patientSet = linksByPatientId.get(link.patient_id) ?? new Set<string>()
    patientSet.add(link.lead_id)
    linksByPatientId.set(link.patient_id, patientSet)
  }

  for (const [leadId, patientIds] of linksByLeadId.entries()) {
    if (patientIds.size > 1) {
      stats.multiplePatientMatches += 1
      console.warn(
        `[link] lead already linked to multiple patients lead=${leadId} patients=${Array.from(patientIds).join(',')}`,
      )
    }
  }

  for (const [patientId, leadIds] of linksByPatientId.entries()) {
    if (leadIds.size > 1) {
      stats.multipleLeadMatches += 1
      console.warn(
        `[link] patient already linked to multiple leads patient=${patientId} leads=${Array.from(leadIds).join(',')}`,
      )
    }
  }

  // Process in batches
  const totalBatches = Math.ceil(patients.length / BATCH_SIZE)
  console.log(
    `Processing ${patients.length} patients in ${totalBatches} batches of ${BATCH_SIZE}...\n`,
  )

  for (let i = 0; i < patients.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const batch = patients.slice(i, i + BATCH_SIZE)
    const batchStart = Date.now()

    await prisma.$transaction(
      async (tx) => {
        await linkBatch(
          tx,
          organizationId,
          batch,
          leadsByPhone,
          leadsByEmail,
          stats,
          linksByLeadId,
          linksByPatientId,
        )
      },
      { timeout: TX_TIMEOUT_MS, maxWait: TX_TIMEOUT_MS },
    )

    const elapsed = Date.now() - batchStart
    console.log(
      `[batch ${batchNum}/${totalBatches}] size=${batch.length} ms=${elapsed}`,
    )
  }

  // Final link count
  const finalLinkCount = await prisma.lead_patient_links.count({
    where: { organization_id: organizationId },
  })

  console.log('\n--- Summary ---')
  console.log(`Total patients: ${patients.length}`)
  console.log(`Total leads: ${leads.length}`)
  console.log(`Matched by phone: ${stats.matchedByPhone}`)
  console.log(`Matched by email: ${stats.matchedByEmail}`)
  console.log(`Unmatched: ${stats.unmatched}`)
  console.log(`Conflicting matches (phone vs email): ${stats.conflictingMatches}`)
  console.log(`Leads linked to multiple patients: ${stats.multiplePatientMatches}`)
  console.log(`Patients linked to multiple leads: ${stats.multipleLeadMatches}`)
  console.log(`---`)
  console.log(`Links before: ${existingLinkCount}`)
  console.log(`Links after: ${finalLinkCount}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
