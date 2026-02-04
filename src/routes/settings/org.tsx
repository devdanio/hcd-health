import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { AppLayout } from '@/components/app/AppLayout'
import { RequireSignedIn } from '@/components/app/RequireSignedIn'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import {
  createLocation,
  generateNewApiKey,
  getOrg,
  listApiKeys,
  listLocations,
  revokeApiKey,
  syncGoogleAdsNow,
  updateOrg,
} from '@/server/ri/serverFns'

export const Route = createFileRoute('/settings/org')({
  component: RouteComponent,
})

function RouteComponent() {
  const queryClient = useQueryClient()

  const orgQuery = useQuery({ queryKey: ['org'], queryFn: () => getOrg() })
  const keysQuery = useQuery({ queryKey: ['api-keys'], queryFn: () => listApiKeys() })
  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: () => listLocations(),
  })

  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newLocationName, setNewLocationName] = useState('')

  const defaultFrom = useMemo(
    () => dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    [],
  )
  const defaultTo = useMemo(() => dayjs().format('YYYY-MM-DD'), [])
  const [syncFrom, setSyncFrom] = useState(defaultFrom)
  const [syncTo, setSyncTo] = useState(defaultTo)

  const updateOrgMutation = useMutation({
    mutationFn: (input: {
      name?: string
      qualified_call_duration_threshold_sec?: number
      google_ads_customer_id?: string | null
    }) => updateOrg(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['org'] })
    },
  })

  const createKeyMutation = useMutation({
    mutationFn: () => generateNewApiKey({ label: newKeyLabel || undefined }),
    onSuccess: async () => {
      setNewKeyLabel('')
      await queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const createLocationMutation = useMutation({
    mutationFn: () => createLocation({ name: newLocationName }),
    onSuccess: async () => {
      setNewLocationName('')
      await queryClient.invalidateQueries({ queryKey: ['locations'] })
      await queryClient.invalidateQueries({ queryKey: ['campaign-settings'] })
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => syncGoogleAdsNow({ from_date: syncFrom, to_date: syncTo }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['campaign-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const org = orgQuery.data

  return (
    <RequireSignedIn>
      <AppLayout>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Organization</h1>
          <p className="text-sm text-muted-foreground">
            Ingestion API keys and org-level defaults.
          </p>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <CardTitle className="text-base">Org Details</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Org ID</label>
                <input
                  value={org?.id ?? ''}
                  readOnly
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <input
                  defaultValue={org?.name ?? ''}
                  onBlur={(e) => {
                    const name = e.target.value.trim()
                    if (name.length > 0 && name !== org?.name) {
                      updateOrgMutation.mutate({ name })
                    }
                  }}
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Call qualified threshold (sec)
                </label>
                <input
                  type="number"
                  defaultValue={org?.qualified_call_duration_threshold_sec ?? 60}
                  onBlur={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) {
                      updateOrgMutation.mutate({
                        qualified_call_duration_threshold_sec: Math.max(0, Math.floor(n)),
                      })
                    }
                  }}
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Ingestion endpoint: <code>/api/ingest/events</code>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <CardTitle className="text-base">Ingestion API Keys</CardTitle>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-xs text-muted-foreground">New key label</label>
                <input
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="e.g. RudderStack Prod"
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                />
              </div>
              <button
                className="rounded-md bg-black text-white px-3 py-2 text-sm"
                onClick={() => createKeyMutation.mutate()}
                disabled={createKeyMutation.isPending}
              >
                Generate key
              </button>
            </div>

            {createKeyMutation.data?.api_key ? (
              <div className="border rounded-md p-3 bg-yellow-50 text-sm">
                <div className="font-medium text-foreground">New API key</div>
                <div className="text-muted-foreground break-all">
                  {createKeyMutation.data.api_key}
                </div>
                <div className="text-xs text-muted-foreground">
                  Copy this now — it won’t be shown again.
                </div>
              </div>
            ) : null}

            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-4">Prefix</th>
                    <th className="py-2 pr-4">Label</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-4">Last used</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {(keysQuery.data ?? []).map((k) => (
                    <tr key={k.id} className="border-b">
                      <td className="py-2 pr-4">{k.key_prefix}</td>
                      <td className="py-2 pr-4">{k.label ?? '—'}</td>
                      <td className="py-2 pr-4">
                        {new Date(k.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">
                        {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-2 pr-4">
                        {k.revoked_at ? 'revoked' : 'active'}
                      </td>
                      <td className="py-2 pr-4">
                        {!k.revoked_at ? (
                          <button
                            className="text-sm text-red-600 hover:underline"
                            onClick={() => revokeKeyMutation.mutate(k.id)}
                            disabled={revokeKeyMutation.isPending}
                          >
                            Revoke
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {(keysQuery.data?.length ?? 0) === 0 ? (
                    <tr>
                      <td className="py-3 text-muted-foreground" colSpan={6}>
                        No API keys yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <CardTitle className="text-base">Locations</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-xs text-muted-foreground">New location name</label>
                <input
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="e.g. Denver"
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                />
              </div>
              <button
                className="rounded-md border bg-background px-3 py-2 text-sm"
                onClick={() => createLocationMutation.mutate()}
                disabled={createLocationMutation.isPending || newLocationName.trim().length === 0}
              >
                Add location
              </button>
            </div>
            <div className="text-sm text-muted-foreground">
              {(locationsQuery.data ?? []).map((l) => l.name).join(', ') || '—'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <CardTitle className="text-base">Google Ads Sync</CardTitle>
            <p className="text-sm text-muted-foreground">
              Set your Google Ads customer ID and run a manual sync. For production,
              schedule this daily.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Customer ID</label>
                <input
                  defaultValue={org?.google_ads_customer_id ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    updateOrgMutation.mutate({ google_ads_customer_id: v.length > 0 ? v : null })
                  }}
                  placeholder="123-456-7890"
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">From</label>
                <input
                  type="date"
                  value={syncFrom}
                  onChange={(e) => setSyncFrom(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">To</label>
                <input
                  type="date"
                  value={syncTo}
                  onChange={(e) => setSyncTo(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                />
              </div>
            </div>

            <button
              className="rounded-md bg-black text-white px-3 py-2 text-sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? 'Syncing…' : 'Sync Google Ads now'}
            </button>

            {syncMutation.data ? (
              <div className="text-sm text-muted-foreground">
                Synced: {syncMutation.data.campaigns_upserted} campaigns,{' '}
                {syncMutation.data.spend_rows_upserted} spend rows.
              </div>
            ) : null}
            {syncMutation.error ? (
              <div className="text-sm text-red-600">
                {syncMutation.error instanceof Error
                  ? syncMutation.error.message
                  : 'Sync failed'}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
    </RequireSignedIn>
  )
}
