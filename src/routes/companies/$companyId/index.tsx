import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
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
  FileText,
  Phone,
  MessageSquare,
  DollarSign,
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
import { useState, useMemo } from 'react'
import { TimeframeSelect, type TimeRange } from '@/components/timeframe-select'
import dayjs from 'dayjs'
import {
  getCompany,
  getSessions,
  getSessionPageViews,
  getLast24HoursVisitors,
  getTopPages,
  getRevenueByDateRange,
} from '@/collections'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { ChartCategories } from '@/components/chart-categories'
// import { LeadsPatientsChart } from '@/components/leads-patients-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCollections } from '@/routes/__root'
import { useLiveQuery, eq } from '@tanstack/react-db'

const searchParamsSchema = z.object({
  timeRange: z
    .enum(['24h', '7d', '14d', '30d', '90d', '1y'])
    .optional()
    .default('30d'),
})

// Helper to get start date from TimeRange
function getStartDateFromTimeRange(timeRange: TimeRange): Date {
  switch (timeRange) {
    case '24h':
      return dayjs().subtract(24, 'hour').toDate()
    case '7d':
      return dayjs().subtract(7, 'day').toDate()
    case '14d':
      return dayjs().subtract(14, 'day').toDate()
    case '30d':
      return dayjs().subtract(30, 'day').toDate()
    case '90d':
      return dayjs().subtract(90, 'day').toDate()
    case '1y':
      return dayjs().subtract(1, 'year').toDate()
  }
}

export const Route = createFileRoute('/companies/$companyId/')({
  validateSearch: searchParamsSchema,
  component: CompanyDetailsPage,
})

