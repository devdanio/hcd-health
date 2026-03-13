import { useAuth } from "@clerk/tanstack-react-start"
import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router"

import { AppLayout } from "@/components/app/AppLayout"
import { RequireOrganization } from "@/components/app/RequireOrganization"
import { RequireSignedIn } from "@/components/app/RequireSignedIn"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/organizations/$orgId/settings")({
  component: RouteComponent,
})

function RouteComponent() {
  const { orgId } = Route.useParams()
  const { isLoaded, orgId: activeOrgId } = useAuth()
  const orgReady = isLoaded && activeOrgId === orgId

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const base = `/organizations/${orgId}/settings`
  const navItems = [
    { label: "Org settings", to: `${base}/org` },
    { label: "Google", to: `${base}/google` },
    { label: "Facebook", to: `${base}/facebook-ads` },
    { label: "Campaigns", to: `${base}/campaigns` },
  ]

  const isActive = (url: string) =>
    pathname === url || pathname.startsWith(`${url}/`)

  return (
    <RequireSignedIn>
      <RequireOrganization orgId={orgId}>
        <AppLayout orgId={orgId}>
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-label text-muted-foreground">Settings</div>
              <h1 className="text-xl font-semibold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Organization configuration, ads platforms, and campaign mapping.
              </p>
            </div>

            {!orgReady ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
                <nav className="flex flex-col gap-2">
                  {navItems.map((item) => {
                    const active = isActive(item.to)
                    return (
                      <Button
                        key={item.to}
                        asChild
                        variant={active ? "default" : "ghost"}
                        className={cn(
                          "w-full justify-start",
                          !active && "text-muted-foreground",
                        )}
                      >
                        <Link to={item.to}>{item.label}</Link>
                      </Button>
                    )
                  })}
                </nav>
                <div className="min-w-0">
                  <Outlet />
                </div>
              </div>
            )}
          </div>
        </AppLayout>
      </RequireOrganization>
    </RequireSignedIn>
  )
}
