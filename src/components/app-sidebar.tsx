import * as React from 'react'
import { OrganizationSwitcher, UserButton } from '@clerk/tanstack-react-start'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  IconDashboard,
  IconHelp,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react'

import { NavSecondary } from '@/components/nav-secondary'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const navSecondary = [
  {
    title: 'Support',
    url: 'https://highcountryhealth.com',
    icon: IconHelp,
  },
]

export function AppSidebar({
  orgId,
  ...props
}: React.ComponentProps<typeof Sidebar> & { orgId: string }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const base = `/organizations/${orgId}`

  const navMain = [
    {
      title: 'Dashboard',
      url: `${base}`,
      icon: IconDashboard,
    },
    {
      title: 'Leads',
      url: `${base}/leads`,
      icon: IconUsers,
    },
    {
      title: 'Settings',
      url: `${base}/settings`,
      icon: IconSettings,
    },
  ]

  const isActive = (url: string) =>
    url === base
      ? pathname === base || pathname === `${base}/`
      : pathname === url || pathname.startsWith(`${url}/`)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to={base}>
                <img
                  src="/images/high-country-health-logo.svg"
                  alt="High Country Digital"
                  className="h-6 w-auto"
                />
                <span className="text-base font-semibold">
                  High Country Digital
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="px-1.5 py-1">
              <OrganizationSwitcher
                afterCreateOrganizationUrl={(org) => `/organizations/${org.id}`}
                afterSelectOrganizationUrl={(org) => `/organizations/${org.id}`}
                afterSelectPersonalUrl="/organizations"
              />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navMain.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
              >
                <Link to={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <UserButton />
          <span className="text-xs text-muted-foreground">Account</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
