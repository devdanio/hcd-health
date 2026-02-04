import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar"

export function AppLayout(props: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarRail />
      <SidebarInset className="@container/main min-h-svh">
        <SiteHeader />
        <main className="flex-1 px-4 py-6 lg:px-6">{props.children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
