import { useAuth } from "@clerk/tanstack-react-start"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { AppLayout } from "@/components/app/AppLayout"
import { RequireOrganization } from "@/components/app/RequireOrganization"
import { RequireSignedIn } from "@/components/app/RequireSignedIn"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { listCampaignSettings, upsertCampaignSetting } from "@/server/ri/serverFns"
import { formatCents } from "@/utils/money"

export const Route = createFileRoute(
  "/organizations/$orgId/settings/campaigns",
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { orgId } = Route.useParams()
  const { isLoaded, orgId: activeOrgId } = useAuth()
  const orgReady = isLoaded && activeOrgId === orgId

  const queryClient = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: ["org", orgId, "campaign-settings"],
    queryFn: () => listCampaignSettings(),
    enabled: orgReady,
  })

  const updateMutation = useMutation({
    mutationFn: (input: {
      platform: string
      campaign_id: string
      location_id: string | null
      include_in_reporting: boolean
      campaign_category: "branded" | "non_branded" | "other" | null
    }) => upsertCampaignSetting({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "campaign-settings"],
      })
      await queryClient.invalidateQueries({ queryKey: ["org", orgId, "dashboard"] })
    },
  })

  const data = settingsQuery.data

  return (
    <RequireSignedIn>
      <RequireOrganization orgId={orgId}>
        <AppLayout orgId={orgId}>
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-label text-muted-foreground">
                Campaign Settings
              </div>
              <h1 className="text-xl font-semibold text-foreground">
                Campaign Settings
              </h1>
              <p className="text-sm text-muted-foreground">
                Map campaigns to locations and include/exclude them from reporting.
              </p>
            </div>

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Campaigns</CardTitle>
                <CardDescription>
                  Assign locations and categorize campaigns across platforms.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last 7d Spend</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Include</TableHead>
                        <TableHead>Category</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.campaigns ?? []).map((c) => (
                        <TableRow key={`${c.platform}:${c.campaign_id}`}>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.platform === "google_ads"
                              ? "Google Ads"
                              : c.platform === "facebook_ads"
                                ? "Facebook Ads"
                                : c.platform}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {c.campaign_name ?? c.campaign_id}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                id: {c.campaign_id}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{c.status}</TableCell>
                          <TableCell>
                            {formatCents(c.last_7d_spend_cents)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={c.location_id ?? "unassigned"}
                              onValueChange={(value) =>
                                updateMutation.mutate({
                                  platform: c.platform,
                                  campaign_id: c.campaign_id,
                                  location_id:
                                    value === "unassigned" ? null : value,
                                  include_in_reporting: c.include_in_reporting,
                                  campaign_category: c.campaign_category,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Unassigned/Shared" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">
                                  Unassigned/Shared
                                </SelectItem>
                                {(data?.locations ?? []).map((l) => (
                                  <SelectItem key={l.id} value={l.id}>
                                    {l.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={c.include_in_reporting}
                              onCheckedChange={(value) =>
                                updateMutation.mutate({
                                  platform: c.platform,
                                  campaign_id: c.campaign_id,
                                  location_id: c.location_id,
                                  include_in_reporting: !!value,
                                  campaign_category: c.campaign_category,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={c.campaign_category ?? "none"}
                              onValueChange={(value) =>
                                updateMutation.mutate({
                                  platform: c.platform,
                                  campaign_id: c.campaign_id,
                                  location_id: c.location_id,
                                  include_in_reporting: c.include_in_reporting,
                                  campaign_category:
                                    (value as
                                      | "branded"
                                      | "non_branded"
                                      | "other"
                                      | "none") === "none"
                                      ? null
                                      : (value as
                                          | "branded"
                                          | "non_branded"
                                          | "other"),
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                <SelectItem value="branded">branded</SelectItem>
                                <SelectItem value="non_branded">
                                  non_branded
                                </SelectItem>
                                <SelectItem value="other">other</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                      {data?.campaigns.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-muted-foreground">
                            No campaigns yet. Run a Google or Facebook Ads sync or
                            ingest leads with a `campaign_id`.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </AppLayout>
      </RequireOrganization>
    </RequireSignedIn>
  )
}
