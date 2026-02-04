import { SignInButton, SignedIn, SignedOut } from "@clerk/tanstack-react-start"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/")({ component: RouteComponent })

function RouteComponent() {
  return (
    <>
      <SignedOut>
        <Landing />
      </SignedOut>
      <SignedIn>
        <RedirectToOrganizations />
      </SignedIn>
    </>
  )
}

function RedirectToOrganizations() {
  const navigate = useNavigate()

  useEffect(() => {
    void navigate({ to: "/organizations", replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md pt-20 text-center text-sm text-muted-foreground">
        Redirecting…
      </div>
    </div>
  )
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <img
            src="/images/high-country-health-logo.svg"
            alt="High Country Health"
            className="h-9 w-auto"
          />
        </div>
      </header>
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-16 text-center">
        <div className="text-label text-muted-foreground">
          Revenue Intelligence
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          High Country Health Dashboard
        </h1>
        <p className="text-muted-foreground">
          Track spend to patients with a single, connected view of ROI.
        </p>
        <Card className="w-full max-w-md border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Sign in to view your organizations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignInButton>
              <Button className="w-full">Sign In</Button>
            </SignInButton>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

