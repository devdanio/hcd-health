import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { Id } from '../../../../../convex/_generated/dataModel'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Edit, ArrowLeft } from 'lucide-react'

export const Route = createFileRoute(
  '/companies/$companyId/patients/$patientId',
)({
  component: PatientDetailPage,
})

function PatientDetailPage() {
  const { companyId, patientId } = Route.useParams()

  const patient = useQuery(api.patients.getPatient, {
    id: patientId as Id<'patients'>,
  })
  const updatePatient = useMutation(api.patients.updatePatient)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    payerName: '',
    dateOfBirth: '',
    memberId: '',
    groupId: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  })

  useEffect(() => {
    if (patient) {
      setFormData({
        firstName: patient.contact?.firstName || '',
        lastName: patient.contact?.lastName || '',
        phone: patient.contact?.phone || '',
        email: patient.contact?.email || '',
        payerName: patient.payerName || '',
        dateOfBirth: patient.dateOfBirth || '',
        memberId: patient.memberId || '',
        groupId: patient.groupId || '',
        emergencyContactName: patient.emergencyContactName || '',
        emergencyContactPhone: patient.emergencyContactPhone || '',
        emergencyContactRelation: patient.emergencyContactRelation || '',
      })
    }
  }, [patient])

  const handleUpdate = async () => {
    if (!formData.firstName || !formData.phone) {
      toast.error('First Name and Phone are required')
      return
    }

    try {
      await updatePatient({
        id: patientId as Id<'patients'>,
        firstName: formData.firstName,
        lastName: formData.lastName || undefined,
        phone: formData.phone,
        email: formData.email || undefined,
        payerName: formData.payerName || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        memberId: formData.memberId || undefined,
        groupId: formData.groupId || undefined,
        emergencyContactName: formData.emergencyContactName || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
        emergencyContactRelation: formData.emergencyContactRelation || undefined,
      })
      toast.success('Patient updated successfully')
      setIsEditOpen(false)
    } catch (error) {
      toast.error('Failed to update patient')
      console.error(error)
    }
  }

  if (patient === undefined) {
    return (
      <div className="container mx-auto p-8">
        <div>Loading...</div>
      </div>
    )
  }

  if (patient === null) {
    return (
      <div className="container mx-auto p-8">
        <div>Patient not found</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <Link
          to="/companies/$companyId/patients"
          params={{ companyId }}
          className="text-sm text-muted-foreground hover:underline mb-2 inline-flex items-center"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Patients
        </Link>
        
        {/* Header Section with Grid Layout */}
        <div className="grid grid-cols-3 gap-6 mt-4">
          {/* Left Column: Patient Info */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold">{patient.contact?.fullName || 'Unknown Patient'}</h1>
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Edit className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit Patient Information</DialogTitle>
                    <DialogDescription>
                      Update the patient's personal, insurance, and emergency contact information.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) =>
                            setFormData({ ...formData, firstName: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) =>
                            setFormData({ ...formData, lastName: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="phone">Phone *</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="dob">Date of Birth</Label>
                        <Input
                          id="dob"
                          type="date"
                          value={formData.dateOfBirth}
                          onChange={(e) =>
                            setFormData({ ...formData, dateOfBirth: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="payerName">Payer Name</Label>
                        <Input
                          id="payerName"
                          value={formData.payerName}
                          onChange={(e) =>
                            setFormData({ ...formData, payerName: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="memberId">Member ID</Label>
                        <Input
                          id="memberId"
                          value={formData.memberId}
                          onChange={(e) =>
                            setFormData({ ...formData, memberId: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="groupId">Group ID</Label>
                        <Input
                          id="groupId"
                          value={formData.groupId}
                          onChange={(e) =>
                            setFormData({ ...formData, groupId: e.target.value })
                          }
                        />
                      </div>
                      <div className="col-span-2 border-t pt-4 mt-2">
                          <h4 className="font-medium mb-2">Emergency Contact</h4>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="ecName">Name</Label>
                        <Input
                          id="ecName"
                          value={formData.emergencyContactName}
                          onChange={(e) =>
                            setFormData({ ...formData, emergencyContactName: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="ecPhone">Phone</Label>
                        <Input
                          id="ecPhone"
                          value={formData.emergencyContactPhone}
                          onChange={(e) =>
                            setFormData({ ...formData, emergencyContactPhone: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="ecRelation">Relation</Label>
                        <Input
                          id="ecRelation"
                          value={formData.emergencyContactRelation}
                          onChange={(e) =>
                            setFormData({ ...formData, emergencyContactRelation: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdate}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="text-muted-foreground space-y-1">
              <div className="flex gap-4">
                <span>DOB: {patient.dateOfBirth || 'N/A'}</span>
                <span>Phone: {patient.contact?.phone || 'N/A'}</span>
                <span>Email: {patient.contact?.email || 'N/A'}</span>
              </div>
              <div className="flex gap-4">
                 <span>Emergency: {patient.emergencyContactName || 'N/A'} ({patient.emergencyContactPhone || 'N/A'})</span>
                 <span>Insurance: {patient.payerName || 'N/A'} (Member ID: {patient.memberId || 'N/A'})</span>
              </div>
            </div>
          </div>

          {/* Right Column: AI Summary */}
          <div className="col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Patient presents with a history of regular acupuncture treatments for chronic pain management. 
                  Recent visits show positive response to treatment with improved mobility and reduced discomfort.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Tabs defaultValue="appointments" className="w-full">
        <TabsList>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="soap-notes">Soap Notes</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>
        <TabsContent value="appointments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Appointments</CardTitle>
              <CardDescription>
                Manage patient appointments here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                No appointments found.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="soap-notes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Soap Notes</CardTitle>
              <CardDescription>
                View and manage SOAP notes.
              </CardDescription>
            </CardHeader>
            <CardContent>
               <div className="text-sm text-muted-foreground">
                No SOAP notes found.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="billing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>
                View billing history and invoices.
              </CardDescription>
            </CardHeader>
            <CardContent>
               <div className="text-sm text-muted-foreground">
                No billing information found.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
