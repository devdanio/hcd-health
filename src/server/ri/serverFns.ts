import { createServerFn } from '@tanstack/react-start'
import dayjs from 'dayjs'
import { z } from 'zod'

import { requireActiveOrganizationFromAuth } from '@/server/ri/orgContext'
import { toIsoString } from '@/server/ri/serializers'
import { sanitizeEmail, sanitizePhone } from '@/utils/helpers'

function normalizeOptionalString(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function campaignKey(
  platform: string | null | undefined,
  campaignId: string | null | undefined,
): string {
  const platformValue = platform ?? 'unknown'
  const campaignValue = campaignId ?? 'unknown'
  return `${platformValue}::${campaignValue}`
}

function parseCampaignKey(key: string): {
  platform: string | null
  campaign_id: string | null
} {
  const separator = '::'
  const splitIndex = key.indexOf(separator)
  if (splitIndex === -1) {
    return { platform: null, campaign_id: null }
  }
  const platformValue = key.slice(0, splitIndex)
  const campaignValue = key.slice(splitIndex + separator.length)
  return {
    platform: platformValue === 'unknown' ? null : platformValue,
    campaign_id: campaignValue === 'unknown' ? null : campaignValue,
  }
}

type LeadPatientLinkBase = {
  link_reason: string
  patient: { created_at_source: Date | null }
}

function pickConvertedPatientLink<T extends LeadPatientLinkBase>(
  links: T[],
  firstEventAt: Date | null,
): T | null {
  const manualLink = links.find((link) => link.link_reason === 'manual')
  if (manualLink) return manualLink

  if (!firstEventAt) return null
  const candidates = links
    .filter(
      (link) =>
        link.patient.created_at_source &&
        dayjs(firstEventAt).isBefore(link.patient.created_at_source),
    )
    .sort((a, b) => {
      const aTime = a.patient.created_at_source?.getTime() ?? 0
      const bTime = b.patient.created_at_source?.getTime() ?? 0
      return aTime - bTime
    })

  return candidates[0] ?? null
}

async function requireOrganizationId(): Promise<string> {
  const { organizationId } = await requireActiveOrganizationFromAuth()
  return organizationId
}

export const getOrg = createServerFn({ method: 'GET' }).handler(async () => {
  const organizationId = await requireOrganizationId()
  const { prisma } = await import('@/db')
  const org = await prisma.organizations.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      qualified_call_duration_threshold_sec: true,
      default_revenue_model: true,
      google_ads_customer_id: true,
      facebook_ads_account_id: true,
    },
  })
  return org
})

export const updateOrg = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      name: z.string().min(1).optional(),
      qualified_call_duration_threshold_sec: z.number().int().min(0).optional(),
      google_ads_customer_id: z.string().min(1).optional().nullable(),
      facebook_ads_account_id: z.string().min(1).optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const updated = await prisma.organizations.update({
      where: { id: organizationId },
      data: {
        name: input.name,
        qualified_call_duration_threshold_sec:
          input.qualified_call_duration_threshold_sec,
        google_ads_customer_id:
          input.google_ads_customer_id === null
            ? null
            : (input.google_ads_customer_id ?? undefined),
        facebook_ads_account_id:
          input.facebook_ads_account_id === null
            ? null
            : (input.facebook_ads_account_id ?? undefined),
      },
      select: {
        id: true,
        name: true,
        qualified_call_duration_threshold_sec: true,
        default_revenue_model: true,
        google_ads_customer_id: true,
        facebook_ads_account_id: true,
      },
    })
    return updated
  })

const googleAdsCredentialsInput = z.object({
  customer_id: z.string().optional(),
  mcc_id: z.string().optional(),
  developer_token: z.string().optional(),
  refresh_token: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
})

export const getGoogleAdsCredentialsStatus = createServerFn({
  method: 'GET',
}).handler(async () => {
  const organizationId = await requireOrganizationId()
  const { prisma } = await import('@/db')
  const record = await prisma.organization_credentials.findUnique({
    where: {
      organization_id_provider: {
        organization_id: organizationId,
        provider: 'google_ads',
      },
    },
    select: { id: true, updated_at: true },
  })

  return {
    has_credentials: !!record,
    updated_at: record ? toIsoString(record.updated_at) : null,
  }
})

export const saveGoogleAdsCredentials = createServerFn({ method: 'POST' })
  .inputValidator(googleAdsCredentialsInput)
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const { encryptToken } = await import('@/server/lib/encryption')

    const payload = {
      customer_id: normalizeOptionalString(input.customer_id),
      mcc_id: normalizeOptionalString(input.mcc_id),
      developer_token: normalizeOptionalString(input.developer_token),
      refresh_token: normalizeOptionalString(input.refresh_token),
      client_id: normalizeOptionalString(input.client_id),
      client_secret: normalizeOptionalString(input.client_secret),
    }

    const hasValues = Object.values(payload).some((value) => value)

    if (!hasValues) {
      await prisma.organization_credentials.deleteMany({
        where: { organization_id: organizationId, provider: 'google_ads' },
      })
      return { ok: true, cleared: true as const }
    }

    const encryptedPayload = await encryptToken(JSON.stringify(payload))

    await prisma.organization_credentials.upsert({
      where: {
        organization_id_provider: {
          organization_id: organizationId,
          provider: 'google_ads',
        },
      },
      create: {
        organization_id: organizationId,
        provider: 'google_ads',
        encrypted_payload: encryptedPayload,
      },
      update: {
        encrypted_payload: encryptedPayload,
      },
    })

    if (payload.customer_id) {
      await prisma.organizations.update({
        where: { id: organizationId },
        data: { google_ads_customer_id: payload.customer_id },
      })
    }

    return { ok: true, cleared: false as const }
  })

const orgSettingsInput = z.object({
  primary_contact_email: z.string().optional(),
  timezone: z.string().optional(),
  account_ids: z.string().optional(),
  webhook_url: z.string().optional(),
  data_sync_start_date: z.string().optional(),
  allowed_ips: z.string().optional(),
  notes: z.string().optional(),
  facebook_business_id: z.string().optional(),
  facebook_ad_account_ids: z.array(z.string().min(1)).optional(),
})

