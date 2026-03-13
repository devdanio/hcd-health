import {
  OrganizationList,
  SignInButton,
  SignedIn,
  SignedOut,
} from '@clerk/tanstack-react-start'
import { Link, createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/onboarding')({
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
        <OnboardingChooser />
      </SignedIn>
    </>
  )
}

function OnboardingChooser() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <img
            src="/images/high-country-health-logo.svg"
            alt="High Country Digital"
            className="h-9 w-auto"
          />
          <Button variant="ghost" asChild>
            <Link to="/organizations">Back to organizations</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div>
          <div className="text-label text-muted-foreground">Settings</div>
          <h1 className="text-xl font-semibold text-foreground">
            Create or select an organization
          </h1>
          <p className="text-sm text-muted-foreground">
            Create a new org or select an existing one to configure settings.
          </p>
        </div>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>
              Create a new org or select an existing one to configure settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationList
              afterCreateOrganizationUrl={(org) =>
                `/organizations/${org.id}/settings/org`
              }
              afterSelectOrganizationUrl={(org) =>
                `/organizations/${org.id}/settings/org`
              }
              afterSelectPersonalUrl="/organizations"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
