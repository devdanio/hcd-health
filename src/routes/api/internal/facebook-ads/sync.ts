import dayjs from 'dayjs'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { env } from '@/env'
import { prisma } from '@/db'
import { syncFacebookAdsForOrganization } from '@/server/ri/syncFacebookAds'

const inputSchema = z.object({
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export const Route = createFileRoute('/api/internal/facebook-ads/sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get('x-cron-secret')
        if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
          return json(401, { error: 'Unauthorized' })
        }

        let body: unknown = {}
        try {
          body = await request.json()
        } catch {
          body = {}
        }

        const parsed = inputSchema.safeParse(body)
        if (!parsed.success) {
          return json(400, { error: parsed.error.message })
        }

        const defaultDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
        const from = parsed.data.from_date ?? defaultDate
        const to = parsed.data.to_date ?? defaultDate

        const [orgs, settingsRows] = await Promise.all([
          prisma.organizations.findMany({
            select: { id: true, facebook_ads_account_id: true },
          }),
          prisma.organization_settings.findMany({
            select: { organization_id: true, config_json: true },
          }),
        ])

        const settingsByOrgId = new Map(
          settingsRows.map((row) => [row.organization_id, row.config_json] as const),
        )

        const results: Array<{
          organization_id: string
          ok: boolean
          campaigns_upserted?: number
          spend_rows_upserted?: number
          error?: string
        }> = []

        for (const org of orgs) {
          const config = (settingsByOrgId.get(org.id) ?? {}) as Record<string, unknown>
          const businessId =
            typeof config.facebook_business_id === 'string'
              ? config.facebook_business_id
              : undefined
          const accountIds = Array.isArray(config.facebook_ad_account_ids)
            ? config.facebook_ad_account_ids.filter(
                (id): id is string => typeof id === 'string',
              )
            : []

          if (!org.facebook_ads_account_id && !businessId && accountIds.length === 0) {
            continue
          }

          try {
            const r = await syncFacebookAdsForOrganization({
              organizationId: org.id,
              fromDate: from,
              toDate: to,
              businessId,
              accountIds,
            })
            results.push({
              organization_id: org.id,
              ok: true,
              campaigns_upserted: r.campaigns_upserted,
              spend_rows_upserted: r.spend_rows_upserted,
            })
          } catch (err) {
            results.push({
              organization_id: org.id,
              ok: false,
              error: err instanceof Error ? err.message : 'Unknown error',
            })
          }
        }

        return json(200, { ok: true, from_date: from, to_date: to, results })
      },
    },
  },
})
