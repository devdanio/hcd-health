import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/theme-provider'

export const Route = createFileRoute('/companies')({
  component: CompaniesLayout,
  beforeLoad: ({ context }) => {
    console.log('start')
    if (!context.userId) {
      throw new Error('Not authenticated')
    }
    console.log('end')
  },
  ssr: false,
})

function CompaniesLayout() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="hch-ui-theme">
      <Outlet />
    </ThemeProvider>
  )
}