export const getOrgSettings = createServerFn({ method: 'GET' }).handler(
  async () => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const record = await prisma.organization_settings.findUnique({
      where: { organization_id: organizationId },
      select: { config_json: true, updated_at: true },
    })

    const config = (record?.config_json ?? {}) as Record<string, unknown>

    return {
      config: {
        primary_contact_email:
          typeof config.primary_contact_email === 'string'
            ? config.primary_contact_email
            : '',
        timezone: typeof config.timezone === 'string' ? config.timezone : '',
        account_ids:
          typeof config.account_ids === 'string' ? config.account_ids : '',
        webhook_url:
          typeof config.webhook_url === 'string' ? config.webhook_url : '',
        data_sync_start_date:
          typeof config.data_sync_start_date === 'string'
            ? config.data_sync_start_date
            : '',
        allowed_ips:
          typeof config.allowed_ips === 'string' ? config.allowed_ips : '',
        notes: typeof config.notes === 'string' ? config.notes : '',
        facebook_business_id:
          typeof config.facebook_business_id === 'string'
            ? config.facebook_business_id
            : '',
        facebook_ad_account_ids: Array.isArray(config.facebook_ad_account_ids)
          ? config.facebook_ad_account_ids.filter(
              (id): id is string => typeof id === 'string',
            )
          : typeof config.facebook_ad_account_ids === 'string'
            ? config.facebook_ad_account_ids
                .split(',')
                .map((id) => id.trim())
                .filter((id) => id.length > 0)
            : [],
      },
      updated_at: record ? toIsoString(record.updated_at) : null,
    }
  },
)

export const updateOrgSettings = createServerFn({ method: 'POST' })
  .inputValidator(orgSettingsInput)
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')

    const existing = await prisma.organization_settings.findUnique({
      where: { organization_id: organizationId },
      select: { config_json: true },
    })
    const previous = (existing?.config_json ?? {}) as Record<string, unknown>

    const priorFacebookAccounts = Array.isArray(
      previous.facebook_ad_account_ids,
    )
      ? previous.facebook_ad_account_ids.filter(
          (id): id is string => typeof id === 'string',
        )
      : typeof previous.facebook_ad_account_ids === 'string'
        ? previous.facebook_ad_account_ids
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id.length > 0)
        : []

    const resolveString = (
      nextValue: string | undefined,
      priorValue: unknown,
    ): string => {
      if (typeof nextValue !== 'undefined') {
        return normalizeOptionalString(nextValue) ?? ''
      }
      return typeof priorValue === 'string' ? priorValue : ''
    }

    const config = {
      primary_contact_email: resolveString(
        input.primary_contact_email,
        previous.primary_contact_email,
      ),
      timezone: resolveString(input.timezone, previous.timezone),
      account_ids: resolveString(input.account_ids, previous.account_ids),
      webhook_url: resolveString(input.webhook_url, previous.webhook_url),
      data_sync_start_date: resolveString(
        input.data_sync_start_date,
        previous.data_sync_start_date,
      ),
      allowed_ips: resolveString(input.allowed_ips, previous.allowed_ips),
      notes: resolveString(input.notes, previous.notes),
      facebook_business_id: resolveString(
        input.facebook_business_id,
        previous.facebook_business_id,
      ),
      facebook_ad_account_ids: Array.isArray(input.facebook_ad_account_ids)
        ? input.facebook_ad_account_ids
        : priorFacebookAccounts,
    } as const

    const updated = await prisma.organization_settings.upsert({
      where: { organization_id: organizationId },
      create: { organization_id: organizationId, config_json: config },
      update: { config_json: config },
      select: { updated_at: true },
    })

    return { ok: true, updated_at: toIsoString(updated.updated_at) }
  })

export const getActiveApiKey = createServerFn({ method: 'GET' }).handler(
  async () => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const active = await prisma.organization_api_keys.findFirst({
      where: { organization_id: organizationId, revoked_at: null },
      orderBy: { created_at: 'desc' },
      select: { id: true, key_prefix: true, label: true, created_at: true },
    })

    if (!active) return null
    return {
      id: active.id,
      key_prefix: active.key_prefix,
      label: active.label,
      created_at: toIsoString(active.created_at),
    }
  },
)

export const rotateApiKey = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      label: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const { generateApiKey, hashApiKey } = await import('@/server/ri/apiKeys')

    await prisma.organization_api_keys.updateMany({
      where: { organization_id: organizationId, revoked_at: null },
      data: { revoked_at: new Date() },
    })

    const { apiKey, keyPrefix } = generateApiKey()
    const keyHash = hashApiKey(apiKey)

    const created = await prisma.organization_api_keys.create({
      data: {
        organization_id: organizationId,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        label: input.label,
      },
      select: { id: true, key_prefix: true, created_at: true },
    })

    return {
      id: created.id,
      key_prefix: created.key_prefix,
      created_at: toIsoString(created.created_at),
      api_key: apiKey,
    }
  })

export const listLocations = createServerFn({ method: 'GET' }).handler(
  async () => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const locations = await prisma.locations.findMany({
      where: { organization_id: organizationId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    return locations
  },
)

export const createLocation = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      name: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const location = await prisma.locations.create({
      data: { organization_id: organizationId, name: input.name },
      select: { id: true, name: true },
    })
    return location
  })

export const listApiKeys = createServerFn({ method: 'GET' }).handler(
  async () => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const keys = await prisma.organization_api_keys.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        key_prefix: true,
        label: true,
        last_used_at: true,
        revoked_at: true,
        created_at: true,
      },
    })

    return keys.map((k) => ({
      ...k,
      last_used_at: k.last_used_at ? toIsoString(k.last_used_at) : null,
      revoked_at: k.revoked_at ? toIsoString(k.revoked_at) : null,
      created_at: toIsoString(k.created_at),
    }))
  },
)

export const generateNewApiKey = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      label: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const { generateApiKey, hashApiKey } = await import('@/server/ri/apiKeys')
    const { apiKey, keyPrefix } = generateApiKey()
    const keyHash = hashApiKey(apiKey)

    await prisma.organization_api_keys.updateMany({
      where: { organization_id: organizationId, revoked_at: null },
      data: { revoked_at: new Date() },
    })

    const created = await prisma.organization_api_keys.create({
      data: {
        organization_id: organizationId,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        label: input.label,
      },
      select: { id: true, key_prefix: true, created_at: true },
    })

    return {
      id: created.id,
      key_prefix: created.key_prefix,
      created_at: toIsoString(created.created_at),
      api_key: apiKey,
    }
  })

export const revokeApiKey = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    await prisma.organization_api_keys.updateMany({
      where: { id: input.id, organization_id: organizationId },
      data: { revoked_at: new Date() },
    })
    return { ok: true }
  })

