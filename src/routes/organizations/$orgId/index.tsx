import { useAuth } from '@clerk/tanstack-react-start'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { useId, useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'

import { AppLayout } from '@/components/app/AppLayout'
import { RequireOrganization } from '@/components/app/RequireOrganization'
import { RequireSignedIn } from '@/components/app/RequireSignedIn'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  getDashboard,
  getSpendTimeSeries,
  listLeads,
  listLocations,
} from '@/server/ri/serverFns'
import { formatCents } from '@/utils/money'

dayjs.extend(isoWeek)

export const Route = createFileRoute('/organizations/$orgId/')({
  component: RouteComponent,
})

const PATIENT_VALUE_CENTS = 2200 * 100

const getDerivedRoas = (patients: number, spendCents: number) => {
  if (spendCents <= 0) return null
  const revenueCents = patients * PATIENT_VALUE_CENTS
  return revenueCents / spendCents
}

const getConversionRate = (leads: number, patients: number) => {
  if (leads <= 0) return null
  return patients / leads
}

const getCostPerPatient = (spendCents: number, patients: number) => {
  if (patients <= 0) return null
  return spendCents / patients
}

const formatRoas = (value: number | null): string => {
  if (value === null) return '—'
  return value.toFixed(3)
}

const formatRate = (value: number | null): string => {
  if (value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

const compareNullableNumber = (
  a: number | null,
  b: number | null,
  dir: 1 | -1,
) => {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return dir * (a - b)
}

const performanceChartConfig = {
  spend_cents: {
    label: 'Spend',
    color: 'var(--color-hcd-data-green)',
  },
  leads: {
    label: 'Leads',
    color: 'var(--color-hcd-data-blue)',
  },
  patients: {
    label: 'Patients',
    color: 'var(--color-hcd-data-amber)',
  },
} satisfies ChartConfig

function RouteComponent() {
  const { orgId: orgIdFromParams } = Route.useParams()
  const { isLoaded, orgId } = useAuth()
  const orgReady = isLoaded && orgId === orgIdFromParams

  const chartId = useId().replaceAll(':', '')
  const leadsGradientId = `leads-gradient-${chartId}`
  const patientsGradientId = `patients-gradient-${chartId}`

  const defaultFrom = useMemo(
    () => dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
    [],
  )
  const defaultTo = useMemo(() => dayjs().format('YYYY-MM-DD'), [])

  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  const [locationId, setLocationId] = useState<string>('')
  const [platforms, setPlatforms] = useState<string[]>([
    'google_ads',
    'facebook_ads',
  ])

  const locationsQuery = useQuery({
    queryKey: ['org', orgIdFromParams, 'locations'],
    queryFn: () => listLocations(),
    enabled: orgReady,
  })

  const dashboardQuery = useQuery({
    queryKey: [
      'org',
      orgIdFromParams,
      'dashboard',
      { fromDate, toDate, locationId, platforms },
    ],
    queryFn: () =>
      getDashboard({
        data: {
          from_date: fromDate,
          to_date: toDate,
          location_id: locationId || undefined,
          platforms,
          include_excluded: false,
        },
      }),
    enabled: orgReady,
  })

  type SpendGranularity = 'day' | 'week' | 'month' | 'year'
  const [spendGranularity, setSpendGranularity] =
    useState<SpendGranularity>('day')

  const spendTimeSeriesQuery = useQuery({
    queryKey: [
      'org',
      orgIdFromParams,
      'spend-time-series',
      { fromDate, toDate, locationId, platforms },
    ],
    queryFn: () =>
      getSpendTimeSeries({
        data: {
          from_date: fromDate,
          to_date: toDate,
          location_id: locationId || undefined,
          platforms,
        },
      }),
    enabled: orgReady,
  })

  const performanceChartData = useMemo(() => {
    const daily = spendTimeSeriesQuery.data ?? []
    if (daily.length === 0) return []

    type PerformancePoint = {
      period: string
      axis_label: string
      tooltip_label: string
      year: number
      sort_key: string
      spend_cents: number
      leads: number
      patients: number
    }

    const withYearBreakLabels = (rows: PerformancePoint[]) =>
      rows.map((row, index) => {
        if (spendGranularity === 'year') {
          return { ...row, axis_label: String(row.year) }
        }
        const previous = index > 0 ? rows[index - 1] : null
        const yearChanged = !previous || previous.year !== row.year
        return {
          ...row,
          axis_label: yearChanged ? `${row.period} ${row.year}` : row.period,
        }
      })

    if (spendGranularity === 'day') {
      const rows = daily
        .map((d) => {
          const date = dayjs(d.date)
          return {
            period: date.format('MMM D'),
            axis_label: date.format('MMM D'),
            tooltip_label: date.format('MMM D, YYYY'),
            year: date.year(),
            sort_key: date.format('YYYY-MM-DD'),
            spend_cents: d.spend_cents,
            leads: d.leads,
            patients: d.patients,
          } satisfies PerformancePoint
        })
        .sort((a, b) => a.sort_key.localeCompare(b.sort_key))
      return withYearBreakLabels(rows)
    }

    const buckets = new Map<
      string,
      {
        period: string
        axis_label: string
        tooltip_label: string
        year: number
        sort_key: string
        spend_cents: number
        leads: number
        patients: number
      }
    >()
    for (const d of daily) {
      const date = dayjs(d.date)
      let key: string
      let period: string
      let tooltipLabel: string
      let sortKey: string
      let year: number
      if (spendGranularity === 'week') {
        const weekStart = date.startOf('isoWeek')
        key = weekStart.format('YYYY-MM-DD')
        period = weekStart.format('MMM D')
        tooltipLabel = `Week of ${weekStart.format('MMM D, YYYY')}`
        sortKey = weekStart.format('YYYY-MM-DD')
        year = weekStart.year()
      } else if (spendGranularity === 'month') {
        const monthStart = date.startOf('month')
        key = monthStart.format('YYYY-MM')
        period = monthStart.format('MMM')
        tooltipLabel = monthStart.format('MMM YYYY')
        sortKey = monthStart.format('YYYY-MM')
        year = monthStart.year()
      } else {
        const yearStart = date.startOf('year')
        key = yearStart.format('YYYY')
        period = yearStart.format('YYYY')
        tooltipLabel = yearStart.format('YYYY')
        sortKey = yearStart.format('YYYY')
        year = yearStart.year()
      }
      const existing = buckets.get(key) ?? {
        period,
        axis_label: period,
        tooltip_label: tooltipLabel,
        year,
        sort_key: sortKey,
        spend_cents: 0,
        leads: 0,
        patients: 0,
      }
      existing.spend_cents += d.spend_cents
      existing.leads += d.leads
      existing.patients += d.patients
      buckets.set(key, existing)
    }

    const rows = Array.from(buckets.values()).sort((a, b) =>
      a.sort_key.localeCompare(b.sort_key),
    )
    return withYearBreakLabels(rows)
  }, [spendTimeSeriesQuery.data, spendGranularity])

  type SortColumn =
    | 'campaign'
    | 'location'
    | 'spend'
    | 'leads'
    | 'patients'
    | 'conv_rate'
    | 'cost_per_patient'
    | 'roas'
  const [sortColumn, setSortColumn] = useState<SortColumn>('spend')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const campaignColumns: SortColumn[] = [
    'campaign',
    'location',
    'spend',
    'leads',
    'patients',
    'conv_rate',
    'cost_per_patient',
    'roas',
  ]
  const columnLabels: Record<SortColumn, string> = {
    campaign: 'Campaign',
    location: 'Location',
    spend: 'Spend',
    leads: 'Leads',
    patients: 'Patients',
    conv_rate: 'Conv rate',
    cost_per_patient: 'Cost/Patient',
    roas: 'ROAS',
  }

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const sortedCampaigns = useMemo(() => {
    const rows = dashboardQuery.data?.campaigns ?? []
    const sorted = [...rows]
    const dir = sortDirection === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      switch (sortColumn) {
        case 'campaign': {
          const aName = a.campaign_name ?? ''
          const bName = b.campaign_name ?? ''
          return dir * aName.localeCompare(bName)
        }
        case 'location': {
          const aLoc = a.location_name ?? ''
          const bLoc = b.location_name ?? ''
          return dir * aLoc.localeCompare(bLoc)
        }
        case 'spend':
          return dir * (a.spend_cents - b.spend_cents)
        case 'leads':
          return dir * (a.leads - b.leads)
        case 'patients':
          return dir * (a.patients - b.patients)
        case 'conv_rate':
          return compareNullableNumber(
            getConversionRate(a.leads, a.patients),
            getConversionRate(b.leads, b.patients),
            dir,
          )
        case 'cost_per_patient':
          return compareNullableNumber(
            getCostPerPatient(a.spend_cents, a.patients),
            getCostPerPatient(b.spend_cents, b.patients),
            dir,
          )
        case 'roas':
          return (
            dir *
            ((getDerivedRoas(a.patients, a.spend_cents) ?? -Infinity) -
              (getDerivedRoas(b.patients, b.spend_cents) ?? -Infinity))
          )
        default:
          return 0
      }
    })

    return sorted
  }, [dashboardQuery.data?.campaigns, sortColumn, sortDirection])

  const [selectedCampaign, setSelectedCampaign] = useState<{
    platform: string
    campaign_id: string
    campaign_name: string | null
    location_name: string | null
  } | null>(null)
  const [leadsDrawerOpen, setLeadsDrawerOpen] = useState(false)

  return (
    <RequireSignedIn>
      <RequireOrganization orgId={orgIdFromParams}>
        <AppLayout orgId={orgIdFromParams}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="text-label text-muted-foreground">
                  Revenue Intelligence
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Spend → Leads → Patients → Revenue → ROAS
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="from-date">From</Label>
                  <Input
                    id="from-date"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to-date">To</Label>
                  <Input
                    id="to-date"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Select
                    value={locationId || 'all'}
                    onValueChange={(value) =>
                      setLocationId(value === 'all' ? '' : value)
                    }
                  >
                    <SelectTrigger id="location">
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {(locationsQuery.data ?? []).map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="text-xs text-muted-foreground">Platforms</div>
                <ToggleGroup
                  type="multiple"
                  value={platforms}
                  onValueChange={(value) => setPlatforms(value)}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="google_ads">
                    <PlatformIcon platform="google_ads" />
                    Google Ads
                  </ToggleGroupItem>
                  <ToggleGroupItem value="facebook_ads">
                    <PlatformIcon platform="facebook_ads" />
                    Facebook Ads
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle>Spend, Leads, Patients</CardTitle>
                    <CardDescription>
                      Ad spend and outcomes over time.
                    </CardDescription>
                  </div>
                  <Select
                    value={spendGranularity}
                    onValueChange={(v) =>
                      setSpendGranularity(v as SpendGranularity)
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {spendTimeSeriesQuery.isLoading ? (
                  <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : performanceChartData.length === 0 ? (
                  <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                    No data for this range.
                  </div>
                ) : (
                  <ChartContainer
                    config={performanceChartConfig}
                    className="h-[250px] w-full"
                  >
                    <ComposedChart data={performanceChartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="axis_label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <YAxis
                        yAxisId="count"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(v: number) => v.toLocaleString()}
                      />
                      <YAxis
                        yAxisId="spend"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(v: number) => formatCents(v)}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(_, payload) => {
                              const row =
                                payload?.[0]?.payload as
                                  | { tooltip_label?: string }
                                  | undefined
                              return row?.tooltip_label ?? ''
                            }}
                            formatter={(value, name, item) => {
                              const series = String(name)
                              const numericValue =
                                typeof value === 'number'
                                  ? value
                                  : Number(value)
                              const displayValue =
                                series === 'spend_cents'
                                  ? formatCents(
                                      Number.isFinite(numericValue)
                                        ? numericValue
                                        : 0,
                                    )
                                  : Number.isFinite(numericValue)
                                    ? numericValue.toLocaleString()
                                    : '0'
                              const color =
                                series === 'spend_cents'
                                  ? 'var(--color-spend_cents)'
                                  : series === 'leads'
                                    ? 'var(--color-leads)'
                                    : series === 'patients'
                                      ? 'var(--color-patients)'
                                      : (item.color ?? 'currentColor')
                              const label =
                                series === 'spend_cents'
                                  ? 'Spend'
                                  : series === 'leads'
                                    ? 'Leads'
                                    : series === 'patients'
                                      ? 'Patients'
                                      : series

                              return (
                                <div className="flex w-full items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 rounded-[2px]"
                                      style={{ backgroundColor: color }}
                                    />
                                    <span className="text-muted-foreground">
                                      {label}
                                    </span>
                                  </div>
                                  <span className="font-mono font-medium tabular-nums text-foreground">
                                    {displayValue}
                                  </span>
                                </div>
                              )
                            }}
                          />
                        }
                      />
                      <defs>
                        <linearGradient
                          id={leadsGradientId}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--color-leads)"
                            stopOpacity={1}
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--color-leads)"
                            stopOpacity={0.2}
                          />
                        </linearGradient>
                        <linearGradient
                          id={patientsGradientId}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--color-patients)"
                            stopOpacity={1}
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--color-patients)"
                            stopOpacity={0.2}
                          />
                        </linearGradient>
                      </defs>
                      <Bar
                        dataKey="leads"
                        yAxisId="count"
                        fill={`url(#${leadsGradientId})`}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="patients"
                        yAxisId="count"
                        fill={`url(#${patientsGradientId})`}
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        type="monotone"
                        dataKey="spend_cents"
                        yAxisId="spend"
                        stroke="var(--color-spend_cents)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <KpiGrid
              loading={dashboardQuery.isLoading}
              kpis={dashboardQuery.data?.kpis ?? null}
            />

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle>Campaigns</CardTitle>
                    <CardDescription>
                      Performance by location and channel.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {campaignColumns.map((col) => (
                          <TableHead
                            key={col}
                            className="cursor-pointer select-none hover:text-foreground"
                            onClick={() => toggleSort(col)}
                          >
                            <span className="inline-flex items-center gap-1">
                              {columnLabels[col]}
                              {sortColumn === col ? (
                                <span className="text-xs">
                                  {sortDirection === 'asc' ? '\u25B2' : '\u25BC'}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/40">
                                  {'\u25BC'}
                                </span>
                              )}
                            </span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedCampaigns.map((r) => (
                        <TableRow
                          key={`${r.platform ?? 'unknown'}:${r.campaign_id ?? 'unknown'}`}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <PlatformIcon
                                  platform={r.platform ?? 'unknown'}
                                />
                                <span>{r.campaign_name}</span>
                              </div>
                              {r.campaign_id ? (
                                <span className="text-xs text-muted-foreground">
                                  id: {r.campaign_id}
                                </span>
                              ) : null}
                              <span className="text-xs text-muted-foreground">
                                {r.platform === 'google_ads'
                                  ? 'Google Ads'
                                  : r.platform === 'facebook_ads'
                                    ? 'Facebook Ads'
                                    : (r.platform ?? 'Unknown')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{r.location_name ?? '—'}</TableCell>
                          <TableCell>{formatCents(r.spend_cents)}</TableCell>
                          <TableCell>
                            {r.campaign_id && r.platform ? (
                              <button
                                type="button"
                                className="text-left font-medium text-foreground underline underline-offset-2 hover:text-foreground/80"
                                onClick={() => {
                                  setSelectedCampaign({
                                    platform: r.platform,
                                    campaign_id: r.campaign_id,
                                    campaign_name: r.campaign_name,
                                    location_name: r.location_name ?? null,
                                  })
                                  setLeadsDrawerOpen(true)
                                }}
                              >
                                {r.leads}
                              </button>
                            ) : (
                              <span>{r.leads}</span>
                            )}
                          </TableCell>
                          <TableCell>{r.patients}</TableCell>
                          <TableCell>
                            {formatRate(getConversionRate(r.leads, r.patients))}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const cost = getCostPerPatient(
                                r.spend_cents,
                                r.patients,
                              )
                              return cost === null ? '—' : formatCents(cost)
                            })()}
                          </TableCell>
                          <TableCell>
                            {formatRoas(getDerivedRoas(r.patients, r.spend_cents))}
                          </TableCell>
                        </TableRow>
                      ))}
                      {sortedCampaigns.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-muted-foreground"
                          >
                            No data for this range yet.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <CampaignLeadsDrawer
              orgId={orgIdFromParams}
              open={leadsDrawerOpen}
              onOpenChange={(open) => {
                setLeadsDrawerOpen(open)
                if (!open) setSelectedCampaign(null)
              }}
              campaign={selectedCampaign}
              fromDate={fromDate}
              toDate={toDate}
              locationId={locationId}
            />
          </div>
        </AppLayout>
      </RequireOrganization>
    </RequireSignedIn>
  )
}

