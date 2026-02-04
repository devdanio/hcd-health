import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { toIsoString } from '@/server/ri/serializers'

async function requireOrganizationId(): Promise<string> {
  const { requireUserId, getOrCreateOrganizationForUser } = await import(
    '@/server/ri/session'
  )
  const userId = await requireUserId()
  const { organizationId } = await getOrCreateOrganizationForUser({ userId })
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
    }),
  )
  .handler(async ({ input }) => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const updated = await prisma.organizations.update({
      where: { id: organizationId },
      data: {
        name: input.name,
        qualified_call_duration_threshold_sec: input.qualified_call_duration_threshold_sec,
        google_ads_customer_id: input.google_ads_customer_id ?? undefined,
      },
      select: {
        id: true,
        name: true,
        qualified_call_duration_threshold_sec: true,
        default_revenue_model: true,
        google_ads_customer_id: true,
      },
    })
    return updated
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
  .handler(async ({ input }) => {
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
  .handler(async ({ input }) => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const { generateApiKey, hashApiKey } = await import('@/server/ri/apiKeys')
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

export const revokeApiKey = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string().min(1),
    }),
  )
  .handler(async ({ input }) => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    await prisma.organization_api_keys.updateMany({
      where: { id: input.id, organization_id: organizationId },
      data: { revoked_at: new Date() },
    })
    return { ok: true }
  })

const leadsListInput = z.object({
  status: z.enum(['new', 'patient', 'not_patient']).optional(),
  qualified_only: z.boolean().optional(),
  campaign_id: z.string().min(1).optional(),
  location_id: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50),
})

export const listLeads = createServerFn({ method: 'POST' })
  .inputValidator(leadsListInput)
  .handler(async ({ input }) => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')

    const campaignIdsForLocation = input.location_id
      ? await prisma.campaign_settings
          .findMany({
            where: { organization_id: organizationId, location_id: input.location_id },
            select: { campaign_id: true },
          })
          .then((rows) => rows.map((r) => r.campaign_id))
      : null

    const where = {
      organization_id: organizationId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.qualified_only ? { qualified: true } : {}),
      ...(input.campaign_id ? { campaign_id: input.campaign_id } : {}),
      ...(campaignIdsForLocation ? { campaign_id: { in: campaignIdsForLocation } } : {}),
      ...(input.from || input.to
        ? {
            first_event_at: {
              ...(input.from ? { gte: new Date(input.from) } : {}),
              ...(input.to ? { lte: new Date(input.to) } : {}),
            },
          }
        : {}),
      ...(input.q
        ? {
            OR: [
              { phone: { contains: input.q } },
              { name: { contains: input.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    } as const

    const leads = await prisma.leads.findMany({
      where,
      orderBy: { last_event_at: 'desc' },
      take: input.limit,
      select: {
        id: true,
        phone: true,
        name: true,
        status: true,
        qualified: true,
        first_event_at: true,
        last_event_at: true,
        campaign_id: true,
        utm_campaign: true,
        platform: true,
      },
    })

    return leads.map((l) => ({
      ...l,
      first_event_at: toIsoString(l.first_event_at),
      last_event_at: toIsoString(l.last_event_at),
      campaign_name: l.utm_campaign,
    }))
  })

export const getLeadDetail = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ lead_id: z.string().min(1) }))
  .handler(async ({ input }) => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const lead = await prisma.leads.findFirstOrThrow({
      where: { id: input.lead_id, organization_id: organizationId },
      select: {
        id: true,
        phone: true,
        name: true,
        status: true,
        qualified: true,
        first_event_at: true,
        last_event_at: true,
        platform: true,
        campaign_id: true,
        gclid: true,
        utm_source: true,
        utm_medium: true,
        utm_campaign: true,
        utm_content: true,
        utm_term: true,
        referrer: true,
        landing_page: true,
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
      },
    })

    return {
      ...lead,
      first_event_at: toIsoString(lead.first_event_at),
      last_event_at: toIsoString(lead.last_event_at),
      lead_events: lead.lead_events.map((e) => ({
        ...e,
        occurred_at: toIsoString(e.occurred_at),
      })),
    }
  })

export const setLeadStatus = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      lead_id: z.string().min(1),
      status: z.enum(['new', 'patient', 'not_patient']),
    }),
  )
  .handler(async ({ input }) => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const updated = await prisma.leads.updateMany({
      where: { id: input.lead_id, organization_id: organizationId },
      data: { status: input.status },
    })
    return { updated: updated.count }
  })