const leadsListInput = z.object({
  status: z.enum(['lead', 'patient']).optional(),
  qualified_only: z.boolean().optional(),
  campaign_id: z.string().min(1).optional(),
  platform: z.string().min(1).optional(),
  location_id: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(5000).default(50),
})

const linkListInput = z.object({
  q: z.string().min(1).optional(),
})

export const listLeads = createServerFn({ method: 'POST' })
  .inputValidator(leadsListInput)
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')

    const campaignPairsForLocation = input.location_id
      ? await prisma.campaign_settings
          .findMany({
            where: {
              organization_id: organizationId,
              location_id: input.location_id,
            },
            select: { campaign_id: true, platform: true },
          })
          .then((rows) =>
            rows.map((r) => ({
              campaign_id: r.campaign_id,
              platform: r.platform,
            })),
          )
      : []

    const where = {
      organization_id: organizationId,
      ...(input.qualified_only ? { qualified: true } : {}),
      ...(input.q
        ? {
            OR: [
              { phone: { contains: input.q } },
              { name: { contains: input.q, mode: 'insensitive' as const } },
              { email: { contains: input.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    } as const

    const leads = await prisma.leads.findMany({
      where,
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        qualified: true,
        created_at: true,
        patient_values: {
          select: { ltv_cents: true, cash_collected_to_date_cents: true },
        },
        lead_patient_links: {
          select: {
            link_reason: true,
            patient: {
              select: { id: true, name: true, created_at_source: true },
            },
          },
        },
      },
    })

    if (leads.length === 0) return []

    const leadIds = leads.map((lead) => lead.id)
    const [firstEvents, lastEvents] = await Promise.all([
      prisma.lead_events.findMany({
        where: { organization_id: organizationId, lead_id: { in: leadIds } },
        orderBy: { occurred_at: 'asc' },
        distinct: ['lead_id'],
        select: {
          lead_id: true,
          occurred_at: true,
          campaign_id: true,
          utm_campaign: true,
          platform: true,
          gclid: true,
          utm_source: true,
          utm_medium: true,
          utm_content: true,
          utm_term: true,
          referrer: true,
          landing_page: true,
        },
      }),
      prisma.lead_events.findMany({
        where: { organization_id: organizationId, lead_id: { in: leadIds } },
        orderBy: { occurred_at: 'desc' },
        distinct: ['lead_id'],
        select: {
          lead_id: true,
          occurred_at: true,
        },
      }),
    ])

    const firstByLeadId = new Map(firstEvents.map((e) => [e.lead_id, e]))
    const lastByLeadId = new Map(lastEvents.map((e) => [e.lead_id, e]))

    const filtered = leads
      .map((lead) => {
        const firstEvent = firstByLeadId.get(lead.id) ?? null
        const lastEvent = lastByLeadId.get(lead.id) ?? null
        const firstEventAt = firstEvent?.occurred_at ?? lead.created_at
        const lastEventAt = lastEvent?.occurred_at ?? firstEventAt
        const link = pickConvertedPatientLink(
          lead.lead_patient_links,
          firstEvent?.occurred_at ?? null,
        )

        return {
          id: lead.id,
          phone: lead.phone,
          email: lead.email,
          name: lead.name,
          qualified: lead.qualified,
          first_event_at: toIsoString(firstEventAt),
          last_event_at: toIsoString(lastEventAt),
          campaign_id: firstEvent?.campaign_id ?? null,
          campaign_name: firstEvent?.utm_campaign ?? null,
          platform: firstEvent?.platform ?? null,
          revenue_cents: lead.patient_values?.ltv_cents ?? 0,
          cash_collected_to_date_cents:
            lead.patient_values?.cash_collected_to_date_cents ?? 0,
          is_patient: Boolean(link),
          linked_patient: link
            ? {
                id: link.patient.id,
                name: link.patient.name,
                created_at_source: link.patient.created_at_source
                  ? toIsoString(link.patient.created_at_source)
                  : null,
                link_reason: link.link_reason,
              }
            : null,
        }
      })
      .filter((lead) => {
        if (input.status === 'patient' && !lead.is_patient) return false
        if (input.status === 'lead' && lead.is_patient) return false
        if (input.campaign_id && lead.campaign_id !== input.campaign_id)
          return false
        if (input.platform && lead.platform !== input.platform) return false
        if (campaignPairsForLocation.length > 0) {
          const match = campaignPairsForLocation.some(
            (pair) =>
              pair.campaign_id === lead.campaign_id &&
              pair.platform === lead.platform,
          )
          if (!match) return false
        }
        if (input.from || input.to) {
          const firstEventAt = dayjs(lead.first_event_at)
          if (input.from && firstEventAt.isBefore(dayjs(input.from)))
            return false
          if (input.to && firstEventAt.isAfter(dayjs(input.to))) return false
        }
        return true
      })
      .sort(
        (a, b) =>
          dayjs(b.last_event_at).valueOf() - dayjs(a.last_event_at).valueOf(),
      )
      .slice(0, input.limit)

    return filtered
  })

export const listPatientsForLinking = createServerFn({ method: 'POST' })
  .inputValidator(linkListInput)
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')

    const patients = await prisma.patients.findMany({
      where: {
        organization_id: organizationId,
        ...(input.q
          ? {
              OR: [
                { phone: { contains: input.q } },
                { name: { contains: input.q, mode: 'insensitive' as const } },
                {
                  email: { contains: input.q, mode: 'insensitive' as const },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ created_at_source: 'desc' }, { created_at: 'desc' }],
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        created_at_source: true,
        _count: {
          select: {
            lead_patient_links: true,
          },
        },
      },
    })

    return patients.map((patient) => ({
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
      email: patient.email,
      created_at_source: patient.created_at_source
        ? toIsoString(patient.created_at_source)
        : null,
      linked_lead_count: patient._count.lead_patient_links,
    }))
  })

export const listLeadsForLinking = createServerFn({ method: 'POST' })
  .inputValidator(linkListInput)
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')

    const leads = await prisma.leads.findMany({
      where: {
        organization_id: organizationId,
        ...(input.q
          ? {
              OR: [
                { phone: { contains: input.q } },
                { name: { contains: input.q, mode: 'insensitive' as const } },
                {
                  email: { contains: input.q, mode: 'insensitive' as const },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updated_at: 'desc' }],
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        qualified: true,
        created_at: true,
        lead_patient_links: {
          orderBy: { linked_at: 'desc' },
          select: {
            link_reason: true,
            linked_at: true,
            patient: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                created_at_source: true,
              },
            },
          },
        },
      },
    })

    return leads.map((lead) => {
      const manualLink = lead.lead_patient_links.find(
        (link) => link.link_reason === 'manual',
      )
      const linked = manualLink ?? lead.lead_patient_links[0] ?? null

      return {
        id: lead.id,
        phone: lead.phone,
        email: lead.email,
        name: lead.name,
        qualified: lead.qualified,
        created_at: toIsoString(lead.created_at),
        linked_patient: linked
          ? {
              id: linked.patient.id,
              name: linked.patient.name,
              phone: linked.patient.phone,
              email: linked.patient.email,
              created_at_source: linked.patient.created_at_source
                ? toIsoString(linked.patient.created_at_source)
                : null,
              link_reason: linked.link_reason,
              linked_at: toIsoString(linked.linked_at),
            }
          : null,
      }
    })
  })

