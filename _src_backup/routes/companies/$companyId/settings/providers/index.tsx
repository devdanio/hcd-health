import { createFileRoute } from '@tanstack/react-router'
import { ProvidersSettings } from '@/components/settings/providers-settings'

export const Route = createFileRoute(
  '/companies/$companyId/settings/providers/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { companyId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Providers Settings</h1>
      <ProvidersSettings companyId={companyId} />
    </div>
  )
}
