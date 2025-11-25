/**
 * Google Ads API client
 * Provides functions to fetch campaign data, conversions, and account structure
 */

import { v } from 'convex/values'
import { action } from './_generated/server'
import { api } from './_generated/api'
import { decryptToken } from './lib/encryption'

const GOOGLE_ADS_API_VERSION = 'v18'
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`

/**
 * Check if error is a rate limit error
 */
function isRateLimitError(error: any): boolean {
  return (
    error.message?.includes('429') ||
    error.message?.includes('RATE_LIMIT') ||
    error.message?.includes('rate_limit_exceeded')
  )
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Make authenticated request to Google Ads API
 */
async function makeGoogleAdsRequest(
  accessToken: string,
  customerId: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN

  if (!developerToken) {
    throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN environment variable')
  }

  const url = `${GOOGLE_ADS_API_BASE}/customers/${customerId}/${endpoint}`

  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'developer-token': developerToken,
      'login-customer-id': customerId,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Google Ads API error: ${JSON.stringify(error)}`)
  }

  return await response.json()
}

/**
 * Make request with exponential backoff retry for rate limits
 */
async function makeGoogleAdsRequestWithRetry(
  accessToken: string,
  customerId: string,
  endpoint: string,
  body?: any,
  retries = 3
): Promise<any> {
  try {
    return await makeGoogleAdsRequest(accessToken, customerId, endpoint, body)
  } catch (error: any) {
    if (isRateLimitError(error) && retries > 0) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, 3 - retries) * 1000
      await sleep(delay)
      return makeGoogleAdsRequestWithRetry(
        accessToken,
        customerId,
        endpoint,
        body,
        retries - 1
      )
    }
    throw error
  }
}

/**
 * Get date string in YYYY-MM-DD format
 */
function getDateString(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().split('T')[0]
}

/**
 * Convert micros (1/1,000,000 of currency unit) to standard currency units
 */
function microsToUnits(micros: number): number {
  return micros / 1000000
}

/**
 * Get campaign performance metrics
 */
