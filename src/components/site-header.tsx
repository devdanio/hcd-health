import { OrganizationSwitcher, UserButton } from "@clerk/tanstack-react-start"
import { useRouterState } from "@tanstack/react-router"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader(props: { orgId: string }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const base = `/organizations/${props.orgId}`

  const title =
    pathname === base || pathname === `${base}/`
      ? "Dashboard"
      : pathname.startsWith(`${base}/leads`)
        ? "Leads"
        : pathname.startsWith(`${base}/settings`)
          ? "Settings"
          : "Revenue Intelligence"

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border/60 bg-background/70 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <OrganizationSwitcher
            afterCreateOrganizationUrl={(org) => `/organizations/${org.id}`}
            afterSelectOrganizationUrl={(org) => `/organizations/${org.id}`}
            afterSelectPersonalUrl="/organizations"
          />
          <UserButton />
        </div>
      </div>
    </header>
  )
}
