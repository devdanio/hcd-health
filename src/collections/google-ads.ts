import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import { encryptToken, decryptToken } from '@/server/lib/encryption'

// ============================================================================
// Schemas
// ============================================================================

export const generateOAuthUrlSchema = z.object({
  companyId: z.string(),
})

export const handleOAuthCallbackSchema = z.object({
  code: z.string(),
  state: z.string(),
})

export const listAccessibleAccountsSchema = z.object({
  companyId: z.string(),
})

export const selectAccountSchema = z.object({
  companyId: z.string(),
  customerId: z.string(),
})

export const refreshAccessTokenSchema = z.object({
  companyId: z.string(),
})

export const disconnectGoogleAdsSchema = z.object({
  companyId: z.string(),
})

export const getCampaignsSchema = z.object({
  companyId: z.string(),
})

export const ensureValidTokenSchema = z.object({
  companyId: z.string(),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a secure random string for OAuth state parameter
 */
function generateSecureState(companyId: string): string {
  const randomBytes = new Uint8Array(16)
  crypto.getRandomValues(randomBytes)
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const stateData = `${companyId}:${randomHex}`
  return btoa(stateData)
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Generate OAuth URL for Google Ads authorization
 */
export const generateOAuthUrl = createServerFn({ method: 'POST' })
  .inputValidator(generateOAuthUrlSchema)
  .handler(async ({ data }) => {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID
    const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI

    if (!clientId || !redirectUri) {
      throw new Error(
        'Missing Google Ads OAuth credentials. Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_REDIRECT_URI environment variables.',
      )
    }

    // Generate cryptographically secure state parameter
    const state = generateSecureState(data.companyId)

    // Store state in database with 10-minute expiry
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 10)

    await prisma.oAuthState.create({
      data: {
        state,
        companyId: data.companyId,
        expiresAt,
      },
    })

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/adwords',
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return { oauthUrl }
  })

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Google Ads OAuth credentials in environment')
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`OAuth token exchange failed: ${JSON.stringify(error)}`)
  }

  const responseData = await response.json()

  if (!responseData.refresh_token) {
    throw new Error(
      'No refresh token received. User may have already authorized this app. Try revoking access at https://myaccount.google.com/permissions and reconnecting.',
    )
  }

  return {
    access_token: responseData.access_token,
    refresh_token: responseData.refresh_token,
    expires_in: responseData.expires_in,
  }
}

/**
 * Handle OAuth callback - exchange code for tokens and store in database
 */
export const handleOAuthCallback = createServerFn({ method: 'POST' })
  .inputValidator(handleOAuthCallbackSchema)
  .handler(async ({ data }) => {
    // 1. Validate state and get companyId
    const oauthState = await prisma.oAuthState.findUnique({
      where: { state: data.state },
    })

    if (!oauthState || oauthState.expiresAt < new Date()) {
      throw new Error(
        'Invalid or expired OAuth state. Please try connecting again.',
      )
    }

    try {
      // 2. Exchange authorization code for tokens
      const tokens = await exchangeCodeForTokens(data.code)

      // 3. Encrypt tokens before storage
      const encryptedAccessToken = await encryptToken(tokens.access_token)
      const encryptedRefreshToken = await encryptToken(tokens.refresh_token)

      const tokenExpiresAt = new Date()
      tokenExpiresAt.setSeconds(tokenExpiresAt.getSeconds() + tokens.expires_in)

      // 4. Store tokens in database
      await prisma.company.update({
        where: { id: oauthState.companyId },
        data: {
          googleAdsAccessToken: encryptedAccessToken,
          googleAdsRefreshToken: encryptedRefreshToken,
          googleAdsTokenExpiresAt: tokenExpiresAt,
          googleAdsConnectedAt: new Date(),
        },
      })

      // 5. Clean up OAuth state
      await prisma.oAuthState.delete({
        where: { state: data.state },
      })

      return { companyId: oauthState.companyId }
    } catch (error: any) {
      // Clean up OAuth state even on error
      await prisma.oAuthState
        .delete({
          where: { state: data.state },
        })
        .catch(() => {})
      throw error
    }
  })

