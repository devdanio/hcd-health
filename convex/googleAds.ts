/**
 * Google Ads OAuth 2.0 integration
 * Handles OAuth flow, token management, and account connection
 */

import { v } from 'convex/values'
import { action, mutation, query } from './_generated/server'
import { api } from './_generated/api'
import { Id } from './_generated/dataModel'
import { encryptToken, decryptToken } from './lib/encryption'

/**
 * Generate a secure random string for OAuth state parameter
 */
function generateSecureState(companyId: Id<'companies'>): string {
  // Create state as base64(companyId:randomNonce)
  const randomBytes = new Uint8Array(16)
  crypto.getRandomValues(randomBytes)
  const randomHex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const stateData = `${companyId}:${randomHex}`
  return btoa(stateData)
}

/**
 * Generate OAuth URL for Google Ads authorization
 */
export const generateOAuthUrl = action({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID
    const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI

    if (!clientId || !redirectUri) {
      throw new Error(
        'Missing Google Ads OAuth credentials. ' +
        'Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_REDIRECT_URI environment variables.'
      )
    }

    // Generate cryptographically secure state parameter
    const state = generateSecureState(args.companyId)

    // Store state in database with 10-minute expiry
    const expiresAt = Date.now() + 10 * 60 * 1000
    await ctx.runMutation(api.googleAds.storeOAuthState, {
      state,
      companyId: args.companyId,
      expiresAt,
    })

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/adwords',
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent screen to ensure refresh token
      state,
    })

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return { oauthUrl }
  },
})

/**
 * Store OAuth state for CSRF validation
 */
export const storeOAuthState = mutation({
  args: {
    state: v.string(),
    companyId: v.id('companies'),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('oauthStates', {
      state: args.state,
      companyId: args.companyId,
      expiresAt: args.expiresAt,
    })
  },
})

/**
 * Validate OAuth state parameter
 */
export const validateOAuthState = query({
  args: {
    state: v.string(),
  },
  handler: async (ctx, args) => {
    const oauthState = await ctx.db
      .query('oauthStates')
      .withIndex('state', (q) => q.eq('state', args.state))
      .first()

    if (!oauthState) {
      return null
    }

    // Check if expired
    if (oauthState.expiresAt < Date.now()) {
      return null
    }

    return oauthState
  },
})

/**
 * Delete used OAuth state
 */
