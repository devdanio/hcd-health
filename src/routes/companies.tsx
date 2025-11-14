import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarProvider } from '@/components/ui/sidebar'
import { ThemeProvider } from '@/components/theme-provider'

export const Route = createFileRoute('/companies')({
  component: CompaniesLayout,
})

function CompaniesLayout() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="leadalytics-ui-theme">
      <SidebarProvider>
        <AppSidebar />
        <div className="flex flex-col flex-1 w-full">
          <SiteHeader title="Leadalytics" />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  )
}
