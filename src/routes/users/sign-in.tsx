import { SignIn } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/users/sign-in')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      Sign in
      <SignIn />
    </div>
  )
}
