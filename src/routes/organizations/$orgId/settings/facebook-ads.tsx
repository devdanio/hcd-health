import { useAuth } from '@clerk/tanstack-react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getFacebookBusinessAdAccounts,
  getOrgSettings,
  syncFacebookBusinessCampaignsNow,
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

  const settingsQuery = useQuery({
    queryKey: ['org', orgId, 'settings'],
    queryFn: () => getOrgSettings(),
    enabled: orgReady,
  })

  const [formInitialized, setFormInitialized] = useState(false)
  const [facebookBusinessId, setFacebookBusinessId] = useState('')
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])

  useEffect(() => {
    if (!settingsQuery.data || formInitialized) return
    setFacebookBusinessId(settingsQuery.data.config.facebook_business_id ?? '')
    setSelectedAccounts(settingsQuery.data.config.facebook_ad_account_ids ?? [])
    setFormInitialized(true)
  }, [formInitialized, settingsQuery.data])

  const accountsQuery = useQuery({
    queryKey: ['org', orgId, 'facebook-ad-accounts', facebookBusinessId.trim()],
    queryFn: () =>
      getFacebookBusinessAdAccounts({
        data: { business_id: facebookBusinessId.trim() || undefined },
      }),
    enabled: orgReady && facebookBusinessId.trim().length > 0,
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
    <RequireSignedIn>
      <RequireOrganization orgId={orgId}>
        <AppLayout orgId={orgId}>
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-label text-muted-foreground">Settings</div>
              <h1 className="text-xl font-semibold text-foreground">
                Facebook Ads
              </h1>
              <p className="text-sm text-muted-foreground">
                Store your Business ID and sync campaign metadata across ad
                accounts.
              </p>
            </div>

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Business ID</CardTitle>
                <CardDescription>
                  Used to discover all ad accounts owned/managed by the
                  business.
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
                        facebook_business_id:
                          facebookBusinessId.trim() || undefined,
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
                <CardTitle>Ad Accounts</CardTitle>
                <CardDescription>
                  Select which ad accounts should be synced for campaigns and
                  spend.
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
                    Loading ad accounts…
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
                    Selected {selectedAccounts.length} of {allAccounts.length}{' '}
                    ad accounts.
                    {allSelected ? ' (all selected)' : ''}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Sync Campaigns</CardTitle>
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
                    Synced {syncCampaignsMutation.data.campaigns_upserted}{' '}
                    campaigns from {syncCampaignsMutation.data.ad_accounts} ad
                    accounts (owned:{' '}
                    {syncCampaignsMutation.data.owned_ad_accounts}, client:{' '}
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
          </div>
        </AppLayout>
      </RequireOrganization>
    </RequireSignedIn>
  )
}
