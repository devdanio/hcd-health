import { SignInButton, SignedIn, SignedOut } from '@clerk/tanstack-react-start'

import { Card, CardContent, CardTitle } from '@/components/ui/card'

export function RequireSignedIn(props: { children: React.ReactNode }) {
  return (
    <>
      <SignedOut>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-md mx-auto pt-20">
            <Card>
              <CardContent className="p-6 space-y-3">
                <CardTitle className="text-lg">Sign in required</CardTitle>
                <SignInButton>
                  <button className="w-full rounded-md bg-black text-white py-2 text-sm">
                    Sign In
                  </button>
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
