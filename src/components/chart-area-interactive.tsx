"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { useQuery } from "@tanstack/react-query"
import { getVisitorAnalytics } from "@/server/functions/tracking"

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

export const description = "An interactive bar chart"

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
  organic_search: {
    label: "Organic Search",
    color: "#10b981", // Emerald green
  },
  paid_search: {
    label: "Paid Search",
    color: "#3b82f6", // Blue
  },
  organic_social: {
    label: "Organic Social",
    color: "#8b5cf6", // Purple
  },
  email: {
    label: "Email",
    color: "#f59e0b", // Amber
  },
  direct: {
    label: "Direct",
    color: "#ef4444", // Red
  },
} satisfies ChartConfig

interface ChartAreaInteractiveProps {
  companyId: string
  timeRange: "24h" | "7d" | "30d" | "90d"
}

export function ChartAreaInteractive({ companyId, timeRange }: ChartAreaInteractiveProps) {
  const { data: chartData } = useQuery({
    queryKey: ['visitorAnalytics', companyId, timeRange],
    queryFn: () => getVisitorAnalytics({ data: { companyId, timeRange } }),
  })

  // Use real data or empty array while loading
  const filteredData = chartData || []

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Total Visitors</CardTitle>
        <CardDescription>
          Unique visitors over time by traffic source
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart data={filteredData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                if (timeRange === "24h") {
                  return date.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    hour12: true,
                  })
                }
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    const date = new Date(value)
                    if (timeRange === "24h") {
                      return date.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })
                    }
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                />
              }
            />
            <Bar
              dataKey="direct"
              fill={chartConfig.direct.color}
              stackId="a"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="email"
              fill={chartConfig.email.color}
              stackId="a"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="organic_social"
              fill={chartConfig.organic_social.color}
              stackId="a"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="paid_search"
              fill={chartConfig.paid_search.color}
              stackId="a"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="organic_search"
              fill={chartConfig.organic_search.color}
              stackId="a"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
