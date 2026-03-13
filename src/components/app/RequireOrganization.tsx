import { useAuth, useOrganizationList } from "@clerk/tanstack-react-start"
import { useEffect, useState } from "react"

export function RequireOrganization(props: {
  orgId: string
  children: React.ReactNode
}) {
  const { isLoaded, isSignedIn, orgId } = useAuth()
  const { isLoaded: orgsLoaded, setActive } = useOrganizationList()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !orgsLoaded) return
    if (!isSignedIn) return
    if (orgId === props.orgId) return

    setError(null)
    void setActive({ organization: props.orgId }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to switch organization")
    })
  }, [isLoaded, orgsLoaded, isSignedIn, orgId, props.orgId, setActive])

  if (!isLoaded || !orgsLoaded) {
    return <div className="text-sm text-muted-foreground">Loading…</div>
  }

  if (!isSignedIn) {
    return null
  }

  if (error) {
    return <div className="text-sm text-red-600">{error}</div>
  }

  if (orgId !== props.orgId) {
    return (
      <div className="text-sm text-muted-foreground">
        Switching organization…
      </div>
    )
  }

  return props.children
}

