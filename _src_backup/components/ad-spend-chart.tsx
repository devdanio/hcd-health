"use client"

import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const chartConfig = {
  spend: {
    label: "Ad Spend",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

// TODO: Re-implement Facebook integration with TanStack DB collections
export function AdSpendChart() {
  const [data] = React.useState<any[]>([])
  const [loading] = React.useState(false)
  const [error] = React.useState<string | null>(null)

  // Temporarily disabled - needs Facebook integration to be migrated to collections
  // React.useEffect(() => {
  //   const fetchData = async () => {
  //     try {
  //       const result = await getAdSpend({
  //         level: 'account',
  //         timeIncrement: 1,
  //       })
  //
  //       // Format data for chart
  //       // The API returns data in reverse chronological order usually, but we want chronological
  //       const formattedData = (result.data || [])
  //         .map((item: any) => ({
  //           date: item.date_start,
  //           spend: parseFloat(item.spend || '0'),
  //         }))
  //         .reverse()
  //
  //       setData(formattedData)
  //     } catch (err) {
  //       console.error("Failed to fetch ad spend:", err)
  //       setError("Failed to load ad spend data")
  //     } finally {
  //       setLoading(false)
  //     }
  //   }
  //   fetchData()
  // }, [])

  const totalSpend = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.spend, 0)
  }, [data])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Facebook Ad Spend</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Facebook Ad Spend</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facebook Ad Spend (Last 30 Days)</CardTitle>
        <CardDescription>
          Total Spend: ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Line
              dataKey="spend"
              type="natural"
              stroke="var(--color-spend)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
