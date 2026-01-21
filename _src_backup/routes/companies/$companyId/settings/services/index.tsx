import { createFileRoute } from '@tanstack/react-router'
import { ServicesSettings } from '@/components/settings/services-settings'

export const Route = createFileRoute(
  '/companies/$companyId/settings/services/',
)({
  component: RouteComponent,
  ssr: false,
})

function RouteComponent() {
  const { companyId } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  console.log('queryClient', queryClient)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Services Settings</h1>
      <ServicesSettings companyId={companyId} />
    </div>
  )
}
