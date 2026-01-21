import { createFileRoute, useSearch } from '@tanstack/react-router'
import { IntegrationsSettings } from '@/components/settings/integrations-settings'
import { useEffect } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute(
  '/companies/$companyId/settings/integrations/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { companyId } = Route.useParams()
  const search = useSearch({
    from: '/companies/$companyId/settings/integrations/',
  }) as Record<string, string>

  // Handle OAuth callback status
  useEffect(() => {
    if (search.google_ads === 'select_account') {
      toast.info('Please select your Google Ads account')
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

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
      <IntegrationsSettings companyId={companyId} />
    </div>
  )
}
