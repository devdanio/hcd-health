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
  groupBy: z.enum(['day', 'week', 'month', 'year']),
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
      groupBy === 'day'
        ? "DATE_TRUNC('day', p.\"posted_date\")"
        : groupBy === 'week'
          ? "DATE_TRUNC('week', p.\"posted_date\")"
          : groupBy === 'month'
            ? "DATE_TRUNC('month', p.\"posted_date\")"
            : "DATE_TRUNC('year', p.\"posted_date\")"

    const results = await prisma.$queryRawUnsafe<
      Array<{
        date: Date
        revenue_cents: number
        payment_count: number
      }>
    >(
      `
      SELECT
        ${dateTruncSql}::date as date,
        COALESCE(SUM(p."amountInCents"), 0)::int as revenue_cents,
        COUNT(*)::int as payment_count
      FROM "Payments" p
      WHERE p."companyId" = $1
        AND p."posted_date" >= $2
        AND p."posted_date" <= $3
        AND p.status = 'posted'
      GROUP BY ${dateTruncSql}
      ORDER BY date ASC
    `,
      companyId,
      startDate,
      endDate,
    )

    return results.map((row) => ({
      date: row.date.toISOString(),
      revenueCents: row.revenue_cents,
      revenueDollars: row.revenue_cents / 100,
      paymentCount: row.payment_count,
    }))
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
