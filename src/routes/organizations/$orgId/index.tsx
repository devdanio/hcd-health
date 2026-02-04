import { useAuth } from "@clerk/tanstack-react-start"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import dayjs from "dayjs"
import { useMemo, useState } from "react"

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
import { getDashboard, listLocations } from "@/server/ri/serverFns"
import { formatCents, formatPercent } from "@/utils/money"

export const Route = createFileRoute("/organizations/$orgId/")({
  component: RouteComponent,
})

function RouteComponent() {
  const { orgId: orgIdFromParams } = Route.useParams()
  const { isLoaded, orgId } = useAuth()
  const orgReady = isLoaded && orgId === orgIdFromParams

  const defaultFrom = useMemo(
    () => dayjs().subtract(6, "day").format("YYYY-MM-DD"),
    [],
  )
  const defaultTo = useMemo(() => dayjs().format("YYYY-MM-DD"), [])

  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  const [locationId, setLocationId] = useState<string>("")

  const locationsQuery = useQuery({
    queryKey: ["org", orgIdFromParams, "locations"],
    queryFn: () => listLocations(),
    enabled: orgReady,
  })

  const dashboardQuery = useQuery({
    queryKey: ["org", orgIdFromParams, "dashboard", { fromDate, toDate, locationId }],
    queryFn: () =>
      getDashboard({
        data: {
          from_date: fromDate,
          to_date: toDate,
          location_id: locationId || undefined,
          include_excluded: false,
        },
      }),
    enabled: orgReady,
  })

  return (
    <RequireSignedIn>
      <RequireOrganization orgId={orgIdFromParams}>
        <AppLayout orgId={orgIdFromParams}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="text-label text-muted-foreground">
                  Revenue Intelligence
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Spend → Leads → Patients → Revenue → ROI
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="from-date">From</Label>
                  <Input
                    id="from-date"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to-date">To</Label>
                  <Input
                    id="to-date"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Select
                    value={locationId || "all"}
                    onValueChange={(value) =>
                      setLocationId(value === "all" ? "" : value)
                    }
                  >
                    <SelectTrigger id="location">
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
              </div>
            </div>

            <KpiGrid
              loading={dashboardQuery.isLoading}
              kpis={dashboardQuery.data?.kpis ?? null}
            />

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle>Campaigns</CardTitle>
                    <CardDescription>
                      Performance by location and channel.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Spend</TableHead>
                        <TableHead>Leads</TableHead>
                        <TableHead>Patients</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>ROI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(dashboardQuery.data?.campaigns ?? []).map((r) => (
                        <TableRow key={r.campaign_id ?? "unknown"}>
                          <TableCell className="font-medium">
                            {r.campaign_name ?? r.campaign_id ?? "Unknown"}
                          </TableCell>
                          <TableCell>{r.location_name ?? "—"}</TableCell>
                          <TableCell>{formatCents(r.spend_cents)}</TableCell>
                          <TableCell>{r.leads}</TableCell>
                          <TableCell>{r.patients}</TableCell>
                          <TableCell>
                            {formatCents(r.revenue_cents)}
                          </TableCell>
                          <TableCell>{formatPercent(r.roi)}</TableCell>
                        </TableRow>
                      ))}
                      {dashboardQuery.data?.campaigns.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-muted-foreground"
                          >
                            No data for this range yet.
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

function KpiGrid(props: {
  loading: boolean
  kpis: {
    spend_cents: number
    leads: number
    qualified_leads: number
    patients: number
    revenue_cents: number
    roi: number | null
  } | null
}) {
  const k = props.kpis
  const items = [
    { label: "Spend", value: k ? formatCents(k.spend_cents) : "—" },
    { label: "Leads", value: k ? String(k.leads) : "—" },
    { label: "Qualified", value: k ? String(k.qualified_leads) : "—" },
    { label: "Patients", value: k ? String(k.patients) : "—" },
    { label: "Revenue", value: k ? formatCents(k.revenue_cents) : "—" },
    { label: "ROI", value: k ? formatPercent(k.roi) : "—" },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} className="border-border/60 bg-card/80">
          <CardHeader className="pb-3">
            <CardDescription className="text-label text-muted-foreground">
              {item.label}
            </CardDescription>
            <CardTitle className="text-metric-medium">
              {props.loading ? "…" : item.value}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-1 w-10 rounded-full bg-gradient-data" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
