"use client"

import * as React from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// TODO: Re-implement Facebook integration with TanStack DB collections
export function CampaignSpendCards() {
  const [data] = React.useState<any[]>([])
  const [loading] = React.useState(false)
  const [error] = React.useState<string | null>(null)

  // Temporarily disabled - needs Facebook integration to be migrated to collections
  // React.useEffect(() => {
  //   const fetchData = async () => {
  //     try {
  //       const result = await getAdSpend({
  //         level: 'campaign',
  //         timeIncrement: 'all_days',
  //       })
  //
  //       setData(result.data || [])
  //     } catch (err) {
  //       console.error("Failed to fetch campaign spend:", err)
  //       setError("Failed to load campaign data")
  //     } finally {
  //       setLoading(false)
  //     }
  //   }
  //   fetchData()
  // }, [])

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
