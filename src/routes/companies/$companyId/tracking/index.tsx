import { Button } from '@/components/ui/button'
import { useCompany } from '@/hooks/useCompany'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/companies/$companyId/tracking/')({
  component: RouteComponent,
})

function RouteComponent() {
  const company = useCompany()
  return (
    <div>
      {/* API Key Section */}
      <div className="mb-8 p-6 border rounded-lg bg-card">
        <h2 className="text-lg font-semibold mb-4">Tracking Setup</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">API Key</label>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted p-3 rounded text-sm overflow-x-auto">
                {company?.apiKey}
              </code>
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard.writeText(company?.apiKey ?? '')
                }
              >
                Copy
              </Button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Installation Code
            </label>
            <code className="block bg-muted p-3 rounded text-sm overflow-x-auto">
              {`<script\n  src="https://app.leadalytics.ai/tracker/tracker.js"\n  
              data-api-key="${company?.apiKey}"
              data-api-url="${import.meta.env.VITE_CONVEX_URL}/http"\n></script>`}
            </code>
          </div>
        </div>
      </div>
    </div>
  )
}
