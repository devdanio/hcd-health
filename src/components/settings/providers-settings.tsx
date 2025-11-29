"use client"

import { useLiveQuery } from "@tanstack/react-db"
import { useCollections } from "@/routes/__root"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Pencil, Trash2, Plus } from "lucide-react"

interface ProvidersSettingsProps {
  companyId: string
}

export function ProvidersSettings({ companyId }: ProvidersSettingsProps) {
  const { providersCollection, servicesCollection } = useCollections()

  const { data: providers } = useLiveQuery((q) =>
    q.from({ provider: providersCollection })
      .setMeta({ companyId })
  )

  const { data: services } = useLiveQuery((q) =>
    q.from({ service: servicesCollection })
      .setMeta({ companyId })
  )

  const [newProviderName, setNewProviderName] = useState("")
  const [newProviderService, setNewProviderService] = useState<string>("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<{ id: string, name: string, serviceId: string } | null>(null)

  const handleCreate = async () => {
    if (!newProviderService) {
      toast.error("Please select a service")
      return
    }
    try {
      await providersCollection.insert({
        companyId,
        name: newProviderName,
        serviceId: newProviderService
      })
      setNewProviderName("")
      setNewProviderService("")
      setIsCreateOpen(false)
      toast.success("Provider created")
    } catch (error) {
      toast.error("Failed to create provider")
    }
  }

  const handleUpdate = async () => {
    if (!editingProvider) return
    try {
      await providersCollection.update(editingProvider.id, {
        name: editingProvider.name,
        serviceId: editingProvider.serviceId
      })
      setEditingProvider(null)
      toast.success("Provider updated")
    } catch (error) {
      toast.error("Failed to update provider")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this provider?")) return
    try {
      await providersCollection.delete(id)
      toast.success("Provider deleted")
    } catch (error) {
      toast.error("Failed to delete provider")
    }
  }

  if (!providers || !services) return <div>Loading...</div>

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Providers</CardTitle>
          <CardDescription>Manage your providers.</CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Provider</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Provider</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="Provider Name"
                value={newProviderName}
                onChange={(e) => setNewProviderName(e.target.value)}
              />
              <Select value={newProviderService} onValueChange={setNewProviderService}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <TableHead>Service</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((provider) => {
              const service = services.find(s => s.id === provider.serviceId)
              return (
                <TableRow key={provider.id}>
                  <TableCell>
                    {editingProvider?.id === provider.id ? (
                      <Input
                        value={editingProvider.name}
                        onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                      />
                    ) : (
                      provider.name
                    )}
                  </TableCell>
                  <TableCell>
                    {editingProvider?.id === provider.id ? (
                      <Select
                        value={editingProvider.serviceId}
                        onValueChange={(val) => setEditingProvider({ ...editingProvider, serviceId: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      service?.name || '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingProvider?.id === provider.id ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={handleUpdate}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingProvider(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" onClick={() => setEditingProvider({ id: provider.id, name: provider.name, serviceId: provider.serviceId })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(provider.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
