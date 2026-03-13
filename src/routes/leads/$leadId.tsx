import { useAuth } from "@clerk/tanstack-react-start"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { RequireSignedIn } from "@/components/app/RequireSignedIn"

export const Route = createFileRoute("/leads/$leadId")({
  component: RouteComponent,
})

function RouteComponent() {
  const { leadId } = Route.useParams()
  const navigate = useNavigate()
  const { isLoaded, orgId } = useAuth()

  useEffect(() => {
    if (!isLoaded) return
    if (!orgId) {
      void navigate({ to: "/organizations", replace: true })
      return
    }

    void navigate({
      to: "/organizations/$orgId/leads/$leadId",
      params: { orgId, leadId },
      replace: true,
    })
  }, [isLoaded, leadId, navigate, orgId])

  return (
    <RequireSignedIn>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md pt-20 text-center text-sm text-muted-foreground">
          Redirecting…
        </div>
      </div>
    </RequireSignedIn>
  )
}

