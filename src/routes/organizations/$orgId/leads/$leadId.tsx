import { useAuth } from "@clerk/tanstack-react-start"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"

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
  getLeadDetail,
  upsertPatientValue,
} from "@/server/ri/serverFns"
import { parseDollarsToCents } from "@/utils/helpers"
import { formatCents } from "@/utils/money"

export const Route = createFileRoute("/organizations/$orgId/leads/$leadId")({
  component: RouteComponent,
})

function RouteComponent() {
  const { orgId, leadId } = Route.useParams()
  const { isLoaded, orgId: activeOrgId } = useAuth()
  const orgReady = isLoaded && activeOrgId === orgId

  const queryClient = useQueryClient()

  const leadQuery = useQuery({
    queryKey: ["org", orgId, "lead", leadId],
    queryFn: () => getLeadDetail({ data: { lead_id: leadId } }),
    enabled: orgReady,
  })

  const lead = leadQuery.data

  const [ltv, setLtv] = useState("")
  const [cash, setCash] = useState("")

  const initialValues = useMemo(() => {
    const pv = lead?.patient_values
    return {
      ltv: pv?.ltv_cents != null ? String(pv.ltv_cents / 100) : "",
      cash:
        pv?.cash_collected_to_date_cents != null
          ? String(pv.cash_collected_to_date_cents / 100)
          : "",
    }
  }, [lead?.patient_values])

  useEffect(() => {
    if (!lead) return
    if (ltv.length === 0 && initialValues.ltv) setLtv(initialValues.ltv)
    if (cash.length === 0 && initialValues.cash) setCash(initialValues.cash)
  }, [lead, initialValues, ltv.length, cash.length])

  const saveValueMutation = useMutation({
    mutationFn: () => {
      const ltvCents = ltv.trim().length > 0 ? parseDollarsToCents(ltv) : null
      const cashCents =
        cash.trim().length > 0 ? parseDollarsToCents(cash) : null

      if (ltvCents === null && ltv.trim().length > 0) {
        throw new Error("Invalid LTV")
      }
      if (cashCents === null && cash.trim().length > 0) {
        throw new Error("Invalid cash collected")
      }

      return upsertPatientValue({
        data: {
          lead_id: leadId,
          ltv_cents: ltvCents,
          cash_collected_to_date_cents: cashCents,
        },
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "lead", leadId],
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
          {leadQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : !lead ? (
            <div className="text-sm text-muted-foreground">Lead not found.</div>
          ) : (
            <LeadDetail
              lead={lead}
              ltv={ltv}
              cash={cash}
              setLtv={setLtv}
              setCash={setCash}
              saveValue={() => saveValueMutation.mutate()}
              saveError={
                saveValueMutation.error instanceof Error
                  ? saveValueMutation.error.message
                  : null
              }
            />
          )}
        </AppLayout>
      </RequireOrganization>
    </RequireSignedIn>
  )
}

function LeadDetail(props: {
  lead: Awaited<ReturnType<typeof getLeadDetail>>
  ltv: string
  cash: string
  setLtv: (v: string) => void
  setCash: (v: string) => void
  saveValue: () => void
  saveError: string | null
}) {
  const lead = props.lead
  const pv = lead.patient_values
  const ltvCents = pv?.ltv_cents ?? null
  const cashCents = pv?.cash_collected_to_date_cents ?? null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="text-label text-muted-foreground">Lead detail</div>
          <h1 className="text-xl font-semibold text-foreground">
            {lead.name ?? lead.phone ?? lead.email ?? "Unknown"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lead.phone ?? lead.email ?? "—"} • Created{" "}
            {new Date(lead.first_event_at).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>Lead qualification snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm text-foreground">
              {lead.linked_patient ? (
                <span className="text-emerald-500">Patient</span>
              ) : (
                "Lead"
              )}
            </div>
            <div className="text-sm text-foreground">
              Qualified: {lead.qualified ? "Yes" : "No"}
            </div>
            {lead.linked_patient ? (
              <div className="mt-2 rounded-md border border-border/60 bg-muted/10 p-2 text-sm">
                <div className="text-muted-foreground">Linked patient</div>
                <div className="font-medium text-foreground">
                  {lead.linked_patient.name ?? lead.linked_patient.phone ?? "Unknown"}
                </div>
                {lead.linked_patient.created_at_source ? (
                  <div className="text-xs text-muted-foreground">
                    First visit: {new Date(lead.linked_patient.created_at_source).toLocaleDateString()}
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80 md:col-span-2">
          <CardHeader>
            <CardTitle>Attribution (first event)</CardTitle>
            <CardDescription>Source details captured at intake.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Campaign</span>
                <div className="text-foreground">
                  {lead.utm_campaign ?? lead.campaign_id ?? "Unknown/Direct"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Platform</span>
                <div className="text-foreground">{lead.platform ?? "—"}</div>
              </div>
              <div>
                <span className="text-muted-foreground">gclid</span>
                <div className="break-all text-foreground">
                  {lead.gclid ?? "—"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Landing page</span>
                <div className="break-all text-foreground">
                  {lead.landing_page ?? "—"}
                </div>
              </div>
              <div className="md:col-span-2">
                <span className="text-muted-foreground">Referrer</span>
                <div className="break-all text-foreground">
                  {lead.referrer ?? "—"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Patient Value (LTV)</CardTitle>
          <CardDescription>Record confirmed revenue attribution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-ltv">LTV ($)</Label>
              <Input
                id="lead-ltv"
                value={props.ltv}
                onChange={(e) => props.setLtv(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-cash">Cash collected to date ($)</Label>
              <Input
                id="lead-cash"
                value={props.cash}
                onChange={(e) => props.setCash(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={props.saveValue}>Save</Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Current LTV:{" "}
            <span className="font-medium text-foreground">
              {ltvCents != null ? formatCents(ltvCents) : "—"}
            </span>
            {" • "}Cash collected:{" "}
            <span className="font-medium text-foreground">
              {cashCents != null ? formatCents(cashCents) : "—"}
            </span>
          </div>

          {props.saveError ? (
            <div className="text-sm text-red-600">{props.saveError}</div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Activity history for this lead.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {lead.lead_events.map((e) => (
              <div key={e.id} className="rounded-md border border-border/60 bg-muted/10 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">
                    {e.event_type}
                    {e.qualified ? (
                      <span className="ml-2 text-xs text-emerald-400">
                        qualified
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.occurred_at).toLocaleString()}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-3">
                  <div>campaign_id: {e.campaign_id ?? "—"}</div>
                  <div>utm_campaign: {e.utm_campaign ?? "—"}</div>
                  <div>gclid: {e.gclid ?? "—"}</div>
                </div>
                {typeof e.duration_sec === "number" ? (
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
  )
}
