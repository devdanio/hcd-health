import { useAuth } from "@clerk/tanstack-react-start"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app/AppLayout"
import { RequireOrganization } from "@/components/app/RequireOrganization"
import { RequireSignedIn } from "@/components/app/RequireSignedIn"
import { Badge } from "@/components/ui/badge"
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
import { env } from "@/env"
import { cn } from "@/lib/utils"
import {
  getActiveApiKey,
  getGoogleAdsCredentialsStatus,
  getOrg,
  getOrgSettings,
  rotateApiKey,
  saveGoogleAdsCredentials,
  updateOrg,
  updateOrgSettings,
} from "@/server/ri/serverFns"

const steps = [
  "Org basics",
  "Google Ads credentials",
  "API key",
  "Org settings",
  "Next steps",
] as const

export const Route = createFileRoute("/organizations/$orgId/onboarding")({
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

  const credentialsStatusQuery = useQuery({
    queryKey: ["org", orgId, "google-ads-credentials"],
    queryFn: () => getGoogleAdsCredentialsStatus(),
    enabled: orgReady,
  })

  const settingsQuery = useQuery({
    queryKey: ["org", orgId, "settings"],
    queryFn: () => getOrgSettings(),
    enabled: orgReady,
  })

  const activeKeyQuery = useQuery({
    queryKey: ["org", orgId, "active-api-key"],
    queryFn: () => getActiveApiKey(),
    enabled: orgReady,
  })

  const [step, setStep] = useState(1)

  const [orgFormInitialized, setOrgFormInitialized] = useState(false)
  const [orgName, setOrgName] = useState("")
  const [googleAdsCustomerId, setGoogleAdsCustomerId] = useState("")
  const [facebookAdsAccountId, setFacebookAdsAccountId] = useState("")

  useEffect(() => {
    if (!orgQuery.data || orgFormInitialized) return
    setOrgName(orgQuery.data.name ?? "")
    setGoogleAdsCustomerId(orgQuery.data.google_ads_customer_id ?? "")
    setFacebookAdsAccountId(orgQuery.data.facebook_ads_account_id ?? "")
    setOrgFormInitialized(true)
  }, [orgFormInitialized, orgQuery.data])

  const [googleAdsDeveloperToken, setGoogleAdsDeveloperToken] = useState("")
  const [googleAdsClientId, setGoogleAdsClientId] = useState("")
  const [googleAdsClientSecret, setGoogleAdsClientSecret] = useState("")
  const [googleAdsRefreshToken, setGoogleAdsRefreshToken] = useState("")
  const [googleAdsMccId, setGoogleAdsMccId] = useState("")

  const [settingsFormInitialized, setSettingsFormInitialized] = useState(false)
  const [primaryContactEmail, setPrimaryContactEmail] = useState("")
  const [timezone, setTimezone] = useState("")
  const [accountIds, setAccountIds] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [dataSyncStartDate, setDataSyncStartDate] = useState("")
  const [allowedIps, setAllowedIps] = useState("")
  const [notes, setNotes] = useState("")

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

  const [newApiKeyLabel, setNewApiKeyLabel] = useState("Primary")
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null)

  const updateOrgMutation = useMutation({
    mutationFn: (input: {
      name?: string
      google_ads_customer_id?: string | null
      facebook_ads_account_id?: string | null
    }) => updateOrg({ data: input }),
    onSuccess: async () => {
      toast.success("Organization basics saved.")
      await queryClient.invalidateQueries({ queryKey: ["org", orgId] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to save organization.",
      )
    },
  })

  const saveGoogleAdsMutation = useMutation({
    mutationFn: (input: {
      customer_id?: string
      mcc_id?: string
      developer_token?: string
      refresh_token?: string
      client_id?: string
      client_secret?: string
    }) => saveGoogleAdsCredentials({ data: input }),
    onSuccess: async () => {
      toast.success("Google Ads credentials saved.")
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "google-ads-credentials"],
      })
      await queryClient.invalidateQueries({ queryKey: ["org", orgId] })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save Google Ads credentials.",
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
      toast.success("Organization settings saved.")
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "settings"],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings.",
      )
    },
  })

  const rotateApiKeyMutation = useMutation({
    mutationFn: (label?: string) => rotateApiKey({ data: { label } }),
    onSuccess: async (data) => {
      toast.success("API key generated.")
      setGeneratedApiKey(data.api_key)
      await queryClient.invalidateQueries({
        queryKey: ["org", orgId, "active-api-key"],
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate API key.",
      )
    },
  })

  const apiHostUrl = env.VITE_API_HOST_URL ?? "https://api.highcountrydigital.io"

  const fetchSnippet = useMemo(() => {
    const apiKey = generatedApiKey ?? "YOUR_API_KEY"
    return `const API_HOST_URL = import.meta.env.VITE_API_HOST_URL ?? "https://api.highcountrydigital.io"\n\nconst API_KEY = "${apiKey}"\n\nawait fetch(\`${"${API_HOST_URL}"}/api/ingest/events\`, {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    Authorization: \`Bearer ${"${API_KEY}"}\`,\n  },\n  body: JSON.stringify({\n    organization_id: "${orgId}",\n    event_type: "form",\n    occurred_at: new Date().toISOString(),\n    phone: "+15555555555",\n    name: "Test Lead",\n    platform: "google_ads",\n    campaign_id: "1234567890",\n    gclid: "EAIaIQobChMI8a...",\n    utm_source: "google",\n    utm_medium: "cpc",\n    utm_campaign: "brand-search",\n    utm_content: "ad-variation-a",\n    utm_term: "family dentist near me",\n    referrer: "https://www.google.com/",\n    landing_page: "https://clientsite.com/landing-page",\n  }),\n})\n`
  }, [generatedApiKey, orgId])

  const continueTo = (nextStep: number) => setStep(nextStep)

  return (
    <RequireSignedIn>
      <RequireOrganization orgId={orgId}>
        <AppLayout orgId={orgId}>
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-label text-muted-foreground">Onboarding</div>
              <h1 className="text-xl font-semibold text-foreground">
                New client onboarding
              </h1>
              <p className="text-sm text-muted-foreground">
                Capture credentials, generate an API key, and finalize integration
                steps.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {steps.map((label, index) => {
                const stepNumber = index + 1
                const isActive = stepNumber === step
                return (
                  <Button
                    key={label}
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    onClick={() => setStep(stepNumber)}
                  >
                    {stepNumber}. {label}
                  </Button>
                )
              })}
            </div>

            <div className="text-sm text-muted-foreground">
              Step {step} of {steps.length}
            </div>

            {!orgReady ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : null}

            {step === 1 ? (
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle>Organization basics</CardTitle>
                  <CardDescription>
                    Core identifiers for this client.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="org-id">Org ID</Label>
                      <Input id="org-id" value={orgId} readOnly />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="org-name">Organization name</Label>
                      <Input
                        id="org-name"
                        value={orgName}
                        onChange={(event) => setOrgName(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="google-ads-customer-id">
                        Google Ads customer ID
                      </Label>
                      <Input
                        id="google-ads-customer-id"
                        value={googleAdsCustomerId}
                        onChange={(event) =>
                          setGoogleAdsCustomerId(event.target.value)
                        }
                        placeholder="123-456-7890"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="facebook-ads-account-id">
                        Facebook Ads account ID
                      </Label>
                      <Input
                        id="facebook-ads-account-id"
                        value={facebookAdsAccountId}
                        onChange={(event) =>
                          setFacebookAdsAccountId(event.target.value)
                        }
                        placeholder="act_1234567890"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => {
                        updateOrgMutation.mutate({
                          name: orgName.trim() || undefined,
                          google_ads_customer_id:
                            googleAdsCustomerId.trim().length > 0
                              ? googleAdsCustomerId.trim()
                              : null,
                          facebook_ads_account_id:
                            facebookAdsAccountId.trim().length > 0
                              ? facebookAdsAccountId.trim()
                              : null,
                        })
                      }}
                      disabled={updateOrgMutation.isPending}
                    >
                      Save basics
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => continueTo(2)}
                    >
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {step === 2 ? (
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>Google Ads credentials</CardTitle>
                      <CardDescription>
                        Store per-client OAuth credentials securely.
                      </CardDescription>
                    </div>
                    {credentialsStatusQuery.data?.has_credentials ? (
                      <Badge variant="secondary">Saved</Badge>
                    ) : (
                      <Badge variant="outline">Not set</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="google-ads-client-id">Client ID</Label>
                      <Input
                        id="google-ads-client-id"
                        value={googleAdsClientId}
                        onChange={(event) => setGoogleAdsClientId(event.target.value)}
                        placeholder="OAuth client ID"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="google-ads-client-secret">Client secret</Label>
                      <Input
                        id="google-ads-client-secret"
                        value={googleAdsClientSecret}
                        onChange={(event) =>
                          setGoogleAdsClientSecret(event.target.value)
                        }
                        placeholder="OAuth client secret"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="google-ads-developer-token">
                        Developer token
                      </Label>
                      <Input
                        id="google-ads-developer-token"
                        value={googleAdsDeveloperToken}
                        onChange={(event) =>
                          setGoogleAdsDeveloperToken(event.target.value)
                        }
                        placeholder="Developer token"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="google-ads-refresh-token">Refresh token</Label>
                      <Input
                        id="google-ads-refresh-token"
                        value={googleAdsRefreshToken}
                        onChange={(event) =>
                          setGoogleAdsRefreshToken(event.target.value)
                        }
                        placeholder="Refresh token"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="google-ads-mcc-id">MCC / Login customer ID</Label>
                      <Input
                        id="google-ads-mcc-id"
                        value={googleAdsMccId}
                        onChange={(event) => setGoogleAdsMccId(event.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() =>
                        saveGoogleAdsMutation.mutate({
                          customer_id:
                            googleAdsCustomerId.trim().length > 0
                              ? googleAdsCustomerId.trim()
                              : undefined,
                          mcc_id: googleAdsMccId.trim() || undefined,
                          developer_token: googleAdsDeveloperToken.trim() || undefined,
                          refresh_token: googleAdsRefreshToken.trim() || undefined,
                          client_id: googleAdsClientId.trim() || undefined,
                          client_secret: googleAdsClientSecret.trim() || undefined,
                        })
                      }
                      disabled={saveGoogleAdsMutation.isPending}
                    >
                      Save credentials
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        saveGoogleAdsMutation.mutate({
                          customer_id: undefined,
                          mcc_id: undefined,
                          developer_token: undefined,
                          refresh_token: undefined,
                          client_id: undefined,
                          client_secret: undefined,
                        })
                      }
                      disabled={saveGoogleAdsMutation.isPending}
                    >
                      Clear credentials
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => continueTo(3)}
                    >
                      Continue
                    </Button>
                  </div>

                  {saveGoogleAdsMutation.error instanceof Error ? (
                    <div className="text-sm text-destructive">
                      {saveGoogleAdsMutation.error.message}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {step === 3 ? (
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle>API key</CardTitle>
                  <CardDescription>
                    Generate a single API key for ingestion requests.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div>
                      Active key:{" "}
                      {activeKeyQuery.data ? (
                        <span className="text-foreground">
                          {activeKeyQuery.data.key_prefix}… (created{" "}
                          {new Date(activeKeyQuery.data.created_at).toLocaleDateString()})
                        </span>
                      ) : (
                        <span>None yet</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="api-key-label">Label</Label>
                      <Input
                        id="api-key-label"
                        value={newApiKeyLabel}
                        onChange={(event) => setNewApiKeyLabel(event.target.value)}
                        placeholder="Primary"
                      />
                    </div>
                    <Button
                      onClick={() =>
                        rotateApiKeyMutation.mutate(
                          newApiKeyLabel.trim().length > 0
                            ? newApiKeyLabel.trim()
                            : undefined,
                        )
                      }
                      disabled={rotateApiKeyMutation.isPending}
                    >
                      {activeKeyQuery.data ? "Rotate key" : "Generate key"}
                    </Button>
                  </div>

                  {generatedApiKey ? (
                    <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
                      <div className="font-medium text-foreground">New API key</div>
                      <div className="break-all text-muted-foreground">
                        {generatedApiKey}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Copy this now — it won’t be shown again.
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => continueTo(4)}>
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {step === 4 ? (
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle>Organization settings</CardTitle>
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
                        onChange={(event) =>
                          setPrimaryContactEmail(event.target.value)
                        }
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
                        onChange={(event) =>
                          setDataSyncStartDate(event.target.value)
                        }
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
                        "min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-none",
                        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
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
                      disabled={updateSettingsMutation.isPending}
                    >
                      Save settings
                    </Button>
                    <Button variant="outline" onClick={() => continueTo(5)}>
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {step === 5 ? (
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle>Next steps</CardTitle>
                  <CardDescription>
                    Use the API key and endpoint below to start sending data.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div>
                      API host:{" "}
                      <span className="text-foreground">{apiHostUrl}</span>
                    </div>
                    <div>
                      Ingestion endpoint:{" "}
                      <span className="text-foreground">/api/ingest/events</span>
                    </div>
                    <div>
                      Organization ID:{" "}
                      <span className="text-foreground">{orgId}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Example fetch request
                    </div>
                    <pre className="mt-2 overflow-auto rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-foreground">
                      <code>{fetchSnippet}</code>
                    </pre>
                    <div className="text-xs text-muted-foreground">
                      If you need a new key, rotate it in step 3.
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => continueTo(1)}>
                      Start another onboarding
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </AppLayout>
      </RequireOrganization>
    </RequireSignedIn>
  )
}