export const upsertPatientValue = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      lead_id: z.string().min(1),
      ltv_cents: z.number().int().min(0).nullable().optional(),
      cash_collected_to_date_cents: z.number().int().min(0).nullable().optional(),
    }),
  )
  .handler(async ({ input }) => {
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
        cash_collected_to_date_cents: input.cash_collected_to_date_cents ?? null,
      },
      update: {
        model: 'ltv',
        ltv_cents: input.ltv_cents ?? null,
        cash_collected_to_date_cents: input.cash_collected_to_date_cents ?? null,
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

    const [campaignRows, leadCampaignRows, last7dSpend, locations, settings] =
      await Promise.all([
        prisma.campaigns.findMany({
          where: { organization_id: organizationId },
          select: { campaign_id: true, campaign_name: true, status: true },
        }),
        prisma.leads.findMany({
          where: { organization_id: organizationId, campaign_id: { not: null } },
          distinct: ['campaign_id'],
          select: { campaign_id: true, utm_campaign: true },
        }),
        prisma.ad_spend_daily.groupBy({
          by: ['campaign_id'],
          where: {
            organization_id: organizationId,
            date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
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
            location_id: true,
            include_in_reporting: true,
            campaign_category: true,
          },
        }),
      ])

    const spendByCampaign = new Map<string, number>()
    for (const row of last7dSpend) {
      spendByCampaign.set(row.campaign_id, row._sum.cost_cents ?? 0)
    }

    const locationById = new Map(locations.map((l) => [l.id, l.name] as const))
    const settingsByCampaignId = new Map(
      settings.map((s) => [s.campaign_id, s] as const),
    )

    const campaignIds = new Set<string>()
    for (const c of campaignRows) campaignIds.add(c.campaign_id)
    for (const c of leadCampaignRows) {
      if (c.campaign_id) campaignIds.add(c.campaign_id)
    }

    const campaigns = Array.from(campaignIds).map((campaignId) => {
      const campaign = campaignRows.find((c) => c.campaign_id === campaignId)
      const leadCampaign = leadCampaignRows.find((c) => c.campaign_id === campaignId)
      const setting = settingsByCampaignId.get(campaignId)
      const locationName = setting?.location_id
        ? locationById.get(setting.location_id) ?? null
        : null

      return {
        campaign_id: campaignId,
        campaign_name: campaign?.campaign_name ?? leadCampaign?.utm_campaign ?? null,
        status: campaign?.status ?? 'unknown',
        include_in_reporting: setting?.include_in_reporting ?? true,
        campaign_category: setting?.campaign_category ?? null,
        location_id: setting?.location_id ?? null,
        location_name: locationName,
        last_7d_spend_cents: spendByCampaign.get(campaignId) ?? 0,
      }
    })

    campaigns.sort((a, b) => b.last_7d_spend_cents - a.last_7d_spend_cents)

    return { campaigns, locations }
  },
)

