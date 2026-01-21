import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { prisma } from '@/server/db/client'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ExpandedState,
} from '@tanstack/react-table'
import { useState, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { EventType } from '@/generated/prisma/enums'

export const Route = createFileRoute(
  '/companies/$companyId/reports/people/',
)({
  component: PeopleReportPage,
})

// ============================================================================
// Schemas & Types
// ============================================================================

const getPeopleWithIdentifyEventsSchema = z.object({
  companyId: z.string(),
})

type PersonWithEvents = {
  id: string
  email: string | null
  phone: string | null
  fullName: string | null
  firstName: string | null
  lastName: string | null
  events: Array<{
    id: string
    type: EventType
    timestamp: Date
    metadata: any
    source: string
  }>
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all people who have at least one IDENTIFY event
 * Returns people with all their events in chronological order
 */
const getPeopleWithIdentifyEvents = createServerFn({ method: 'GET' })
  .inputValidator(getPeopleWithIdentifyEventsSchema)
  .handler(async ({ data }) => {
    // First, get all person IDs that have at least one IDENTIFY event
    const peopleWithIdentify = await prisma.person.findMany({
      where: {
        company_id: data.companyId,
        events: {
          some: {
            type: EventType.IDENTIFY,
          },
        },
      },
      select: {
        id: true,
        email: true,
        phone: true,
        full_name: true,
        first_name: true,
        last_name: true,
      },
    })

    // For each person, get all their events
    const peopleWithEvents: PersonWithEvents[] = []

    for (const person of peopleWithIdentify) {
      const events = await prisma.event.findMany({
        where: {
          person_id: person.id,
          company_id: data.companyId,
        },
        orderBy: {
          timestamp: 'asc',
        },
        select: {
          id: true,
          type: true,
          timestamp: true,
          metadata: true,
          source: true,
        },
      })

      peopleWithEvents.push({
        id: person.id,
        email: person.email,
        phone: person.phone,
        fullName: person.full_name,
        firstName: person.first_name,
        lastName: person.last_name,
        events,
      })
    }

    return peopleWithEvents
  })

// ============================================================================
// Component
// ============================================================================

function PeopleReportPage() {
  const { companyId } = Route.useParams()
  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})

  // Fetch people with IDENTIFY events
  const { data: people, isLoading } = useQuery({
    queryKey: ['people-with-identify', companyId],
    queryFn: () =>
      getPeopleWithIdentifyEvents({ data: { companyId } }),
  })

  // Define columns
  const columns = useMemo<ColumnDef<PersonWithEvents>[]>(
    () => [
      {
        id: 'expander',
        header: () => null,
        cell: ({ row }) => {
          return row.getCanExpand() ? (
            <button
              onClick={row.getToggleExpandedHandler()}
              className="flex items-center justify-center"
            >
              {row.getIsExpanded() ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : null
        },
      },
      {
        accessorKey: 'fullName',
        header: 'Name',
        cell: ({ row }) => {
          const fullName = row.original.fullName
          const firstName = row.original.firstName
          const lastName = row.original.lastName
          return fullName || `${firstName || ''} ${lastName || ''}`.trim() || '-'
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => row.original.email || '-',
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => row.original.phone || '-',
      },
      {
        id: 'eventCount',
        header: 'Total Events',
        cell: ({ row }) => row.original.events.length,
      },
    ],
    [],
  )

  const table = useReactTable({
    data: people ?? [],
    columns,
    state: {
      sorting,
      expanded,
    },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  })

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">People Report</h1>
          <p className="text-muted-foreground">
            All people with IDENTIFY events and their complete event history
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>People with IDENTIFY Events</CardTitle>
          <CardDescription>
            {people ? `${people.length} people found` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : !people || people.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No people with IDENTIFY events found
            </div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left text-sm font-medium"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <>
                      <tr
                        key={row.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 text-sm">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                      {row.getIsExpanded() && (
                        <tr>
                          <td colSpan={columns.length} className="p-0">
                            <div className="bg-muted/30 p-4">
                              <h4 className="font-semibold mb-3 text-sm">
                                Event History ({row.original.events.length}{' '}
                                events)
                              </h4>
                              <div className="space-y-2">
                                {row.original.events.map((event) => (
                                  <div
                                    key={event.id}
                                    className="flex items-start gap-4 p-3 bg-background rounded-md border text-sm"
                                  >
                                    <div className="flex-shrink-0 w-32 text-muted-foreground">
                                      {new Date(
                                        event.timestamp,
                                      ).toLocaleString()}
                                    </div>
                                    <div className="flex-shrink-0 w-32 font-medium">
                                      {event.type}
                                    </div>
                                    <div className="flex-shrink-0 w-24 text-muted-foreground">
                                      {event.source}
                                    </div>
                                    <div className="flex-1 text-muted-foreground font-mono text-xs">
                                      {JSON.stringify(event.metadata)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
