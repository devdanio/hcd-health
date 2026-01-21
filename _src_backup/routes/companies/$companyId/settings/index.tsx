import { createFileRoute, Navigate, useSearch } from '@tanstack/react-router'

export const Route = createFileRoute('/companies/$companyId/settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { companyId } = Route.useParams()
  const search = useSearch({
    from: '/companies/$companyId/settings/',
  }) as Record<string, string>

  // Handle OAuth callback - redirect to integrations with query params
  if (search.google_ads) {
    return (
      <Navigate
        to="/companies/$companyId/settings/integrations"
        params={{ companyId }}
        search={search}
      />
    )
  }

  // Default redirect to company settings
  return (
    <Navigate
      to="/companies/$companyId/settings/company"
      params={{ companyId }}
    />
  )
}
