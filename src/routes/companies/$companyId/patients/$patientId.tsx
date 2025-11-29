import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { useCollections } from '@/routes/__root'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Edit, ArrowLeft, CalendarArrowDown } from 'lucide-react'
import { Calendar } from '@/components/Calendar'
import { PatientForm } from '@/components/PatientForm'

export const Route = createFileRoute(
  '/companies/$companyId/patients/$patientId',
)({
  component: PatientDetailPage,
})

function PatientDetailPage() {
  const { companyId, patientId } = Route.useParams()
  const { patientsCollection } = useCollections()

  const { data: patients } = useLiveQuery((q) =>
    q.from({ patient: patientsCollection })
      .setMeta({ companyId })
  )

  const patient = patients?.find(p => p.id === patientId)

  const [isEditOpen, setIsEditOpen] = useState(false)

  if (patients === undefined) {
    return (
      <div className="container mx-auto p-8">
        <div>Loading...</div>
      </div>
    )
  }

  if (!patient) {
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
                  <PatientForm
                    patientId={patientId}
                    patientData={{
                      firstName: patient.contact?.firstName || '',
                      lastName: patient.contact?.lastName || '',
                      phone: patient.contact?.phone || '',
                      email: patient.contact?.email || '',
                      dateOfBirth: patient.dateOfBirth || '',
                      payerName: patient.payerName || '',
                      memberId: patient.memberId || '',
                      groupId: patient.groupId || '',
                      emergencyContactName: patient.emergencyContactName || '',
                      emergencyContactPhone: patient.emergencyContactPhone || '',
                      emergencyContactRelation: patient.emergencyContactRelation || '',
                    }}
                    onSuccess={() => setIsEditOpen(false)}
                    onCancel={() => setIsEditOpen(false)}
                  />
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
                          <Calendar />
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
