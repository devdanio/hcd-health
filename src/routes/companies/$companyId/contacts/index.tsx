import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/companies/$companyId/contacts/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/companies/$companyId/contacts/"!</div>
}
