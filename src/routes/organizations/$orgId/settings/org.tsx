import { useAuth } from "@clerk/tanstack-react-start"
import dayjs from "dayjs"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { toast } from "sonner"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createLocation,
  generateNewApiKey,
  getOrg,
  listApiKeys,
  listLocations,
  revokeApiKey,
  syncFacebookAdsNow,
  syncGoogleAdsNow,
  updateOrg,
} from "@/server/ri/serverFns"

export const Route = createFileRoute("/organizations/$orgId/settings/org")({
  component: RouteComponent,
})

function RouteComponent() {
  const { orgId } = Route.useParams()
  const { isLoaded, orgId: activeOrgId } = useAuth()
  const orgReady = isLoaded && activeOrgId === orgId

  const queryClient = useQueryClient()

  const orgQuery = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => getOrg(),
    enabled: orgReady,
  })
  const keysQuery = useQuery({
    queryKey: ["org", orgId, "api-keys"],
    queryFn: () => listApiKeys(),
    enabled: orgReady,
  })
  const locationsQuery = useQuery({
    queryKey: ["org", orgId, "locations"],
    queryFn: () => listLocations(),
    enabled: orgReady,
  })

  const [newKeyLabel, setNewKeyLabel] = useState("")
  const [newLocationName, setNewLocationName] = useState("")

  const defaultFrom = useMemo(
    () => dayjs().subtract(7, "day").format("YYYY-MM-DD"),
    [],
  )
  const defaultTo = useMemo(() => dayjs().format("YYYY-MM-DD"), [])
  const [syncFrom, setSyncFrom] = useState(defaultFrom)
  const [syncTo, setSyncTo] = useState(defaultTo)

  const updateOrgMutation = useMutation({
    mutationFn: (input: {
      name?: string
      qualified_call_duration_threshold_sec?: number
      google_ads_customer_id?: string | null
      facebook_ads_account_id?: string | null
    }) => updateOrg({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["org", orgId] })
    },
  })

  const createKeyMutation = useMutation({
    mutationFn: () =>
      generateNewApiKey({ data: { label: newKeyLabel || undefined } }),
    onSuccess: async () => {
      setNewKeyLabel("")
      await queryClient.invalidateQueries({ queryKey: ["org", orgId, "api-keys"] })
    },
  })

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["org", orgId, "api-keys"] })
    },
  })

  const createLocationMutation = useMutation({
    mutationFn: () => createLocation({ data: { name: newLocationName } }),
    onSuccess: async () => {
      toast.success("Location saved.")
      setNewLocationName("")
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "locations"],
      })
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "campaign-settings"],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to save location.",
      )
    },
  })

  const syncMutation = useMutation({
    mutationFn: () =>
      syncGoogleAdsNow({ data: { from_date: syncFrom, to_date: syncTo } }),
    onSuccess: async () => {
      toast.success("Google Ads sync completed.")
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "campaign-settings"],
      })
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "dashboard"],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Google Ads sync failed.",
      )
    },
  })

  const syncFacebookMutation = useMutation({
    mutationFn: () =>
      syncFacebookAdsNow({ data: { from_date: syncFrom, to_date: syncTo } }),
    onSuccess: async () => {
      toast.success("Facebook Ads sync completed.")
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "campaign-settings"],
      })
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "dashboard"],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Facebook Ads sync failed.",
      )
    },
  })

  const org = orgQuery.data

  return (
    <RequireSignedIn>
      <RequireOrganization orgId={orgId}>
        <AppLayout orgId={orgId}>
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-label text-muted-foreground">Organization</div>
              <h1 className="text-xl font-semibold text-foreground">
                Organization
              </h1>
              <p className="text-sm text-muted-foreground">
                Ingestion API keys and org-level defaults.
              </p>
            </div>

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Org Details</CardTitle>
                <CardDescription>Core identifiers and defaults.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="org-id">Org ID</Label>
                    <Input id="org-id" value={org?.id ?? ""} readOnly />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="org-name">Name</Label>
                    <Input
                      id="org-name"
                      defaultValue={org?.name ?? ""}
                      onBlur={(e) => {
                        const name = e.target.value.trim()
                        if (name.length > 0 && name !== org?.name) {
                          updateOrgMutation.mutate({ name })
                        }
                      }}
                      disabled={!orgReady}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="call-threshold">
                      Call qualified threshold (sec)
                    </Label>
                    <Input
                      id="call-threshold"
                      type="number"
                      defaultValue={org?.qualified_call_duration_threshold_sec ?? 60}
                      onBlur={(e) => {
                        const n = Number(e.target.value)
                        if (Number.isFinite(n)) {
                          updateOrgMutation.mutate({
                            qualified_call_duration_threshold_sec: Math.max(
                              0,
                              Math.floor(n),
                            ),
                          })
                        }
                      }}
                      disabled={!orgReady}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="google-ads-customer-id">
                      Google Ads customer ID
                    </Label>
                    <Input
                      id="google-ads-customer-id"
                      defaultValue={org?.google_ads_customer_id ?? ""}
                      placeholder="e.g. 123-456-7890"
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        updateOrgMutation.mutate({
                          google_ads_customer_id: value.length > 0 ? value : null,
                        })
                      }}
                      disabled={!orgReady}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="facebook-ads-account-id">
                      Facebook Ads account ID
                    </Label>
                    <Input
                      id="facebook-ads-account-id"
                      defaultValue={org?.facebook_ads_account_id ?? ""}
                      placeholder="e.g. act_1234567890"
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        updateOrgMutation.mutate({
                          facebook_ads_account_id: value.length > 0 ? value : null,
                        })
                      }}
                      disabled={!orgReady}
                    />
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Ingestion endpoint: <code>/api/ingest/events</code>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Ingestion API Keys</CardTitle>
                <CardDescription>
                  Create keys for data ingestion pipelines.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="new-key-label">New key label</Label>
                    <Input
                      id="new-key-label"
                      value={newKeyLabel}
                      onChange={(e) => setNewKeyLabel(e.target.value)}
                      placeholder="e.g. RudderStack Prod"
                      disabled={!orgReady}
                    />
                  </div>
                  <Button
                    onClick={() => createKeyMutation.mutate()}
                    disabled={!orgReady || createKeyMutation.isPending}
                  >
                    Generate key
                  </Button>
                </div>

                {createKeyMutation.data?.api_key ? (
                  <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
                    <div className="font-medium text-foreground">New API key</div>
                    <div className="break-all text-muted-foreground">
                      {createKeyMutation.data.api_key}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Copy this now — it won’t be shown again.
                    </div>
                  </div>
                ) : null}

                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prefix</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Last used</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(keysQuery.data ?? []).map((k) => (
                        <TableRow key={k.id}>
                          <TableCell>{k.key_prefix}</TableCell>
                          <TableCell>{k.label ?? "—"}</TableCell>
                          <TableCell>
                            {new Date(k.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {k.last_used_at
                              ? new Date(k.last_used_at).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell>{k.revoked_at ? "revoked" : "active"}</TableCell>
                          <TableCell>
                            {!k.revoked_at ? (
                              <Button
                                variant="link"
                                size="sm"
                                className="px-0 text-destructive"
                                onClick={() => revokeKeyMutation.mutate(k.id)}
                                disabled={!orgReady || revokeKeyMutation.isPending}
                              >
                                Revoke
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(keysQuery.data?.length ?? 0) === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-muted-foreground">
                            No API keys yet.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Locations</CardTitle>
                <CardDescription>
                  Locations are used for campaign reporting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="new-location-name">New location</Label>
                    <Input
                      id="new-location-name"
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      placeholder="e.g. Denver"
                      disabled={!orgReady}
                    />
                  </div>
                  <Button
                    onClick={() => createLocationMutation.mutate()}
                    disabled={
                      !orgReady ||
                      createLocationMutation.isPending ||
                      newLocationName.trim().length === 0
                    }
                  >
                    Add location
                  </Button>
                </div>

                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(locationsQuery.data ?? []).map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{l.name}</TableCell>
                        </TableRow>
                      ))}
                      {(locationsQuery.data?.length ?? 0) === 0 ? (
                        <TableRow>
                          <TableCell className="text-muted-foreground">
                            No locations yet.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Google Ads Sync</CardTitle>
                <CardDescription>
                  Manual spend + campaign sync. Recommended daily automation later.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sync-from">From</Label>
                    <Input
                      id="sync-from"
                      type="date"
                      value={syncFrom}
                      onChange={(e) => setSyncFrom(e.target.value)}
                      disabled={!orgReady}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sync-to">To</Label>
                    <Input
                      id="sync-to"
                      type="date"
                      value={syncTo}
                      onChange={(e) => setSyncTo(e.target.value)}
                      disabled={!orgReady}
                    />
                  </div>
                  <Button
                    onClick={() => syncMutation.mutate()}
                    disabled={!orgReady || syncMutation.isPending}
                  >
                    Sync now
                  </Button>
                </div>

                {syncMutation.error instanceof Error ? (
                  <div className="text-sm text-destructive">
                    {syncMutation.error.message}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Facebook Ads Sync</CardTitle>
                <CardDescription>
                  Manual spend + campaign sync using the shared access token.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="facebook-sync-from">From</Label>
                    <Input
                      id="facebook-sync-from"
                      type="date"
                      value={syncFrom}
                      onChange={(e) => setSyncFrom(e.target.value)}
                      disabled={!orgReady}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="facebook-sync-to">To</Label>
                    <Input
                      id="facebook-sync-to"
                      type="date"
                      value={syncTo}
                      onChange={(e) => setSyncTo(e.target.value)}
                      disabled={!orgReady}
                    />
                  </div>
                  <Button
                    onClick={() => syncFacebookMutation.mutate()}
                    disabled={!orgReady || syncFacebookMutation.isPending}
                  >
                    Sync now
                  </Button>
                </div>

                {syncFacebookMutation.error instanceof Error ? (
                  <div className="text-sm text-destructive">
                    {syncFacebookMutation.error.message}
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
