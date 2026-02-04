import { useAuth } from "@clerk/tanstack-react-start"
import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { listLeads, listLocations } from "@/server/ri/serverFns"

export const Route = createFileRoute("/organizations/$orgId/leads/")({
  component: RouteComponent,
})

function RouteComponent() {
  const { orgId } = Route.useParams()
  const { isLoaded, orgId: activeOrgId } = useAuth()
  const orgReady = isLoaded && activeOrgId === orgId

  const [status, setStatus] = useState<string>("")
  const [qualifiedOnly, setQualifiedOnly] = useState(false)
  const [q, setQ] = useState("")
  const [locationId, setLocationId] = useState<string>("")

  const locationsQuery = useQuery({
    queryKey: ["org", orgId, "locations"],
    queryFn: () => listLocations(),
    enabled: orgReady,
  })

  const leadsQuery = useQuery({
    queryKey: ["org", orgId, "leads", { status, qualifiedOnly, q, locationId }],
    queryFn: () =>
      listLeads({
        data: {
          status: status ? (status as "new" | "patient" | "not_patient") : undefined,
          qualified_only: qualifiedOnly || undefined,
          q: q.trim() || undefined,
          location_id: locationId || undefined,
          limit: 100,
        },
      }),
    enabled: orgReady,
  })

  return (
    <RequireSignedIn>
      <RequireOrganization orgId={orgId}>
        <AppLayout orgId={orgId}>
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-label text-muted-foreground">Lead Inbox</div>
              <h1 className="text-xl font-semibold text-foreground">Leads</h1>
              <p className="text-sm text-muted-foreground">
                Inbox for front desk conversion + value entry.
              </p>
            </div>

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Filters</CardTitle>
                <CardDescription>Refine your lead list.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-status">Status</Label>
                  <Select
                    value={status || "all"}
                    onValueChange={(value) =>
                      setStatus(value === "all" ? "" : value)
                    }
                  >
                    <SelectTrigger id="lead-status">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="patient">Patient</SelectItem>
                      <SelectItem value="not_patient">Not a Patient</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lead-location">Location</Label>
                  <Select
                    value={locationId || "all"}
                    onValueChange={(value) =>
                      setLocationId(value === "all" ? "" : value)
                    }
                  >
                    <SelectTrigger id="lead-location">
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {(locationsQuery.data ?? []).map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lead-search">Search</Label>
                  <Input
                    id="lead-search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Phone or name"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <Checkbox
                    id="qualified-only"
                    checked={qualifiedOnly}
                    onCheckedChange={(value) => setQualifiedOnly(!!value)}
                  />
                  <Label htmlFor="qualified-only">Qualified only</Label>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Inbox</CardTitle>
                <CardDescription>Latest lead activity.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Qualified</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(leadsQuery.data ?? []).map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <Link
                                to="/organizations/$orgId/leads/$leadId"
                                params={{ orgId, leadId: lead.id }}
                                className="font-medium text-foreground hover:underline"
                              >
                                {lead.name ?? lead.phone}
                              </Link>
                              <span className="text-xs text-muted-foreground">
                                {lead.phone}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>
                                {lead.campaign_name ??
                                  lead.campaign_id ??
                                  "Unknown/Direct"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {lead.platform ?? "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{lead.qualified ? "Yes" : "No"}</TableCell>
                          <TableCell>{lead.status}</TableCell>
                          <TableCell>
                            {new Date(lead.last_event_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {leadsQuery.data?.length === 0 ? (
                        <TableRow>
                          <TableCell
                            className="text-muted-foreground"
                            colSpan={5}
                          >
                            No leads found.
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
