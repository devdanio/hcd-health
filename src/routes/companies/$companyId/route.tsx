import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useCompany } from '@/hooks/useCompany'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/companies/$companyId')({
  component: RouteComponent,
})

function RouteComponent() {
  const company = useCompany()
  return <SidebarProvider>
        <AppSidebar />
        <div className="flex flex-col flex-1 w-full">
          <SiteHeader title={company?.name || ''} />
          <main className="flex-1">
              <Outlet />
          </main>
        </div>
      </SidebarProvider>
}