/**
 * List all accessible Google Ads accounts
 */
export const listAccessibleAccounts = createServerFn({ method: 'POST' })
  .inputValidator(listAccessibleAccountsSchema)
  .handler(async ({ data }) => {
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
    })

    if (!company?.googleAdsAccessToken || !company?.googleAdsRefreshToken) {
      throw new Error('Google Ads not connected. Please connect first.')
    }

    // Check if access token is expired and refresh if needed
    const now = new Date()
    const tokenExpiresAt = company.googleAdsTokenExpiresAt

    let accessToken: string

    if (
      !tokenExpiresAt ||
      tokenExpiresAt < new Date(now.getTime() + 5 * 60 * 1000)
    ) {
      // Refresh token
      await refreshToken(data.companyId)
      const updatedCompany = await prisma.company.findUnique({
        where: { id: data.companyId },
      })
      if (!updatedCompany?.googleAdsAccessToken) {
        throw new Error('Failed to refresh token')
      }
      accessToken = await decryptToken(updatedCompany.googleAdsAccessToken)
    } else {
      accessToken = await decryptToken(company.googleAdsAccessToken)
    }

    return await listAccountsWithToken(accessToken)
  })

/**
 * Helper function to list accounts with a given access token
 */
async function listAccountsWithToken(accessToken: string): Promise<
  Array<{
    customerId: string
    accountName: string
    currencyCode: string
    timeZone: string
    isManager: boolean
  }>
> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN

  if (!developerToken) {
    throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN')
  }

  // Get accessible customers
  const customersResponse = await fetch(
    'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': developerToken,
      },
    },
  )

  if (!customersResponse.ok) {
    const error = await customersResponse.json()

    if (error.error?.code === 501 || error.error?.status === 'UNIMPLEMENTED') {
      return []
    }

    throw new Error(`Failed to list accounts: ${JSON.stringify(error)}`)
  }

  const customersData = await customersResponse.json()
  const customerResourceNames = customersData.resourceNames || []

  if (customerResourceNames.length === 0) {
    throw new Error('No Google Ads accounts found')
  }

  // Fetch details for each account
  const accounts = []
  for (const resourceName of customerResourceNames) {
    const customerId = resourceName.split('/')[1]

    try {
      const query = `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone,
          customer.manager
        FROM customer
        WHERE customer.id = ${customerId}
      `

      const response = await fetch(
        `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': developerToken,
            'login-customer-id': customerId,
          },
          body: JSON.stringify({ query }),
        },
      )

      if (response.ok) {
        const responseData = await response.json()
        const result = responseData.results?.[0]

        if (result) {
          accounts.push({
            customerId,
            accountName:
              result.customer.descriptiveName || `Account ${customerId}`,
            currencyCode: result.customer.currencyCode || 'USD',
            timeZone: result.customer.timeZone || 'America/Los_Angeles',
            isManager: result.customer.manager || false,
          })
        }
      }
    } catch (error) {
      console.error(`Failed to fetch details for ${customerId}:`, error)
    }
  }

  return accounts
}

/**
 * Select a Google Ads account
 */
export const selectAccount = createServerFn({ method: 'POST' })
  .inputValidator(selectAccountSchema)
  .handler(async ({ data }) => {
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
    })

    if (!company?.googleAdsAccessToken) {
      throw new Error('Google Ads not connected')
    }

    // Check if token needs refresh
    const now = new Date()
    const tokenExpiresAt = company.googleAdsTokenExpiresAt

    let accessToken: string

    if (
      !tokenExpiresAt ||
      tokenExpiresAt < new Date(now.getTime() + 5 * 60 * 1000)
    ) {
      await refreshToken(data.companyId)
      const updatedCompany = await prisma.company.findUnique({
        where: { id: data.companyId },
      })
      if (!updatedCompany?.googleAdsAccessToken) {
        throw new Error('Failed to refresh token')
      }
      accessToken = await decryptToken(updatedCompany.googleAdsAccessToken)
    } else {
      accessToken = await decryptToken(company.googleAdsAccessToken)
    }

    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN

    if (!developerToken) {
      throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN')
    }

    // Try to fetch account details
    let accountName = `Account ${data.customerId}`
    let currencyCode = 'USD'
    let timeZone = 'America/Los_Angeles'

    try {
      const query = `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone
        FROM customer
        WHERE customer.id = ${data.customerId}
      `

      const response = await fetch(
        `https://googleads.googleapis.com/v18/customers/${data.customerId}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': developerToken,
            'login-customer-id': data.customerId,
          },
          body: JSON.stringify({ query }),
        },
      )

      if (response.ok) {
        const responseData = await response.json()
        const result = responseData.results?.[0]

        if (result) {
          accountName = result.customer.descriptiveName || accountName
          currencyCode = result.customer.currencyCode || currencyCode
          timeZone = result.customer.timeZone || timeZone
        }
      }
    } catch (error) {
      console.log('Error fetching account details, using defaults:', error)
    }

    // Update company with selected account
    await prisma.company.update({
      where: { id: data.companyId },
      data: {
        googleAdsCustomerId: data.customerId,
        googleAdsAccountName: accountName,
        googleAdsCurrencyCode: currencyCode,
        googleAdsTimeZone: timeZone,
        googleAdsAccountSelectedAt: new Date(),
      },
    })

    return { success: true }
  })

