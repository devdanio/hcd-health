import { createContext, useContext } from 'react'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'dark' | 'light'
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  resolvedTheme: 'light',
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = 'hch-ui-theme',
  ...props
}: ThemeProviderProps) {
  // Force light mode - dark mode disabled
  const theme = 'light'
  const resolvedTheme = 'light'

  const value = {
    theme,
    resolvedTheme,
    setTheme: () => {
      // Theme switching disabled - always use light mode
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      <div className="min-h-screen w-full bg-background text-foreground">
        {children}
      </div>
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
