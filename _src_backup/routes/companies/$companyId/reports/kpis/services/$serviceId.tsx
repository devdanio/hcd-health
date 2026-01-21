import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/companies/$companyId/reports/kpis/services/$serviceId',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/companies/$companyId/kpis/services/$serviceId"!</div>
}
