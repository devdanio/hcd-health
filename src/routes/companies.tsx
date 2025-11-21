import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/theme-provider'

export const Route = createFileRoute('/companies')({
  component: CompaniesLayout,
  beforeLoad: ({ context }) => {
    if (!context.userId) {
      throw new Error('Not authenticated')
    }
  },
})

function CompaniesLayout() {

  return (
    <ThemeProvider defaultTheme="system" storageKey="leadalytics-ui-theme">
      <Outlet />
      
    </ThemeProvider>
  )
}
