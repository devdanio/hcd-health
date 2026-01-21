'use client'

import * as React from 'react'
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { getRevenueByDateRange } from '@/collections'
import dayjs from 'dayjs'
import type { GroupBy } from '@/components/group-by-select'
import type { TimeRange } from '@/components/timeframe-select'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: '#10b981', // Emerald green
  },
} satisfies ChartConfig

interface RevenueChartProps {
  companyId: string
  timeRange: TimeRange
  groupBy: GroupBy
}

// Helper to get start date from TimeRange
function getStartDateFromTimeRange(timeRange: TimeRange): Date {
  switch (timeRange) {
    case '24h':
      return dayjs().subtract(24, 'hour').toDate()
    case '7d':
      return dayjs().subtract(7, 'day').toDate()
    case '14d':
      return dayjs().subtract(14, 'day').toDate()
    case '30d':
      return dayjs().subtract(30, 'day').toDate()
    case '90d':
      return dayjs().subtract(90, 'day').toDate()
    case '1y':
      return dayjs().subtract(1, 'year').toDate()
    case 'max':
      return new Date('2000-01-01') // Far enough in the past to get all data
  }
}

// Format date based on groupBy
function formatDate(dateStr: string, groupBy: GroupBy): string {
  const date = new Date(dateStr)

  switch (groupBy) {
    case 'hour':
      return date.toLocaleTimeString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        hour12: true,
      })
    case 'day':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    case 'week':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    case 'month':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    case 'year':
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
      })
  }
}

export function RevenueChart({
  companyId,
  timeRange,
  groupBy,
}: RevenueChartProps) {
  const { data: revenueData } = useQuery({
    queryKey: ['revenue', companyId, timeRange, groupBy],
    queryFn: () =>
      getRevenueByDateRange({
        data: {
          companyId,
          startDate: getStartDateFromTimeRange(timeRange),
          endDate: dayjs().toDate(),
          groupBy,
        },
      }),
  })

  // Transform data for the chart
  const chartData = React.useMemo(() => {
    if (!revenueData) return []
    return revenueData.map((item) => ({
      date: item.date,
      revenue: item.revenueDollars,
    }))
  }, [revenueData])

  const totalRevenue = React.useMemo(() => {
    if (!revenueData) return 0
    return revenueData.reduce((acc, curr) => acc + curr.revenueDollars, 0)
  }, [revenueData])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Revenue Over Time</CardTitle>
        <CardDescription>
          Total revenue: $
          {totalRevenue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <LineChart data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => formatDate(value, groupBy)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) =>
                `$${value.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`
              }
            />
            <ChartTooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatDate(value as string, groupBy)}
                  formatter={(value) => [
                    `$${(value as number).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`,
                    'Revenue',
                  ]}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={chartConfig.revenue.color}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