/**
 * Refresh access token using refresh token (internal helper)
 */
async function refreshToken(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  })

  if (!company?.googleAdsRefreshToken) {
    throw new Error('No Google Ads connection found')
  }

  const refreshTokenStr = await decryptToken(company.googleAdsRefreshToken)

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing Google Ads OAuth credentials')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshTokenStr,
    grant_type: 'refresh_token',
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const error = await response.json()

    // Update last error in database
    await prisma.company.update({
      where: { id: companyId },
      data: {
        googleAdsLastError: `Token refresh failed: ${error.error_description || error.error}`,
        googleAdsLastErrorAt: new Date(),
      },
    })

    throw new Error(`Token refresh failed: ${JSON.stringify(error)}`)
  }

  const responseData = await response.json()

  // Encrypt new access token
  const encryptedAccessToken = await encryptToken(responseData.access_token)

  const tokenExpiresAt = new Date()
  tokenExpiresAt.setSeconds(
    tokenExpiresAt.getSeconds() + responseData.expires_in,
  )

  // Update database
  await prisma.company.update({
    where: { id: companyId },
    data: {
      googleAdsAccessToken: encryptedAccessToken,
      googleAdsTokenExpiresAt: tokenExpiresAt,
      googleAdsLastSyncedAt: new Date(),
    },
  })
}

/**
 * Refresh access token (public endpoint)
 */
export const refreshAccessToken = createServerFn({ method: 'POST' })
  .inputValidator(refreshAccessTokenSchema)
  .handler(async ({ data }) => {
    await refreshToken(data.companyId)
    return { success: true }
  })

/**
 * Disconnect Google Ads integration
 */
export const disconnectGoogleAds = createServerFn({ method: 'POST' })
  .inputValidator(disconnectGoogleAdsSchema)
  .handler(async ({ data }) => {
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
    })

    if (!company?.googleAdsAccessToken) {
      return { success: true }
    }

    // Revoke tokens with Google (best effort)
    try {
      const accessToken = await decryptToken(company.googleAdsAccessToken)
      await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
    } catch (error) {
      console.error('Failed to revoke Google token:', error)
    }

    // Remove from database
    await prisma.company.update({
      where: { id: data.companyId },
      data: {
        googleAdsAccessToken: null,
        googleAdsRefreshToken: null,
        googleAdsTokenExpiresAt: null,
        googleAdsCustomerId: null,
        googleAdsAccountName: null,
        googleAdsCurrencyCode: null,
        googleAdsTimeZone: null,
        googleAdsConnectedAt: null,
        googleAdsAccountSelectedAt: null,
        googleAdsLastSyncedAt: null,
        googleAdsLastError: null,
        googleAdsLastErrorAt: null,
      },
    })

    return { success: true }
  })

