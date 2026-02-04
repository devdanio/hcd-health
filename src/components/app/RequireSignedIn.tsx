import { SignInButton, SignedIn, SignedOut } from "@clerk/tanstack-react-start"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"

export function RequireSignedIn(props: { children: React.ReactNode }) {
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
      <SignedIn>{props.children}</SignedIn>
    </>
  )
}
