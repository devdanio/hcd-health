import { useAuth } from "@clerk/tanstack-react-start"
import { createFileRoute, Link } from "@tanstack/react-router"

import { AppLayout } from "@/components/app/AppLayout"
import { RequireOrganization } from "@/components/app/RequireOrganization"
import { RequireSignedIn } from "@/components/app/RequireSignedIn"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/organizations/$orgId/settings/")({
  component: RouteComponent,
})

function RouteComponent() {
  const { orgId } = Route.useParams()
  const { isLoaded, orgId: activeOrgId } = useAuth()
  const orgReady = isLoaded && activeOrgId === orgId

  return (
    <RequireSignedIn>
      <RequireOrganization orgId={orgId}>
        <AppLayout orgId={orgId}>
          <div className="flex flex-col gap-6">
            <div>
              <div className="text-label text-muted-foreground">Settings</div>
              <h1 className="text-xl font-semibold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Campaign mapping, ingestion API keys, and org preferences.
              </p>
            </div>

            {!orgReady ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Card className="border-border/60 bg-card/80">
                  <CardHeader>
                    <CardTitle>Campaigns</CardTitle>
                    <CardDescription>
                      Map campaigns to locations and hide excluded campaigns from
                      reports.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="link" asChild className="px-0">
                      <Link
                        to="/organizations/$orgId/settings/campaigns"
                        params={{ orgId }}
                      >
                        Open campaigns settings →
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardHeader>
                    <CardTitle>Organization</CardTitle>
                    <CardDescription>
                      Ingestion API keys, call qualification threshold, Google Ads
                      customer ID.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="link" asChild className="px-0">
                      <Link
                        to="/organizations/$orgId/settings/org"
                        params={{ orgId }}
                      >
                        Open org settings →
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </AppLayout>
      </RequireOrganization>
    </RequireSignedIn>
  )
}
