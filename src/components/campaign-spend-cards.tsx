"use client"

import * as React from "react"
import { useAction } from "convex/react"
import { api } from "convex/_generated/api"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function CampaignSpendCards() {
  const getAdSpend = useAction(api.facebook.getAdSpend)
  const [data, setData] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await getAdSpend({
          level: 'campaign',
          timeIncrement: 'all_days',
        })
        
        setData(result.data || [])
      } catch (err) {
        console.error("Failed to fetch campaign spend:", err)
        setError("Failed to load campaign data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [getAdSpend])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 w-1/2 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-3/4 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return <div className="text-destructive">{error}</div>
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {data.map((campaign) => (
        <Card key={campaign.campaign_id || campaign.campaign_name}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {campaign.campaign_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${parseFloat(campaign.spend || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
