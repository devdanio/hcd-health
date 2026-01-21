import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { SignInButton } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <img
            src="/images/high-country-health-logo.svg"
            alt="High Country Health"
            className="w-20 md:w-24 h-auto"
          />
        </div>
      </header>

      <Card className="max-w-md mx-auto mt-10">
        <CardContent>
          <SignInButton>
            <Button className="w-full">Sign In</Button>
          </SignInButton>
        </CardContent>
      </Card>
    </div>
  )
}