export const deleteOAuthState = mutation({
  args: {
    state: v.string(),
  },
  handler: async (ctx, args) => {
    const oauthState = await ctx.db
      .query('oauthStates')
      .withIndex('state', (q) => q.eq('state', args.state))
      .first()

    if (oauthState) {
      await ctx.db.delete(oauthState._id)
    }
  },
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

  const data = await response.json()

  if (!data.refresh_token) {
    throw new Error(
      'No refresh token received. User may have already authorized this app. ' +
      'Try revoking access at https://myaccount.google.com/permissions and reconnecting.'
    )
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  }
}

/**
 * Fetch Google Ads account information
 */
async function fetchGoogleAdsAccountInfo(accessToken: string): Promise<{
  customerId: string
  accountName: string
  currencyCode: string
  timeZone: string
}> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN

  if (!developerToken) {
    throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN environment variable')
  }

  let customerId: string | undefined

  // Try to get accessible customers (accounts)
  try {
    const customersResponse = await fetch(
      'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
        },
      }
    )

    if (customersResponse.ok) {
      const customersData = await customersResponse.json()
      const customerResourceNames = customersData.resourceNames || []

      if (customerResourceNames.length > 0) {
        // Extract customer ID from first account (format: customers/1234567890)
        customerId = customerResourceNames[0].split('/')[1]
      }
    } else {
      const error = await customersResponse.json()
      console.log('listAccessibleCustomers failed:', error)

      // If we get a 501 or UNIMPLEMENTED error, try fallback to env var
      if (error.error?.code === 501 || error.error?.status === 'UNIMPLEMENTED') {
        console.log('Using fallback customer ID from environment variable')
        customerId = process.env.GOOGLE_ADS_CUSTOMER_ID
      }
    }
  } catch (error: any) {
    console.log('Error calling listAccessibleCustomers:', error)
    // Try fallback to environment variable
    customerId = process.env.GOOGLE_ADS_CUSTOMER_ID
  }

  // If we still don't have a customer ID, check environment variable
  if (!customerId) {
    customerId = process.env.GOOGLE_ADS_CUSTOMER_ID
  }

  if (!customerId) {
    throw new Error(
      'Unable to determine Google Ads Customer ID. Please add GOOGLE_ADS_CUSTOMER_ID to your environment variables. ' +
      'Find your Customer ID at https://ads.google.com (top right corner, format: 123-456-7890). ' +
      'Add it without dashes to your .env.local file as: GOOGLE_ADS_CUSTOMER_ID=1234567890'
    )
  }

  // Remove any dashes from customer ID
  customerId = customerId.replace(/-/g, '')

  // Fetch account details
  const query = `
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.currency_code,
      customer.time_zone
    FROM customer
    WHERE customer.id = ${customerId}
  `

  const accountResponse = await fetch(
    `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'developer-token': developerToken,
        'login-customer-id': customerId,
      },
      body: JSON.stringify({ query }),
    }
  )

  if (!accountResponse.ok) {
    const error = await accountResponse.json()
    throw new Error(`Failed to fetch account details: ${JSON.stringify(error)}`)
  }

  const accountData = await accountResponse.json()
  const result = accountData.results?.[0]

  if (!result) {
    throw new Error('Failed to retrieve account information')
  }

  return {
    customerId,
    accountName: result.customer.descriptiveName || 'Unknown Account',
    currencyCode: result.customer.currencyCode || 'USD',
    timeZone: result.customer.timeZone || 'America/Los_Angeles',
  }
}

/**
 * Handle OAuth callback - exchange code for tokens and store in database
 * Note: This only stores tokens. User must select account in next step.
 */
export const handleOAuthCallback = action({
  args: {
    code: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args): Promise<{ companyId: Id<'companies'> }> => {
    // 1. Validate state and get companyId
    const oauthState = await ctx.runQuery(api.googleAds.validateOAuthState, {
      state: args.state,
    })

    if (!oauthState) {
      throw new Error('Invalid or expired OAuth state. Please try connecting again.')
    }

    try {
      // 2. Exchange authorization code for tokens
      const tokens = await exchangeCodeForTokens(args.code)

      // 3. Encrypt tokens before storage
      const encryptedAccessToken = await encryptToken(tokens.access_token)
      const encryptedRefreshToken = await encryptToken(tokens.refresh_token)

      // 4. Store tokens in database (without account selection yet)
      await ctx.runMutation(api.googleAds.saveGoogleAdsTokens, {
        companyId: oauthState.companyId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      })

      // 5. Clean up OAuth state
      await ctx.runMutation(api.googleAds.deleteOAuthState, {
        state: args.state,
      })

      return { companyId: oauthState.companyId }
    } catch (error: any) {
      // Clean up OAuth state even on error
      await ctx.runMutation(api.googleAds.deleteOAuthState, {
        state: args.state,
      })
      throw error
    }
  },
})

/**
 * Save Google Ads tokens to database (without account selection)
 */
export const saveGoogleAdsTokens = mutation({
  args: {
    companyId: v.id('companies'),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.companyId, {
      googleAds: {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiresAt: args.tokenExpiresAt,
        connectedAt: Date.now(),
      },
    })
  },
})

/**
 * List all accessible Google Ads accounts
 */
export const listAccessibleAccounts = action({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args): Promise<Array<{
    customerId: string
    accountName: string
    currencyCode: string
    timeZone: string
    isManager: boolean
  }>> => {
    const company = await ctx.runQuery(api.companies.getCompany, {
      companyId: args.companyId,
    })

    if (!company?.googleAds) {
      throw new Error('Google Ads not connected. Please connect first.')
    }

    // Check if access token is expired and refresh if needed
    const now = Date.now()
    const tokenExpiresAt = company.googleAds.tokenExpiresAt

    // Refresh token if it's expired or will expire in the next 5 minutes
    if (tokenExpiresAt < now + 5 * 60 * 1000) {
      console.log('Access token expired or expiring soon, refreshing...')
      try {
        await ctx.runAction(api.googleAds.refreshAccessToken, {
          companyId: args.companyId,
        })

        // Re-fetch company to get the new access token
        const updatedCompany = await ctx.runQuery(api.companies.getCompany, {
          companyId: args.companyId,
        })

        if (!updatedCompany?.googleAds) {
          throw new Error('Failed to refresh token')
        }

        // Decrypt the refreshed access token
        const accessToken = await decryptToken(updatedCompany.googleAds.accessToken)
        return await listAccountsWithToken(ctx, args.companyId, accessToken)
      } catch (error: any) {
        console.error('Token refresh failed:', error)
        throw new Error(`Token refresh failed: ${error.message}`)
      }
    }

    // Token is still valid, use it
    const accessToken = await decryptToken(company.googleAds.accessToken)
    return await listAccountsWithToken(ctx, args.companyId, accessToken)
  },
})

/**
 * Helper function to list accounts with a given access token
 */
async function listAccountsWithToken(
  ctx: any,
  companyId: Id<'companies'>,
  accessToken: string
): Promise<Array<{
  customerId: string
  accountName: string
  currencyCode: string
  timeZone: string
  isManager: boolean
}>> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN

  if (!developerToken) {
    throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN')
  }

  // Get accessible customers
  const customersResponse = await fetch(
    'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
      },
    }
  )

  if (!customersResponse.ok) {
    const error = await customersResponse.json()

    // If we get 501/UNIMPLEMENTED, return empty array to trigger manual input UI
    if (error.error?.code === 501 || error.error?.status === 'UNIMPLEMENTED') {
      console.log('listAccessibleCustomers not supported with test token, returning empty array')
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
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': developerToken,
            'login-customer-id': customerId,
          },
          body: JSON.stringify({ query }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const result = data.results?.[0]

        if (result) {
          accounts.push({
            customerId,
            accountName: result.customer.descriptiveName || `Account ${customerId}`,
            currencyCode: result.customer.currencyCode || 'USD',
            timeZone: result.customer.timeZone || 'America/Los_Angeles',
            isManager: result.customer.manager || false,
          })
        }
      }
    } catch (error) {
      console.error(`Failed to fetch details for ${customerId}:`, error)
      // Continue with other accounts
    }
  }

  return accounts
}

/**
 * Select a Google Ads account
 */
export const selectAccount = action({
  args: {
    companyId: v.id('companies'),
    customerId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const company = await ctx.runQuery(api.companies.getCompany, {
      companyId: args.companyId,
    })

    if (!company?.googleAds) {
      throw new Error('Google Ads not connected')
    }

    // Check if access token is expired and refresh if needed
    const now = Date.now()
    const tokenExpiresAt = company.googleAds.tokenExpiresAt

    let accessToken: string

    // Refresh token if it's expired or will expire in the next 5 minutes
    if (tokenExpiresAt < now + 5 * 60 * 1000) {
      console.log('Access token expired or expiring soon, refreshing...')
      try {
        await ctx.runAction(api.googleAds.refreshAccessToken, {
          companyId: args.companyId,
        })

        // Re-fetch company to get the new access token
        const updatedCompany = await ctx.runQuery(api.companies.getCompany, {
          companyId: args.companyId,
        })

        if (!updatedCompany?.googleAds) {
          throw new Error('Failed to refresh token')
        }

        accessToken = await decryptToken(updatedCompany.googleAds.accessToken)
      } catch (error: any) {
        console.error('Token refresh failed:', error)
        throw new Error(`Token refresh failed: ${error.message}`)
      }
    } else {
      // Token is still valid, use it
      accessToken = await decryptToken(company.googleAds.accessToken)
    }

    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN

    if (!developerToken) {
      throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN')
    }

    // Try to fetch account details
    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone
      FROM customer
      WHERE customer.id = ${args.customerId}
    `

    let accountName = `Account ${args.customerId}`
    let currencyCode = 'USD'
    let timeZone = 'America/Los_Angeles'

    try {
      const response = await fetch(
        `https://googleads.googleapis.com/v18/customers/${args.customerId}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': developerToken,
            'login-customer-id': args.customerId,
          },
          body: JSON.stringify({ query }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const result = data.results?.[0]

        if (result) {
          accountName = result.customer.descriptiveName || accountName
          currencyCode = result.customer.currencyCode || currencyCode
          timeZone = result.customer.timeZone || timeZone
        }
      } else {
        const error = await response.json()

        // If we get 501/UNIMPLEMENTED (test token), use defaults
        if (error.error?.code === 501 || error.error?.status === 'UNIMPLEMENTED') {
          console.log('Cannot fetch account details with test token, using defaults')
          // Continue with default values
        } else {
          // For other errors, throw
          throw new Error(`Failed to fetch account details: ${JSON.stringify(error)}`)
        }
      }
    } catch (error: any) {
      // If it's our own thrown error, re-throw it
      if (error.message?.includes('Failed to fetch account details')) {
        throw error
      }
      // For network errors or other issues with test tokens, use defaults
      console.log('Error fetching account details, using defaults:', error)
    }

    // Update company with selected account (using fetched details or defaults)
    await ctx.runMutation(api.googleAds.updateSelectedAccount, {
      companyId: args.companyId,
      customerId: args.customerId,
      accountName,
      currencyCode,
      timeZone,
    })

    return { success: true }
  },
})

/**
 * Update selected account in database
 */
export const updateSelectedAccount = mutation({
  args: {
    companyId: v.id('companies'),
    customerId: v.string(),
    accountName: v.string(),
    currencyCode: v.string(),
    timeZone: v.string(),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId)

    if (!company?.googleAds) {
      throw new Error('Google Ads not connected')
    }

    await ctx.db.patch(args.companyId, {
      googleAds: {
        ...company.googleAds,
        customerId: args.customerId,
        accountName: args.accountName,
        currencyCode: args.currencyCode,
        timeZone: args.timeZone,
        accountSelectedAt: Date.now(),
      },
    })
  },
})

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = action({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    // 1. Get current tokens from database
    const company = await ctx.runQuery(api.companies.getCompany, {
      companyId: args.companyId,
    })

    if (!company?.googleAds) {
      throw new Error('No Google Ads connection found')
    }

    // 2. Decrypt refresh token
    const refreshToken = await decryptToken(company.googleAds.refreshToken)

    // 3. Request new access token
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error('Missing Google Ads OAuth credentials')
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
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
      await ctx.runMutation(api.googleAds.updateLastError, {
        companyId: args.companyId,
        error: `Token refresh failed: ${error.error_description || error.error}`,
      })

      throw new Error(`Token refresh failed: ${JSON.stringify(error)}`)
    }

    const data = await response.json()

    // 4. Encrypt new access token
    const encryptedAccessToken = await encryptToken(data.access_token)

    // 5. Update database
    await ctx.runMutation(api.googleAds.updateAccessToken, {
      companyId: args.companyId,
      accessToken: encryptedAccessToken,
      tokenExpiresAt: Date.now() + data.expires_in * 1000,
    })

    return { success: true }
  },
})

/**
 * Update access token after refresh
 */
export const updateAccessToken = mutation({
  args: {
    companyId: v.id('companies'),
    accessToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId)

    if (!company?.googleAds) {
      throw new Error('No Google Ads connection found')
    }

    await ctx.db.patch(args.companyId, {
      googleAds: {
        ...company.googleAds,
        accessToken: args.accessToken,
        tokenExpiresAt: args.tokenExpiresAt,
        lastSyncedAt: Date.now(),
      },
    })
  },
})

/**
 * Update last error in Google Ads connection
 */
export const updateLastError = mutation({
  args: {
    companyId: v.id('companies'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId)

    if (!company?.googleAds) {
      throw new Error('No Google Ads connection found')
    }

    await ctx.db.patch(args.companyId, {
      googleAds: {
        ...company.googleAds,
        lastError: args.error,
        lastErrorAt: Date.now(),
      },
    })
  },
})

/**
 * Ensure valid token - refresh if expiring soon
 */
export const ensureValidToken = action({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args): Promise<any> => {
    const company = await ctx.runQuery(api.companies.getCompany, {
      companyId: args.companyId,
    })

    if (!company?.googleAds) {
      throw new Error('Google Ads not connected')
    }

    // Check if token expires in next 5 minutes
    const buffer = 5 * 60 * 1000
    if (company.googleAds.tokenExpiresAt < Date.now() + buffer) {
      // Refresh proactively
      await ctx.runAction(api.googleAds.refreshAccessToken, {
        companyId: args.companyId,
      })

      // Fetch updated company
      const updatedCompany = await ctx.runQuery(api.companies.getCompany, {
        companyId: args.companyId,
      })

      return updatedCompany
    }

    return company
  },
})

/**
 * Revoke Google OAuth token
 */
async function revokeGoogleToken(accessToken: string): Promise<void> {
  const response = await fetch(
    `https://oauth2.googleapis.com/revoke?token=${accessToken}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )

  if (!response.ok) {
    // Log but don't throw - best effort revocation
    console.error('Failed to revoke Google token:', await response.text())
  }
}

/**
 * Disconnect Google Ads integration
 */
export const disconnectGoogleAds = action({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const company = await ctx.runQuery(api.companies.getCompany, {
      companyId: args.companyId,
    })

    if (!company?.googleAds) {
      return { success: true } // Already disconnected
    }

    // 1. Revoke tokens with Google (best effort)
    try {
      const accessToken = await decryptToken(company.googleAds.accessToken)
      await revokeGoogleToken(accessToken)
    } catch (error) {
      console.error('Failed to revoke Google token:', error)
      // Continue with local cleanup even if revocation fails
    }

    // 2. Remove from database
    await ctx.runMutation(api.googleAds.removeGoogleAdsConnection, {
      companyId: args.companyId,
    })

    return { success: true }
  },
})

/**
 * Remove Google Ads connection from database
 */
export const removeGoogleAdsConnection = mutation({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId)

    if (!company) {
      throw new Error('Company not found')
    }

    // Remove googleAds field
    await ctx.db.patch(args.companyId, {
      googleAds: undefined,
    })
  },
})

