import { useForm } from '@tanstack/react-form'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

type PatientFormData = {
  firstName: string
  lastName: string
  phone: string
  email: string
  dateOfBirth: string
  payerName: string
  memberId: string
  groupId: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelation: string
}

type PatientFormProps = {
  companyId?: Id<'companies'>
  patientId?: Id<'patients'>
  patientData?: Partial<PatientFormData>
  onSuccess?: () => void
  onCancel?: () => void
}

export function PatientForm({
  companyId,
  patientId,
  patientData,
  onSuccess,
  onCancel,
}: PatientFormProps) {
  const createPatient = useMutation(api.patients.createPatient)
  const updatePatient = useMutation(api.patients.updatePatient)

  const isUpdateMode = !!patientId

  const form = useForm({
    defaultValues: {
      firstName: patientData?.firstName || '',
      lastName: patientData?.lastName || '',
      phone: patientData?.phone || '',
      email: patientData?.email || '',
      dateOfBirth: patientData?.dateOfBirth || '',
      payerName: patientData?.payerName || '',
      memberId: patientData?.memberId || '',
      groupId: patientData?.groupId || '',
      emergencyContactName: patientData?.emergencyContactName || '',
      emergencyContactPhone: patientData?.emergencyContactPhone || '',
      emergencyContactRelation: patientData?.emergencyContactRelation || '',
    },
    onSubmit: async ({ value }) => {
      try {
        if (isUpdateMode) {
          // Update existing patient
          await updatePatient({
            id: patientId,
            firstName: value.firstName,
            lastName: value.lastName || undefined,
            phone: value.phone,
            email: value.email || undefined,
            payerName: value.payerName || undefined,
            dateOfBirth: value.dateOfBirth || undefined,
            memberId: value.memberId || undefined,
            groupId: value.groupId || undefined,
            emergencyContactName: value.emergencyContactName || undefined,
            emergencyContactPhone: value.emergencyContactPhone || undefined,
            emergencyContactRelation: value.emergencyContactRelation || undefined,
          })
          toast.success('Patient updated successfully')
        } else {
          // Create new patient
          if (!companyId) {
            toast.error('Company ID is required to create a patient')
            return
          }
          await createPatient({
            companyId,
            firstName: value.firstName,
            lastName: value.lastName || undefined,
            phone: value.phone,
            email: value.email || undefined,
            payerName: value.payerName || undefined,
            dateOfBirth: value.dateOfBirth || undefined,
            memberId: value.memberId || undefined,
            groupId: value.groupId || undefined,
            emergencyContactName: value.emergencyContactName || undefined,
            emergencyContactPhone: value.emergencyContactPhone || undefined,
            emergencyContactRelation: value.emergencyContactRelation || undefined,
          })
          toast.success('Patient created successfully')
        }
        onSuccess?.()
      } catch (error) {
        toast.error(
          isUpdateMode ? 'Failed to update patient' : 'Failed to create patient'
        )
        console.error(error)
      }
    },
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isUpdateMode ? 'Edit Patient Information' : 'Add New Patient'}
        </DialogTitle>
        <DialogDescription>
          {isUpdateMode
            ? "Update the patient's personal, insurance, and emergency contact information."
            : 'Enter the details for the new patient. First Name and Phone are required.'}
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            {/* First Name */}
            <form.Field
              name="firstName"
              validators={{
                onBlur: ({ value }) =>
                  !value ? 'First Name is required' : undefined,
              }}
            >
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <span className="text-sm text-destructive">
                      {field.state.meta.errors[0]}
                    </span>
                  )}
                </div>
              )}
            </form.Field>

            {/* Last Name */}
            <form.Field name="lastName">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>

            {/* Phone */}
            <form.Field
              name="phone"
              validators={{
                onBlur: ({ value }) =>
                  !value ? 'Phone is required' : undefined,
              }}
            >
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <span className="text-sm text-destructive">
                      {field.state.meta.errors[0]}
                    </span>
                  )}
                </div>
              )}
            </form.Field>

            {/* Email */}
            <form.Field name="email">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>

            {/* Date of Birth */}
            <form.Field name="dateOfBirth">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>

            {/* Payer Name */}
            <form.Field name="payerName">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="payerName">Payer Name</Label>
                  <Input
                    id="payerName"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>

            {/* Member ID */}
            <form.Field name="memberId">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="memberId">Member ID</Label>
                  <Input
                    id="memberId"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>

            {/* Group ID */}
            <form.Field name="groupId">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="groupId">Group ID</Label>
                  <Input
                    id="groupId"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>

            {/* Emergency Contact Section */}
            <div className="col-span-2 border-t pt-4 mt-2">
              <h4 className="font-medium mb-2">Emergency Contact</h4>
            </div>

            {/* Emergency Contact Name */}
            <form.Field name="emergencyContactName">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="ecName">Name</Label>
                  <Input
                    id="ecName"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>

            {/* Emergency Contact Phone */}
            <form.Field name="emergencyContactPhone">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="ecPhone">Phone</Label>
                  <Input
                    id="ecPhone"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>

            {/* Emergency Contact Relation */}
            <form.Field name="emergencyContactRelation">
              {(field) => (
                <div className="grid gap-2">
                  <Label htmlFor="ecRelation">Relation</Label>
                  <Input
                    id="ecRelation"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {isUpdateMode ? 'Save Changes' : 'Save Patient'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
