import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { useCollections } from '@/routes/__root'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ArrowUpDown, Plus, Upload, FileSpreadsheet } from 'lucide-react'
import { PatientForm } from '@/components/PatientForm'

export const Route = createFileRoute('/companies/$companyId/patients/')({
  component: PatientsPage,
})

type Patient = {
  id: string
  contactId: string
  dateOfBirth: string | null
  gender: string | null
  payerName: string | null
  memberId: string | null
  groupId: string | null
  createdAt: Date
  updatedAt: Date
  contact: {
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    fullName: string | null
    dateOfBirth: Date | null
  }
}

function PatientsPage() {
  const { companyId } = Route.useParams()
  const { patientsCollection } = useCollections()
  const navigate = useNavigate()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Use TanStack DB useLiveQuery for reactive data
  const { data: patients } = useLiveQuery((q) =>
    q
      .from({ patient: patientsCollection })
      .where(({ patient }) => eq(patient.contact.companyId, companyId)),
  )

  const columns = useMemo<ColumnDef<Patient>[]>(
    () => [
      {
        accessorFn: (row) => row.contact?.firstName,
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
          <div className="capitalize">
            {row.original.contact?.firstName || '-'}
          </div>
        ),
      },
      {
        accessorFn: (row) => row.contact?.lastName,
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
          <div className="capitalize">
            {row.original.contact?.lastName || '-'}
          </div>
        ),
      },
      {
        accessorFn: (row) => row.contact?.email,
        id: 'email',
        header: 'Email',
        cell: ({ row }) => (
          <div className="lowercase">{row.original.contact?.email || '-'}</div>
        ),
      },
      {
        accessorFn: (row) => row.contact?.phone,
        id: 'phone',
        header: 'Phone',
        cell: ({ row }) => <div>{row.original.contact?.phone || '-'}</div>,
      },
      {
        accessorKey: 'payerName',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
            >
              Payer Name
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }) => (
          <div className="capitalize">{row.getValue('payerName') || '-'}</div>
        ),
      },
      {
        accessorKey: 'dateOfBirth',
        header: 'Date of Birth',
        cell: ({ row }) => (
          <div>{row.getValue('contact.dateOfBirth') || '-'}</div>
        ),
      },
      {
        accessorKey: 'memberId',
        header: 'Member ID',
        cell: ({ row }) => <div>{row.getValue('memberId') || '-'}</div>,
      },
      {
        accessorKey: 'groupId',
        header: 'Group ID',
        cell: ({ row }) => <div>{row.getValue('groupId') || '-'}</div>,
      },
      {
        accessorKey: 'createdAt',
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
          return (
            <div>
              {new Date(row.getValue('createdAt')).toLocaleDateString()}
            </div>
          )
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data: patients ?? [],
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

  if (patients === undefined) {
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
          <h1 className="text-3xl font-bold">Patients</h1>
          <p className="text-muted-foreground">Manage and view all patients</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" /> Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import Patients</DialogTitle>
                <DialogDescription>
                  Upload a CSV or XLS file to import patients. Drag and drop
                  your file or click to browse.
                </DialogDescription>
              </DialogHeader>
              <div
                className={`mt-4 border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  const files = e.dataTransfer.files
                  if (files.length > 0) {
                    // File handling will be implemented later
                  }
                }}
              >
                <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm font-medium mb-2">
                  Drag and drop your file here
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  className="hidden"
                  id="file-upload"
                  onChange={(e) => {
                    const files = e.target.files
                    if (files && files.length > 0) {
                      // File handling will be implemented later
                    }
                  }}
                />
                <label htmlFor="file-upload">
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    asChild
                  >
                    <span>Select File</span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground mt-4">
                  Supported formats: CSV, XLS, XLSX
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Patient
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <PatientForm
                companyId={companyId}
                onSuccess={() => setIsAddOpen(false)}
                onCancel={() => setIsAddOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Patients ({patients.length})</CardTitle>
          <div className="flex items-center gap-4 mt-4">
            <Input
              placeholder="Search patients..."
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
                          to: '/companies/$companyId/patients/$patientId',
                          params: {
                            companyId,
                            patientId: row.original.id,
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
                      No patients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">
              {table.getFilteredRowModel().rows.length} patient(s) total
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