export const upsertManualLeadPatientLink = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      lead_id: z.string().min(1),
      patient_id: z.string().min(1).nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')

    await prisma.leads.findFirstOrThrow({
      where: { id: input.lead_id, organization_id: organizationId },
      select: { id: true },
    })

    if (input.patient_id) {
      await prisma.patients.findFirstOrThrow({
        where: { id: input.patient_id, organization_id: organizationId },
        select: { id: true },
      })
    }

    const link = await prisma.$transaction(async (tx) => {
      await tx.lead_patient_links.deleteMany({
        where: {
          organization_id: organizationId,
          lead_id: input.lead_id,
        },
      })

      if (!input.patient_id) return null

      return tx.lead_patient_links.create({
        data: {
          organization_id: organizationId,
          lead_id: input.lead_id,
          patient_id: input.patient_id,
          link_reason: 'manual',
        },
        select: {
          link_reason: true,
          linked_at: true,
          patient: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              created_at_source: true,
            },
          },
        },
      })
    })

    return {
      lead_id: input.lead_id,
      linked_patient: link
        ? {
            id: link.patient.id,
            name: link.patient.name,
            phone: link.patient.phone,
            email: link.patient.email,
            created_at_source: link.patient.created_at_source
              ? toIsoString(link.patient.created_at_source)
              : null,
            link_reason: link.link_reason,
            linked_at: toIsoString(link.linked_at),
          }
        : null,
    }
  })

export const createLead = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      name: z.string().optional(),
      phone: z.string().min(1),
      email: z.string().optional(),
      campaign_id: z.string().min(1),
      platform: z.string().min(1),
      campaign_name: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const now = dayjs().toDate()
    const trimmedEmail = sanitizeEmail(input.email)
    const normalizedPhone = sanitizePhone(input.phone)
    if (!normalizedPhone) {
      throw new Error('Invalid phone (must be E.164)')
    }

    const existingByPhone = await prisma.leads.findUnique({
      where: {
        organization_id_phone: {
          organization_id: organizationId,
          phone: normalizedPhone,
        },
      },
      select: { id: true, phone: true, email: true, name: true },
    })

    const existingByEmail = trimmedEmail
      ? await prisma.leads.findUnique({
          where: {
            organization_id_email: {
              organization_id: organizationId,
              email: trimmedEmail,
            },
          },
          select: { id: true, phone: true, email: true, name: true },
        })
      : null

    const existing = existingByPhone ?? existingByEmail

    const lead = existing
      ? await prisma.leads.update({
          where: { id: existing.id },
          data: {
            name: existing.name ?? input.name?.trim() ?? undefined,
            phone: existing.phone ?? normalizedPhone,
            email: existing.email ?? trimmedEmail ?? undefined,
          },
          select: { id: true },
        })
      : await prisma.leads.create({
          data: {
            organization_id: organizationId,
            phone: normalizedPhone,
            name: input.name?.trim() || null,
            email: trimmedEmail ?? null,
            qualified: false,
            raw_payload: {
              source: 'manual',
              payload: {
                name: input.name?.trim() || null,
                phone: normalizedPhone,
                email: trimmedEmail ?? null,
                campaign_id: input.campaign_id,
                platform: input.platform,
                campaign_name: input.campaign_name ?? null,
                created_at: now.toISOString(),
              },
            },
          },
          select: { id: true },
        })

    await prisma.lead_events.create({
      data: {
        organization_id: organizationId,
        lead_id: lead.id,
        event_type: 'import',
        occurred_at: now,
        phone: normalizedPhone,
        name: input.name?.trim() || null,
        platform: input.platform || null,
        campaign_id: input.campaign_id || null,
        utm_campaign: input.campaign_name || null,
        qualified: false,
        raw_payload: {
          source: 'manual',
          payload: {
            name: input.name?.trim() || null,
            phone: normalizedPhone,
            email: trimmedEmail ?? null,
            campaign_id: input.campaign_id,
            platform: input.platform,
            campaign_name: input.campaign_name ?? null,
            created_at: now.toISOString(),
          },
        },
      },
      select: { id: true },
    })

    return { id: lead.id }
  })

export const getLeadDetail = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ lead_id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const lead = await prisma.leads.findFirstOrThrow({
      where: { id: input.lead_id, organization_id: organizationId },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        qualified: true,
        created_at: true,
        lead_events: {
          orderBy: { occurred_at: 'desc' },
          select: {
            id: true,
            event_type: true,
            occurred_at: true,
            qualified: true,
            duration_sec: true,
            utm_source: true,
            utm_medium: true,
            utm_campaign: true,
            gclid: true,
            campaign_id: true,
            referrer: true,
            landing_page: true,
            platform: true,
            utm_content: true,
            utm_term: true,
          },
        },
        patient_values: {
          select: {
            id: true,
            model: true,
            ltv_cents: true,
            cash_collected_to_date_cents: true,
          },
        },
        lead_patient_links: {
          select: {
            link_reason: true,
            linked_at: true,
            patient: {
              select: {
                id: true,
                name: true,
                phone: true,
                created_at_source: true,
              },
            },
          },
        },
      },
    })

    const events = lead.lead_events
    const firstEvent = events.length > 0 ? events[events.length - 1] : null
    const lastEvent = events.length > 0 ? events[0] : null
    const firstEventAt = firstEvent?.occurred_at ?? lead.created_at
    const lastEventAt = lastEvent?.occurred_at ?? firstEventAt
    const link = pickConvertedPatientLink(
      lead.lead_patient_links,
      firstEvent?.occurred_at ?? null,
    )

    return {
      ...lead,
      lead_patient_links: undefined,
      first_event_at: toIsoString(firstEventAt),
      last_event_at: toIsoString(lastEventAt),
      platform: firstEvent?.platform ?? null,
      campaign_id: firstEvent?.campaign_id ?? null,
      gclid: firstEvent?.gclid ?? null,
      utm_source: firstEvent?.utm_source ?? null,
      utm_medium: firstEvent?.utm_medium ?? null,
      utm_campaign: firstEvent?.utm_campaign ?? null,
      utm_content: firstEvent?.utm_content ?? null,
      utm_term: firstEvent?.utm_term ?? null,
      referrer: firstEvent?.referrer ?? null,
      landing_page: firstEvent?.landing_page ?? null,
      lead_events: events.map((e) => ({
        ...e,
        occurred_at: toIsoString(e.occurred_at),
      })),
      linked_patient: link
        ? {
            id: link.patient.id,
            name: link.patient.name,
            phone: link.patient.phone,
            created_at_source: link.patient.created_at_source
              ? toIsoString(link.patient.created_at_source)
              : null,
            link_reason: link.link_reason,
            linked_at: toIsoString(link.linked_at),
          }
        : null,
      is_patient: Boolean(link),
    }
  })

