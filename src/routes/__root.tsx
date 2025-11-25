import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/tanstack-react-start'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import Header from '../components/Header'

import ConvexProvider from '../integrations/convex/provider'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'
import { auth } from '@clerk/tanstack-react-start/server'
import { createServerFn } from '@tanstack/react-start'
const fetchClerkAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await auth()

  return {
    userId,
  }
})
interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  notFoundComponent: () => <div>Not Found</div>,
  errorComponent: ({ error, info }) => (
    <div>
      Error: {error.message}
      {info?.componentStack ? <pre>{info.componentStack}</pre> : null}
    </div>
  ),
  beforeLoad: async () => {
    const { userId } = await fetchClerkAuth()

    return {
      userId,
    }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  component: RootComponent,
})

function RootComponent() {
  return (
    <ClerkProvider>
      <RootDocument>
        <Outlet />
      </RootDocument>
    </ClerkProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ConvexProvider>
          {children}
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            // plugins={[
            //   {
            //     name: 'Tanstack Router',
            //     render: <TanStackRouterDevtoolsPanel />,
            //   },
            //   TanStackQueryDevtools,
            // ]}
          />
        </ConvexProvider>
        <Scripts />
      </body>
    </html>
  )
}
