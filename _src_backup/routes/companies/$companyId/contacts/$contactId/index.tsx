import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/companies/$companyId/contacts/$contactId/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/companies/$companyId/contacts/$contactId/"!</div>
}
