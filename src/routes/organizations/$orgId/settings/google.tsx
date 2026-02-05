import { useAuth } from '@clerk/tanstack-react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getActiveApiKey,
  getGoogleAdsCredentialsStatus,
  getOrg,
  rotateApiKey,
  saveGoogleAdsCredentials,
  syncGoogleAdsNow,
  updateOrg,
} from '@/server/ri/serverFns'

export const Route = createFileRoute('/organizations/$orgId/settings/google')({
  component: RouteComponent,
})

function RouteComponent() {
  const { orgId } = Route.useParams()
  const { isLoaded, orgId: activeOrgId } = useAuth()
  const orgReady = isLoaded && activeOrgId === orgId

  const queryClient = useQueryClient()

  const orgQuery = useQuery({
    queryKey: ['org', orgId],
    queryFn: () => getOrg(),
    enabled: orgReady,
  })

  const credentialsStatusQuery = useQuery({
    queryKey: ['org', orgId, 'google-ads-credentials'],
    queryFn: () => getGoogleAdsCredentialsStatus(),
    enabled: orgReady,
  })

  const activeKeyQuery = useQuery({
    queryKey: ['org', orgId, 'active-api-key'],
    queryFn: () => getActiveApiKey(),
    enabled: orgReady,
  })

  const [orgFormInitialized, setOrgFormInitialized] = useState(false)
  const [googleAdsCustomerId, setGoogleAdsCustomerId] = useState('')

  useEffect(() => {
    if (!orgQuery.data || orgFormInitialized) return
    setGoogleAdsCustomerId(orgQuery.data.google_ads_customer_id ?? '')
    setOrgFormInitialized(true)
  }, [orgFormInitialized, orgQuery.data])

  const [googleAdsDeveloperToken, setGoogleAdsDeveloperToken] = useState('')
  const [googleAdsClientId, setGoogleAdsClientId] = useState('')
  const [googleAdsClientSecret, setGoogleAdsClientSecret] = useState('')
  const [googleAdsRefreshToken, setGoogleAdsRefreshToken] = useState('')
  const [googleAdsMccId, setGoogleAdsMccId] = useState('')

  const [syncFromDate, setSyncFromDate] = useState(() =>
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
  )
  const [syncToDate, setSyncToDate] = useState(() =>
    dayjs().format('YYYY-MM-DD'),
  )

  const [newApiKeyLabel, setNewApiKeyLabel] = useState('Primary')
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null)
  const hasGoogleCustomerId = googleAdsCustomerId.trim().length > 0

  const updateOrgMutation = useMutation({
    mutationFn: (input: { google_ads_customer_id?: string | null }) =>
      updateOrg({ data: input }),
    onSuccess: async () => {
      toast.success('Google Ads account saved.')
      await queryClient.invalidateQueries({ queryKey: ['org', orgId] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save account.',
      )
    },
  })

  const saveGoogleAdsMutation = useMutation({
    mutationFn: (input: {
      mcc_id?: string
      developer_token?: string
      refresh_token?: string
      client_id?: string
      client_secret?: string
    }) => saveGoogleAdsCredentials({ data: input }),
    onSuccess: async () => {
      toast.success('Google Ads credentials saved.')
      await queryClient.invalidateQueries({
        queryKey: ['org', orgId, 'google-ads-credentials'],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to save Google Ads credentials.',
      )
    },
  })

  const rotateApiKeyMutation = useMutation({
    mutationFn: (label?: string) => rotateApiKey({ data: { label } }),
    onSuccess: async (data) => {
      toast.success('API key generated.')
      setGeneratedApiKey(data.api_key)
      await queryClient.invalidateQueries({
        queryKey: ['org', orgId, 'active-api-key'],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate API key.',
      )
    },
  })

  const syncMutation = useMutation({
    mutationFn: () =>
      syncGoogleAdsNow({
        data: { from_date: syncFromDate, to_date: syncToDate },
      }),
    onSuccess: async () => {
      toast.success('Google Ads sync complete.')
      await queryClient.invalidateQueries({
        queryKey: ['org', orgId, 'campaign-settings'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['org', orgId, 'dashboard'],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to sync Google Ads.',
      )
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-label text-muted-foreground">Settings</div>
        <h1 className="text-xl font-semibold text-foreground">Google</h1>
        <p className="text-sm text-muted-foreground">
          Manage Google Ads credentials, ingestion keys, and sync windows.
        </p>
      </div>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Google Ads account</CardTitle>
          <CardDescription>
            Required for pulling campaigns and spend from Google Ads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="google-ads-customer-id">Customer ID</Label>
              <Input
                id="google-ads-customer-id"
                value={googleAdsCustomerId}
                onChange={(event) => setGoogleAdsCustomerId(event.target.value)}
                placeholder="123-456-7890"
                disabled={!orgReady}
              />
            </div>
            <Button
              onClick={() =>
                updateOrgMutation.mutate({
                  google_ads_customer_id:
                    googleAdsCustomerId.trim().length > 0
                      ? googleAdsCustomerId.trim()
                      : null,
                })
              }
              disabled={!orgReady || updateOrgMutation.isPending}
            >
              Save account
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Google Ads credentials</CardTitle>
              <CardDescription>
                Store OAuth credentials securely for this organization.
              </CardDescription>
            </div>
            {credentialsStatusQuery.data?.has_credentials ? (
              <Badge variant="secondary">Saved</Badge>
            ) : (
              <Badge variant="outline">Not set</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="google-ads-client-id">Client ID</Label>
              <Input
                id="google-ads-client-id"
                value={googleAdsClientId}
                onChange={(event) => setGoogleAdsClientId(event.target.value)}
                placeholder="OAuth client ID"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="google-ads-client-secret">Client secret</Label>
              <Input
                id="google-ads-client-secret"
                value={googleAdsClientSecret}
                onChange={(event) =>
                  setGoogleAdsClientSecret(event.target.value)
                }
                placeholder="OAuth client secret"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="google-ads-developer-token">
                Developer token
              </Label>
              <Input
                id="google-ads-developer-token"
                value={googleAdsDeveloperToken}
                onChange={(event) =>
                  setGoogleAdsDeveloperToken(event.target.value)
                }
                placeholder="Developer token"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="google-ads-refresh-token">Refresh token</Label>
              <Input
                id="google-ads-refresh-token"
                value={googleAdsRefreshToken}
                onChange={(event) =>
                  setGoogleAdsRefreshToken(event.target.value)
                }
                placeholder="Refresh token"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="google-ads-mcc-id">MCC / Login customer ID</Label>
              <Input
                id="google-ads-mcc-id"
                value={googleAdsMccId}
                onChange={(event) => setGoogleAdsMccId(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() =>
                saveGoogleAdsMutation.mutate({
                  mcc_id: googleAdsMccId.trim() || undefined,
                  developer_token: googleAdsDeveloperToken.trim() || undefined,
                  refresh_token: googleAdsRefreshToken.trim() || undefined,
                  client_id: googleAdsClientId.trim() || undefined,
                  client_secret: googleAdsClientSecret.trim() || undefined,
                })
              }
              disabled={saveGoogleAdsMutation.isPending}
            >
              Save credentials
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                saveGoogleAdsMutation.mutate({
                  mcc_id: undefined,
                  developer_token: undefined,
                  refresh_token: undefined,
                  client_id: undefined,
                  client_secret: undefined,
                })
              }
              disabled={saveGoogleAdsMutation.isPending}
            >
              Clear credentials
            </Button>
          </div>

          {saveGoogleAdsMutation.error instanceof Error ? (
            <div className="text-sm text-destructive">
              {saveGoogleAdsMutation.error.message}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Sync Google Ads</CardTitle>
          <CardDescription>
            Choose a date range for spend and campaign performance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="google-sync-from">From</Label>
              <Input
                id="google-sync-from"
                type="date"
                value={syncFromDate}
                onChange={(event) => setSyncFromDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="google-sync-to">To</Label>
              <Input
                id="google-sync-to"
                type="date"
                value={syncToDate}
                onChange={(event) => setSyncToDate(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => syncMutation.mutate()}
                disabled={!orgReady || !hasGoogleCustomerId || syncMutation.isPending}
              >
                Sync now
              </Button>
            </div>
          </div>

          {!hasGoogleCustomerId ? (
            <div className="text-sm text-muted-foreground">
              Add a Google Ads customer ID to enable sync.
            </div>
          ) : null}

          {syncMutation.data ? (
            <div className="text-sm text-muted-foreground">
              Synced {syncMutation.data.campaigns_upserted} campaigns and{' '}
              {syncMutation.data.spend_rows_upserted} spend rows.
            </div>
          ) : null}

          {syncMutation.error instanceof Error ? (
            <div className="text-sm text-destructive">
              {syncMutation.error.message}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Ingestion API key</CardTitle>
          <CardDescription>
            Generate a key for pushing lead events into the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <div>
              Active key:{' '}
              {activeKeyQuery.data ? (
                <span className="text-foreground">
                  {activeKeyQuery.data.key_prefix}… (created{' '}
                  {dayjs(activeKeyQuery.data.created_at).format('MMM D, YYYY')})
                </span>
              ) : (
                <span>None yet</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="api-key-label">Label</Label>
              <Input
                id="api-key-label"
                value={newApiKeyLabel}
                onChange={(event) => setNewApiKeyLabel(event.target.value)}
                placeholder="Primary"
              />
            </div>
            <Button
              onClick={() =>
                rotateApiKeyMutation.mutate(
                  newApiKeyLabel.trim().length > 0
                    ? newApiKeyLabel.trim()
                    : undefined,
                )
              }
              disabled={rotateApiKeyMutation.isPending}
            >
              {activeKeyQuery.data ? 'Rotate key' : 'Generate key'}
            </Button>
          </div>

          {generatedApiKey ? (
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="font-medium text-foreground">New API key</div>
              <div className="break-all text-muted-foreground">
                {generatedApiKey}
              </div>
              <div className="text-xs text-muted-foreground">
                Copy this now - it won't be shown again.
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
