import * as React from 'react'
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react'

import { NavDocuments } from '@/components/nav-documents'
import { NavMain } from '@/components/nav-main'
import { NavReports } from '@/components/nav-reports'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Link, useParams } from '@tanstack/react-router'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const companyId = useParams({
    strict: false,
    select: (params) => params.companyId,
  })
  const data = {
    user: {
      name: 'shadcn',
      email: 'm@example.com',
      avatar: '/avatars/shadcn.jpg',
    },
    navMain: [
      {
        title: 'Dashboard',
        url: `/companies/${companyId}`,
        icon: IconDashboard,
      },
      {
        title: 'Visitors',
        url: `/companies/${companyId}/visitors`,
        icon: IconListDetails,
      },
      {
        title: 'Contacts',
        url: `/companies/${companyId}/contacts`,
        icon: IconListDetails,
      },
    ],
    navClouds: [
      {
        title: 'Capture',
        icon: IconCamera,
        isActive: true,
        url: '#',
        items: [
          {
            title: 'Active Proposals',
            url: '#',
          },
          {
            title: 'Archived',
            url: '#',
          },
        ],
      },
      {
        title: 'Proposal',
        icon: IconFileDescription,
        url: '#',
        items: [
          {
            title: 'Active Proposals',
            url: '#',
          },
          {
            title: 'Archived',
            url: '#',
          },
        ],
      },
      {
        title: 'Prompts',
        icon: IconFileAi,
        url: '#',
        items: [
          {
            title: 'Active Proposals',
            url: '#',
          },
          {
            title: 'Archived',
            url: '#',
          },
        ],
      },
    ],
    navSecondary: [
      {
        title: 'Settings',
        url: `/companies/${companyId}/settings`,
        icon: IconSettings,
      },
      {
        title: 'Get Help',
        url: '#',
        icon: IconHelp,
      },
      {
        title: 'Search',
        url: '#',
        icon: IconSearch,
      },
    ],

    reports: [
      {
        name: 'KPIs',
        url: `/companies/${companyId}/reports/kpis`,
        icon: IconChartBar,
      },
      {
        name: 'Appointments',
        url: `/companies/${companyId}/reports/appointments`,
        icon: IconReport,
      },
      {
        name: 'ROI',
        url: `/companies/${companyId}/reports/roi`,
        icon: IconDatabase,
      },
    ],

    documents: [
      {
        name: 'Patients',
        url: `/companies/${companyId}/patients`,
        icon: IconDatabase,
      },
      {
        name: 'Tracking',
        url: `/companies/${companyId}/tracking`,
        icon: IconDatabase,
      },
      {
        name: 'CMS Pages',
        url: `/companies/${companyId}/cms-pages`,
        icon: IconFileDescription,
      },
    ],
  }
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/companies">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Companies</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavReports items={data.reports} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
