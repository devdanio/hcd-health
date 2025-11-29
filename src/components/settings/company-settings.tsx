'use client'

import { useLiveQuery } from '@tanstack/react-db'
import { useCollections } from '@/routes/__root'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { EhrType } from '@/generated/prisma/enums'

interface CompanySettingsProps {
  companyId: string
}

export function CompanySettings({ companyId }: CompanySettingsProps) {
  const { companiesCollection } = useCollections()
  const { data: companies } = useLiveQuery((q) =>
    q.from({ company: companiesCollection }),
  )
  const company = companies?.find((c) => c.id === companyId)

  const [name, setName] = useState('')
  const [companyBrief, setCompanyBrief] = useState('')
  const [ehr, setEhr] = useState<string>('')

  useEffect(() => {
    if (company) {
      setName(company.name)
      setCompanyBrief(company.companyBrief || '')
      setEhr(company.ehr || '')
    }
  }, [company])

  const handleSave = async () => {
    try {
      companiesCollection.update({ id: companyId, ehr: ehr }, (draft) => {
        draft.ehr = ehr as EhrType
      })
      toast.success('Company settings updated')
    } catch (error) {
      console.error('Failed to update company settings:', error)
      toast.error('Failed to update company settings')
    }
  }

  if (!company) return <div>Loading...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Details</CardTitle>
        <CardDescription>Manage your company information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Company Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyBrief">Company Brief</Label>
          <Textarea
            id="companyBrief"
            value={companyBrief}
            onChange={(e) => setCompanyBrief(e.target.value)}
            placeholder="A brief description of your company..."
            className="min-h-[100px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ehr">EHR System</Label>
          <Select value={ehr} onValueChange={setEhr}>
            <SelectTrigger id="ehr">
              <SelectValue placeholder="None - Select EHR system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unified_practice">Unified Practice</SelectItem>
              <SelectItem value="ghl">GoHighLevel</SelectItem>
            </SelectContent>
          </Select>
          {ehr && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEhr('')}
              className="h-8 px-2 text-xs"
            >
              Clear selection
            </Button>
          )}
        </div>
        <Button onClick={handleSave}>Save Changes</Button>
      </CardContent>
    </Card>
  )
}