// Helper to extract source and category from session attribution object
const extractSourceInfo = (
  attribution: any,
): { source: string; category: string } => {
  if (!attribution) return { source: 'Direct', category: 'direct' }

  // Determine the source based on UTM parameters or click IDs
  let source = 'Direct'
  let medium = ''

  if (attribution.utm_source) {
    source = attribution.utm_source
    medium = attribution.utm_medium || ''
  } else if (attribution.gclid) {
    source = 'Google'
    medium = 'cpc'
  } else if (attribution.fbclid) {
    source = 'Facebook'
    medium = 'cpc'
  } else if (attribution.referrer) {
    try {
      const referrerUrl = new URL(attribution.referrer)
      source = referrerUrl.hostname.replace('www.', '')
    } catch {
      source = attribution.referrer
    }
  }

  // Determine category based on source and medium
  const sourceLower = source.toLowerCase()
  const mediumLower = medium.toLowerCase()

  let category = 'direct'

  if (mediumLower.includes('cpc') || mediumLower.includes('ppc')) {
    category = 'paid_search'
  } else if (
    mediumLower.includes('organic') ||
    sourceLower.includes('google')
  ) {
    category = 'organic_search'
  } else if (mediumLower.includes('social')) {
    category = mediumLower.includes('paid') ? 'paid_social' : 'organic_social'
  } else if (mediumLower.includes('email')) {
    category = 'email'
  } else if (attribution.referrer) {
    category = 'referral'
  }

  return { source, category }
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

// Category badge component with icons
type CategoryType =
  | 'direct social'
  | 'paid social'
  | 'organic search'
  | 'paid search'
  | 'email'
  | 'phone'
  | 'chat'

function CategoryBadge({ category }: { category: CategoryType }) {
  const categoryConfig: Record<
    CategoryType,
    { label: string; icon: React.ElementType; className: string }
  > = {
    'direct social': {
      label: 'Direct Social',
      icon: Users,
      className:
        'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    },
    'paid social': {
      label: 'Paid Social',
      icon: Users,
      className:
        'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    },
    'organic search': {
      label: 'Organic Search',
      icon: Search,
      className:
        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    'paid search': {
      label: 'Paid Search',
      icon: Search,
      className:
        'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    email: {
      label: 'Email',
      icon: Mail,
      className:
        'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    },
    phone: {
      label: 'Phone',
      icon: Phone,
      className:
        'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    },
    chat: {
      label: 'Chat',
      icon: MessageSquare,
      className:
        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    },
  }

  const config = categoryConfig[category]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={`${config.className} text-[10px] px-1`}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </Badge>
  )
}

// Channel badge component with icons
type ChannelType = 'instagram' | 'tiktok' | 'youtube' | 'meta' | 'google'

function ChannelBadge({ channel }: { channel: ChannelType }) {
  const channelConfig: Record<
    ChannelType,
    { label: string; icon: React.ElementType; className: string }
  > = {
    instagram: {
      label: 'Instagram',
      icon: Instagram,
      className:
        'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    },
    tiktok: {
      label: 'TikTok',
      icon: Video,
      className: 'bg-black text-white dark:bg-gray-800 dark:text-white',
    },
    youtube: {
      label: 'YouTube',
      icon: Youtube,
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    },
    meta: {
      label: 'Meta',
      icon: Facebook,
      className:
        'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    google: {
      label: 'Google',
      icon: Search,
      className:
        'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
  }

  const config = channelConfig[channel]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={`${config.className} text-[10px] px-1`}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </Badge>
  )
}

// Generate fake contacts data
function generateFakeContacts() {
  const names = [
    'John Smith',
    'Sarah Johnson',
    'Michael Chen',
    'Emily Davis',
    'David Wilson',
    'Jessica Martinez',
    'Robert Taylor',
    'Amanda Brown',
    'Christopher Lee',
    'Jennifer White',
  ]

  const locations = ['Princeton', 'Bridgewater']

  const categories: CategoryType[] = [
    'direct social',
    'paid social',
    'organic search',
    'paid search',
    'email',
    'phone',
    'chat',
  ]

  const channels: ChannelType[] = [
    'instagram',
    'tiktok',
    'youtube',
    'meta',
    'google',
  ]

  const campaigns = [
    'Summer Wellness',
    'Back Pain Relief',
    'New Patient Special',
    'Holiday Promotion',
    'Fitness Challenge',
  ]

  const contactTypes: ('Lead' | 'Patient')[] = ['Lead', 'Patient']

  return Array.from({ length: 10 }, (_, i) => {
    const numCampaigns = Math.floor(Math.random() * 3) + 1
    const selectedCampaigns = Array.from({ length: numCampaigns }, () => {
      return campaigns[Math.floor(Math.random() * campaigns.length)]
    })

    const speedToLeadDays = Math.floor(Math.random() * 13) // 0-12 days
    const speedToLeadHours = Math.floor(Math.random() * 24)
    const speedToLeadMinutes = Math.floor(Math.random() * 60)
    const speedToLeadSeconds = Math.floor(Math.random() * 60)

    let speedToLead = ''
    if (speedToLeadDays > 0) {
      speedToLead = `${speedToLeadDays}d ${speedToLeadHours}h`
    } else if (speedToLeadHours > 0) {
      speedToLead = `${speedToLeadHours}h ${speedToLeadMinutes}m`
    } else if (speedToLeadMinutes > 0) {
      speedToLead = `${speedToLeadMinutes}m ${speedToLeadSeconds}s`
    } else {
      speedToLead = `${speedToLeadSeconds}s`
    }

    return {
      name: names[i],
      location: locations[Math.floor(Math.random() * locations.length)],
      category: categories[
        Math.floor(Math.random() * categories.length)
      ] as CategoryType,
      channel: channels[
        Math.floor(Math.random() * channels.length)
      ] as ChannelType,
      campaigns: [...new Set(selectedCampaigns)],
      speedToLead,
      contactType: contactTypes[
        Math.floor(Math.random() * contactTypes.length)
      ] as 'Lead' | 'Patient',
    }
  })
}

function CompanyDetailsPage() {
  const { companyId } = Route.useParams()
  const navigate = Route.useNavigate()
  const searchParams = Route.useSearch()
  const timeRange = searchParams.timeRange
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  )

  const handleTimeRangeChange = (value: TimeRange) => {
    navigate({
      search: (prev: z.infer<typeof searchParamsSchema>) => ({
        ...prev,
        timeRange: value,
      }),
    })
  }

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany({ data: { companyId } }),
  })

  const { contactsCollection } = useCollections()

  const { data: contacts } = useLiveQuery((q) =>
    q
      .from({ contact: contactsCollection })
      .where(({ contact }) => eq(contact.companyId, companyId)),
  )

  const { data: revenueData } = useQuery({
    queryKey: ['revenue', companyId, timeRange],
    queryFn: () =>
      getRevenueByDateRange({
        data: {
          companyId,
          startDate: getStartDateFromTimeRange(timeRange),
          endDate: dayjs().toDate(),
          groupBy: 'day',
        },
      }),
  })

  const totalRevenue = useMemo(() => {
    if (!revenueData) return 0
    return revenueData.reduce((acc, curr) => acc + curr.revenueDollars, 0)
  }, [revenueData])

  // const { data: sessions } = useQuery({
  //   queryKey: ['sessions', companyId],
  //   queryFn: () => getSessions({ data: { companyId, limit: 500 } }),
  // })

  // const { data: pageViews } = useQuery({
  //   queryKey: ['pageViews', selectedSessionId],
  //   queryFn: () =>
  //     getSessionPageViews({ data: { sessionId: selectedSessionId! } }),
  //   enabled: !!selectedSessionId,
  // })

  // const { data: last24HoursVisitors } = useQuery({
  //   queryKey: ['visitors24h', companyId],
  //   queryFn: () => getLast24HoursVisitors({ data: { companyId } }),
  // })

  // const { data: topPages } = useQuery({
  //   queryKey: ['topPages', companyId, timeRange],
  //   queryFn: () => getTopPages({ data: { companyId, timeRange } }),
  // })

  // Sort sessions by last activity
  // const sortedSessions = useMemo(() => {
  //   if (!sessions) return []
  //   return [...sessions].sort((a, b) => {
  //     return b.lastActivity - a.lastActivity
  //   })
  // }, [sessions])

  // Find the selected session to get its client sessionId for display
  // const selectedSession = selectedSessionId
  //   ? sessions?.find((s) => s._id === selectedSessionId)
  //   : null

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

  if (company === undefined) {
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
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/companies"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to Companies
        </Link>
        <TimeframeSelect
          value={timeRange}
          onValueChange={handleTimeRangeChange}
          className="w-[180px]"
        />
      </div>

      <div className="grid grid-cols-4 mb-4 gap-4">
        <Card>
          <CardHeader>Leads</CardHeader>
          <CardContent className="flex items-center justify-center">
            <span className="text-2xl font-semibold">62</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>New Patients</CardHeader>
          <CardContent className="flex items-center justify-center">
            <span className="text-2xl font-semibold">13</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>Total Revenue</CardHeader>
          <CardContent className="flex items-center justify-center">
            <span className="text-2xl font-semibold">
              $
              {totalRevenue.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>Revnue/patient</CardHeader>
          <CardContent className="flex items-center justify-center">
            <span className="text-2xl font-semibold">$1,251</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3">
          {/* <LeadsPatientsChart companyId={companyId} timeRange={timeRange} /> */}
        </div>
        <div className="col-span-1">
          <Card>
            <CardHeader>ROI by Service</CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Acupuncture */}
                <div className="border-b pb-3 last:border-b-0">
                  <h4 className="font-semibold text-sm mb-2">Acupuncture</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CAC:</span>
                      <span className="font-medium">$125</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="font-medium">$2,450</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Expected Revenue:
                      </span>
                      <span className="font-medium">$3,200</span>
                    </div>
                  </div>
                </div>

                {/* PT */}
                <div className="border-b pb-3 last:border-b-0">
                  <h4 className="font-semibold text-sm mb-2">PT</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CAC:</span>
                      <span className="font-medium">$180</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="font-medium">$4,320</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Expected Revenue:
                      </span>
                      <span className="font-medium">$5,400</span>
                    </div>
                  </div>
                </div>

                {/* Chiro */}
                <div className="pb-3">
                  <h4 className="font-semibold text-sm mb-2">Chiro</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CAC:</span>
                      <span className="font-medium">$95</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="font-medium">$1,900</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Expected Revenue:
                      </span>
                      <span className="font-medium">$2,850</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Campaigns</TableHead>
                  <TableHead>Speed to Lead</TableHead>
                  <TableHead>Contact Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generateFakeContacts().map((contact, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {contact.name}
                    </TableCell>
                    <TableCell>{contact.location}</TableCell>
                    <TableCell>
                      <CategoryBadge category={contact.category} />
                    </TableCell>
                    <TableCell>
                      <ChannelBadge channel={contact.channel} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {contact.campaigns.map((campaign, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[10px] px-1"
                          >
                            {campaign}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{contact.speedToLead}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          contact.contactType === 'Patient'
                            ? 'default'
                            : 'secondary'
                        }
                        className="text-[10px] px-1"
                      >
                        {contact.contactType}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