export const getCampaignPerformance = action({
  args: {
    companyId: v.id('companies'),
    dateRange: v.optional(
      v.object({
        startDate: v.string(), // YYYY-MM-DD
        endDate: v.string(), // YYYY-MM-DD
      })
    ),
  },
  handler: async (ctx, args): Promise<any> => {
    // 1. Ensure valid token (auto-refresh if needed)
    const company = await ctx.runAction(api.googleAds.ensureValidToken, {
      companyId: args.companyId,
    })

    if (!company?.googleAds) {
      throw new Error('Google Ads not connected')
    }

    // 2. Decrypt access token
    const accessToken = await decryptToken(company.googleAds.accessToken)

    // 3. Build date range
    const dateRange = args.dateRange || {
      startDate: getDateString(30), // Last 30 days
      endDate: getDateString(0), // Today
    }

    // 4. Build GAQL query
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.average_cpc,
        metrics.ctr,
        segments.date
      FROM campaign
      WHERE segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
      ORDER BY segments.date DESC
    `

    // 5. Make API request
    const result = await makeGoogleAdsRequestWithRetry(
      accessToken,
      company.googleAds.customerId,
      'googleAds:searchStream',
      { query }
    )

    // 6. Transform response
    const campaigns = (result.results || []).map((row: any) => ({
      campaignId: row.campaign.id,
      campaignName: row.campaign.name,
      status: row.campaign.status,
      date: row.segments.date,
      impressions: parseInt(row.metrics.impressions || '0'),
      clicks: parseInt(row.metrics.clicks || '0'),
      cost: microsToUnits(parseInt(row.metrics.costMicros || '0')),
      conversions: parseFloat(row.metrics.conversions || '0'),
      conversionsValue: parseFloat(row.metrics.conversionsValue || '0'),
      averageCpc: microsToUnits(parseInt(row.metrics.averageCpc || '0')),
      ctr: parseFloat(row.metrics.ctr || '0'),
    }))

    // Update last synced timestamp
    await ctx.runMutation(api.googleAds.updateAccessToken, {
      companyId: args.companyId,
      accessToken: company.googleAds.accessToken,
      tokenExpiresAt: company.googleAds.tokenExpiresAt,
    })

    return { campaigns, currencyCode: company.googleAds.currencyCode }
  },
})

/**
 * Get conversion tracking data
 */
export const getConversions = action({
  args: {
    companyId: v.id('companies'),
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      })
    ),
  },
  handler: async (ctx, args): Promise<any> => {
    // 1. Ensure valid token
    const company = await ctx.runAction(api.googleAds.ensureValidToken, {
      companyId: args.companyId,
    })

    if (!company?.googleAds) {
      throw new Error('Google Ads not connected')
    }

    // 2. Decrypt access token
    const accessToken = await decryptToken(company.googleAds.accessToken)

    // 3. Build date range
    const dateRange = args.dateRange || {
      startDate: getDateString(30),
      endDate: getDateString(0),
    }

    // 4. Build GAQL query
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        segments.conversion_action_name,
        segments.conversion_action_category,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_per_conversion,
        segments.date
      FROM campaign
      WHERE segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'
        AND metrics.conversions > 0
      ORDER BY segments.date DESC, metrics.conversions DESC
    `

    // 5. Make API request
    const result = await makeGoogleAdsRequestWithRetry(
      accessToken,
      company.googleAds.customerId,
      'googleAds:searchStream',
      { query }
    )

    // 6. Transform response
    const conversions = (result.results || []).map((row: any) => ({
      campaignId: row.campaign.id,
      campaignName: row.campaign.name,
      adGroupId: row.adGroup.id,
      adGroupName: row.adGroup.name,
      conversionActionName: row.segments.conversionActionName,
      conversionActionCategory: row.segments.conversionActionCategory,
      conversions: parseFloat(row.metrics.conversions || '0'),
      conversionsValue: parseFloat(row.metrics.conversionsValue || '0'),
      costPerConversion: microsToUnits(
        parseInt(row.metrics.costPerConversion || '0')
      ),
      date: row.segments.date,
    }))

    // Update last synced timestamp
    await ctx.runMutation(api.googleAds.updateAccessToken, {
      companyId: args.companyId,
      accessToken: company.googleAds.accessToken,
      tokenExpiresAt: company.googleAds.tokenExpiresAt,
    })

    return { conversions, currencyCode: company.googleAds.currencyCode }
  },
})

/**
 * Get account structure (campaigns and ad groups)
 */
export const getAccountStructure = action({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args): Promise<any> => {
    // 1. Ensure valid token
    const company = await ctx.runAction(api.googleAds.ensureValidToken, {
      companyId: args.companyId,
    })

    if (!company?.googleAds) {
      throw new Error('Google Ads not connected')
    }

    // 2. Decrypt access token
    const accessToken = await decryptToken(company.googleAds.accessToken)

    // 3. Build GAQL query
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        ad_group.id,
        ad_group.name,
        ad_group.status
      FROM ad_group
      ORDER BY campaign.name, ad_group.name
    `

    // 4. Make API request
    const result = await makeGoogleAdsRequestWithRetry(
      accessToken,
      company.googleAds.customerId,
      'googleAds:searchStream',
      { query }
    )

    // 5. Transform into hierarchical structure
    const campaignsMap = new Map()

    for (const row of result.results || []) {
      const campaignId = row.campaign.id
      const campaignName = row.campaign.name
      const campaignStatus = row.campaign.status
      const channelType = row.campaign.advertisingChannelType

      if (!campaignsMap.has(campaignId)) {
        campaignsMap.set(campaignId, {
          campaignId,
          campaignName,
          status: campaignStatus,
          channelType,
          adGroups: [],
        })
      }

      campaignsMap.get(campaignId).adGroups.push({
        adGroupId: row.adGroup.id,
        adGroupName: row.adGroup.name,
        status: row.adGroup.status,
      })
    }

    const campaigns = Array.from(campaignsMap.values())

    // Update last synced timestamp
    await ctx.runMutation(api.googleAds.updateAccessToken, {
      companyId: args.companyId,
      accessToken: company.googleAds.accessToken,
      tokenExpiresAt: company.googleAds.tokenExpiresAt,
    })

    return { campaigns }
  },
})
