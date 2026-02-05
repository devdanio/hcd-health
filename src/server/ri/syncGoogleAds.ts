import { GoogleAdsApi } from 'google-ads-api'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

function microsToCents(micros: unknown): number {
  if (micros === null || typeof micros === 'undefined') return 0

  const asBigInt = (() => {
    if (typeof micros === 'bigint') return micros
    if (typeof micros === 'number') return BigInt(Math.trunc(micros))
    if (typeof micros === 'string' && micros.length > 0) return BigInt(micros)
    return 0n
  })()

  // 1,000,000 micros = 1 unit; 1 unit = 100 cents => 10,000 micros = 1 cent
  const rounded = (asBigInt + 5000n) / 10000n
  const asNumber = Number(rounded)
  if (!Number.isFinite(asNumber) || asNumber < 0) return 0

  // Prisma Int is 32-bit in many DBs; guard against overflow.
  return Math.min(asNumber, 2_000_000_000)
}

function mapCampaignStatus(status: unknown): 'unknown' | 'enabled' | 'paused' | 'removed' {
  if (typeof status !== 'string') return 'unknown'
  const s = status.toUpperCase()
  if (s === 'ENABLED') return 'enabled'
  if (s === 'PAUSED') return 'paused'
  if (s === 'REMOVED') return 'removed'
  return 'unknown'
}

export async function syncGoogleAdsForOrganization(opts: {
  organizationId: string
  fromDate: string // YYYY-MM-DD
  toDate: string // YYYY-MM-DD
}): Promise<{ campaigns_upserted: number; spend_rows_upserted: number }> {
  const { prisma } = await import('@/db')
  const { decryptToken } = await import('@/server/lib/encryption')
  const org = await prisma.organizations.findUniqueOrThrow({
    where: { id: opts.organizationId },
    select: { google_ads_customer_id: true },
  })

  const customerIdRaw = org.google_ads_customer_id?.replace(/\D/g, '') ?? ''
  if (!customerIdRaw) {
    throw new Error('Missing organization google_ads_customer_id')
  }

  const credentialRecord = await prisma.organization_credentials.findUnique({
    where: {
      organization_id_provider: {
        organization_id: opts.organizationId,
        provider: 'google_ads',
      },
    },
    select: { encrypted_payload: true },
  })

  let credentialOverrides: {
    developer_token?: string
    client_id?: string
    client_secret?: string
    refresh_token?: string
    mcc_id?: string
  } | null = null

  if (credentialRecord) {
    try {
      const decrypted = await decryptToken(credentialRecord.encrypted_payload)
      const parsed = JSON.parse(decrypted) as Record<string, unknown>
      credentialOverrides = {
        developer_token:
          typeof parsed.developer_token === 'string' ? parsed.developer_token : undefined,
        client_id: typeof parsed.client_id === 'string' ? parsed.client_id : undefined,
        client_secret:
          typeof parsed.client_secret === 'string' ? parsed.client_secret : undefined,
        refresh_token:
          typeof parsed.refresh_token === 'string' ? parsed.refresh_token : undefined,
        mcc_id: typeof parsed.mcc_id === 'string' ? parsed.mcc_id : undefined,
      }
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to decrypt Google Ads credentials',
      )
    }
  }

  const api = new GoogleAdsApi({
    client_id: credentialOverrides?.client_id ?? requireEnv('GOOGLE_ADS_CLIENT_ID'),
    client_secret:
      credentialOverrides?.client_secret ?? requireEnv('GOOGLE_ADS_CLIENT_SECRET'),
    developer_token:
      credentialOverrides?.developer_token ?? requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
  })

  const customer = api.Customer({
    customer_id: customerIdRaw,
    refresh_token:
      credentialOverrides?.refresh_token ?? requireEnv('GOOGLE_ADS_REFRESH_TOKEN'),
    login_customer_id:
      (credentialOverrides?.mcc_id ?? process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
        ?.replace(/\D/g, '') || undefined,
  })

  const campaignsQuery = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status
    FROM campaign
  `

  const campaignsRes = (await customer.query(campaignsQuery)) as Array<Record<string, unknown>>

  let campaignsUpserted = 0
  for (const row of campaignsRes) {
    const campaign = row.campaign as Record<string, unknown> | undefined
    const id = campaign?.id
    if (typeof id !== 'number' && typeof id !== 'string') continue
    const campaignId = String(id)
    const name = typeof campaign?.name === 'string' ? campaign.name : null
    const status = mapCampaignStatus(campaign?.status)

    await prisma.campaigns.upsert({
      where: {
        organization_id_campaign_id: {
          organization_id: opts.organizationId,
          campaign_id: campaignId,
        },
      },
      create: {
        organization_id: opts.organizationId,
        campaign_id: campaignId,
        campaign_name: name,
        status,
        last_synced_at: new Date(),
      },
      update: {
        campaign_name: name ?? undefined,
        status,
        last_synced_at: new Date(),
      },
    })
    campaignsUpserted++
  }

  const spendQuery = `
    SELECT
      segments.date,
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      customer.currency_code
    FROM campaign
    WHERE segments.date BETWEEN '${opts.fromDate}' AND '${opts.toDate}'
  `

  const spendRes = (await customer.query(spendQuery)) as Array<Record<string, unknown>>
  let spendRowsUpserted = 0

  for (const row of spendRes) {
    const segments = row.segments as Record<string, unknown> | undefined
    const date = segments?.date
    if (typeof date !== 'string') continue

    const campaign = row.campaign as Record<string, unknown> | undefined
    const id = campaign?.id
    if (typeof id !== 'number' && typeof id !== 'string') continue
    const campaignId = String(id)

    const campaignName = typeof campaign?.name === 'string' ? campaign.name : null

    const metrics = row.metrics as Record<string, unknown> | undefined
    const costMicros = metrics?.cost_micros
    const costCents = microsToCents(costMicros)

    const customerObj = row.customer as Record<string, unknown> | undefined
    const currencyCode =
      typeof customerObj?.currency_code === 'string'
        ? customerObj.currency_code
        : null

    const dateObj = new Date(`${date}T00:00:00.000Z`)

    await prisma.ad_spend_daily.upsert({
      where: {
        organization_id_campaign_id_date: {
          organization_id: opts.organizationId,
          campaign_id: campaignId,
          date: dateObj,
        },
      },
      create: {
        organization_id: opts.organizationId,
        campaign_id: campaignId,
        campaign_name: campaignName,
        date: dateObj,
        cost_cents: costCents,
        currency_code: currencyCode,
      },
      update: {
        campaign_name: campaignName ?? undefined,
        cost_cents: costCents,
        currency_code: currencyCode ?? undefined,
      },
    })
    spendRowsUpserted++
  }

  return { campaigns_upserted: campaignsUpserted, spend_rows_upserted: spendRowsUpserted }
}