export const upsertPatientValue = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      lead_id: z.string().min(1),
      ltv_cents: z.number().int().min(0).nullable().optional(),
      cash_collected_to_date_cents: z
        .number()
        .int()
        .min(0)
        .nullable()
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const lead = await prisma.leads.findFirstOrThrow({
      where: { id: input.lead_id, organization_id: organizationId },
      select: { id: true },
    })

    const value = await prisma.patient_values.upsert({
      where: { lead_id: lead.id },
      create: {
        organization_id: organizationId,
        lead_id: lead.id,
        model: 'ltv',
        ltv_cents: input.ltv_cents ?? null,
        cash_collected_to_date_cents:
          input.cash_collected_to_date_cents ?? null,
      },
      update: {
        model: 'ltv',
        ltv_cents: input.ltv_cents ?? null,
        cash_collected_to_date_cents:
          input.cash_collected_to_date_cents ?? null,
      },
      select: {
        id: true,
        model: true,
        ltv_cents: true,
        cash_collected_to_date_cents: true,
      },
    })

    return value
  })

export const listCampaignSettings = createServerFn({ method: 'GET' }).handler(
  async () => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')

    const last7dStart = dayjs().subtract(7, 'day').toDate()

    const [campaignRows, leadCampaignRows, last7dSpend, locations, settings] =
      await Promise.all([
        prisma.campaigns.findMany({
          where: { organization_id: organizationId },
          select: {
            campaign_id: true,
            campaign_name: true,
            status: true,
            platform: true,
          },
        }),
        prisma.lead_events.findMany({
          where: {
            organization_id: organizationId,
            campaign_id: { not: null },
          },
          distinct: ['campaign_id', 'platform'],
          orderBy: { occurred_at: 'asc' },
          select: {
            campaign_id: true,
            utm_campaign: true,
            platform: true,
          },
        }),
        prisma.ad_spend_daily.groupBy({
          by: ['campaign_id', 'platform'],
          where: {
            organization_id: organizationId,
            date: { gte: last7dStart },
          },
          _sum: { cost_cents: true },
        }),
        prisma.locations.findMany({
          where: { organization_id: organizationId },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        prisma.campaign_settings.findMany({
          where: { organization_id: organizationId },
          select: {
            campaign_id: true,
            platform: true,
            location_id: true,
            include_in_reporting: true,
            campaign_category: true,
          },
        }),
      ])

    const spendByCampaign = new Map<string, number>()
    for (const row of last7dSpend) {
      spendByCampaign.set(
        campaignKey(row.platform, row.campaign_id),
        row._sum.cost_cents ?? 0,
      )
    }

    const locationById = new Map(locations.map((l) => [l.id, l.name] as const))
    const settingsByCampaignKey = new Map(
      settings.map((s) => [campaignKey(s.platform, s.campaign_id), s] as const),
    )

    const campaignKeys = new Set<string>()
    for (const c of campaignRows) {
      campaignKeys.add(campaignKey(c.platform, c.campaign_id))
    }
    for (const c of leadCampaignRows) {
      if (c.campaign_id) {
        campaignKeys.add(campaignKey(c.platform, c.campaign_id))
      }
    }

    const campaigns = Array.from(campaignKeys).flatMap((key) => {
      const parsed = parseCampaignKey(key)
      if (!parsed.campaign_id) return []
      const platform = parsed.platform ?? 'unknown'
      const campaign = campaignRows.find(
        (c) => c.campaign_id === parsed.campaign_id && c.platform === platform,
      )
      const leadCampaign = leadCampaignRows.find(
        (c) => c.campaign_id === parsed.campaign_id && c.platform === platform,
      )
      const setting = settingsByCampaignKey.get(key)
      const locationName = setting?.location_id
        ? (locationById.get(setting.location_id) ?? null)
        : null

      return [
        {
          platform,
          campaign_id: parsed.campaign_id,
          campaign_name:
            campaign?.campaign_name ?? leadCampaign?.utm_campaign ?? null,
          status: campaign?.status ?? 'unknown',
          include_in_reporting: setting?.include_in_reporting ?? true,
          campaign_category: setting?.campaign_category ?? null,
          location_id: setting?.location_id ?? null,
          location_name: locationName,
          last_7d_spend_cents: spendByCampaign.get(key) ?? 0,
        },
      ]
    })

    campaigns.sort((a, b) => b.last_7d_spend_cents - a.last_7d_spend_cents)

    return { campaigns, locations }
  },
)

export const upsertCampaignSetting = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      platform: z.string().min(1),
      campaign_id: z.string().min(1),
      location_id: z.string().min(1).nullable(),
      include_in_reporting: z.boolean().optional(),
      campaign_category: z
        .enum(['branded', 'non_branded', 'other'])
        .nullable()
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const setting = await prisma.campaign_settings.upsert({
      where: {
        organization_id_platform_campaign_id: {
          organization_id: organizationId,
          platform: input.platform,
          campaign_id: input.campaign_id,
        },
      },
      create: {
        organization_id: organizationId,
        platform: input.platform,
        campaign_id: input.campaign_id,
        location_id: input.location_id,
        include_in_reporting: input.include_in_reporting ?? true,
        campaign_category: input.campaign_category ?? null,
      },
      update: {
        location_id: input.location_id,
        include_in_reporting: input.include_in_reporting ?? undefined,
        campaign_category: input.campaign_category ?? undefined,
      },
      select: {
        platform: true,
        campaign_id: true,
        location_id: true,
        include_in_reporting: true,
        campaign_category: true,
      },
    })
    return setting
  })

