import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useCompany } from '@/hooks/useCompany'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import z from 'zod'

const dashboardSearchSchema = z.object({
  before: z.iso.datetime().optional(),
  after: z.iso.datetime().optional(),
})

type DashboardSearch = z.infer<typeof dashboardSearchSchema>

export const Route = createFileRoute('/companies/$companyId')({
  component: RouteComponent,
  validateSearch: (search) => dashboardSearchSchema.parse(search),
})

function RouteComponent() {
  const company = useCompany()
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full">
        <SiteHeader title={company?.name || ''} />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  )
}
