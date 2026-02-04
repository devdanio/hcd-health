import { Link } from '@tanstack/react-router'
import { UserButton } from '@clerk/tanstack-react-start'

export function AppLayout(props: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <img
              src="/images/high-country-health-logo.svg"
              alt="High Country Health"
              className="w-20 md:w-24 h-auto"
            />
            <nav className="hidden md:flex items-center gap-4 text-sm">
              <NavLink to="/">Dashboard</NavLink>
              <NavLink to="/leads">Leads</NavLink>
              <NavLink to="/settings">Settings</NavLink>
            </nav>
          </div>
          <UserButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">{props.children}</main>
    </div>
  )
}

function NavLink(props: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={props.to}
      className="text-gray-700 hover:text-gray-900"
      activeProps={{ className: 'text-gray-900 font-medium' }}
    >
      {props.children}
    </Link>
  )
}