function CampaignLeadsDrawer(props: {
  orgId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  fromDate: string
  toDate: string
  locationId: string
  campaign: {
    platform: string
    campaign_id: string
    campaign_name: string | null
    location_name: string | null
  } | null
}) {
  const campaign = props.campaign

  const leadsQuery = useQuery({
    queryKey: [
      'org',
      props.orgId,
      'leads',
      'campaign',
      campaign?.platform ?? '',
      campaign?.campaign_id ?? '',
      props.fromDate,
      props.toDate,
      props.locationId,
    ],
    queryFn: () =>
      listLeads({
        data: {
          platform: campaign?.platform || undefined,
          campaign_id: campaign?.campaign_id || undefined,
          location_id: props.locationId || undefined,
          from: `${props.fromDate}T00:00:00.000Z`,
          to: `${props.toDate}T23:59:59.999Z`,
          limit: 5000,
        },
      }),
    enabled: props.open && !!campaign?.platform && !!campaign?.campaign_id,
  })
  const orderedLeads = useMemo(() => {
    const leads = [...(leadsQuery.data ?? [])]
    return leads.sort((a, b) => {
      if (a.is_patient !== b.is_patient) {
        return a.is_patient ? -1 : 1
      }
      return (
        dayjs(b.last_event_at).valueOf() - dayjs(a.last_event_at).valueOf()
      )
    })
  }, [leadsQuery.data])

  return (
    <Drawer
      open={props.open}
      onOpenChange={props.onOpenChange}
      direction="right"
    >
      <DrawerContent className="h-full max-h-none w-[92vw] max-w-2xl">
        <DrawerHeader>
          <DrawerTitle className="text-base">
            {campaign?.campaign_name ?? 'Campaign'}{' '}
            {campaign?.campaign_id ? (
              <span className="text-muted-foreground">({campaign.campaign_id})</span>
            ) : null}
          </DrawerTitle>
          <DrawerDescription>
            {campaign?.platform === 'google_ads'
              ? 'Google Ads'
              : campaign?.platform === 'facebook_ads'
                ? 'Facebook Ads'
                : campaign?.platform ?? 'Unknown'}{' '}
            {campaign?.location_name ? `- ${campaign.location_name}` : ''}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-auto px-4 pb-4">
          {leadsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading leads...</div>
          ) : null}

          {leadsQuery.error instanceof Error ? (
            <div className="text-sm text-destructive">
              {leadsQuery.error.message}
            </div>
          ) : null}

          <div className="overflow-auto rounded-md border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Qualified</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderedLeads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className={lead.is_patient ? 'bg-emerald-500/5' : undefined}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {lead.name ?? lead.phone}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {lead.phone}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span
                          className={
                            lead.is_patient
                              ? 'font-medium text-emerald-500'
                              : 'font-medium text-foreground'
                          }
                        >
                          {lead.is_patient ? 'Patient' : 'Lead'}
                        </span>
                        {lead.is_patient ? (
                          <span className="text-xs text-emerald-500/90">
                            {lead.linked_patient.name ?? 'Linked'}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Lead</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{lead.qualified ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      {lead.linked_patient
                        ? formatCents(lead.revenue_cents ?? 0)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {dayjs(lead.last_event_at).format('MMM D, YYYY h:mm A')}
                    </TableCell>
                  </TableRow>
                ))}
                {orderedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No leads found for this campaign.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="border-t border-border/60 p-4">
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">
              Close
            </Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function KpiGrid(props: {
  loading: boolean
  kpis: {
    spend_cents: number
    leads: number
    qualified_leads: number
    patients: number
    revenue_cents: number
    roi: number | null
  } | null
}) {
  const k = props.kpis
  const derivedRoas = k ? getDerivedRoas(k.patients, k.spend_cents) : null
  const convRate = k ? getConversionRate(k.leads, k.patients) : null
  const costPerPatient = k ? getCostPerPatient(k.spend_cents, k.patients) : null
  const items = [
    { label: 'Spend', value: k ? formatCents(k.spend_cents) : '—' },
    { label: 'Leads', value: k ? String(k.leads) : '—' },
    { label: 'Patients', value: k ? String(k.patients) : '—' },
    { label: 'Conv rate', value: formatRate(convRate) },
    {
      label: 'Cost/Patient',
      value: costPerPatient === null ? '—' : formatCents(costPerPatient),
    },
    { label: 'ROAS', value: k ? formatRoas(derivedRoas) : '—' },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} className="border-border/60 bg-card/80">
          <CardHeader className="pb-3">
            <CardDescription className="text-label text-muted-foreground">
              {item.label}
            </CardDescription>
            <CardTitle className="text-metric-medium">
              {props.loading ? '…' : item.value}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-1 w-10 rounded-full bg-gradient-data" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function PlatformIcon(props: { platform: string }) {
  const isFacebook = props.platform === 'facebook_ads'
  const isGoogle = props.platform === 'google_ads'
  const label = isFacebook
    ? 'Facebook Ads'
    : isGoogle
      ? 'Google Ads'
      : 'Unknown'
  const text = isFacebook ? 'f' : isGoogle ? 'G' : '?'
  const bgClass = isFacebook
    ? 'bg-[#1877F2]'
    : isGoogle
      ? 'bg-[#4285F4]'
      : 'bg-muted text-foreground'

  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${bgClass} ${isGoogle || isFacebook ? 'text-white' : ''}`}
      aria-label={label}
      title={label}
    >
      {text}
    </span>
  )
}
