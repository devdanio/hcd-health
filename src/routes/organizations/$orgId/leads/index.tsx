import { useAuth } from '@clerk/tanstack-react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { useState } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  createLead,
  listCampaignSettings,
  listLeads,
  listLeadsForLinking,
  listLocations,
  listPatientsForLinking,
  upsertManualLeadPatientLink,
} from '@/server/ri/serverFns'

export const Route = createFileRoute('/organizations/$orgId/leads/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { orgId } = Route.useParams()
  const { isLoaded, orgId: activeOrgId } = useAuth()
  const orgReady = isLoaded && activeOrgId === orgId
  const queryClient = useQueryClient()

  const [status, setStatus] = useState<string>('')
  const [qualifiedOnly, setQualifiedOnly] = useState(false)
  const [q, setQ] = useState('')
  const [locationId, setLocationId] = useState<string>('')

  const [addPatientOpen, setAddPatientOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newCampaignKey, setNewCampaignKey] = useState('')
  const [patientLinkQ, setPatientLinkQ] = useState('')
  const [leadLinkQ, setLeadLinkQ] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState('')

  const locationsQuery = useQuery({
    queryKey: ['org', orgId, 'locations'],
    queryFn: () => listLocations(),
    enabled: orgReady,
  })

  const campaignsQuery = useQuery({
    queryKey: ['org', orgId, 'campaign-settings'],
    queryFn: () => listCampaignSettings(),
    enabled: orgReady,
  })

  const leadsQuery = useQuery({
    queryKey: ['org', orgId, 'leads', { status, qualifiedOnly, q, locationId }],
    queryFn: () =>
      listLeads({
        data: {
          status: status ? (status as 'lead' | 'patient') : undefined,
          qualified_only: qualifiedOnly || undefined,
          q: q.trim() || undefined,
          location_id: locationId || undefined,
          // limit: 100,
        },
      }),
    enabled: orgReady,
  })

  const patientsForLinkingQuery = useQuery({
    queryKey: ['org', orgId, 'linking-patients', { q: patientLinkQ }],
    queryFn: () =>
      listPatientsForLinking({
        data: {
          q: patientLinkQ.trim() || undefined,
        },
      }),
    enabled: orgReady,
  })

  const leadsForLinkingQuery = useQuery({
    queryKey: ['org', orgId, 'linking-leads', { q: leadLinkQ }],
    queryFn: () =>
      listLeadsForLinking({
        data: {
          q: leadLinkQ.trim() || undefined,
        },
      }),
    enabled: orgReady,
  })

  const selectedPatient =
    (patientsForLinkingQuery.data ?? []).find(
      (patient) => patient.id === selectedPatientId,
    ) ?? null

  const createLeadMutation = useMutation({
    mutationFn: () => {
      const selected = (campaignsQuery.data?.campaigns ?? []).find(
        (c) => `${c.platform}::${c.campaign_id}` === newCampaignKey,
      )
      if (!selected) throw new Error('Select a campaign.')
      return createLead({
        data: {
          name: newName.trim() || undefined,
          phone: newPhone.trim(),
          email: newEmail.trim() || undefined,
          campaign_id: selected.campaign_id,
          platform: selected.platform,
          campaign_name: selected.campaign_name || undefined,
        },
      })
    },
    onSuccess: async () => {
      toast.success('Lead added.')
      setAddPatientOpen(false)
      setNewName('')
      setNewPhone('')
      setNewEmail('')
      setNewCampaignKey('')
      await queryClient.invalidateQueries({ queryKey: ['org', orgId, 'leads'] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to add lead.',
      )
    },
  })

  const linkLeadToPatientMutation = useMutation({
    mutationFn: ({
      leadId,
      patientId,
    }: {
      leadId: string
      patientId: string | null
    }) =>
      upsertManualLeadPatientLink({
        data: {
          lead_id: leadId,
          patient_id: patientId,
        },
      }),
    onSuccess: async (_, variables) => {
      toast.success(
        variables.patientId ? 'Lead linked to patient.' : 'Lead unlinked.',
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['org', orgId, 'leads'] }),
        queryClient.invalidateQueries({
          queryKey: ['org', orgId, 'linking-patients'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['org', orgId, 'linking-leads'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['org', orgId, 'lead', variables.leadId],
        }),
      ])
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update link.',
      )
    },
  })

  return (
    <RequireSignedIn>
      <RequireOrganization orgId={orgId}>
        <AppLayout orgId={orgId}>
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-label text-muted-foreground">
                  Lead Inbox
                </div>
                <h1 className="text-xl font-semibold text-foreground">Leads</h1>
                <p className="text-sm text-muted-foreground">
                  Inbox for front desk conversion + value entry.
                </p>
              </div>
              <Button onClick={() => setAddPatientOpen(true)}>Add lead</Button>
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
                    value={status || 'all'}
                    onValueChange={(value) =>
                      setStatus(value === 'all' ? '' : value)
                    }
                  >
                    <SelectTrigger id="lead-status">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="patient">Patient</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lead-location">Location</Label>
                  <Select
                    value={locationId || 'all'}
                    onValueChange={(value) =>
                      setLocationId(value === 'all' ? '' : value)
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
                    placeholder="Phone, email, or name"
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
                                {lead.name ??
                                  lead.phone ??
                                  lead.email ??
                                  'Unknown'}
                              </Link>
                              <span className="text-xs text-muted-foreground">
                                {lead.phone ?? lead.email ?? '—'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>
                                {lead.campaign_name ??
                                  lead.campaign_id ??
                                  'Unknown/Direct'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {lead.platform ?? '—'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{lead.qualified ? 'Yes' : 'No'}</TableCell>
                          <TableCell>
                            {lead.is_patient ? (
                              <span className="text-emerald-500">Patient</span>
                            ) : (
                              'Lead'
                            )}
                          </TableCell>
                          <TableCell>
                            {dayjs(lead.last_event_at).format(
                              'MMM D, YYYY h:mm A',
                            )}
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

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Manual Lead-Patient Linking</CardTitle>
                <CardDescription>
                  Review all patients and leads, then link them manually.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="manual-patient-search">Patients</Label>
                    <span className="text-xs text-muted-foreground">
                      {(patientsForLinkingQuery.data ?? []).length} loaded
                    </span>
                  </div>
                  <Input
                    id="manual-patient-search"
                    value={patientLinkQ}
                    onChange={(e) => setPatientLinkQ(e.target.value)}
                    placeholder="Search patients by phone, email, or name"
                  />

                  <div className="max-h-[28rem] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Patient</TableHead>
                          <TableHead>First Visit</TableHead>
                          <TableHead>Linked Leads</TableHead>
                          <TableHead className="w-[92px] text-right">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(patientsForLinkingQuery.data ?? []).map((patient) => (
                          <TableRow
                            key={patient.id}
                            className={
                              selectedPatientId === patient.id
                                ? 'bg-accent/40'
                                : undefined
                            }
                          >
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">
                                  {patient.name ??
                                    patient.phone ??
                                    patient.email ??
                                    'Unknown'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {patient.phone ?? patient.email ?? '—'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {patient.created_at_source
                                ? dayjs(patient.created_at_source).format(
                                    'MMM D, YYYY',
                                  )
                                : '—'}
                            </TableCell>
                            <TableCell>{patient.linked_lead_count}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="xs"
                                variant={
                                  selectedPatientId === patient.id
                                    ? 'secondary'
                                    : 'outline'
                                }
                                onClick={() => setSelectedPatientId(patient.id)}
                              >
                                {selectedPatientId === patient.id
                                  ? 'Selected'
                                  : 'Select'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {patientsForLinkingQuery.data?.length === 0 ? (
                          <TableRow>
                            <TableCell
                              className="text-muted-foreground"
                              colSpan={4}
                            >
                              {patientsForLinkingQuery.isLoading
                                ? 'Loading patients...'
                                : 'No patients found.'}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    {selectedPatient ? (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          Selected patient:{' '}
                          <span className="font-medium text-foreground">
                            {selectedPatient.name ??
                              selectedPatient.phone ??
                              selectedPatient.email ??
                              'Unknown'}
                          </span>
                        </div>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setSelectedPatientId('')}
                        >
                          Clear
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        Select a patient to enable lead linking.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="manual-lead-search">Leads</Label>
                    <span className="text-xs text-muted-foreground">
                      {(leadsForLinkingQuery.data ?? []).length} loaded
                    </span>
                  </div>
                  <Input
                    id="manual-lead-search"
                    value={leadLinkQ}
                    onChange={(e) => setLeadLinkQ(e.target.value)}
                    placeholder="Search leads by phone, email, or name"
                  />

                  <div className="max-h-[28rem] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lead</TableHead>
                          <TableHead>Current Linked Patient</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[220px] text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(leadsForLinkingQuery.data ?? []).map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">
                                  {lead.name ??
                                    lead.phone ??
                                    lead.email ??
                                    'Unknown'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {lead.phone ?? lead.email ?? '—'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {lead.linked_patient ? (
                                <div className="flex flex-col">
                                  <span>
                                    {lead.linked_patient.name ??
                                      lead.linked_patient.phone ??
                                      lead.linked_patient.email ??
                                      'Unknown'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {lead.linked_patient.link_reason}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">
                                  Not linked
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {lead.qualified ? 'Qualified' : 'Unqualified'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="xs"
                                  disabled={
                                    !selectedPatient ||
                                    linkLeadToPatientMutation.isPending ||
                                    selectedPatient.id === lead.linked_patient?.id
                                  }
                                  onClick={() => {
                                    if (!selectedPatient) return
                                    linkLeadToPatientMutation.mutate({
                                      leadId: lead.id,
                                      patientId: selectedPatient.id,
                                    })
                                  }}
                                >
                                  {selectedPatient?.id ===
                                  lead.linked_patient?.id
                                    ? 'Linked'
                                    : 'Link Selected'}
                                </Button>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  disabled={
                                    !lead.linked_patient ||
                                    linkLeadToPatientMutation.isPending
                                  }
                                  onClick={() =>
                                    linkLeadToPatientMutation.mutate({
                                      leadId: lead.id,
                                      patientId: null,
                                    })
                                  }
                                >
                                  Unlink
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {leadsForLinkingQuery.data?.length === 0 ? (
                          <TableRow>
                            <TableCell
                              className="text-muted-foreground"
                              colSpan={4}
                            >
                              {leadsForLinkingQuery.isLoading
                                ? 'Loading leads...'
                                : 'No leads found.'}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Sheet open={addPatientOpen} onOpenChange={setAddPatientOpen}>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add lead</SheetTitle>
                  <SheetDescription>
                    Manually add a lead and assign them to a campaign.
                  </SheetDescription>
                </SheetHeader>

                <div className="flex flex-col gap-4 px-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-patient-name">Name</Label>
                    <Input
                      id="new-patient-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-patient-phone">Phone</Label>
                    <Input
                      id="new-patient-phone"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="555-123-4567"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-patient-email">Email</Label>
                    <Input
                      id="new-patient-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="jane@example.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new-patient-campaign">Campaign</Label>
                    <Select
                      value={newCampaignKey || 'none'}
                      onValueChange={(v) =>
                        setNewCampaignKey(v === 'none' ? '' : v)
                      }
                    >
                      <SelectTrigger id="new-patient-campaign">
                        <SelectValue placeholder="Select a campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {(campaignsQuery.data?.campaigns ?? []).map((c) => (
                          <SelectItem
                            key={`${c.platform}::${c.campaign_id}`}
                            value={`${c.platform}::${c.campaign_id}`}
                          >
                            {c.campaign_name ?? c.campaign_id}
                            <span className="ml-1 text-muted-foreground">
                              ({c.campaign_id})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <SheetFooter>
                  <Button
                    onClick={() => createLeadMutation.mutate()}
                    disabled={
                      !newPhone.trim() ||
                      !newCampaignKey ||
                      createLeadMutation.isPending
                    }
                  >
                    {createLeadMutation.isPending ? 'Adding...' : 'Add lead'}
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </AppLayout>
      </RequireOrganization>
    </RequireSignedIn>
  )
}
