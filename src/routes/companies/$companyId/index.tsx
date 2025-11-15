import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { z } from 'zod'
import {
  Search,
  Users,
  Mail,
  ExternalLink,
  Monitor,
  Link as LinkIcon,
  MessageCircle,
  Video,
  Globe,
  Briefcase,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Youtube,
  Github,
} from 'lucide-react'

import { SocialIcon } from 'react-social-icons'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState, useMemo } from 'react'
import { api } from 'convex/_generated/api'
import { Id } from 'convex/_generated/dataModel'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { ChartCategories } from '@/components/chart-categories'

const searchParamsSchema = z.object({
  timeRange: z.enum(['24h', '7d', '30d', '90d']).optional().default('30d'),
})

export const Route = createFileRoute('/companies/$companyId/')({
  validateSearch: searchParamsSchema,
  component: CompanyDetailsPage,
})

// Helper to extract source and category from lastSessionSource string
// e.g., "Facebook (paid_social)" → { source: "Facebook", category: "paid_social" }
const extractSourceInfo = (
  lastSessionSource: string | undefined,
): { source: string; category: string } => {
  if (!lastSessionSource) return { source: 'Direct', category: 'direct' }

  const match = lastSessionSource.match(/^(.+?)\s*\(([^)]+)\)/)
  if (match) {
    return {
      source: match[1].trim(),
      category: match[2].trim(),
    }
  }

  return { source: lastSessionSource, category: 'direct' }
}

const style = { width: '20px', height: '20px' }
// Helper function to get icon component based on source and category
const getIconForSource = (source: string, category: string) => {
  const sourceLower = source.toLowerCase()

  console.log(sourceLower)
  // Check for specific social media platforms first
  if (sourceLower.includes('facebook'))
    return () => <SocialIcon url="https://www.facebook.com" style={style} />
  if (sourceLower.includes('twitter') || sourceLower === 'x')
    return () => <SocialIcon url="https://www.twitter.com" style={style} />
  if (sourceLower.includes('linkedin'))
    return () => <SocialIcon url="https://www.linkedin.com" style={style} />
  if (sourceLower.includes('instagram'))
    return () => <SocialIcon url="https://www.instagram.com" style={style} />
  if (sourceLower.includes('youtube'))
    return () => <SocialIcon url="https://www.youtube.com" style={style} />
  if (sourceLower.includes('github'))
    return () => <SocialIcon url="https://www.github.com" style={style} />
  if (sourceLower.includes('tiktok'))
    return () => <SocialIcon url="https://www.tiktok.com" style={style} />
  if (sourceLower.includes('google'))
    return () => <SocialIcon url="https://www.google.com" style={style} />

  // Fall back to category-based icons
  const categoryIconMap: Record<string, React.ElementType> = {
    organic_search: Search,
    paid_search: Search,
    organic_social: Users,
    paid_social: Users,
    email: Mail,
    referral: ExternalLink,
    display: Monitor,
    affiliate: LinkIcon,
    sms: MessageCircle,
    push: MessageCircle,
    shopping: ExternalLink,
    video: Video,
    direct: Globe,
  }

  return categoryIconMap[category] || Globe
}

// Helper to extract pathname from URL
const extractPathname = (url: string | undefined): string => {
  if (!url) return '/'
  try {
    const urlObj = new URL(url)
    return urlObj.pathname
  } catch {
    return url
  }
}

