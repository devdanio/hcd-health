import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const Route = createFileRoute('/companies/$companyId/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  const { companyId } = Route.useParams()
  // const pathname = Route.useRouterState().location.pathname

  const navItems = [
    {
      label: 'Company',
      href: `/companies/${companyId}/settings/company`,
      path: 'company',
    },
    {
      label: 'Services',
      href: `/companies/${companyId}/settings/services`,
      path: 'services',
    },
    {
      label: 'Providers',
      href: `/companies/${companyId}/settings/providers`,
      path: 'providers',
    },
    {
      label: 'Integrations',
      href: `/companies/${companyId}/settings/integrations`,
      path: 'integrations',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Settings Navigation */}
      <div className="border-b">
        <nav className="flex gap-4 px-6">
          <Tabs defaultValue="account" className="w-[400px]">
            <TabsList>
              {navItems.map((item) => {
                return (
                  <TabsTrigger key={item.path} value={item.path} asChild>
                    <Link activeOptions={{ exact: true }} to={item.href}>
                      {item.label}
                    </Link>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        </nav>
      </div>

      {/* Settings Content */}
      <Outlet />
    </div>
  )
}
