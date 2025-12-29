import { createServerFn } from '@tanstack/react-start'
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import type { QueryClient } from '@tanstack/react-query'

// ============================================================================
// Schemas
// ============================================================================

export const getRevenueByDateRangeSchema = z.object({
  companyId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  groupBy: z.enum(['hour', 'day', 'week', 'month', 'year']),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get revenue by date range grouped by day, week, month, or year
 */
export const getRevenueByDateRange = createServerFn({ method: 'GET' })
  .inputValidator(getRevenueByDateRangeSchema)
  .handler(async ({ data }) => {
    const { companyId, startDate, endDate, groupBy } = data

    // Build the date truncation SQL based on groupBy
    const dateTruncSql =
      groupBy === 'hour'
        ? 'DATE_TRUNC(\'hour\', pur."purchased_at")'
        : groupBy === 'day'
          ? 'DATE_TRUNC(\'day\', pur."purchased_at")'
          : groupBy === 'week'
            ? 'DATE_TRUNC(\'week\', pur."purchased_at")'
            : groupBy === 'month'
              ? 'DATE_TRUNC(\'month\', pur."purchased_at")'
              : 'DATE_TRUNC(\'year\', pur."purchased_at")'

    const results = await prisma.$queryRawUnsafe<
      Array<{
        date: Date
        revenue_cents: string
        payment_count: number
      }>
    >(
      `
      SELECT
        ${dateTruncSql}::date as date,
        COALESCE(SUM(pur."amount_in_cents"), 0) as revenue_cents,
        COUNT(*)::int as payment_count
      FROM "purchase" pur
      INNER JOIN "person" p ON pur."person_id" = p."id"
      WHERE p."company_id" = $1
        AND pur."purchased_at" >= $2
        AND pur."purchased_at" <= $3
      GROUP BY ${dateTruncSql}
      ORDER BY date ASC
    `,
      companyId,
      startDate,
      endDate,
    )

    console.log('results', results)

    return results.map((row) => {
      const revenueCents = parseFloat(row.revenue_cents)

      return {
        date: row.date.toISOString(),
        revenueCents,
        revenueDollars: revenueCents / 100,
        paymentCount: row.payment_count,
      }
    })
  })

// ============================================================================
// Collection
// ============================================================================

export function createFinancialsCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      id: 'financials',
      queryKey: ['financials'],
      syncMode: 'on-demand',
      queryFn: async () => {
        // This collection is query-only, no data loaded by default
        return []
      },
      queryClient,
      getKey: (item: any) => item?.id || '',
    }),
  )
}
