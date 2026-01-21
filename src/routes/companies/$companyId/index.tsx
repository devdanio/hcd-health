import { prisma } from '@/server/db/client'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Day } from 'react-big-calendar'
import dayjs from 'dayjs'

export const Route = createFileRoute('/companies/$companyId/')({
  component: RouteComponent,
})

const getUsersWithEvents = createServerFn({ method: 'GET' }).handler(
  async () => {
    const users = await prisma.canonicalUser.findMany({
      include: {
        UnifiedEvent: true,
      },
    })
    return users
  },
)

type UnifiedEventProperties = {
  context_campaign_name?: string
  context_campaign_content?: string
  context_page_initial_referrer?: string
  context_campaign_keyword?: string
  [key: string]: unknown
}

function RouteComponent() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsersWithEvents(),
  })

  const getEventProperty = (
    event: { properties: unknown },
    key: string,
  ): string => {
    const props = event.properties as UnifiedEventProperties | null
    return props?.[key]?.toString() || '-'
  }

  // Calculate campaign name statistics
  const campaignStats = useMemo(() => {
    if (!users) return []

    // Map to track unique users per campaign name
    const campaignUserMap = new Map<string, Set<string>>()

    users.forEach((user) => {
      user.UnifiedEvent.forEach((event) => {
        const campaignName = getEventProperty(event, 'context_campaign_name')
        if (campaignName && campaignName !== '-') {
          if (!campaignUserMap.has(campaignName)) {
            campaignUserMap.set(campaignName, new Set())
          }
          campaignUserMap.get(campaignName)?.add(user.id)
        }
      })
    })

    // Convert to array and sort by count
    return Array.from(campaignUserMap.entries())
      .map(([campaignName, userIds]) => ({
        campaignName,
        uniqueUserCount: userIds.size,
      }))
      .sort((a, b) => b.uniqueUserCount - a.uniqueUserCount)
  }, [users])

  return (
    <div className="container mx-auto p-4 space-y-6">
      {campaignStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaignStats.map((stat) => (
                <div
                  key={stat.campaignName}
                  className="border rounded-lg p-4 bg-muted/50"
                >
                  <div className="font-medium text-sm text-muted-foreground">
                    Campaign Name
                  </div>
                  <div className="text-lg font-semibold mt-1">
                    {stat.campaignName}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    {stat.uniqueUserCount} unique user
                    {stat.uniqueUserCount !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Events</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users?.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {[user.first_name, user.last_name].filter(Boolean).join(' ') ||
                  '-'}
              </TableCell>
              <TableCell>{user.phones.join(', ') || '-'}</TableCell>
              <TableCell>{user.emails.join(', ') || '-'}</TableCell>
              <TableCell>
                {user.UnifiedEvent.length > 0 ? (
                  <div className="space-y-2">
                    {user.UnifiedEvent.map((event) => (
                      <div
                        key={event.id}
                        className="border rounded-md p-3 bg-muted/50"
                      >
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="font-medium">Timestamp:</span>{' '}
                            {dayjs(event.timestamp).format('MM/DD/YYYY HH:mm')}
                          </div>
                          <div>
                            <span className="font-medium">Campaign Name:</span>{' '}
                            {getEventProperty(event, 'context_campaign_name')}
                          </div>
                          <div>
                            <span className="font-medium">
                              Campaign Content:
                            </span>{' '}
                            {getEventProperty(
                              event,
                              'context_campaign_content',
                            )}
                          </div>
                          <div>
                            <span className="font-medium">
                              Initial Referrer:
                            </span>{' '}
                            {getEventProperty(
                              event,
                              'context_page_initial_referrer',
                            )}
                          </div>
                          <div>
                            <span className="font-medium">
                              Campaign Keyword:
                            </span>{' '}
                            {getEventProperty(
                              event,
                              'context_campaign_keyword',
                            )}
                          </div>
                          <div>
                            <span className="font-medium">Event Type:</span>{' '}
                            {event.event_type || '-'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">No events</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
