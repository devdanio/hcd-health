import { useAuth } from '@clerk/tanstack-react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getFacebookBusinessAdAccounts,
  getOrg,
  getOrgSettings,
  syncFacebookAdsNow,
  syncFacebookBusinessCampaignsNow,
  updateOrg,
  updateOrgSettings,
} from '@/server/ri/serverFns'

export const Route = createFileRoute(
  '/organizations/$orgId/settings/facebook-ads',
)({
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

  const settingsQuery = useQuery({
    queryKey: ['org', orgId, 'settings'],
    queryFn: () => getOrgSettings(),
    enabled: orgReady,
  })

  const [orgFormInitialized, setOrgFormInitialized] = useState(false)
  const [facebookAdsAccountId, setFacebookAdsAccountId] = useState('')

  useEffect(() => {
    if (!orgQuery.data || orgFormInitialized) return
    setFacebookAdsAccountId(orgQuery.data.facebook_ads_account_id ?? '')
    setOrgFormInitialized(true)
  }, [orgFormInitialized, orgQuery.data])

  const [settingsFormInitialized, setSettingsFormInitialized] = useState(false)
  const [facebookBusinessId, setFacebookBusinessId] = useState('')
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])

  useEffect(() => {
    if (!settingsQuery.data || settingsFormInitialized) return
    setFacebookBusinessId(settingsQuery.data.config.facebook_business_id ?? '')
    setSelectedAccounts(settingsQuery.data.config.facebook_ad_account_ids ?? [])
    setSettingsFormInitialized(true)
  }, [settingsFormInitialized, settingsQuery.data])

  const [fullSyncStatus, setFullSyncStatus] = useState<{
    current: string
    completed: number
    total: number
    campaignsUpserted: number
    spendRowsUpserted: number
  } | null>(null)
  const fullSyncAbortRef = useRef(false)

  const accountsQuery = useQuery({
    queryKey: ['org', orgId, 'facebook-ad-accounts', facebookBusinessId.trim()],
    queryFn: () =>
      getFacebookBusinessAdAccounts({
        data: { business_id: facebookBusinessId.trim() || undefined },
      }),
    enabled: orgReady && facebookBusinessId.trim().length > 0,
  })

  const updateOrgMutation = useMutation({
    mutationFn: (input: { facebook_ads_account_id?: string | null }) =>
      updateOrg({ data: input }),
    onSuccess: async () => {
      toast.success('Facebook Ads account saved.')
      await queryClient.invalidateQueries({ queryKey: ['org', orgId] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save account.',
      )
    },
  })

  const updateSettingsMutation = useMutation({
    mutationFn: (input: {
      facebook_business_id?: string
      facebook_ad_account_ids?: string[]
    }) => updateOrgSettings({ data: input }),

    onSuccess: async () => {
      toast.success('Facebook Ads settings saved.')
      await queryClient.invalidateQueries({
        queryKey: ['org', orgId, 'settings'],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save settings.',
      )
    },
  })

  const syncCampaignsMutation = useMutation({
    mutationFn: () =>
      syncFacebookBusinessCampaignsNow({
        data: {
          business_id: facebookBusinessId.trim() || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success('Facebook campaigns synced.')
      await queryClient.invalidateQueries({
        queryKey: ['org', orgId, 'campaign-settings'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['org', orgId, 'dashboard'],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to sync campaigns.',
      )
    },
  })

  const syncNowMutation = useMutation({
    mutationFn: () =>
      syncFacebookAdsNow({
        data: {
          from_date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
          to_date: dayjs().format('YYYY-MM-DD'),
        },
      }),
    onSuccess: async () => {
      toast.success('Facebook Ads sync complete.')
      await queryClient.invalidateQueries({
        queryKey: ['org', orgId, 'campaign-settings'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['org', orgId, 'dashboard'],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to sync Facebook Ads.',
      )
    },
  })

  const startFullSync = useCallback(async () => {
    const confirmed = window.confirm(
      'This will sync all historical data going back up to 5 years in 3-month increments. This may take a while. Continue?',
    )
    if (!confirmed) return

    fullSyncAbortRef.current = false
    const now = dayjs()
    const chunks: Array<{ from: string; to: string; label: string }> = []
    for (let i = 0; i < 20; i++) {
      const to = now.subtract(i * 3, 'month')
      const from = now.subtract((i + 1) * 3, 'month')
      chunks.push({
        from: from.format('YYYY-MM-DD'),
        to: to.format('YYYY-MM-DD'),
        label: `${from.format("MMM 'YY")} - ${to.format("MMM 'YY")}`,
      })
    }

    let totalCampaigns = 0
    let totalSpendRows = 0

    for (let i = 0; i < chunks.length; i++) {
      if (fullSyncAbortRef.current) break
      const chunk = chunks[i]
      setFullSyncStatus({
        current: chunk.label,
        completed: i,
        total: chunks.length,
        campaignsUpserted: totalCampaigns,
        spendRowsUpserted: totalSpendRows,
      })

      try {
        const result = await syncFacebookAdsNow({
          data: { from_date: chunk.from, to_date: chunk.to },
        })
        totalCampaigns += result.campaigns_upserted
        totalSpendRows += result.spend_rows_upserted
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : `Failed to sync chunk ${chunk.label}`,
        )
        break
      }
    }

    setFullSyncStatus(null)
    toast.success(
      `Full sync complete: ${totalCampaigns} campaigns, ${totalSpendRows} spend rows.`,
    )
    await queryClient.invalidateQueries({
      queryKey: ['org', orgId, 'campaign-settings'],
    })
    await queryClient.invalidateQueries({
      queryKey: ['org', orgId, 'dashboard'],
    })
  }, [queryClient, orgId])

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts((current) =>
      current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId],
    )
  }

  const allAccounts = accountsQuery.data?.accounts ?? []
  const allAccountIds = allAccounts.map((a) => a.id)
  const selectedSet = new Set(selectedAccounts)
  const allSelected =
    allAccountIds.length > 0 && allAccountIds.every((id) => selectedSet.has(id))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-label text-muted-foreground">Settings</div>
        <h1 className="text-xl font-semibold text-foreground">Facebook</h1>
        <p className="text-sm text-muted-foreground">
          Store Business IDs, select ad accounts, and sync campaigns and spend.
        </p>
      </div>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Default ad account</CardTitle>
          <CardDescription>
            Optional fallback if you are syncing a single account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="facebook-ads-account-id">Ad account ID</Label>
              <Input
                id="facebook-ads-account-id"
                value={facebookAdsAccountId}
                onChange={(event) =>
                  setFacebookAdsAccountId(event.target.value)
                }
                placeholder="act_1234567890"
                disabled={!orgReady}
              />
            </div>
            <Button
              onClick={() =>
                updateOrgMutation.mutate({
                  facebook_ads_account_id:
                    facebookAdsAccountId.trim().length > 0
                      ? facebookAdsAccountId.trim()
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
          <CardTitle>Business ID</CardTitle>
          <CardDescription>
            Used to discover all ad accounts owned/managed by the business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="facebook-business-id">Business ID</Label>
              <Input
                id="facebook-business-id"
                value={facebookBusinessId}
                onChange={(e) => setFacebookBusinessId(e.target.value)}
                placeholder="e.g. 123456789012345"
                disabled={!orgReady}
              />
            </div>
            <Button
              onClick={() =>
                updateSettingsMutation.mutate({
                  facebook_business_id: facebookBusinessId.trim(),
                })
              }
              disabled={!orgReady || updateSettingsMutation.isPending}
            >
              Save
            </Button>
          </div>

          {updateSettingsMutation.error instanceof Error ? (
            <div className="text-sm text-destructive">
              {updateSettingsMutation.error.message}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Ad accounts</CardTitle>
          <CardDescription>
            Select which ad accounts should be synced for campaigns and spend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedAccounts(allAccountIds)}
              disabled={!orgReady || allAccountIds.length === 0}
            >
              Select all
            </Button>
            <Button
              variant="outline"
              onClick={() => setSelectedAccounts([])}
              disabled={!orgReady || selectedAccounts.length === 0}
            >
              Clear
            </Button>
            <Button
              onClick={() =>
                updateSettingsMutation.mutate({
                  facebook_ad_account_ids: selectedAccounts,
                })
              }
              disabled={!orgReady || updateSettingsMutation.isPending}
            >
              Save selection
            </Button>
          </div>

          {accountsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">
              Loading ad accounts...
            </div>
          ) : null}

          {accountsQuery.error instanceof Error ? (
            <div className="text-sm text-destructive">
              {accountsQuery.error.message}
            </div>
          ) : null}

          {allAccounts.length > 0 ? (
            <div className="space-y-2">
              {allAccounts.map((account) => (
                <label
                  key={account.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={selectedSet.has(account.id)}
                    onCheckedChange={() => toggleAccount(account.id)}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {account.name ?? account.id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {account.id}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {facebookBusinessId.trim().length === 0
                ? 'Enter a Business ID to load ad accounts.'
                : 'No ad accounts found for this business.'}
            </div>
          )}

          {allAccounts.length > 0 ? (
            <div className="text-xs text-muted-foreground">
              Selected {selectedAccounts.length} of {allAccounts.length} ad
              accounts.
              {allSelected ? ' (all selected)' : ''}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Sync campaigns</CardTitle>
          <CardDescription>
            Pull campaigns from the selected ad accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => syncCampaignsMutation.mutate()}
            disabled={!orgReady || syncCampaignsMutation.isPending}
          >
            Sync campaigns
          </Button>

          {syncCampaignsMutation.data ? (
            <div className="text-sm text-muted-foreground">
              Synced {syncCampaignsMutation.data.campaigns_upserted} campaigns
              from {syncCampaignsMutation.data.ad_accounts} ad accounts
              (owned: {syncCampaignsMutation.data.owned_ad_accounts}, client:{' '}
              {syncCampaignsMutation.data.client_ad_accounts}).
            </div>
          ) : null}

          {syncCampaignsMutation.error instanceof Error ? (
            <div className="text-sm text-destructive">
              {syncCampaignsMutation.error.message}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Sync spend</CardTitle>
          <CardDescription>
            Pull daily spend from the selected ad accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => syncNowMutation.mutate()}
              disabled={
                !orgReady || syncNowMutation.isPending || !!fullSyncStatus
              }
            >
              {syncNowMutation.isPending ? 'Syncing...' : 'Sync now'}
            </Button>
            <Button
              variant="destructive"
              onClick={startFullSync}
              disabled={
                !orgReady || syncNowMutation.isPending || !!fullSyncStatus
              }
            >
              {fullSyncStatus ? 'Syncing...' : 'Full sync'}
            </Button>
          </div>

          {fullSyncStatus ? (
            <div className="text-sm text-muted-foreground">
              <div className="font-medium text-foreground">
                Now syncing: {fullSyncStatus.current}
              </div>
              <div>
                Chunk {fullSyncStatus.completed + 1} of {fullSyncStatus.total}
                {fullSyncStatus.spendRowsUpserted > 0
                  ? ` — ${fullSyncStatus.campaignsUpserted} campaigns, ${fullSyncStatus.spendRowsUpserted} spend rows so far`
                  : null}
              </div>
            </div>
          ) : null}

          {!fullSyncStatus && syncNowMutation.data ? (
            <div className="text-sm text-muted-foreground">
              Synced {syncNowMutation.data.campaigns_upserted} campaigns and{' '}
              {syncNowMutation.data.spend_rows_upserted} spend rows.
            </div>
          ) : null}

          {syncNowMutation.error instanceof Error ? (
            <div className="text-sm text-destructive">
              {syncNowMutation.error.message}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