/**
 * Get list of Google Ads campaigns
 */
export const getCampaigns = action({
  args: {
    companyId: v.id('companies'),
  },
  handler: async (ctx, args): Promise<Array<{
    id: string
    name: string
    status: string
    advertisingChannelType: string
    biddingStrategyType: string
    budget: {
      id: string
      name: string
      amountMicros: number
      deliveryMethod: string
    } | null
    startDate: string
    endDate: string | null
  }>> => {
    // Ensure valid token (refresh if needed)
    const company = await ctx.runAction(api.googleAds.ensureValidToken, {
      companyId: args.companyId,
    })

    if (!company?.googleAds) {
      throw new Error('Google Ads not connected. Please connect your Google Ads account first.')
    }

    if (!company.googleAds.customerId) {
      throw new Error('No Google Ads account selected. Please select an account in settings.')
    }

    // Decrypt access token
    const accessToken = await decryptToken(company.googleAds.accessToken)
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN

    if (!developerToken) {
      throw new Error('Missing GOOGLE_ADS_DEVELOPER_TOKEN')
    }

    const customerId = company.googleAds.customerId

    // GAQL query to fetch campaigns with relevant fields
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

    try {
      const response = await fetch(
        `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': developerToken,
            'login-customer-id': customerId,
          },
          body: JSON.stringify({ query }),
        }
      )

      if (!response.ok) {
        const error = await response.json()

        // Handle test token limitations
        if (error.error?.code === 501 || error.error?.status === 'UNIMPLEMENTED') {
          throw new Error(
            'Cannot fetch campaigns with test developer token. ' +
            'Please apply for a production Google Ads developer token at ads.google.com (Tools > API Center).'
          )
        }

        throw new Error(`Failed to fetch campaigns: ${JSON.stringify(error)}`)
      }

      const data = await response.json()
      const results = data.results || []

      // Transform the results into a cleaner format
      const campaigns = results.map((result: any) => ({
        id: result.campaign.id,
        name: result.campaign.name,
        status: result.campaign.status,
        advertisingChannelType: result.campaign.advertisingChannelType,
        biddingStrategyType: result.campaign.biddingStrategyType,
        budget: result.campaignBudget ? {
          id: result.campaignBudget.id,
          name: result.campaignBudget.name,
          amountMicros: parseInt(result.campaignBudget.amountMicros),
          deliveryMethod: result.campaignBudget.deliveryMethod,
        } : null,
        startDate: result.campaign.startDate,
        endDate: result.campaign.endDate || null,
      }))

      return campaigns
    } catch (error: any) {
      console.error('Error fetching campaigns:', error)
      throw error
    }
  },
})
