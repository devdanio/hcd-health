import { useWebEvents } from '@/collections/events'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowUpDown } from 'lucide-react'
import groupBy from 'lodash/groupBy'

export const Route = createFileRoute(
  '/companies/$companyId/reports/marketing/',
)({
  component: RouteComponent,
})

type CampaignSubRow = {
  campaignName: string
  sessions: number
  leads: number
  patients: number
  revenue: number
  cost: number
  cac: number
  isSubRow: true
}

type SourceRow = {
  source: string
  sessions: number
  leads: number
  patients: number
  revenue: number
  cost: number
  cac: number
  isSubRow?: false
  subRows?: CampaignSubRow[]
}

type TableRow = SourceRow | CampaignSubRow

function RouteComponent() {
  const { companyId } = Route.useParams()
  const { data: webEvents } = useWebEvents()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const campaigns = useMemo(() => {
    return groupBy(webEvents, 'metadata.utm_campaign')
  }, [webEvents])
  console.log('campaigns', campaigns)

  // Transform events into hierarchical data: sources with campaign sub-rows
  const campaignData = useMemo(() => {
    if (!webEvents) return []

    // Group by source, then by campaign within each source
    const sourceMap = new Map<
      string,
      Map<string, { sessionIds: Set<string> }>
    >()

    for (const event of webEvents) {
      const source =
        (event.metadata as Record<string, unknown>)?.utm_source || 'Unknown'
      const campaign =
        (event.metadata as Record<string, unknown>)?.utm_campaign || 'Unknown'
      const sessionId = event.session_id

      if (!sourceMap.has(source)) {
        sourceMap.set(source, new Map())
      }

      const campaignMap = sourceMap.get(source)!

      if (campaignMap.has(campaign)) {
        const existing = campaignMap.get(campaign)!
        if (sessionId) {
          existing.sessionIds.add(sessionId)
        }
      } else {
        campaignMap.set(campaign, {
          sessionIds: new Set(sessionId ? [sessionId] : []),
        })
      }
    }

    // Convert to array with sub-rows
    const result: SourceRow[] = []

    for (const [source, campaignMap] of sourceMap) {
      const campaigns: CampaignSubRow[] = []
      let totalSessions = 0

      for (const [campaignName, data] of campaignMap) {
        const sessions = data.sessionIds.size
        totalSessions += sessions

        campaigns.push({
          campaignName,
          sessions,
          leads: 0,
          patients: 0,
          revenue: 0,
          cost: 0,
          cac: 0,
          isSubRow: true,
        })
      }

      result.push({
        source,
        sessions: totalSessions,
        leads: 0,
        patients: 0,
        revenue: 0,
        cost: 0,
        cac: 0,
        subRows: campaigns,
      })
    }

    return result
  }, [webEvents])

  const columns = useMemo<ColumnDef<TableRow>[]>(
    () => [
      {
        id: 'source',
        accessorFn: (row) => ('source' in row ? row.source : row.campaignName),
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Source / Campaign
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const isSubRow = row.original.isSubRow
          const value =
            'source' in row.original
              ? row.original.source
              : row.original.campaignName

          return (
            <div
              className={`${isSubRow ? 'pl-8 text-sm text-muted-foreground' : 'font-medium'} capitalize`}
            >
              {value}
            </div>
          )
        },
      },
      {
        accessorKey: 'sessions',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Sessions
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => (
          <div className="text-right">
            {row.original.sessions.toLocaleString()}
          </div>
        ),
      },
      {
        accessorKey: 'leads',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Leads
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => <div className="text-right">0</div>,
      },
      {
        accessorKey: 'patients',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Patients
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => <div className="text-right">0</div>,
      },
      {
        accessorKey: 'revenue',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Revenue
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => <div className="text-right">$0</div>,
      },
      {
        accessorKey: 'cost',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Cost
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => <div className="text-right">$0</div>,
      },
      {
        accessorKey: 'cac',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              CAC
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => <div className="text-right">$0</div>,
      },
    ],
    [],
  )

  const table = useReactTable({
    data: campaignData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    state: {
      sorting,
      columnFilters,
      globalFilter,
      expanded: true, // Always show all sub-rows
    },
  })

  if (!webEvents) {
    return (
      <div className="container mx-auto p-8">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <Link
          to="/companies/$companyId"
          params={{ companyId }}
          className="text-sm text-muted-foreground hover:underline mb-2 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold">Marketing Performance</h1>
        <p className="text-muted-foreground">
          View performance metrics by traffic source
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Source Performance ({campaignData.length} sources)
          </CardTitle>
          <div className="flex items-center gap-4 mt-4">
            <Input
              placeholder="Search sources..."
              value={globalFilter ?? ''}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b ">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="h-12 px-4 text-left align-middle font-medium"
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
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => {
                    const isSubRow = row.original.isSubRow

                    return (
                      <tr
                        key={row.id}
                        className={`border-b transition-colors ${
                          isSubRow ? ' hover:bg-muted/30' : 'hover:bg-muted/50'
                        }`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="p-4 align-middle">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="h-24 text-center">
                      No sources found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">
              {campaignData.length} source(s) total
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <div className="text-sm">
                Page {table.getState().pagination.pageIndex + 1} of{' '}
                {table.getPageCount()}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
