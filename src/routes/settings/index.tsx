import { Link, createFileRoute } from '@tanstack/react-router'

import { AppLayout } from '@/components/app/AppLayout'
import { RequireSignedIn } from '@/components/app/RequireSignedIn'
import { Card, CardContent, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <RequireSignedIn>
      <AppLayout>
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-600">
              Campaign mapping, ingestion API keys, and org preferences.
            </p>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 space-y-2">
              <CardTitle className="text-base">Campaigns</CardTitle>
              <p className="text-sm text-gray-600">
                Map campaigns to locations and hide excluded campaigns from reports.
              </p>
              <Link
                to="/settings/campaigns"
                className="inline-block text-sm text-blue-600 hover:underline"
              >
                Open campaigns settings →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <CardTitle className="text-base">Organization</CardTitle>
              <p className="text-sm text-gray-600">
                Ingestion API keys, call qualification threshold, Google Ads customer ID.
              </p>
              <Link
                to="/settings/org"
                className="inline-block text-sm text-blue-600 hover:underline"
              >
                Open org settings →
              </Link>
            </CardContent>
          </Card>
        </div>
        </div>
    </AppLayout>
    </RequireSignedIn>
  )
}
