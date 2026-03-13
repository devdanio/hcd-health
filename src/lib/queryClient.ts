import { QueryClient } from '@tanstack/react-query'

// Create a single QueryClient instance to be shared across the application
// This ensures TanStack DB collections and queries use the same cache
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
})
