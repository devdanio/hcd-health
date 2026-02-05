import dayjs from 'dayjs'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/db'
import { sanitizePhone } from '@/utils/helpers'
import { ingestEventSchema } from '@/server/ri/ingestSchema'

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function parseOccurredAt(occurredAt: string | undefined): Date {
  if (!occurredAt) return dayjs().toDate()
  const dt = dayjs(occurredAt)
  if (!dt.isValid()) return dayjs().toDate()
  return dt.toDate()
}

export async function ingestEvent(opts: {
  organizationId: string
  payload: unknown
}): Promise<{ leadId: string; leadEventId: string }> {
  const parsed = ingestEventSchema.safeParse(opts.payload)
  if (!parsed.success) {
    throw new Error(parsed.error.message)
  }

  const organization = await prisma.organizations.findUnique({
    where: { id: opts.organizationId },
    select: { qualified_call_duration_threshold_sec: true },
  })
  if (!organization) throw new Error('Organization not found')

  const phone = sanitizePhone(parsed.data.phone)
  if (!phone) throw new Error('Invalid phone')

  const occurredAt = parseOccurredAt(parsed.data.occurred_at)

  const durationSec =
    parsed.data.event_type === 'call'
      ? parsed.data.call?.duration_sec ?? null
      : null

  const qualified =
    parsed.data.event_type === 'call'
      ? typeof durationSec === 'number' &&
        durationSec >= organization.qualified_call_duration_threshold_sec
      : true

  const attributionSnapshot = {
    platform: parsed.data.platform ?? null,
    campaign_id: parsed.data.campaign_id ?? null,
    gclid: parsed.data.gclid ?? null,
    utm_source: parsed.data.utm_source ?? null,
    utm_medium: parsed.data.utm_medium ?? null,
    utm_campaign: parsed.data.utm_campaign ?? null,
    utm_content: parsed.data.utm_content ?? null,
    utm_term: parsed.data.utm_term ?? null,
    referrer: parsed.data.referrer ?? null,
    landing_page: parsed.data.landing_page ?? null,
  } as const

  const existingLead = await prisma.leads.findUnique({
    where: {
      organization_id_phone: {
        organization_id: opts.organizationId,
        phone,
      },
    },
    select: { id: true, qualified: true, name: true, last_event_at: true },
  })

  const lead =
    existingLead ??
    (await prisma.leads.create({
      data: {
        organization_id: opts.organizationId,
        phone,
        name: parsed.data.name,
        qualified,
        first_event_at: occurredAt,
        last_event_at: occurredAt,
        ...attributionSnapshot,
      },
      select: { id: true, qualified: true, name: true, last_event_at: true },
    }))

  if (existingLead) {
    const nextLastEventAt =
      occurredAt > existingLead.last_event_at ? occurredAt : existingLead.last_event_at

    const nextQualified = existingLead.qualified || qualified
    const nextName = existingLead.name ?? parsed.data.name ?? undefined

    await prisma.leads.update({
      where: { id: existingLead.id },
      data: {
        last_event_at: nextLastEventAt,
        qualified: nextQualified,
        name: nextName,
      },
    })
  }

  const leadEvent = await prisma.lead_events.create({
    data: {
      organization_id: opts.organizationId,
      lead_id: lead.id,
      event_type: parsed.data.event_type,
      occurred_at: occurredAt,
      phone,
      name: parsed.data.name,
      duration_sec: durationSec,
      qualified,
      ...attributionSnapshot,
      raw_payload: toInputJsonValue(opts.payload),
    },
    select: { id: true },
  })

  if (parsed.data.campaign_id) {
    const platform = parsed.data.platform ?? 'unknown'
    await prisma.campaigns.upsert({
      where: {
        organization_id_platform_campaign_id: {
          organization_id: opts.organizationId,
          platform,
          campaign_id: parsed.data.campaign_id,
        },
      },
      create: {
        organization_id: opts.organizationId,
        platform,
        campaign_id: parsed.data.campaign_id,
        campaign_name: parsed.data.utm_campaign ?? null,
      },
      update: {
        campaign_name: parsed.data.utm_campaign ?? undefined,
      },
    })
  }

  return { leadId: lead.id, leadEventId: leadEvent.id }
}
