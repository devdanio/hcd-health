import dayjs from 'dayjs'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

function normalizeAdAccountId(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('act_')) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  return digits.length > 0 ? `act_${digits}` : trimmed
}

function mapFacebookStatus(
  status: unknown,
): 'unknown' | 'enabled' | 'paused' | 'removed' {
  if (typeof status !== 'string') return 'unknown'
  const s = status.toUpperCase()
  if (s === 'ACTIVE') return 'enabled'
  if (s === 'PAUSED') return 'paused'
  if (s === 'DELETED' || s === 'ARCHIVED') return 'removed'
  return 'unknown'
}

function spendToCents(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') return 0
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue < 0) return 0
  const cents = Math.round(numberValue * 100)
  if (!Number.isFinite(cents) || cents < 0) return 0
  return Math.min(cents, 2_000_000_000)
}

type GraphRow = Record<string, unknown>
type GraphResponse = {
  data?: unknown
  paging?: { next?: unknown }
  error?: { message?: unknown }
}

async function fetchGraphPage(
  url: string,
): Promise<{ data: GraphRow[]; next: string | null }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Facebook API request failed (${response.status})`)
  }
  const json = (await response.json()) as GraphResponse
  if (!json || typeof json !== 'object') {
    throw new Error('Unexpected Facebook API response')
  }

  const errorMessage =
    typeof json.error?.message === 'string' ? json.error.message : null
  if (errorMessage) {
    throw new Error(errorMessage)
  }

  if (!Array.isArray(json.data)) {
    throw new Error('Unexpected Facebook API response')
  }

  const data = json.data.filter(
    (row): row is GraphRow => !!row && typeof row === 'object',
  )
  const next =
    typeof json.paging?.next === 'string' ? json.paging.next : null
  return {
    data,
    next,
  }
}

async function fetchGraphAll(url: string): Promise<GraphRow[]> {
  const rows: GraphRow[] = []
  let next: string | null = url
  while (next) {
    const page = await fetchGraphPage(next)
    rows.push(...page.data)
    next = page.next ?? null
  }
  return rows
}

async function fetchGraphAllWithError(
  url: string,
): Promise<{ rows: GraphRow[]; error: string | null }> {
  try {
    const rows = await fetchGraphAll(url)
    return { rows, error: null }
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function listBusinessAdAccounts(opts: {
  businessId: string
  accessToken: string
  graphVersion: string
}): Promise<{
  accounts: Array<{ id: string; name: string | null }>
  owned_error: string | null
  client_error: string | null
  owned_count: number
  client_count: number
}> {
  const baseUrl = `https://graph.facebook.com/${opts.graphVersion}`
  const accountParams = new URLSearchParams({
    access_token: opts.accessToken,
    fields: 'id,name,account_id',
    limit: '500',
  })

  const ownedUrl = `${baseUrl}/${opts.businessId}/owned_ad_accounts?${accountParams.toString()}`
  const clientUrl = `${baseUrl}/${opts.businessId}/client_ad_accounts?${accountParams.toString()}`

  const [ownedResult, clientResult] = await Promise.all([
    fetchGraphAllWithError(ownedUrl),
    fetchGraphAllWithError(clientUrl),
  ])
  const owned = ownedResult.rows
  const client = clientResult.rows

  const byId = new Map<string, { id: string; name: string | null }>()
  for (const row of [...owned, ...client]) {
    const idValue =
      typeof row.id === 'string' || typeof row.id === 'number'
        ? String(row.id)
        : typeof row.account_id === 'string' ||
            typeof row.account_id === 'number'
          ? String(row.account_id)
          : null
    if (!idValue) continue
    const accountId = normalizeAdAccountId(idValue)
    const name = typeof row.name === 'string' ? row.name : null
    byId.set(accountId, { id: accountId, name })
  }

  const accounts = Array.from(byId.values())
  if (accounts.length === 0 && (ownedResult.error || clientResult.error)) {
    const details = [
      ownedResult.error ? `owned_ad_accounts: ${ownedResult.error}` : null,
      clientResult.error ? `client_ad_accounts: ${clientResult.error}` : null,
    ]
      .filter(Boolean)
      .join(' | ')
    throw new Error(`Failed to fetch ad accounts. ${details}`)
  }

  return {
    accounts,
    owned_error: ownedResult.error,
    client_error: clientResult.error,
    owned_count: owned.length,
    client_count: client.length,
  }
}

