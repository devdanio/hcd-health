import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { Id } from '../../../../../convex/_generated/dataModel'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ArrowUpDown, Plus } from 'lucide-react'

export const Route = createFileRoute('/companies/$companyId/cms-pages/')({
  component: CmsPagesPage,
})

type CmsPage = {
  _id: Id<'cmsPages'>
  _creationTime: number
  h1: string
  pageTitle: string
  pageDescription: string
  slug: string
  markdownContent: string
}

function CmsPagesPage() {
  const { companyId } = Route.useParams()
  const navigate = useNavigate()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const pages = useQuery(api.cmsPages.getPages, { companyId: companyId as Id<'companies'> })

  const columns = useMemo<ColumnDef<CmsPage>[]>(
    () => [
      {
        accessorKey: 'h1',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              H1
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => <div className="font-medium">{row.getValue('h1')}</div>,
      },
      {
        accessorKey: 'pageTitle',
        header: 'Page Title',
        cell: ({ row }) => <div>{row.getValue('pageTitle')}</div>,
      },
      {
        accessorKey: 'slug',
        header: 'Slug',
        cell: ({ row }) => <div>{row.getValue('slug')}</div>,
      },
      {
        accessorKey: '_creationTime',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Date Created
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => {
          return (
            <div>
              {new Date(row.getValue('_creationTime')).toLocaleDateString()}
            </div>
          )
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data: pages ?? [],
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

  if (pages === undefined) {
    return (
      <div className="container mx-auto p-8">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            to="/companies/$companyId"
            params={{ companyId }}
            className="text-sm text-muted-foreground hover:underline mb-2 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">CMS Pages</h1>
          <p className="text-muted-foreground">
            Manage your website pages
          </p>
        </div>
        <Button onClick={() => navigate({ to: '/companies/$companyId/cms-pages/create', params: { companyId } })}>
          <Plus className="mr-2 h-4 w-4" /> Create Page
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Pages ({pages.length})</CardTitle>
          <div className="flex items-center gap-4 mt-4">
            <Input
              placeholder="Search pages..."
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
                      className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                      onClick={() =>
                        navigate({
                          to: '/companies/$companyId/cms-pages/$pageId',
                          params: {
                            companyId,
                            pageId: row.original._id,
                          },
                        })
                      }
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
                      No pages found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">
              {table.getFilteredRowModel().rows.length} page(s) total
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
