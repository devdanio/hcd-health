"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useQuery } from "convex/react"
import { api } from "convex/_generated/api"
import type { Id } from "convex/_generated/dataModel"

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

export const description = "An interactive area chart"

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
  organic_search: {
    label: "Organic Search",
    color: "hsl(var(--chart-1))",
  },
  paid_search: {
    label: "Paid Search",
    color: "hsl(var(--chart-2))",
  },
  organic_social: {
    label: "Organic Social",
    color: "hsl(var(--chart-3))",
  },
  email: {
    label: "Email",
    color: "hsl(var(--chart-4))",
  },
  direct: {
    label: "Direct",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig

interface ChartAreaInteractiveProps {
  companyId: Id<"companies">
  timeRange: "24h" | "7d" | "30d" | "90d"
}

export function ChartAreaInteractive({ companyId, timeRange }: ChartAreaInteractiveProps) {
  // Fetch real data from Convex
  const chartData = useQuery(api.tracking.getVisitorAnalytics, {
    companyId,
    timeRange,
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
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillOrganicSearch" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-organic_search)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-organic_search)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillPaidSearch" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-paid_search)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-paid_search)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillOrganicSocial" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-organic_social)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-organic_social)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillEmail" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-email)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-email)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillDirect" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-direct)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-direct)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
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
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="direct"
              type="natural"
              fill="url(#fillDirect)"
              stroke="var(--color-direct)"
              stackId="a"
            />
            <Area
              dataKey="email"
              type="natural"
              fill="url(#fillEmail)"
              stroke="var(--color-email)"
              stackId="a"
            />
            <Area
              dataKey="organic_social"
              type="natural"
              fill="url(#fillOrganicSocial)"
              stroke="var(--color-organic_social)"
              stackId="a"
            />
            <Area
              dataKey="paid_search"
              type="natural"
              fill="url(#fillPaidSearch)"
              stroke="var(--color-paid_search)"
              stackId="a"
            />
            <Area
              dataKey="organic_search"
              type="natural"
              fill="url(#fillOrganicSearch)"
              stroke="var(--color-organic_search)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
