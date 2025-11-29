import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { useQuery } from '@tanstack/react-query'
import { useCollections } from '@/routes/__root'
import { getAppointmentsAnalytics, getRevenueByService } from '@/collections'
import { useState, useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import dayjs from 'dayjs'

export const Route = createFileRoute(
  '/companies/$companyId/reports/appointments/',
)({
  component: AppointmentsPage,
})

function AppointmentsPage() {
  const { companyId } = Route.useParams()
  const { appointmentsCollection, servicesCollection } = useCollections()

  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>(
    '30d',
  )
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')

  // Fetch appointments with useLiveQuery
  const { data: appointments } = useLiveQuery((q) =>
    q.from({ appointment: appointmentsCollection })
      .setMeta({ companyId })
  )

  // Fetch services with useLiveQuery
  const { data: services } = useLiveQuery((q) =>
    q.from({ service: servicesCollection })
      .setMeta({ companyId })
  )

  // Use React Query for analytics (non-reactive)
  const { data: analyticsData } = useQuery({
    queryKey: ['appointments-analytics', companyId, timeRange, groupBy],
    queryFn: () => getAppointmentsAnalytics({ data: { companyId, timeRange, groupBy } }),
  })

  const { data: revenueByService } = useQuery({
    queryKey: ['revenue-by-service', companyId, timeRange],
    queryFn: () => getRevenueByService({ data: { companyId, timeRange } }),
  })

  console.log('appointments', appointments)
  console.log('analyticsData', analyticsData)
  console.log('services', services)

  // Generate dynamic chart config and service keys from actual data
  const { chartConfig, serviceKeys } = useMemo(() => {
    if (!analyticsData || analyticsData.length === 0) {
      return { chartConfig: {}, serviceKeys: [] }
    }

    // Extract all unique service keys from the data
    const keys = new Set<string>()
    analyticsData.forEach((dataPoint) => {
      Object.keys(dataPoint).forEach((key) => {
        if (key !== 'date') {
          keys.add(key)
        }
      })
    })

    const serviceKeysArray = Array.from(keys)

    // Generate chart config for each service
    const config: ChartConfig = {}
    serviceKeysArray.forEach((serviceName, index) => {
      // Cycle through chart colors 1-5
      const colorIndex = (index % 5) + 1
      config[serviceName] = {
        label: serviceName,
        color: `var(--chart-${colorIndex})`,
      }
    })

    return { chartConfig: config, serviceKeys: serviceKeysArray }
  }, [analyticsData])

  if (
    appointments === undefined ||
    analyticsData === undefined ||
    revenueByService === undefined
  ) {
    return (
      <div className="container mx-auto p-8">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/companies/$companyId"
          params={{ companyId }}
          className="text-sm text-muted-foreground hover:underline mb-2 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold">Appointments</h1>
        <p className="text-muted-foreground">
          Manage and view all appointments for this company
        </p>
      </div>

      {/* Revenue by Service Cards */}
      {revenueByService.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-6">
          {revenueByService.map((service) => (
            <Card key={service.serviceId} className="gradient-border-hover">
              <Link
                to="/companies/$companyId/reports/kpis/services/$serviceId"
                viewTransition={{ types: ['slide-left'] }}
                params={{
                  companyId,
                  serviceId: service.serviceId,
                }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {service.serviceName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    $
                    {service.revenue.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total charge amount
                  </p>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Chart Card */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>
              Revenue by service grouped by{' '}
              {groupBy === 'day'
                ? 'day'
                : groupBy === 'week'
                  ? 'week'
                  : 'month'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select
              value={groupBy}
              onValueChange={(value: any) => setGroupBy(value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Group by Day</SelectItem>
                <SelectItem value="week">Group by Week</SelectItem>
                <SelectItem value="month">Group by Month</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={timeRange}
              onValueChange={(value: any) => setTimeRange(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {analyticsData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No appointments data available for this time range
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[180px] w-full">
              <BarChart accessibilityLayer data={analyticsData} width={800}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => {
                    if (groupBy === 'day') {
                      return dayjs(value).format('MMM D')
                    } else if (groupBy === 'week') {
                      // Format: 2025-W05 -> Week 5
                      const weekNum = value.split('-W')[1]
                      return `Week ${weekNum}`
                    } else {
                      // Format: 2025-03 -> Mar
                      return dayjs(value).format('MMM')
                    }
                  }}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                {serviceKeys.map((serviceName) => (
                  <Bar
                    key={serviceName}
                    dataKey={serviceName}
                    fill={chartConfig[serviceName]?.color}
                    stackId="a"
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
