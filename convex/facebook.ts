import { action } from './_generated/server'
import { v } from 'convex/values'

export const getAdSpend = action({
  args: {
    timeIncrement: v.optional(v.union(v.number(), v.literal('all_days'))),
    level: v.optional(v.union(v.literal('account'), v.literal('campaign'), v.literal('adset'), v.literal('ad'))),
  },
  handler: async (ctx, args) => {
    const adAccountId = process.env.FB_ACCOUNT_ID_THRIVE
    const accessToken = process.env.FB_ACCESS_TOKEN_THRIVE

    if (!adAccountId || !accessToken) {
      throw new Error('Missing Facebook credentials in environment variables')
    }

    // Ensure adAccountId starts with 'act_' if not provided
    const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
    
    const level = args.level || 'campaign'
    const timeIncrement = args.timeIncrement !== undefined ? `&time_increment=${args.timeIncrement}` : ''
    
    const url = `https://graph.facebook.com/v19.0/${accountId}/insights?level=${level}&fields=campaign_name,spend,impressions,clicks,cpc,cpm,ctr,date_start,date_stop&date_preset=last_30d&access_token=${accessToken}${timeIncrement}`

    const response = await fetch(url)
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Facebook API error: ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    return data
  },
})
