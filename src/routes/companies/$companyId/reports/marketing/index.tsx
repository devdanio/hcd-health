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
  type ExpandedState,
} from '@tanstack/react-table'
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react'
import groupBy from 'lodash/groupBy'

export const Route = createFileRoute(
  '/companies/$companyId/reports/marketing/',
)({
  component: RouteComponent,
})

type SubRow = {
  name: string
  status: 'lead' | 'patient'
  revenue: number
}

type CampaignRow = {
  source: string
  sessions: number
  leads: number
  patients: number
  revenue: number
  cost: number
  cac: number
  subRows?: SubRow[]
}

// Random names for sub-rows
const RANDOM_NAMES = [
  'John Smith',
  'Sarah Johnson',
  'Michael Brown',
  'Emily Davis',
  'David Wilson',
  'Jessica Martinez',
  'Christopher Garcia',
  'Amanda Rodriguez',
  'Matthew Anderson',
  'Ashley Taylor',
  'Daniel Thomas',
  'Jennifer Moore',
  'James Jackson',
  'Lisa White',
  'Robert Harris',
]

// Generate random sub-rows for each campaign
function generateSubRows(count: number): SubRow[] {
  return Array.from({ length: Math.min(count, 5) }, (_, i) => ({
    name: RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)],
    status: Math.random() > 0.5 ? 'lead' : 'patient',
    revenue: Math.floor(Math.random() * 1000),
  }))
}

function RouteComponent() {
  const { companyId } = Route.useParams()
  const { data: webEvents } = useWebEvents()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const campaigns = useMemo(() => {
    return groupBy(webEvents, 'metadata.utm_campaign')
  }, [webEvents])
  console.log('campaigns', campaigns)

  // Transform events into campaign data grouped by source with unique sessions
  const campaignData = useMemo(() => {
    if (!webEvents) return []

    const groupedData = new Map<string, CampaignRow>()

    for (const event of webEvents) {
      const source =
        (event.metadata as Record<string, unknown>)?.utm_source || 'Unknown'
      const sessionId = event.session_id

      if (groupedData.has(source)) {
        const existing = groupedData.get(source)!
        // Track unique sessions
        const sessions = new Set([...(existing as any).sessionIds, sessionId])
        groupedData.set(source, {
          ...existing,
          sessions: sessions.size,
          ...(existing as any).sessionIds && { sessionIds: sessions },
        } as any)
      } else {
        groupedData.set(source, {
          source: source as string,
          sessions: sessionId ? 1 : 0,
          leads: 0,
          patients: 0,
          revenue: 0,
          cost: 0,
          cac: 0,
          sessionIds: new Set([sessionId]),
        } as any)
      }
    }

    // Convert to array and add sub-rows
    return Array.from(groupedData.values()).map((row) => ({
      source: row.source,
      sessions: row.sessions,
      leads: 0,
      patients: 0,
      revenue: 0,
      cost: 0,
      cac: 0,
      subRows: generateSubRows(row.sessions),
    }))
  }, [webEvents])

  const columns = useMemo<ColumnDef<CampaignRow>[]>(
    () => [
      {
        accessorKey: 'source',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Source
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.getCanExpand() && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  row.toggleExpanded()
                }}
                className="cursor-pointer"
              >
                {row.getIsExpanded() ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            <div className="capitalize font-medium">{row.getValue('source')}</div>
          </div>
        ),
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
            {row.getValue<number>('sessions').toLocaleString()}
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

  const subRowColumns = useMemo<ColumnDef<SubRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="pl-12 font-medium">{row.getValue('name')}</div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.getValue<'lead' | 'patient'>('status')
          return (
            <Badge variant={status === 'patient' ? 'default' : 'secondary'}>
              {status === 'patient' ? 'Patient' : 'Lead'}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'revenue',
        header: 'Revenue',
        cell: ({ row }) => (
          <div className="text-right">
            ${row.getValue<number>('revenue').toLocaleString()}
          </div>
        ),
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
    onExpandedChange: setExpanded,
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
      expanded,
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
                  <tr key={headerGroup.id} className="border-b bg-muted/50">
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
                    const isSubRow = row.depth > 0

                    if (isSubRow) {
                      // Render sub-row with different columns
                      return (
                        <tr
                          key={row.id}
                          className="border-b bg-muted/30 transition-colors hover:bg-muted/40"
                        >
                          <td className="p-4 align-middle" colSpan={1}>
                            <div className="pl-12 font-medium">
                              {(row.original as SubRow).name}
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            <Badge
                              variant={
                                (row.original as SubRow).status === 'patient'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {(row.original as SubRow).status === 'patient'
                                ? 'Patient'
                                : 'Lead'}
                            </Badge>
                          </td>
                          <td className="p-4 align-middle text-right" colSpan={5}>
                            ${(row.original as SubRow).revenue.toLocaleString()}
                          </td>
                        </tr>
                      )
                    }

                    // Render parent row
                    return (
                      <tr
                        key={row.id}
                        className="border-b transition-colors hover:bg-muted/50"
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
