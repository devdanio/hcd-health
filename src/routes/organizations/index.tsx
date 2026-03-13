import {
  OrganizationList,
  SignInButton,
  SignedIn,
  SignedOut,
  useOrganizationList,
} from '@clerk/tanstack-react-start'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/organizations/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <>
      <SignedOut>
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-md pt-20">
            <Card className="border-border/60 bg-card/80">
              <CardContent className="space-y-3 p-6">
                <CardTitle className="text-lg">Sign in required</CardTitle>
                <SignInButton>
                  <Button className="w-full">Sign In</Button>
                </SignInButton>
              </CardContent>
            </Card>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <OrganizationsScreen />
      </SignedIn>
    </>
  )
}

function OrganizationsScreen() {
  const navigate = useNavigate()
  const { isLoaded, userMemberships, setActive } = useOrganizationList({
    userMemberships: true,
  })
  const [didAutoRedirect, setDidAutoRedirect] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null)

  const memberships = useMemo(
    () => userMemberships?.data ?? [],
    [userMemberships?.data],
  )
  const membershipsLoading = !isLoaded || userMemberships.isLoading

  useEffect(() => {
    if (!isLoaded) return
    if (!setActive) return
    if (didAutoRedirect) return
    if (userMemberships.isLoading) return
    if (memberships.length !== 1) return

    const org = memberships[0]?.organization
    if (!org?.id) return

    setDidAutoRedirect(true)
    void setActive({ organization: org.id })
      .then(() =>
        navigate({ to: '/organizations/$orgId', params: { orgId: org.id } }),
      )
      .catch(() => {
        // If setting active fails, just show the org chooser UI
        setDidAutoRedirect(false)
      })
  }, [didAutoRedirect, isLoaded, memberships, navigate, setActive])

  const openOrganization = (orgId: string) => {
    if (!setActive) {
      setSwitchError('Organization switching is not available yet.')
      return
    }

    setSwitchError(null)
    setSwitchingOrgId(orgId)
    void setActive({ organization: orgId })
      .then(() => navigate({ to: '/organizations/$orgId', params: { orgId } }))
      .catch((err: unknown) => {
        setSwitchError(
          err instanceof Error ? err.message : 'Failed to switch organization',
        )
        setSwitchingOrgId(null)
      })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <img
            src="/images/high-country-health-logo.svg"
            alt="High Country Digital"
            className="h-9 w-auto"
          />
          <div className="text-sm text-muted-foreground">
            Choose an organization
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="space-y-4">
          <div className="text-label text-muted-foreground">
            Your organizations
          </div>

          {switchError ? (
            <div className="text-sm text-red-600">{switchError}</div>
          ) : null}

          <div className="grid grid-cols-1 gap-3">
            {memberships.map((m) => (
              <Card key={m.id} className="border-border/60 bg-card/80">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">
                      {m.organization.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.role ?? 'member'} • {m.organization.id}
                    </div>
                  </div>
                  <Button
                    onClick={() => openOrganization(m.organization.id)}
                    disabled={switchingOrgId === m.organization.id}
                    variant="outline"
                  >
                    {switchingOrgId === m.organization.id ? 'Opening…' : 'Open'}
                  </Button>
                </CardContent>
              </Card>
            ))}

            {membershipsLoading ? (
              <Card className="border-border/60 bg-card/80">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Loading organizations…
                </CardContent>
              </Card>
            ) : memberships.length === 0 ? (
              <Card className="border-border/60 bg-card/80">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  No organizations yet. Create one below.
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="pt-6">
            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Create or manage</CardTitle>
                <CardDescription>
                  Create a new organization or switch accounts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OrganizationList
                  afterCreateOrganizationUrl={(org) =>
                    `/organizations/${org.id}`
                  }
                  afterSelectOrganizationUrl={(org) =>
                    `/organizations/${org.id}`
                  }
                  afterSelectPersonalUrl="/organizations"
                />
              </CardContent>
            </Card>
          </div>

          <div className="pt-2">
            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Organization settings</CardTitle>
                <CardDescription>
                  Choose an organization to manage settings and integrations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link to="/onboarding">Open settings</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
