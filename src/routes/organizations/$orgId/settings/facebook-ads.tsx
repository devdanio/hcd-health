import { useAuth } from "@clerk/tanstack-react-start"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { AppLayout } from "@/components/app/AppLayout"
import { RequireOrganization } from "@/components/app/RequireOrganization"
import { RequireSignedIn } from "@/components/app/RequireSignedIn"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getOrgSettings,
  syncFacebookBusinessCampaignsNow,
  updateOrgSettings,
} from "@/server/ri/serverFns"

export const Route = createFileRoute(
  "/organizations/$orgId/settings/facebook-ads",
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { orgId } = Route.useParams()
  const { isLoaded, orgId: activeOrgId } = useAuth()
  const orgReady = isLoaded && activeOrgId === orgId

  const queryClient = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: ["org", orgId, "settings"],
    queryFn: () => getOrgSettings(),
    enabled: orgReady,
  })

  const [formInitialized, setFormInitialized] = useState(false)
  const [facebookBusinessId, setFacebookBusinessId] = useState("")

  useEffect(() => {
    if (!settingsQuery.data || formInitialized) return
    setFacebookBusinessId(settingsQuery.data.config.facebook_business_id ?? "")
    setFormInitialized(true)
  }, [formInitialized, settingsQuery.data])

  const updateSettingsMutation = useMutation({
    mutationFn: (input: { facebook_business_id?: string }) =>
      updateOrgSettings({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "settings"],
      })
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
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "campaign-settings"],
      })
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "dashboard"],
      })
    },
  })

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
                <CardTitle>Sync Campaigns</CardTitle>
                <CardDescription>
                  Pull campaigns from all ad accounts under this business.
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
                    (owned: {syncCampaignsMutation.data.owned_ad_accounts}, client:{" "}
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
