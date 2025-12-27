'use client'

import * as React from 'react'
import { Bar, ComposedChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useLiveQuery, eq } from '@tanstack/react-db'
import { useCollections } from '@/routes/__root'
import dayjs from 'dayjs'

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
import { ExternalIdSource } from '@/generated/prisma/enums'
import type { TimeRange } from '@/components/timeframe-select'

// Helper function to get date range info from TimeRange
function getTimeRangeInfo(timeRange: TimeRange): {
  startDate: dayjs.Dayjs
  days: number
  label: string
} {
  const now = dayjs()
  switch (timeRange) {
    case '24h':
      return {
        startDate: now.subtract(24, 'hour'),
        days: 1,
        label: 'Last 24 Hours',
      }
    case '7d':
      return { startDate: now.subtract(7, 'day'), days: 7, label: 'Last 7 Days' }
    case '14d':
      return {
        startDate: now.subtract(14, 'day'),
        days: 14,
        label: 'Last 14 Days',
      }
    case '30d':
      return {
        startDate: now.subtract(30, 'day'),
        days: 30,
        label: 'Last 30 Days',
      }
    case '90d':
      return {
        startDate: now.subtract(90, 'day'),
        days: 90,
        label: 'Last 90 Days',
      }
    case '1y':
      return {
        startDate: now.subtract(1, 'year'),
        days: 365,
        label: 'Last Year',
      }
  }
}

const chartConfig = {
  patients: {
    label: 'Patients',
    color: '#10b981', // Emerald green
  },
} satisfies ChartConfig

// Check if contact is a patient based on externalIds
function isPatient(
  externalIds: Array<{ source: ExternalIdSource }>,
): boolean {
  if (!externalIds || externalIds.length === 0) {
    return false
  }

  const sources = externalIds.map((id) => id.source)

  // Check if it's a patient (has CHIROTOUCH, JASMINE, or UNIFIED_PRACTICE)
  return (
    sources.includes(ExternalIdSource.CHIROTOUCH) ||
    sources.includes(ExternalIdSource.JASMINE) ||
    sources.includes(ExternalIdSource.UNIFIED_PRACTICE)
  )
}

interface PatientsChartProps {
  companyId: string
  timeRange: TimeRange
}

export function LeadsPatientsChart({
  companyId,
  timeRange,
}: PatientsChartProps) {
  const { contactsCollection } = useCollections()

  const { data: contacts } = useLiveQuery((q) =>
    q
      .from({ contact: contactsCollection })
      .where(({ contact }) => eq(contact.companyId, companyId)),
  )

  const data = React.useMemo(() => {
    if (!contacts) return []

    const { startDate, days } = getTimeRangeInfo(timeRange)

    // Filter patients from the selected time range based on firstSeenAt
    const recentPatients = contacts
      .filter((contact) => dayjs(contact.firstSeenAt).isAfter(startDate))
      .filter((contact) => isPatient(contact.externalIds || []))
      .map((contact) => ({
        date: dayjs(contact.firstSeenAt).format('YYYY-MM-DD'),
      }))

    // Group by date
    const groupedByDate = new Map<string, number>()

    // Initialize all dates in the selected time range
    for (let i = days - 1; i >= 0; i--) {
      const dateStr = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
      groupedByDate.set(dateStr, 0)
    }

    // Count patients by date
    for (const patient of recentPatients) {
      const existing = groupedByDate.get(patient.date)
      if (existing !== undefined) {
        groupedByDate.set(patient.date, existing + 1)
      }
    }

    return Array.from(groupedByDate.entries()).map(([date, patients]) => ({
      date,
      patients,
    }))
  }, [contacts, timeRange])

  const totalPatients = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.patients, 0)
  }, [data])

  const { label } = getTimeRangeInfo(timeRange)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patients ({label})</CardTitle>
        <CardDescription>Total Patients: {totalPatients}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ComposedChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12,
              top: 12,
              bottom: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                return dayjs(value).format('MMM D')
              }}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return dayjs(value).format('MMMM D, YYYY')
                  }}
                />
              }
            />
            <Bar
              dataKey="patients"
              fill="var(--color-patients)"
              radius={[4, 4, 0, 0]}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
