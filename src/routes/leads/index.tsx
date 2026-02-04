import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { AppLayout } from '@/components/app/AppLayout'
import { RequireSignedIn } from '@/components/app/RequireSignedIn'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { listLeads, listLocations } from '@/server/ri/serverFns'

export const Route = createFileRoute('/leads/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [status, setStatus] = useState<string>('')
  const [qualifiedOnly, setQualifiedOnly] = useState(false)
  const [q, setQ] = useState('')
  const [locationId, setLocationId] = useState<string>('')

  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: () => listLocations(),
  })

  const leadsQuery = useQuery({
    queryKey: ['leads', { status, qualifiedOnly, q, locationId }],
    queryFn: () =>
      listLeads({
        status: status ? (status as 'new' | 'patient' | 'not_patient') : undefined,
        qualified_only: qualifiedOnly || undefined,
        q: q.trim() || undefined,
        location_id: locationId || undefined,
        limit: 100,
      }),
  })

  return (
    <RequireSignedIn>
      <AppLayout>
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground">
              Inbox for front desk conversion + value entry.
            </p>
          </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <CardTitle className="text-base">Filters</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                >
                  <option value="">All</option>
                  <option value="new">New</option>
                  <option value="patient">Patient</option>
                  <option value="not_patient">Not a Patient</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Location</label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                >
                  <option value="">All</option>
                  {(locationsQuery.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Search</label>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Phone or name"
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                />
              </div>

              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={qualifiedOnly}
                    onChange={(e) => setQualifiedOnly(e.target.checked)}
                  />
                  Qualified only
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <CardTitle className="text-base mb-3">Inbox</CardTitle>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-4">Lead</th>
                    <th className="py-2 pr-4">Campaign</th>
                    <th className="py-2 pr-4">Qualified</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {(leadsQuery.data ?? []).map((lead) => (
                    <tr key={lead.id} className="border-b">
                      <td className="py-2 pr-4">
                        <div className="flex flex-col">
                          <Link
                            to="/leads/$leadId"
                            params={{ leadId: lead.id }}
                            className="text-foreground hover:underline"
                          >
                            {lead.name ?? lead.phone}
                          </Link>
                          <span className="text-xs text-muted-foreground">{lead.phone}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-col">
                          <span>{lead.campaign_name ?? lead.campaign_id ?? 'Unknown/Direct'}</span>
                          <span className="text-xs text-muted-foreground">{lead.platform ?? '—'}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4">{lead.qualified ? 'Yes' : 'No'}</td>
                      <td className="py-2 pr-4">{lead.status}</td>
                      <td className="py-2 pr-4">
                        {new Date(lead.last_event_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {leadsQuery.data?.length === 0 ? (
                    <tr>
                      <td className="py-3 text-muted-foreground" colSpan={5}>
                        No leads found.
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
    </RequireSignedIn>
  )
}
