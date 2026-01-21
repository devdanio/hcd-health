import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/companies/$companyId/visitors/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/companies/$companyId/visitors/"!</div>
}
