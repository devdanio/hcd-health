"use client"

import { useMutation, useQuery } from "convex/react"
import { api } from "convex/_generated/api"
import { Id } from "convex/_generated/dataModel"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

interface CompanySettingsProps {
  companyId: Id<"companies">
}

export function CompanySettings({ companyId }: CompanySettingsProps) {
  const company = useQuery(api.companies.getCompany, { companyId })
  const updateCompany = useMutation(api.companies.updateCompany)
  const [name, setName] = useState("")

  useEffect(() => {
    if (company) {
      setName(company.name)
    }
  }, [company])

  const handleSave = async () => {
    try {
      await updateCompany({ companyId, name })
      toast.success("Company name updated")
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
        <Button onClick={handleSave}>Save Changes</Button>
      </CardContent>
    </Card>
  )
}
