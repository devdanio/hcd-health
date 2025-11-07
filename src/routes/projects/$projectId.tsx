import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectDetailsPage,
})

function ProjectDetailsPage() {
  const { projectId } = Route.useParams()
  const project = useQuery(api.projects.getProject, {
    projectId: projectId as Id<'projects'>,
  })
  const sessions = useQuery(api.tracking.getSessions, {
    projectId: projectId as Id<'projects'>,
    limit: 50,
  })
  const conversions = useQuery(api.tracking.getConversions, {
    projectId: projectId as Id<'projects'>,
    limit: 50,
  })

  if (
    project === undefined ||
    sessions === undefined ||
    conversions === undefined
  ) {
    return <div className="container mx-auto p-8">Loading...</div>
  }

  if (project === null) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
          <Link to="/projects">
            <Button>Back to Projects</Button>
          </Link>
        </div>
      </div>
    )
  }

  const totalSessions = sessions.length
  const totalConversions = conversions.length
  const conversionRate =
    totalSessions > 0
      ? ((totalConversions / totalSessions) * 100).toFixed(2)
      : '0'

  return (
    <div className="container mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/projects"
          className="text-sm text-muted-foreground hover:underline mb-2 inline-block"
        >
          ← Back to Projects
        </Link>
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <p className="text-muted-foreground mt-1">{project.domain}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <div className="p-6 border rounded-lg bg-card">
          <div className="text-sm text-muted-foreground mb-1">
            Total Sessions
          </div>
          <div className="text-3xl font-bold">{totalSessions}</div>
        </div>
        <div className="p-6 border rounded-lg bg-card">
          <div className="text-sm text-muted-foreground mb-1">
            Total Conversions
          </div>
          <div className="text-3xl font-bold">{totalConversions}</div>
        </div>
        <div className="p-6 border rounded-lg bg-card">
          <div className="text-sm text-muted-foreground mb-1">
            Conversion Rate
          </div>
          <div className="text-3xl font-bold">{conversionRate}%</div>
        </div>
      </div>

      {/* API Key Section */}
      <div className="mb-8 p-6 border rounded-lg bg-card">
        <h2 className="text-lg font-semibold mb-4">Tracking Setup</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">API Key</label>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted p-3 rounded text-sm overflow-x-auto">
                {project.apiKey}
              </code>
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(project.apiKey)}
              >
                Copy
              </Button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Installation Code
            </label>
            <code className="block bg-muted p-3 rounded text-sm overflow-x-auto">
              {`<script\n  src="https://your-domain.com/tracker/tracker.js"\n  data-api-key="${project.apiKey}"\n  data-api-url="${import.meta.env.VITE_CONVEX_URL}/http"\n></script>`}
            </code>
          </div>
        </div>
      </div>

      {/* Conversions Table */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Recent Conversions</h2>
        {conversions.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <p className="text-muted-foreground">No conversions yet</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-4 font-medium">Event</th>
                  <th className="text-left p-4 font-medium">Revenue</th>
                  <th className="text-left p-4 font-medium">
                    First Touch Source
                  </th>
                  <th className="text-left p-4 font-medium">
                    Last Touch Source
                  </th>
                  <th className="text-left p-4 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {conversions.map((conversion) => {
                  const firstTouch = conversion.session?.touchPoints?.[0]
                  const lastTouch =
                    conversion.session?.touchPoints?.[
                      conversion.session.touchPoints.length - 1
                    ]

                  return (
                    <tr
                      key={conversion._id}
                      className="border-t hover:bg-muted/50"
                    >
                      <td className="p-4 font-medium">
                        {conversion.eventName}
                      </td>
                      <td className="p-4">
                        {conversion.revenue
                          ? `$${conversion.revenue.toFixed(2)}`
                          : '-'}
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {firstTouch?.utm_source ||
                            firstTouch?.referrer ||
                            'Direct'}
                        </div>
                        {firstTouch?.utm_campaign && (
                          <div className="text-xs text-muted-foreground">
                            {firstTouch.utm_campaign}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {lastTouch?.utm_source ||
                            lastTouch?.referrer ||
                            'Direct'}
                        </div>
                        {lastTouch?.utm_campaign && (
                          <div className="text-xs text-muted-foreground">
                            {lastTouch.utm_campaign}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(conversion._creationTime).toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sessions Table */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Recent Sessions</h2>
        {sessions.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <p className="text-muted-foreground">No sessions yet</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-4 font-medium">Session ID</th>
                  <th className="text-left p-4 font-medium">Source</th>
                  <th className="text-left p-4 font-medium">Landing Page</th>
                  <th className="text-left p-4 font-medium">Page Views</th>
                  <th className="text-left p-4 font-medium">Duration</th>
                  <th className="text-left p-4 font-medium">Started</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const firstTouch = session.touchPoints[0]

                  return (
                    <tr
                      key={session._id}
                      className="border-t hover:bg-muted/50"
                    >
                      <td className="p-4">
                        <code className="text-xs">
                          {session.sessionId.slice(0, 8)}...
                        </code>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {firstTouch?.utm_source || 'Direct'}
                        </div>
                        {firstTouch?.utm_medium && (
                          <div className="text-xs text-muted-foreground">
                            {firstTouch.utm_medium}
                          </div>
                        )}
                        {firstTouch?.fbclid && (
                          <div className="text-xs text-muted-foreground">
                            fbclid: {firstTouch.fbclid.slice(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-sm max-w-xs truncate">
                        {firstTouch?.url || '-'}
                      </td>
                      <td className="p-4 text-center">{session.pageViews}</td>
                      <td className="p-4 text-sm">
                        {session.duration
                          ? `${Math.floor(session.duration / 60)}m ${session.duration % 60}s`
                          : '-'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(session.startedAt).toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
