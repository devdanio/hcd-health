import { createFileRoute, useSearch } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CompanySettings } from '@/components/settings/company-settings'
import { ServicesSettings } from '@/components/settings/services-settings'
import { ProvidersSettings } from '@/components/settings/providers-settings'
import { IntegrationsSettings } from '@/components/settings/integrations-settings'
import { Id } from 'convex/_generated/dataModel'
import React, { useEffect } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/companies/$companyId/settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { companyId } = Route.useParams()
  const search = useSearch({ from: '/companies/$companyId/settings/' }) as Record<string, string>
  const [defaultTab, setDefaultTab] = React.useState<string>("company")

  // Handle OAuth callback status
  useEffect(() => {
    if (search.google_ads === 'select_account') {
      toast.info('Please select your Google Ads account')
      // Auto-switch to integrations tab
      setDefaultTab("integrations")
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    } else if (search.google_ads === 'success') {
      toast.success('Google Ads connected successfully!')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (search.google_ads === 'denied') {
      toast.error('Google Ads connection was cancelled')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (search.google_ads === 'error' && search.message) {
      toast.error(`Google Ads connection failed: ${search.message}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [search.google_ads, search.message])

  // Auto-switch to integrations tab if specified in URL
  useEffect(() => {
    if (search.tab === 'integrations') {
      setDefaultTab('integrations')
    }
  }, [search.tab])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Tabs value={defaultTab} onValueChange={setDefaultTab} className="w-full">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <CompanySettings companyId={companyId as Id<"companies">} />
        </TabsContent>
        <TabsContent value="services">
          <ServicesSettings companyId={companyId as Id<"companies">} />
        </TabsContent>
        <TabsContent value="providers">
          <ProvidersSettings companyId={companyId as Id<"companies">} />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsSettings companyId={companyId as Id<"companies">} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
