import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useState } from 'react'
import { api } from 'convex/_generated/api'
import { Id } from 'convex/_generated/dataModel'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { ChartCategories } from '@/components/chart-categories'

export const Route = createFileRoute('/companies/$companyId/')({
  component: CompanyDetailsPage,
})

function CompanyDetailsPage() {
  const { companyId } = Route.useParams()
  const [selectedSessionId, setSelectedSessionId] =
    useState<Id<'sessions'> | null>(null)

  const company = useQuery(api.companies.getCompany, {
    companyId: companyId as Id<'companies'>,
  })
  const sessions = useQuery(api.tracking.getSessions, {
    companyId: companyId as Id<'companies'>,
    limit: 500,
  })
  const pageViews = useQuery(
    api.tracking.getSessionPageViews,
    selectedSessionId
      ? {
          sessionId: selectedSessionId,
        }
      : 'skip',
  )

  // Find the selected session to get its client sessionId for display
  const selectedSession = selectedSessionId
    ? sessions?.find((s) => s._id === selectedSessionId)
    : null

  // Category badge styling
  const getCategoryBadge = (category: string) => {
    const categoryMap: Record<string, { label: string; className: string }> = {
      organic_search: {
        label: 'Organic Search',
        className:
          'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      },
      paid_search: {
        label: 'Paid Search',
        className:
          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      },
      organic_social: {
        label: 'Organic Social',
        className:
          'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      },
      paid_social: {
        label: 'Paid Social',
        className:
          'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      },
      email: {
        label: 'Email',
        className:
          'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      },
      referral: {
        label: 'Referral',
        className:
          'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      },
      display: {
        label: 'Display',
        className:
          'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      },
      affiliate: {
        label: 'Affiliate',
        className:
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      },
      sms: {
        label: 'SMS',
        className:
          'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
      },
      push: {
        label: 'Push',
        className:
          'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
      },
      shopping: {
        label: 'Shopping',
        className:
          'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      },
      video: {
        label: 'Video',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      },
      direct: {
        label: 'Direct',
        className:
          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      },
    }

    const categoryInfo = categoryMap[category] || {
      label: category,
      className:
        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    }

    return (
      <span
        className={`text-xs font-medium px-1.5 py-0.5 rounded ${categoryInfo.className}`}
      >
        {categoryInfo.label}
      </span>
    )
  }

  if (
    company === undefined ||
    sessions === undefined
  ) {
    return <div className="container mx-auto p-8">Loading...</div>
  }

  if (company === null) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Company Not Found</h1>
          <Link to="/companies">
            <Button>Back to Companies</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/companies"
          className="text-sm text-muted-foreground hover:underline mb-2 inline-block"
        >
          ← Back to Companies
        </Link>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <div className="md:col-span-1">
          <ChartCategories companyId={companyId as Id<'companies'>} />
        </div>
        <div className="md:col-span-3">
          <ChartAreaInteractive companyId={companyId as Id<'companies'>} />
        </div>
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
                  <th className="text-left p-4 font-medium">
                    First Session Source
                  </th>
                  <th className="text-left p-4 font-medium">
                    Last Session Source
                  </th>
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
                        <button
                          onClick={() => setSelectedSessionId(session._id)}
                          className="text-xs text-primary hover:underline cursor-pointer font-mono"
                        >
                          {session.sessionId.slice(0, 8)}...
                        </button>
                      </td>
                      <td className="p-4">
                        {session.firstSessionSource ? (
                          <div className="text-sm font-medium">
                            {session.firstSessionSource}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {firstTouch?.utm_source || 'Direct'}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {session.lastSessionSource ? (
                          <div className="text-sm font-medium">
                            {session.lastSessionSource}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {firstTouch?.utm_source || 'Direct'}
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

      {/* Session Pages Modal */}
      <Dialog
        open={selectedSessionId !== null}
        onOpenChange={(open) => !open && setSelectedSessionId(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pages Visited</DialogTitle>
            <DialogDescription>
              Session ID: {selectedSession?.sessionId.slice(0, 8)}...
              {pageViews !== undefined && (
                <span className="ml-2">
                  ({pageViews?.length || 0} page views)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {pageViews === undefined ? (
              <p className="text-muted-foreground text-center py-8">
                Loading page views...
              </p>
            ) : pageViews.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No pages tracked for this session
              </p>
            ) : (
              <div className="space-y-2">
                {pageViews.map((pageView: any, index) => (
                  <div
                    key={pageView._id}
                    className="p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                            #{index + 1}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(pageView._creationTime).toLocaleString()}
                          </span>
                          {pageView.channel && (
                            <>
                              <span className="text-xs text-muted-foreground">
                                •
                              </span>
                              <span className="text-xs font-medium">
                                {pageView.channel.source}
                              </span>
                              {getCategoryBadge(pageView.channel.category)}
                            </>
                          )}
                        </div>
                        <a
                          href={pageView.url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline break-all"
                        >
                          {pageView.url || 'Unknown URL'}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