const dashboardInput = z.object({
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location_id: z.string().min(1).optional(),
  campaign_id: z.string().min(1).optional(),
  platform: z.string().min(1).optional(),
  platforms: z.array(z.string().min(1)).optional(),
  include_excluded: z.boolean().default(false),
})

export const getDashboard = createServerFn({ method: 'POST' })
  .inputValidator(dashboardInput)
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')

    const fromDate = dayjs(`${input.from_date}T00:00:00.000Z`).toDate()
    const toDate = dayjs(`${input.to_date}T23:59:59.999Z`).toDate()
    const spendFrom = dayjs(`${input.from_date}T00:00:00.000Z`).toDate()
    const spendTo = dayjs(`${input.to_date}T23:59:59.999Z`).toDate()

    const [campaignSettings, locations] = await Promise.all([
      prisma.campaign_settings.findMany({
        where: { organization_id: organizationId },
        select: {
          campaign_id: true,
          platform: true,
          location_id: true,
          include_in_reporting: true,
        },
      }),
      prisma.locations.findMany({
        where: { organization_id: organizationId },
        select: { id: true, name: true },
      }),
    ])

    const platformList = input.platforms
      ? input.platforms
      : input.platform
        ? [input.platform]
        : null

    const filteredCampaignSettings = platformList
      ? campaignSettings.filter((s) => platformList.includes(s.platform))
      : campaignSettings

    const excludedCampaignKeySet = new Set(
      filteredCampaignSettings
        .filter((s) => !s.include_in_reporting)
        .map((s) => campaignKey(s.platform, s.campaign_id)),
    )

    const settingsByCampaignKey = new Map(
      filteredCampaignSettings.map(
        (s) => [campaignKey(s.platform, s.campaign_id), s] as const,
      ),
    )
    const locationById = new Map(locations.map((l) => [l.id, l.name] as const))

    const locationCampaignFilters = input.location_id
      ? filteredCampaignSettings.filter(
          (s) =>
            s.location_id === input.location_id &&
            (input.include_excluded || s.include_in_reporting),
        )
      : []

    const locationCampaignPairs = locationCampaignFilters.map((s) => ({
      campaign_id: s.campaign_id,
      platform: s.platform,
    }))

    const [spendRows, leads, firstEvents] = await Promise.all([
      prisma.ad_spend_daily.groupBy({
        by: ['campaign_id', 'platform'],
        where: {
          organization_id: organizationId,
          date: { gte: spendFrom, lte: spendTo },
          ...(platformList ? { platform: { in: platformList } } : {}),
          ...(input.campaign_id ? { campaign_id: input.campaign_id } : {}),
          ...(locationCampaignPairs.length > 0
            ? { OR: locationCampaignPairs }
            : {}),
        },
        _sum: { cost_cents: true },
      }),
      prisma.leads.findMany({
        where: { organization_id: organizationId },
        select: {
          id: true,
          qualified: true,
          patient_values: {
            select: { ltv_cents: true, cash_collected_to_date_cents: true },
          },
          lead_patient_links: {
            select: {
              link_reason: true,
              patient: { select: { created_at_source: true } },
            },
          },
        },
      }),
      prisma.lead_events.findMany({
        where: { organization_id: organizationId },
        orderBy: { occurred_at: 'asc' },
        distinct: ['lead_id'],
        select: {
          lead_id: true,
          occurred_at: true,
          campaign_id: true,
          platform: true,
          utm_campaign: true,
        },
      }),
    ])

    const spendByCampaign = new Map<string, number>()
    for (const row of spendRows) {
      const key = campaignKey(row.platform, row.campaign_id)
      if (!input.include_excluded && excludedCampaignKeySet.has(key)) continue
      spendByCampaign.set(key, row._sum.cost_cents ?? 0)
    }

    const leadsByCampaign = new Map<string, number>()
    const qualifiedLeadsByCampaign = new Map<string, number>()
    const patientsByCampaign = new Map<string, number>()
    const revenueByCampaign = new Map<string, number>()
    const campaignNameByKey = new Map<string, string | null>()

    const firstEventByLeadId = new Map(firstEvents.map((e) => [e.lead_id, e]))

    for (const lead of leads) {
      const firstEvent = firstEventByLeadId.get(lead.id)
      if (!firstEvent) continue

      const firstAt = dayjs(firstEvent.occurred_at)
      if (firstAt.isBefore(fromDate) || firstAt.isAfter(toDate)) continue

      const campaignId =
        typeof firstEvent.campaign_id === 'string'
          ? firstEvent.campaign_id.trim()
          : ''
      if (!campaignId) continue

      if (
        platformList &&
        (!firstEvent.platform || !platformList.includes(firstEvent.platform))
      ) {
        continue
      }

      if (input.campaign_id && firstEvent.campaign_id !== input.campaign_id) {
        continue
      }

      if (locationCampaignPairs.length > 0) {
        const match = locationCampaignPairs.some(
          (pair) =>
            pair.campaign_id === firstEvent.campaign_id &&
            pair.platform === firstEvent.platform,
        )
        if (!match) continue
      }

      const key = campaignKey(firstEvent.platform, firstEvent.campaign_id)
      if (!input.include_excluded && excludedCampaignKeySet.has(key)) continue
      leadsByCampaign.set(key, (leadsByCampaign.get(key) ?? 0) + 1)

      if (lead.qualified) {
        qualifiedLeadsByCampaign.set(
          key,
          (qualifiedLeadsByCampaign.get(key) ?? 0) + 1,
        )
      }

      if (firstEvent.utm_campaign)
        campaignNameByKey.set(key, firstEvent.utm_campaign)

      const convertedLink = pickConvertedPatientLink(
        lead.lead_patient_links,
        firstAt.toDate(),
      )

      if (convertedLink) {
        const patientCreatedAt = convertedLink.patient.created_at_source
        if (!patientCreatedAt) continue

        const patientAt = dayjs(patientCreatedAt)
        if (!patientAt.isValid()) continue

        if (patientAt.isBefore(fromDate) || patientAt.isAfter(toDate)) {
          continue
        }
        patientsByCampaign.set(key, (patientsByCampaign.get(key) ?? 0) + 1)
        const ltv = lead.patient_values?.ltv_cents ?? 0
        revenueByCampaign.set(key, (revenueByCampaign.get(key) ?? 0) + ltv)
      }
    }

    const campaignKeys = new Set<string>([
      ...Array.from(spendByCampaign.keys()),
      ...Array.from(leadsByCampaign.keys()),
      ...Array.from(patientsByCampaign.keys()),
    ])

    const campaignPairs = Array.from(campaignKeys)
      .map((key) => parseCampaignKey(key))
      .filter(
        (pair): pair is { platform: string; campaign_id: string } =>
          !!pair.campaign_id && !!pair.platform,
      )

    const syncedCampaigns =
      campaignPairs.length > 0
        ? await prisma.campaigns.findMany({
            where: {
              organization_id: organizationId,
              OR: campaignPairs.map((pair) => ({
                campaign_id: pair.campaign_id,
                platform: pair.platform,
              })),
            },
            select: { campaign_id: true, campaign_name: true, platform: true },
          })
        : []

    const syncedCampaignNameByKey = new Map<string, string | null>(
      syncedCampaigns.map(
        (c) =>
          [campaignKey(c.platform, c.campaign_id), c.campaign_name] as const,
      ),
    )

    const rows = Array.from(campaignKeys).map((key) => {
      const parsed = parseCampaignKey(key)
      const campaignId = parsed.campaign_id
      const platform = parsed.platform ?? 'unknown'
      const spend = campaignId ? (spendByCampaign.get(key) ?? 0) : 0
      const leadCount = leadsByCampaign.get(key) ?? 0
      const qualifiedCount = qualifiedLeadsByCampaign.get(key) ?? 0
      const patientCount = patientsByCampaign.get(key) ?? 0
      const revenue = revenueByCampaign.get(key) ?? 0

      const setting =
        campaignId && platform !== 'unknown'
          ? settingsByCampaignKey.get(key)
          : undefined
      const includeInReporting = setting?.include_in_reporting ?? true

      const locationId = setting?.location_id ?? null
      const locationName = locationId
        ? (locationById.get(locationId) ?? null)
        : null

      const roi = spend > 0 ? (revenue - spend) / spend : null

      const displayName =
        campaignId === null
          ? 'Unknown/Direct'
          : (syncedCampaignNameByKey.get(key) ??
            campaignNameByKey.get(key) ??
            null)

      return {
        platform,
        campaign_id: campaignId,
        campaign_name: displayName,
        location_id: locationId,
        location_name: locationName,
        include_in_reporting: includeInReporting,
        spend_cents: spend,
        leads: leadCount,
        qualified_leads: qualifiedCount,
        patients: patientCount,
        revenue_cents: revenue,
        roi,
      }
    })

    const filteredRows = rows.filter((r) => {
      if (r.campaign_id === null) return false
      if (!input.include_excluded && r.campaign_id) {
        if (!r.include_in_reporting) return false
      }
      return true
    })

    const spendTotal = filteredRows.reduce((acc, r) => acc + r.spend_cents, 0)
    const leadsTotal = filteredRows.reduce((acc, r) => acc + r.leads, 0)
    const qualifiedTotal = filteredRows.reduce(
      (acc, r) => acc + r.qualified_leads,
      0,
    )
    const patientsTotal = filteredRows.reduce((acc, r) => acc + r.patients, 0)
    const revenueTotal = filteredRows.reduce(
      (acc, r) => acc + r.revenue_cents,
      0,
    )
    const roiTotal =
      spendTotal > 0 ? (revenueTotal - spendTotal) / spendTotal : null

    filteredRows.sort((a, b) => b.spend_cents - a.spend_cents)

    return {
      kpis: {
        spend_cents: spendTotal,
        leads: leadsTotal,
        qualified_leads: qualifiedTotal,
        patients: patientsTotal,
        revenue_cents: revenueTotal,
        roi: roiTotal,
      },
      campaigns: filteredRows,
    }
  })