function CompanyDetailsPage() {
  const { companyId } = Route.useParams()
  const navigate = Route.useNavigate()
  const searchParams = Route.useSearch()
  const timeRange = searchParams.timeRange
  const [selectedSessionId, setSelectedSessionId] =
    useState<Id<'sessions'> | null>(null)

  const handleTimeRangeChange = (value: string) => {
    navigate({
      search: (prev: z.infer<typeof searchParamsSchema>) => ({
        ...prev,
        timeRange: value as '24h' | '7d' | '30d' | '90d',
      }),
    })
  }

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

  // Sort sessions by last activity (endedAt or startedAt)
  const sortedSessions = useMemo(() => {
    if (!sessions) return []
    return [...sessions].sort((a, b) => {
      const aTime = a.endedAt || a.startedAt
      const bTime = b.endedAt || b.startedAt
      return bTime - aTime
    })
  }, [sessions])

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

  if (company === undefined || sessions === undefined) {
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
      <div className="mb-4">
        <Link
          to="/companies"
          className="text-sm text-muted-foreground hover:underline mb-2 inline-block"
        >
          ← Back to Companies
        </Link>
      </div>

      {/* Time Range Selector */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm font-medium">Time Range:</span>
        <Select value={timeRange} onValueChange={handleTimeRangeChange}>
          <SelectTrigger className="w-[180px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="24h" className="rounded-lg">
              Last 24 hours
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Last 30 days
            </SelectItem>
            <SelectItem value="90d" className="rounded-lg">
              Last 3 months
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <div className="md:col-span-3">
          <ChartAreaInteractive
            companyId={companyId as Id<'companies'>}
            timeRange={timeRange}
          />
        </div>
        <div className="md:col-span-1">
          <ChartCategories
            companyId={companyId as Id<'companies'>}
            timeRange={timeRange}
          />
        </div>
      </div>

      {/* Sessions Table */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Recent Sessions</h2>
        {sortedSessions.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <p className="text-muted-foreground">No sessions yet</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-4 font-medium w-12">Source</th>
                  <th className="text-left p-4 font-medium">Session ID</th>
                  <th className="text-left p-4 font-medium">User Identity</th>
                  <th className="text-left p-4 font-medium">Current Page</th>
                  <th className="text-left p-4 font-medium">Page Views</th>
                  <th className="text-left p-4 font-medium">Duration</th>
                  <th className="text-left p-4 font-medium">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map((session) => {
                  const lastTouch =
                    session.touchPoints[session.touchPoints.length - 1]
                  const { source, category } = extractSourceInfo(
                    session.lastSessionSource,
                  )
                  const IconComponent = getIconForSource(source, category)
                  const lastActivity = session.endedAt || session.startedAt

                  // Determine user identity display
                  const getUserIdentity = () => {
                    console.log('session', session.user)
                    if (!session.user) return 'Anonymous'
                    const { email, fullName, firstName, lastName } =
                      session.user
                    if (email) return email
                    if (fullName) return fullName
                    if (firstName || lastName) {
                      return [firstName, lastName].filter(Boolean).join(' ')
                    }
                    return 'Anonymous'
                  }

                  return (
                    <tr
                      key={session._id}
                      className="border-t hover:bg-muted/50"
                    >
                      <td className="p-4">
                        <IconComponent className="h-5 w-5 text-muted-foreground" />
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setSelectedSessionId(session._id)}
                          className="text-xs text-primary hover:underline cursor-pointer font-mono"
                        >
                          {session.sessionId.slice(0, 8)}...
                        </button>
                      </td>
                      <td className="p-4 text-sm">
                        <span
                          className={
                            getUserIdentity() === 'Anonymous'
                              ? 'text-muted-foreground italic'
                              : ''
                          }
                        >
                          {getUserIdentity()}
                        </span>
                      </td>
                      <td className="p-4 text-sm max-w-xs truncate">
                        {extractPathname(lastTouch?.url)}
                      </td>
                      <td className="p-4 text-center">{session.pageViews}</td>
                      <td className="p-4 text-sm">
                        {session.duration
                          ? `${Math.floor(session.duration / 60)}m ${session.duration % 60}s`
                          : '-'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(lastActivity).toLocaleString()}
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
                {pageViews.map((pageView: any, index) => {
                  const PageIconComponent = pageView.channel
                    ? getIconForSource(
                        pageView.channel.source,
                        pageView.channel.category,
                      )
                    : Globe

                  return (
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
                              {new Date(
                                pageView._creationTime,
                              ).toLocaleString()}
                            </span>
                            {pageView.channel && (
                              <>
                                <span className="text-xs text-muted-foreground">
                                  •
                                </span>
                                <PageIconComponent className="h-4 w-4 text-muted-foreground" />
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
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
