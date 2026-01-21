import { createFileRoute, Link } from '@tanstack/react-router'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { useCollections } from '@/routes/__root'
import { useQuery } from '@tanstack/react-query'
import { getContactsAnalytics } from '@/collections'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useState, useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowUpDown } from 'lucide-react'

export const Route = createFileRoute('/companies/$companyId/contacts/')({
  component: ContactsPage,
})

// Chart configuration
const chartConfig = {
  contacts: {
    label: 'Contacts',
    color: 'oklch(90.5% 0.093 164.15)',
  },
} satisfies ChartConfig

type GHLContact = {
  id: string
  locationId: string
  contactName: string | null
  firstName: string | null
  lastName: string | null
  companyName: string | null
  email: string | null
  phone: string | null
  dateAdded: Date
  dateUpdated: Date
  createdAt: Date
  updatedAt: Date
}

type Contact = {
  id: string
  email: string | null
  phone: string | null
  fullName: string | null
  firstName: string | null
  lastName: string | null
  companyId: string
  ghlContactId: string | null
  ghlContact: GHLContact | null
  createdAt: Date
  updatedAt: Date
}

function ContactsPage() {
  const { companyId } = Route.useParams()
  const { contactsCollection } = useCollections()

  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>(
    '30d',
  )
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  // Use TanStack DB useLiveQuery for reactive data
  const { data: contacts } = useLiveQuery((q) =>
    q
      .from({ contact: contactsCollection })
      .where(({ contact }) => eq(contact.companyId, companyId)),
  )

  // Calculate date range for analytics
  const getDateRange = (range: '7d' | '30d' | '90d' | 'all') => {
    const endDate = new Date()
    const startDate = new Date()

    if (range === '7d') startDate.setDate(startDate.getDate() - 7)
    else if (range === '30d') startDate.setDate(startDate.getDate() - 30)
    else if (range === '90d') startDate.setDate(startDate.getDate() - 90)
    else startDate.setFullYear(2000) // 'all' - far back date

    return { startDate, endDate }
  }

  const { startDate, endDate } = getDateRange(timeRange)

  const { data: analyticsData } = useQuery({
    queryKey: ['contacts-analytics', companyId, timeRange],
    queryFn: () =>
      getContactsAnalytics({ data: { companyId, startDate, endDate } }),
  })

  // Define table columns using GHL data
  const columns = useMemo<ColumnDef<Contact>[]>(
    () => [
      {
        accessorFn: (row) => row.ghlContact?.firstName,
        id: 'firstName',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              First Name
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => (
          <div className="capitalize">{row.original.firstName || '-'}</div>
        ),
      },
      {
        accessorFn: (row) => row.lastName,
        id: 'lastName',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Last Name
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => (
          <div className="capitalize">{row.original.lastName || '-'}</div>
        ),
      },
      {
        accessorFn: (row) => row.email,
        id: 'email',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Email
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => (
          <div className="lowercase">{row.original.email || '-'}</div>
        ),
      },
      {
        accessorFn: (row) => row.phone,
        id: 'phone',
        header: 'Phone',
        cell: ({ row }) => <div>{row.original.phone || '-'}</div>,
      },
      {
        accessorFn: (row) => row.createdAt,
        id: 'dateAdded',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Date Added
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          const dateAdded = row.original.createdAt
          if (!dateAdded) return <div>-</div>
          const date =
            dateAdded instanceof Date ? dateAdded : new Date(dateAdded)
          return <div>{date.toLocaleDateString()}</div>
        },
      },
    ],
    [],
  )

  // Initialize table
  const table = useReactTable({
    data: contacts ?? [],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  })

  if (contacts === undefined || analyticsData === undefined) {
    return (
      <div className="container mx-auto p-8">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/companies/$companyId"
          params={{ companyId }}
          className="text-sm text-muted-foreground hover:underline mb-2 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold">Contacts</h1>
        <p className="text-muted-foreground">
          Manage and view all contacts for this company
        </p>
      </div>

      {/* Chart Card */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Contacts Over Time</CardTitle>
            <CardDescription>New contacts added by day</CardDescription>
          </div>
          <Select
            value={timeRange}
            onValueChange={(value: any) => setTimeRange(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {analyticsData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No contacts data available for this time range
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[180px] w-full">
              <BarChart accessibilityLayer data={analyticsData} width={800}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  }}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar
                  dataKey="contacts"
                  fill="var(--color-contacts)"
                  radius={8}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Contacts ({contacts.length})</CardTitle>
          <div className="flex items-center gap-4 mt-4">
            <Input
              placeholder="Search contacts..."
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
                  table.getRowModel().rows.map((row) => (
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="h-24 text-center">
                      No contacts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">
              {table.getFilteredRowModel().rows.length} contact(s) total
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