export const getSpendTimeSeries = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      location_id: z.string().min(1).optional(),
      platform: z.string().min(1).optional(),
      platforms: z.array(z.string().min(1)).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')

    const fromDate = dayjs(`${input.from_date}T00:00:00.000Z`).toDate()
    const toDate = dayjs(`${input.to_date}T23:59:59.999Z`).toDate()

    const platformList = input.platforms
      ? input.platforms
      : input.platform
        ? [input.platform]
        : null

    const campaignSettings = await prisma.campaign_settings.findMany({
      where: { organization_id: organizationId },
      select: {
        campaign_id: true,
        platform: true,
        location_id: true,
        include_in_reporting: true,
      },
    })

    const filteredCampaignSettings = platformList
      ? campaignSettings.filter((s) => platformList.includes(s.platform))
      : campaignSettings

    const excludedCampaignKeySet = new Set(
      filteredCampaignSettings
        .filter((s) => !s.include_in_reporting)
        .map((s) => campaignKey(s.platform, s.campaign_id)),
    )

    const locationCampaignPairs = input.location_id
      ? filteredCampaignSettings
          .filter(
            (s) =>
              s.location_id === input.location_id && s.include_in_reporting,
          )
          .map((s) => ({
            campaign_id: s.campaign_id,
            platform: s.platform,
          }))
      : []

    const locationCampaignSet = new Set(
      locationCampaignPairs.map((pair) =>
        campaignKey(pair.platform, pair.campaign_id),
      ),
    )

    const [spendRows, leads, firstEvents] = await Promise.all([
      prisma.ad_spend_daily.groupBy({
        by: ['date', 'campaign_id', 'platform'],
        where: {
          organization_id: organizationId,
          date: { gte: fromDate, lte: toDate },
          ...(platformList ? { platform: { in: platformList } } : {}),
          ...(locationCampaignPairs.length > 0
            ? { OR: locationCampaignPairs }
            : {}),
        },
        _sum: { cost_cents: true },
        orderBy: { date: 'asc' },
      }),
      prisma.leads.findMany({
        where: { organization_id: organizationId },
        select: {
          id: true,
          lead_patient_links: {
            select: {
              link_reason: true,
              patient: { select: { created_at_source: true } },
            },
          },
        },
      }),
      prisma.lead_events.findMany({
        where: { organization_id: organizationId },
        orderBy: { occurred_at: 'asc' },
        distinct: ['lead_id'],
        select: {
          lead_id: true,
          occurred_at: true,
          campaign_id: true,
          platform: true,
        },
      }),
    ])

    const firstEventByLeadId = new Map(firstEvents.map((e) => [e.lead_id, e]))
    const leadsByDate = new Map<string, number>()
    const patientsByDate = new Map<string, number>()

    for (const lead of leads) {
      const firstEvent = firstEventByLeadId.get(lead.id)
      if (!firstEvent) continue

      const firstAt = dayjs(firstEvent.occurred_at)
      if (firstAt.isBefore(fromDate) || firstAt.isAfter(toDate)) continue

      const campaignId =
        typeof firstEvent.campaign_id === 'string'
          ? firstEvent.campaign_id.trim()
          : ''
      if (!campaignId || !firstEvent.platform) continue

      const campaignKeyValue = campaignKey(firstEvent.platform, campaignId)
      if (excludedCampaignKeySet.has(campaignKeyValue)) continue

      if (
        platformList &&
        (!firstEvent.platform || !platformList.includes(firstEvent.platform))
      ) {
        continue
      }

      if (locationCampaignSet.size > 0) {
        if (!locationCampaignSet.has(campaignKeyValue)) continue
      }

      if (!firstAt.isBefore(fromDate) && !firstAt.isAfter(toDate)) {
        const leadDate = firstAt.format('YYYY-MM-DD')
        leadsByDate.set(leadDate, (leadsByDate.get(leadDate) ?? 0) + 1)
      }

      const convertedLink = pickConvertedPatientLink(
        lead.lead_patient_links,
        firstAt.toDate(),
      )
      const patientDate = convertedLink?.patient?.created_at_source
      if (!patientDate) continue

      const patientAt = dayjs(patientDate)
      if (patientAt.isBefore(fromDate) || patientAt.isAfter(toDate)) continue

      const patientKey = patientAt.format('YYYY-MM-DD')
      patientsByDate.set(patientKey, (patientsByDate.get(patientKey) ?? 0) + 1)
    }

    const byDate = new Map<
      string,
      { date: string; spend_cents: number; leads: number; patients: number }
    >()

    const ensureRow = (date: string) => {
      const existing = byDate.get(date)
      if (existing) return existing
      const created = { date, spend_cents: 0, leads: 0, patients: 0 }
      byDate.set(date, created)
      return created
    }

    for (const row of spendRows) {
      const spendCampaignKey = campaignKey(row.platform, row.campaign_id)
      if (excludedCampaignKeySet.has(spendCampaignKey)) continue
      if (
        locationCampaignSet.size > 0 &&
        !locationCampaignSet.has(spendCampaignKey)
      ) {
        continue
      }
      const dateKey = dayjs(row.date).format('YYYY-MM-DD')
      const entry = ensureRow(dateKey)
      entry.spend_cents += row._sum.cost_cents ?? 0
    }

    for (const [date, count] of leadsByDate.entries()) {
      const entry = ensureRow(date)
      entry.leads = count
    }

    for (const [date, count] of patientsByDate.entries()) {
      const entry = ensureRow(date)
      entry.patients = count
    }

    return Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    )
  })

