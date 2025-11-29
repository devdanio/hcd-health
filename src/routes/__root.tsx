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

import { QueryClientProvider } from '@tanstack/react-query'
import { createContext, useContext, useMemo } from 'react'

import { createCollections, type Collections } from '@/collections'
import { queryClient } from '@/lib/queryClient'

import appCss from '../styles.css?url'
import { auth } from '@clerk/tanstack-react-start/server'
import { createServerFn } from '@tanstack/react-start'

// Collections Context
const CollectionsContext = createContext<Collections | null>(null)

export const useCollections = () => {
  const collections = useContext(CollectionsContext)
  if (!collections) {
    throw new Error('useCollections must be used within CollectionsProvider')
  }
  return collections
}

const fetchClerkAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await auth()

  return {
    userId,
  }
})
interface MyRouterContext {
  queryClient: typeof queryClient
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
        title: 'Leadalytics',
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
  // Create collections once
  const collections = useMemo(() => createCollections(queryClient), [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <CollectionsContext.Provider value={collections}>
            {children}
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={[
                {
                  name: 'Tanstack Router',
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
          </CollectionsContext.Provider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
