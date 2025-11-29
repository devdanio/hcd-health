import { eq, useLiveQuery } from '@tanstack/react-db'
import { useCollections } from '@/routes/__root'
import { useState } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { dan } from '@/collections'

interface ServicesSettingsProps {
  companyId: string
}

export function ServicesSettings({ companyId }: ServicesSettingsProps) {
  const { servicesCollection } = useCollections()
  console.log('companyId before fetch', companyId)
  const { data: services } = useLiveQuery((q) =>
    q
      .from({ servicesCollection })
      .where(({ servicesCollection }) =>
        eq(servicesCollection.companyId, companyId),
      ),
  )

  console.log('services', services)
  const [newServiceName, setNewServiceName] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingService, setEditingService] = useState<{
    id: string
    name: string
  } | null>(null)

  const handleCreate = async () => {
    try {
      await servicesCollection.insert({
        companyId,
        name: newServiceName,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      setNewServiceName('')
      setIsCreateOpen(false)
      toast.success('Service created')
    } catch (error) {
      toast.error('Failed to create service')
    }
  }

  const handleUpdate = async () => {
    if (!editingService) return
    try {
      await servicesCollection.update(editingService.id, {
        name: editingService.name,
      })
      setEditingService(null)
      toast.success('Service updated')
    } catch (error) {
      toast.error('Failed to update service')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return
    try {
      await servicesCollection.delete(id)
      toast.success('Service deleted')
    } catch (error) {
      toast.error('Failed to delete service')
    }
  }

  if (!services) return <div>Loading...</div>

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Services</CardTitle>
          <CardDescription>Manage your services.</CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" /> Add Service
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Service</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="Service Name"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
              />
              <Button onClick={handleCreate}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell>
                  {editingService?.id === service.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={editingService.name}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            name: e.target.value,
                          })
                        }
                      />
                      <Button size="sm" onClick={handleUpdate}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingService(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    service.name
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setEditingService({
                          id: service.id,
                          name: service.name,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(service.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