export const upsertCampaignSetting = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      campaign_id: z.string().min(1),
      location_id: z.string().min(1).nullable(),
      include_in_reporting: z.boolean().optional(),
      campaign_category: z.enum(['branded', 'non_branded', 'other']).nullable().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const setting = await prisma.campaign_settings.upsert({
      where: {
        organization_id_campaign_id: {
          organization_id: organizationId,
          campaign_id: input.campaign_id,
        },
      },
      create: {
        organization_id: organizationId,
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
  include_excluded: z.boolean().default(false),
})

export const getDashboard = createServerFn({ method: 'POST' })
  .inputValidator(dashboardInput)
  .handler(async ({ input }) => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')

    const fromDate = new Date(`${input.from_date}T00:00:00.000Z`)
    const toDate = new Date(`${input.to_date}T23:59:59.999Z`)

    const [campaignSettings, locations] = await Promise.all([
      prisma.campaign_settings.findMany({
        where: { organization_id: organizationId },
        select: {
          campaign_id: true,
          location_id: true,
          include_in_reporting: true,
        },
      }),
      prisma.locations.findMany({
        where: { organization_id: organizationId },
        select: { id: true, name: true },
      }),
    ])

    const settingsByCampaignId = new Map(
      campaignSettings.map((s) => [s.campaign_id, s] as const),
    )
    const locationById = new Map(locations.map((l) => [l.id, l.name] as const))

    const campaignIdsForLocation = input.location_id
      ? campaignSettings
          .filter((s) => s.location_id === input.location_id)
          .map((s) => s.campaign_id)
      : null

    const leadWhere = {
      organization_id: organizationId,
      first_event_at: { gte: fromDate, lte: toDate },
      ...(input.platform ? { platform: input.platform } : {}),
      ...(input.campaign_id ? { campaign_id: input.campaign_id } : {}),
      ...(campaignIdsForLocation ? { campaign_id: { in: campaignIdsForLocation } } : {}),
    } as const

    const [spendRows, leads, patients] = await Promise.all([
      prisma.ad_spend_daily.groupBy({
        by: ['campaign_id'],
        where: {
          organization_id: organizationId,
          date: { gte: new Date(input.from_date), lte: new Date(input.to_date) },
          ...(input.campaign_id ? { campaign_id: input.campaign_id } : {}),
          ...(campaignIdsForLocation ? { campaign_id: { in: campaignIdsForLocation } } : {}),
        },
        _sum: { cost_cents: true },
      }),
      prisma.leads.findMany({
        where: leadWhere,
        select: {
          id: true,
          campaign_id: true,
          utm_campaign: true,
          qualified: true,
          status: true,
        },
      }),
      prisma.leads.findMany({
        where: { ...leadWhere, status: 'patient' },
        select: {
          id: true,
          campaign_id: true,
          patient_values: { select: { ltv_cents: true, cash_collected_to_date_cents: true } },
        },
      }),
    ])

    const spendByCampaign = new Map<string, number>()
    for (const row of spendRows) {
      spendByCampaign.set(row.campaign_id, row._sum.cost_cents ?? 0)
    }

    const leadsByCampaign = new Map<string, number>()
    const qualifiedLeadsByCampaign = new Map<string, number>()
    const patientsByCampaign = new Map<string, number>()
    const revenueByCampaign = new Map<string, number>()
    const campaignNameById = new Map<string, string | null>()

    for (const l of leads) {
      const cid = l.campaign_id ?? 'unknown'
      leadsByCampaign.set(cid, (leadsByCampaign.get(cid) ?? 0) + 1)
      if (l.qualified) {
        qualifiedLeadsByCampaign.set(cid, (qualifiedLeadsByCampaign.get(cid) ?? 0) + 1)
      }
      if (l.utm_campaign) campaignNameById.set(cid, l.utm_campaign)
    }

    for (const p of patients) {
      const cid = p.campaign_id ?? 'unknown'
      patientsByCampaign.set(cid, (patientsByCampaign.get(cid) ?? 0) + 1)
      const ltv = p.patient_values?.ltv_cents ?? 0
      revenueByCampaign.set(cid, (revenueByCampaign.get(cid) ?? 0) + ltv)
    }

    const campaignIds = new Set<string>([
      ...Array.from(spendByCampaign.keys()),
      ...Array.from(leadsByCampaign.keys()),
      ...Array.from(patientsByCampaign.keys()),
    ])

    const rows = Array.from(campaignIds).map((cid) => {
      const campaignId = cid === 'unknown' ? null : cid
      const spend = campaignId ? spendByCampaign.get(campaignId) ?? 0 : 0
      const leadCount = leadsByCampaign.get(cid) ?? 0
      const qualifiedCount = qualifiedLeadsByCampaign.get(cid) ?? 0
      const patientCount = patientsByCampaign.get(cid) ?? 0
      const revenue = revenueByCampaign.get(cid) ?? 0

      const setting = campaignId ? settingsByCampaignId.get(campaignId) : undefined
      const includeInReporting = setting?.include_in_reporting ?? true

      const locationId = setting?.location_id ?? null
      const locationName = locationId ? locationById.get(locationId) ?? null : null

      const roi = spend > 0 ? (revenue - spend) / spend : null

      const displayName =
        campaignId === null
          ? 'Unknown/Direct'
          : campaignNameById.get(cid) ?? null

      return {
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
      if (!input.include_excluded && r.campaign_id) {
        if (!r.include_in_reporting) return false
      }
      return true
    })

    const spendTotal = filteredRows.reduce((acc, r) => acc + r.spend_cents, 0)
    const leadsTotal = filteredRows.reduce((acc, r) => acc + r.leads, 0)
    const qualifiedTotal = filteredRows.reduce((acc, r) => acc + r.qualified_leads, 0)
    const patientsTotal = filteredRows.reduce((acc, r) => acc + r.patients, 0)
    const revenueTotal = filteredRows.reduce((acc, r) => acc + r.revenue_cents, 0)
    const roiTotal = spendTotal > 0 ? (revenueTotal - spendTotal) / spendTotal : null

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

export const syncGoogleAdsNow = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ input }) => {
    const organizationId = await requireOrganizationId()
    const { syncGoogleAdsForOrganization } = await import(
      '@/server/ri/syncGoogleAds'
    )
    const result = await syncGoogleAdsForOrganization({
      organizationId,
      fromDate: input.from_date,
      toDate: input.to_date,
    })
    return result
  })

export const validateIngestionApiKey = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ authorization: z.string().min(1) }))
  .handler(async ({ input }) => {
    const organizationId = await requireOrganizationId()
    const { prisma } = await import('@/db')
    const { extractBearerToken, hashApiKey } = await import('@/server/ri/apiKeys')
    const token = extractBearerToken(input.authorization)
    if (!token) return { ok: false as const }
    const keyHash = hashApiKey(token)
    const match = await prisma.organization_api_keys.findFirst({
      where: { organization_id: organizationId, key_hash: keyHash, revoked_at: null },
      select: { id: true },
    })
    return { ok: !!match }
  })