export const syncGoogleAdsNow = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { syncGoogleAdsForOrganization } =
      await import('@/server/ri/syncGoogleAds')
    const result = await syncGoogleAdsForOrganization({
      organizationId,
      fromDate: input.from_date,
      toDate: input.to_date,
    })
    return result
  })

export const getFacebookBusinessAdAccounts = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      business_id: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const record = await prisma.organization_settings.findUnique({
      where: { organization_id: organizationId },
      select: { config_json: true },
    })

    const config = (record?.config_json ?? {}) as Record<string, unknown>
    const savedBusinessId =
      typeof config.facebook_business_id === 'string'
        ? config.facebook_business_id
        : ''

    const businessId =
      normalizeOptionalString(input.business_id) ??
      normalizeOptionalString(savedBusinessId)

    if (!businessId) {
      throw new Error('Missing facebook_business_id')
    }

    const { fetchFacebookBusinessAdAccounts } =
      await import('@/server/ri/syncFacebookAds')
    return await fetchFacebookBusinessAdAccounts({ businessId })
  })

export const syncFacebookAdsNow = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const record = await prisma.organization_settings.findUnique({
      where: { organization_id: organizationId },
      select: { config_json: true },
    })
    const config = (record?.config_json ?? {}) as Record<string, unknown>
    const businessId =
      typeof config.facebook_business_id === 'string'
        ? config.facebook_business_id
        : undefined
    const accountIds = Array.isArray(config.facebook_ad_account_ids)
      ? config.facebook_ad_account_ids.filter(
          (id): id is string => typeof id === 'string',
        )
      : []

    const { syncFacebookAdsForOrganization } =
      await import('@/server/ri/syncFacebookAds')
    const result = await syncFacebookAdsForOrganization({
      organizationId,
      fromDate: input.from_date,
      toDate: input.to_date,
      businessId,
      accountIds,
    })
    return result
  })

export const syncFacebookBusinessCampaignsNow = createServerFn({
  method: 'POST',
})
  .inputValidator(
    z.object({
      business_id: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const record = await prisma.organization_settings.findUnique({
      where: { organization_id: organizationId },
      select: { config_json: true },
    })

    const config = (record?.config_json ?? {}) as Record<string, unknown>
    const savedBusinessId =
      typeof config.facebook_business_id === 'string'
        ? config.facebook_business_id
        : ''

    const businessId =
      normalizeOptionalString(input.business_id) ??
      normalizeOptionalString(savedBusinessId)

    if (!businessId) {
      throw new Error('Missing facebook_business_id')
    }

    const accountIds = Array.isArray(config.facebook_ad_account_ids)
      ? config.facebook_ad_account_ids.filter(
          (id): id is string => typeof id === 'string',
        )
      : []

    const { syncFacebookBusinessCampaigns } =
      await import('@/server/ri/syncFacebookAds')
    return await syncFacebookBusinessCampaigns({
      organizationId,
      businessId,
      accountIds,
    })
  })

export const validateIngestionApiKey = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ authorization: z.string().min(1) }))
  .handler(async ({ data }) => {
    const input = data
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const { extractBearerToken, hashApiKey } =
      await import('@/server/ri/apiKeys')
    const token = extractBearerToken(input.authorization)
    if (!token) return { ok: false as const }
    const keyHash = hashApiKey(token)
    const match = await prisma.organization_api_keys.findFirst({
      where: {
        organization_id: organizationId,
        key_hash: keyHash,
        revoked_at: null,
      },
      select: { id: true },
    })
    return { ok: !!match }
  })
