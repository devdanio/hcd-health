import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

// Import the generated route tree
import { routeTree } from './routeTree.gen'
import { queryClient } from './lib/queryClient'

// Create a new router instance
export const getRouter = () => {
  const startTime = performance.now()

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  const endTime = performance.now()
  console.log(
    `Router creation and SSR query integration took ${endTime - startTime} ms`,
  )

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