/**
 * Get list of Google Ads campaigns
 */
export const getCampaigns = createServerFn({ method: 'POST' })
  .inputValidator(getCampaignsSchema)
  .handler(async ({ data }) => {
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
    })

    if (!company?.googleAdsAccessToken || !company?.googleAdsCustomerId) {
      throw new Error('Google Ads not connected or no account selected')
    }

    // Check if token needs refresh
    const now = new Date()
    const tokenExpiresAt = company.googleAdsTokenExpiresAt

    let accessToken: string

    if (
      !tokenExpiresAt ||
      tokenExpiresAt < new Date(now.getTime() + 5 * 60 * 1000)
    ) {
      await refreshToken(data.companyId)
      const updatedCompany = await prisma.company.findUnique({
        where: { id: data.companyId },
      })
      if (!updatedCompany?.googleAdsAccessToken) {
        throw new Error('Failed to refresh token')
      }
      accessToken = await decryptToken(updatedCompany.googleAdsAccessToken)
    } else {
      accessToken = await decryptToken(company.googleAdsAccessToken)
    }

    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN

    if (!developerToken) {
      throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN')
    }

    const customerId = company.googleAdsCustomerId

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        campaign.start_date,
        campaign.end_date,
        campaign_budget.id,
        campaign_budget.name,
        campaign_budget.amount_micros,
        campaign_budget.delivery_method
      FROM campaign
      ORDER BY campaign.name
    `

    const response = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'developer-token': developerToken,
          'login-customer-id': customerId,
        },
        body: JSON.stringify({ query }),
      },
    )

    if (!response.ok) {
      const error = await response.json()

      if (
        error.error?.code === 501 ||
        error.error?.status === 'UNIMPLEMENTED'
      ) {
        throw new Error(
          'Cannot fetch campaigns with test developer token. Please apply for a production Google Ads developer token at ads.google.com (Tools > API Center).',
        )
      }

      throw new Error(`Failed to fetch campaigns: ${JSON.stringify(error)}`)
    }

    const responseData = await response.json()
    const results = responseData.results || []

    return results.map((result: any) => ({
      id: result.campaign.id,
      name: result.campaign.name,
      status: result.campaign.status,
      advertisingChannelType: result.campaign.advertisingChannelType,
      biddingStrategyType: result.campaign.biddingStrategyType,
      budget: result.campaignBudget
        ? {
            id: result.campaignBudget.id,
            name: result.campaignBudget.name,
            amountMicros: parseInt(result.campaignBudget.amountMicros),
            deliveryMethod: result.campaignBudget.deliveryMethod,
          }
        : null,
      startDate: result.campaign.startDate,
      endDate: result.campaign.endDate || null,
    }))
  })

/**
 * Ensure valid token - refresh if expiring soon
 */
export const ensureValidToken = createServerFn({ method: 'POST' })
  .inputValidator(ensureValidTokenSchema)
  .handler(async ({ data }) => {
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
    })

    if (!company?.googleAdsAccessToken) {
      throw new Error('Google Ads not connected')
    }

    const tokenExpiresAt = company.googleAdsTokenExpiresAt
    const buffer = 5 * 60 * 1000

    if (!tokenExpiresAt || tokenExpiresAt < new Date(Date.now() + buffer)) {
      await refreshToken(data.companyId)
      return await prisma.company.findUnique({
        where: { id: data.companyId },
      })
    }

    return company
  })
