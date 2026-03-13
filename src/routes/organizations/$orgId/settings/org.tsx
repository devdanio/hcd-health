import { useAuth } from '@clerk/tanstack-react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  createLocation,
  getOrg,
  getOrgSettings,
  listLocations,
  updateOrg,
  updateOrgSettings,
} from '@/server/ri/serverFns'

export const Route = createFileRoute('/organizations/$orgId/settings/org')({
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

  const locationsQuery = useQuery({
    queryKey: ['org', orgId, 'locations'],
    queryFn: () => listLocations(),
    enabled: orgReady,
  })

  const [orgFormInitialized, setOrgFormInitialized] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [callThreshold, setCallThreshold] = useState(60)

  useEffect(() => {
    if (!orgQuery.data || orgFormInitialized) return
    setOrgName(orgQuery.data.name ?? '')
    setCallThreshold(orgQuery.data.qualified_call_duration_threshold_sec ?? 60)
    setOrgFormInitialized(true)
  }, [orgFormInitialized, orgQuery.data])

  const [settingsFormInitialized, setSettingsFormInitialized] = useState(false)
  const [primaryContactEmail, setPrimaryContactEmail] = useState('')
  const [timezone, setTimezone] = useState('')
  const [accountIds, setAccountIds] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [dataSyncStartDate, setDataSyncStartDate] = useState('')
  const [allowedIps, setAllowedIps] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!settingsQuery.data || settingsFormInitialized) return
    const config = settingsQuery.data.config
    setPrimaryContactEmail(config.primary_contact_email)
    setTimezone(config.timezone)
    setAccountIds(config.account_ids)
    setWebhookUrl(config.webhook_url)
    setDataSyncStartDate(config.data_sync_start_date)
    setAllowedIps(config.allowed_ips)
    setNotes(config.notes)
    setSettingsFormInitialized(true)
  }, [settingsFormInitialized, settingsQuery.data])

  const updateOrgMutation = useMutation({
    mutationFn: (input: {
      name?: string
      qualified_call_duration_threshold_sec?: number
    }) => updateOrg({ data: input }),
    onSuccess: async () => {
      toast.success('Organization details saved.')
      await queryClient.invalidateQueries({ queryKey: ['org', orgId] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save organization.',
      )
    },
  })

  const updateSettingsMutation = useMutation({
    mutationFn: (input: {
      primary_contact_email?: string
      timezone?: string
      account_ids?: string
      webhook_url?: string
      data_sync_start_date?: string
      allowed_ips?: string
      notes?: string
    }) => updateOrgSettings({ data: input }),
    onSuccess: async () => {
      toast.success('Organization settings saved.')
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

  const [newLocationName, setNewLocationName] = useState('')
  const createLocationMutation = useMutation({
    mutationFn: () => createLocation({ data: { name: newLocationName } }),
    onSuccess: async () => {
      toast.success('Location saved.')
      setNewLocationName('')
      await queryClient.invalidateQueries({
        queryKey: ['org', orgId, 'locations'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['org', orgId, 'campaign-settings'],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save location.',
      )
    },
  })

  const org = orgQuery.data

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-label text-muted-foreground">Organization</div>
        <h1 className="text-xl font-semibold text-foreground">Org settings</h1>
        <p className="text-sm text-muted-foreground">
          Organization details, operational settings, and locations.
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
              <Input id="org-id" value={org?.id ?? ''} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
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
                value={callThreshold}
                onChange={(e) => setCallThreshold(Number(e.target.value))}
                disabled={!orgReady}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                updateOrgMutation.mutate({
                  name: orgName.trim() || undefined,
                  qualified_call_duration_threshold_sec: Number.isFinite(
                    callThreshold,
                  )
                    ? Math.max(0, Math.floor(callThreshold))
                    : undefined,
                })
              }
              disabled={!orgReady || updateOrgMutation.isPending}
            >
              Save org details
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
          <CardDescription>
            Optional details used for operations and integrations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="primary-contact">Primary contact email</Label>
              <Input
                id="primary-contact"
                value={primaryContactEmail}
                onChange={(event) => setPrimaryContactEmail(event.target.value)}
                placeholder="ops@client.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="America/Denver"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="account-ids">Account IDs</Label>
              <Input
                id="account-ids"
                value={accountIds}
                onChange={(event) => setAccountIds(event.target.value)}
                placeholder="Comma-separated"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
                placeholder="https://client.com/webhooks/hcd"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="data-sync-start">Data sync start date</Label>
              <Input
                id="data-sync-start"
                value={dataSyncStartDate}
                onChange={(event) => setDataSyncStartDate(event.target.value)}
                placeholder="YYYY-MM-DD"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="allowed-ips">Allowed IPs</Label>
              <Input
                id="allowed-ips"
                value={allowedIps}
                onChange={(event) => setAllowedIps(event.target.value)}
                placeholder="1.2.3.4, 5.6.7.8"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={cn(
                'min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-none',
                'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              )}
              placeholder="Anything else you want to capture for this client."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() =>
                updateSettingsMutation.mutate({
                  primary_contact_email: primaryContactEmail,
                  timezone,
                  account_ids: accountIds,
                  webhook_url: webhookUrl,
                  data_sync_start_date: dataSyncStartDate,
                  allowed_ips: allowedIps,
                  notes,
                })
              }
              disabled={!orgReady || updateSettingsMutation.isPending}
            >
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>Locations are used for campaign reporting.</CardDescription>
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
    </div>
  )
}