export async function fetchFacebookBusinessAdAccounts(opts: {
  businessId: string
}): Promise<{
  accounts: Array<{ id: string; name: string | null }>
  owned_error: string | null
  client_error: string | null
  owned_count: number
  client_count: number
}> {
  const accessToken = requireEnv('FACEBOOK_ADS_ACCESS_TOKEN')
  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION ?? 'v20.0'
  const businessId = opts.businessId.trim()
  if (!businessId) throw new Error('Missing facebook_business_id')

  return await listBusinessAdAccounts({
    businessId,
    accessToken,
    graphVersion,
  })
}

export async function syncFacebookBusinessCampaigns(opts: {
  organizationId: string
  businessId: string
  accountIds?: string[]
}): Promise<{
  ad_accounts: number
  owned_ad_accounts: number
  client_ad_accounts: number
  campaigns_upserted: number
}> {
  const { prisma } = await import('@/db')

  const accessToken = requireEnv('FACEBOOK_ADS_ACCESS_TOKEN')
  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION ?? 'v20.0'
  const businessId = opts.businessId.trim()
  if (!businessId) throw new Error('Missing facebook_business_id')

  const explicitAccounts = (opts.accountIds ?? [])
    .map((id) => normalizeAdAccountId(id))
    .filter((id) => id.length > 0)

  const adAccountsResult =
    explicitAccounts.length > 0
      ? {
          accounts: Array.from(
            new Map(explicitAccounts.map((id) => [id, { id, name: null }])).values(),
          ),
          owned_error: null,
          client_error: null,
          owned_count: 0,
          client_count: 0,
        }
      : await listBusinessAdAccounts({
          businessId,
          accessToken,
          graphVersion,
        })

  const adAccounts = adAccountsResult.accounts

  const syncedAt = dayjs().toDate()
  let campaignsUpserted = 0

  for (const account of adAccounts) {
    const campaignsParams = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,name,status,effective_status',
      limit: '500',
    })
    const campaignsUrl = `https://graph.facebook.com/${graphVersion}/${account.id}/campaigns?${campaignsParams.toString()}`
    const campaignsRes = await fetchGraphAll(campaignsUrl)

    for (const row of campaignsRes) {
      const id = row.id
      if (typeof id !== 'string' && typeof id !== 'number') continue
      const campaignId = String(id)
      const name = typeof row.name === 'string' ? row.name : null
      const status = mapFacebookStatus(
        typeof row.status !== 'undefined' ? row.status : row.effective_status,
      )

      await prisma.campaigns.upsert({
        where: {
          organization_id_platform_campaign_id: {
            organization_id: opts.organizationId,
            platform: 'facebook_ads',
            campaign_id: campaignId,
          },
        },
        create: {
          organization_id: opts.organizationId,
          platform: 'facebook_ads',
          campaign_id: campaignId,
          campaign_name: name,
          status,
          last_synced_at: syncedAt,
        },
        update: {
          campaign_name: name ?? undefined,
          status,
          last_synced_at: syncedAt,
        },
      })
      campaignsUpserted++
    }
  }

  return {
    ad_accounts: adAccounts.length,
    owned_ad_accounts: adAccountsResult.owned_count,
    client_ad_accounts: adAccountsResult.client_count,
    campaigns_upserted: campaignsUpserted,
  }
}

