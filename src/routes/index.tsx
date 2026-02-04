import { SignInButton, SignedIn, SignedOut } from '@clerk/tanstack-react-start'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'

import { AppLayout } from '@/components/app/AppLayout'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { getDashboard, listLocations } from '@/server/ri/serverFns'
import { formatCents, formatPercent } from '@/utils/money'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <>
      <SignedOut>
        <Landing />
      </SignedOut>
      <SignedIn>
        <Dashboard />
      </SignedIn>
    </>
  )
}

function Landing() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <img
            src="/images/high-country-health-logo.svg"
            alt="High Country Health"
            className="w-20 md:w-24 h-auto"
          />
        </div>
      </header>
      <Card className="max-w-md mx-auto mt-10">
        <CardContent className="space-y-3">
          <CardTitle className="text-lg">Revenue Intelligence</CardTitle>
          <SignInButton>
            <button className="w-full rounded-md bg-black text-white py-2 text-sm">
              Sign In
            </button>
          </SignInButton>
        </CardContent>
      </Card>
    </div>
  )
}

function Dashboard() {
  const defaultFrom = useMemo(
    () => dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
    [],
  )
  const defaultTo = useMemo(() => dayjs().format('YYYY-MM-DD'), [])

  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  const [locationId, setLocationId] = useState<string>('')

  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: () => listLocations(),
  })

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', { fromDate, toDate, locationId }],
    queryFn: () =>
      getDashboard({
        from_date: fromDate,
        to_date: toDate,
        location_id: locationId || undefined,
        include_excluded: false,
      }),
  })

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-end justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-600">
              Spend → Leads → Patients → Revenue → ROI
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">Location</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm bg-white"
              >
                <option value="">All</option>
                {(locationsQuery.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <KpiGrid
          loading={dashboardQuery.isLoading}
          kpis={dashboardQuery.data?.kpis ?? null}
        />

        <Card>
          <CardContent className="p-4">
            <CardTitle className="text-base mb-3">Campaigns</CardTitle>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-4">Campaign</th>
                    <th className="py-2 pr-4">Location</th>
                    <th className="py-2 pr-4">Spend</th>
                    <th className="py-2 pr-4">Leads</th>
                    <th className="py-2 pr-4">Patients</th>
                    <th className="py-2 pr-4">Revenue</th>
                    <th className="py-2 pr-4">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboardQuery.data?.campaigns ?? []).map((r) => (
                    <tr key={r.campaign_id ?? 'unknown'} className="border-b">
                      <td className="py-2 pr-4">
                        {r.campaign_name ?? r.campaign_id ?? 'Unknown'}
                      </td>
                      <td className="py-2 pr-4">{r.location_name ?? '—'}</td>
                      <td className="py-2 pr-4">{formatCents(r.spend_cents)}</td>
                      <td className="py-2 pr-4">{r.leads}</td>
                      <td className="py-2 pr-4">{r.patients}</td>
                      <td className="py-2 pr-4">{formatCents(r.revenue_cents)}</td>
                      <td className="py-2 pr-4">{formatPercent(r.roi)}</td>
                    </tr>
                  ))}
                  {dashboardQuery.data?.campaigns.length === 0 ? (
                    <tr>
                      <td className="py-3 text-gray-600" colSpan={7}>
                        No data for this range yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
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
  const items = [
    { label: 'Spend', value: k ? formatCents(k.spend_cents) : '—' },
    { label: 'Leads', value: k ? String(k.leads) : '—' },
    { label: 'Qualified', value: k ? String(k.qualified_leads) : '—' },
    { label: 'Patients', value: k ? String(k.patients) : '—' },
    { label: 'Revenue', value: k ? formatCents(k.revenue_cents) : '—' },
    { label: 'ROI', value: k ? formatPercent(k.roi) : '—' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="text-xs text-gray-600">{item.label}</div>
            <div className="text-lg font-semibold text-gray-900">
              {props.loading ? '…' : item.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
