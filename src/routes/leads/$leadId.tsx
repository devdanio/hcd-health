import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { AppLayout } from '@/components/app/AppLayout'
import { RequireSignedIn } from '@/components/app/RequireSignedIn'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { getLeadDetail, setLeadStatus, upsertPatientValue } from '@/server/ri/serverFns'
import { parseDollarsToCents } from '@/utils/helpers'
import { formatCents } from '@/utils/money'

export const Route = createFileRoute('/leads/$leadId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { leadId } = Route.useParams()
  const queryClient = useQueryClient()

  const leadQuery = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => getLeadDetail({ lead_id: leadId }),
  })

  const lead = leadQuery.data

  const [ltv, setLtv] = useState('')
  const [cash, setCash] = useState('')

  const initialValues = useMemo(() => {
    const pv = lead?.patient_values
    return {
      ltv: pv?.ltv_cents != null ? String(pv.ltv_cents / 100) : '',
      cash: pv?.cash_collected_to_date_cents != null
        ? String(pv.cash_collected_to_date_cents / 100)
        : '',
    }
  }, [lead?.patient_values])

  useEffect(() => {
    if (!lead) return
    if (ltv.length === 0 && initialValues.ltv) setLtv(initialValues.ltv)
    if (cash.length === 0 && initialValues.cash) setCash(initialValues.cash)
  }, [lead, initialValues, ltv.length, cash.length])

  const markStatusMutation = useMutation({
    mutationFn: (status: 'new' | 'patient' | 'not_patient') =>
      setLeadStatus({ lead_id: leadId, status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      await queryClient.invalidateQueries({ queryKey: ['leads'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const saveValueMutation = useMutation({
    mutationFn: () => {
      const ltvCents =
        ltv.trim().length > 0 ? parseDollarsToCents(ltv) : null
      const cashCents =
        cash.trim().length > 0 ? parseDollarsToCents(cash) : null

      if (ltvCents === null && ltv.trim().length > 0) {
        throw new Error('Invalid LTV')
      }
      if (cashCents === null && cash.trim().length > 0) {
        throw new Error('Invalid cash collected')
      }

      return upsertPatientValue({
        lead_id: leadId,
        ltv_cents: ltvCents,
        cash_collected_to_date_cents: cashCents,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  if (leadQuery.isLoading) {
    return (
      <RequireSignedIn>
        <AppLayout>
          <div className="text-sm text-muted-foreground">Loading…</div>
        </AppLayout>
      </RequireSignedIn>
    )
  }

  if (!lead) {
    return (
      <RequireSignedIn>
        <AppLayout>
          <div className="text-sm text-muted-foreground">Lead not found.</div>
        </AppLayout>
      </RequireSignedIn>
    )
  }

  const pv = lead.patient_values
  const ltvCents = pv?.ltv_cents ?? null
  const cashCents = pv?.cash_collected_to_date_cents ?? null

  return (
    <RequireSignedIn>
      <AppLayout>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {lead.name ?? lead.phone}
            </h1>
            <p className="text-sm text-muted-foreground">
              {lead.phone} • Created {new Date(lead.first_event_at).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-md border bg-background px-3 py-2 text-sm"
              onClick={() => markStatusMutation.mutate('patient')}
              disabled={markStatusMutation.isPending}
            >
              Mark as Patient
            </button>
            <button
              className="rounded-md border bg-background px-3 py-2 text-sm"
              onClick={() => markStatusMutation.mutate('not_patient')}
              disabled={markStatusMutation.isPending}
            >
              Not a Patient
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 space-y-2">
              <CardTitle className="text-base">Status</CardTitle>
              <div className="text-sm text-foreground">{lead.status}</div>
              <div className="text-sm text-foreground">
                Qualified: {lead.qualified ? 'Yes' : 'No'}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardContent className="p-4 space-y-2">
              <CardTitle className="text-base">Attribution (first event)</CardTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Campaign</span>
                  <div className="text-foreground">
                    {lead.utm_campaign ?? lead.campaign_id ?? 'Unknown/Direct'}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Platform</span>
                  <div className="text-foreground">{lead.platform ?? '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">gclid</span>
                  <div className="text-foreground break-all">{lead.gclid ?? '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Landing page</span>
                  <div className="text-foreground break-all">
                    {lead.landing_page ?? '—'}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <span className="text-muted-foreground">Referrer</span>
                  <div className="text-foreground break-all">{lead.referrer ?? '—'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <CardTitle className="text-base">Patient Value (LTV)</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">LTV ($)</label>
                <input
                  value={ltv}
                  onChange={(e) => setLtv(e.target.value)}
                  placeholder={initialValues.ltv || 'e.g. 2500'}
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Cash collected to date ($)</label>
                <input
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  placeholder={initialValues.cash || 'e.g. 500'}
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                />
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-md bg-black text-white px-3 py-2 text-sm"
                  onClick={() => saveValueMutation.mutate()}
                  disabled={saveValueMutation.isPending}
                >
                  Save
                </button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Current LTV:{' '}
              <span className="font-medium">
                {ltvCents != null ? formatCents(ltvCents) : '—'}
              </span>
              {' • '}
              Cash collected:{' '}
              <span className="font-medium">
                {cashCents != null ? formatCents(cashCents) : '—'}
              </span>
            </div>

            {saveValueMutation.error ? (
              <div className="text-sm text-red-600">
                {saveValueMutation.error instanceof Error
                  ? saveValueMutation.error.message
                  : 'Failed to save'}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <CardTitle className="text-base mb-3">Timeline</CardTitle>
            <div className="space-y-2">
              {lead.lead_events.map((e) => (
                <div key={e.id} className="border rounded-md p-3 bg-background">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-foreground">
                      {e.event_type}
                      {e.qualified ? (
                        <span className="ml-2 text-xs text-green-700">
                          qualified
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(e.occurred_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>campaign_id: {e.campaign_id ?? '—'}</div>
                    <div>utm_campaign: {e.utm_campaign ?? '—'}</div>
                    <div>gclid: {e.gclid ?? '—'}</div>
                  </div>
                  {typeof e.duration_sec === 'number' ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      duration_sec: {e.duration_sec}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
    </RequireSignedIn>
  )
}