export async function syncFacebookAdsForOrganization(opts: {
  organizationId: string
  fromDate: string // YYYY-MM-DD
  toDate: string // YYYY-MM-DD
  businessId?: string
  accountIds?: string[]
}): Promise<{ campaigns_upserted: number; spend_rows_upserted: number }> {
  const { prisma } = await import('@/db')

  const accessToken = requireEnv('FACEBOOK_ADS_ACCESS_TOKEN')
  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION ?? 'v20.0'
  const baseUrl = `https://graph.facebook.com/${graphVersion}`

  const explicitAccounts = (opts.accountIds ?? [])
    .map((id) => normalizeAdAccountId(id))
    .filter((id) => id.length > 0)

  let accountIds: string[] = []
  if (explicitAccounts.length > 0) {
    accountIds = Array.from(new Set(explicitAccounts))
  } else if (opts.businessId) {
    const adAccountsResult = await listBusinessAdAccounts({
      businessId: opts.businessId,
      accessToken,
      graphVersion,
    })
    accountIds = adAccountsResult.accounts.map((a) => a.id)
  } else {
    const org = await prisma.organizations.findUniqueOrThrow({
      where: { id: opts.organizationId },
      select: { facebook_ads_account_id: true },
    })
    const accountIdRaw = org.facebook_ads_account_id ?? ''
    if (!accountIdRaw) {
      throw new Error('Missing organization facebook_ads_account_id')
    }
    accountIds = [normalizeAdAccountId(accountIdRaw)]
  }

  if (accountIds.length === 0) {
    throw new Error('No Facebook ad accounts available to sync')
  }

  const syncedAt = dayjs().toDate()
  let campaignsUpserted = 0
  let spendRowsUpserted = 0

  for (const accountId of accountIds) {
    const campaignsParams = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,name,status,effective_status',
      limit: '500',
    })
    const campaignsUrl = `${baseUrl}/${accountId}/campaigns?${campaignsParams.toString()}`
    const campaignsRes = await fetchGraphAll(campaignsUrl)

    for (const row of campaignsRes) {
      const id = row.id
      if (typeof id !== 'string' && typeof id !== 'number') continue
      const campaignId = String(id)
      const name = typeof row.name === 'string' ? row.name : null
      const status = mapFacebookStatus(
        typeof row.status !== 'undefined' ? row.status : row.effective_status,
      )

      await prisma.campaigns.upsert({
        where: {
          organization_id_platform_campaign_id: {
            organization_id: opts.organizationId,
            platform: 'facebook_ads',
            campaign_id: campaignId,
          },
        },
        create: {
          organization_id: opts.organizationId,
          platform: 'facebook_ads',
          campaign_id: campaignId,
          campaign_name: name,
          status,
          last_synced_at: syncedAt,
        },
        update: {
          campaign_name: name ?? undefined,
          status,
          last_synced_at: syncedAt,
        },
      })
      campaignsUpserted++
    }

    const insightsParams = new URLSearchParams({
      access_token: accessToken,
      level: 'campaign',
      time_increment: '1',
      fields: 'campaign_id,campaign_name,spend,account_currency,date_start',
      limit: '500',
    })
    insightsParams.set('time_range[since]', opts.fromDate)
    insightsParams.set('time_range[until]', opts.toDate)

    const insightsUrl = `${baseUrl}/${accountId}/insights?${insightsParams.toString()}`
    const insightsRes = await fetchGraphAll(insightsUrl)

    for (const row of insightsRes) {
      const campaignIdRaw = row.campaign_id
      if (typeof campaignIdRaw !== 'string' && typeof campaignIdRaw !== 'number')
        continue
      const campaignId = String(campaignIdRaw)

      const dateStart = row.date_start
      const dateValue =
        typeof dateStart === 'string'
          ? dateStart
          : typeof row.date === 'string'
            ? row.date
            : null
      if (!dateValue) continue

      const dateObj = dayjs(`${dateValue}T00:00:00.000Z`).toDate()
      const costCents = spendToCents(row.spend)

      const currencyCode =
        typeof row.account_currency === 'string'
          ? row.account_currency
          : typeof row.currency === 'string'
            ? row.currency
            : null

      const campaignName =
        typeof row.campaign_name === 'string' ? row.campaign_name : null

      await prisma.ad_spend_daily.upsert({
        where: {
          organization_id_platform_campaign_id_date: {
            organization_id: opts.organizationId,
            platform: 'facebook_ads',
            campaign_id: campaignId,
            date: dateObj,
          },
        },
        create: {
          organization_id: opts.organizationId,
          platform: 'facebook_ads',
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
  }

  return {
    campaigns_upserted: campaignsUpserted,
    spend_rows_upserted: spendRowsUpserted,
  }
}
