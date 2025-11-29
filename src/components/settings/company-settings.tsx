"use client"

import { useLiveQuery } from "@tanstack/react-db"
import { useCollections } from "@/routes/__root"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface CompanySettingsProps {
  companyId: string
}

export function CompanySettings({ companyId }: CompanySettingsProps) {
  const { companiesCollection } = useCollections()
  const { data: companies } = useLiveQuery((q) =>
    q.from({ company: companiesCollection })
  )
  const company = companies?.find(c => c.id === companyId)

  const [name, setName] = useState("")
  const [companyBrief, setCompanyBrief] = useState("")

  useEffect(() => {
    if (company) {
      setName(company.name)
      setCompanyBrief(company.companyBrief || "")
    }
  }, [company])

  const handleSave = async () => {
    try {
      await companiesCollection.update(companyId, { name, companyBrief })
      toast.success("Company settings updated")
    } catch (error) {
      toast.error("Failed to update company name")
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
        <Button onClick={handleSave}>Save Changes</Button>
      </CardContent>
    </Card>
  )
}
