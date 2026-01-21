import { createFileRoute } from '@tanstack/react-router'
import { CompanySettings } from '@/components/settings/company-settings'

export const Route = createFileRoute(
  '/companies/$companyId/settings/company/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { companyId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Company Settings</h1>
      <CompanySettings companyId={companyId} />
    </div>
  )
}
