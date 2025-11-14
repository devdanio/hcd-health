"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useQuery } from "convex/react"
import { api } from "convex/_generated/api"
import type { Id } from "convex/_generated/dataModel"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

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
}

export function ChartAreaInteractive({ companyId }: ChartAreaInteractiveProps) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState<"24h" | "7d" | "30d" | "90d">("90d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

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
          <span className="hidden @[540px]/card:block">
            {timeRange === "24h" ? "Total for the last 24 hours" :
             timeRange === "7d" ? "Total for the last 7 days" :
             timeRange === "30d" ? "Total for the last 30 days" :
             "Total for the last 3 months"}
          </span>
          <span className="@[540px]/card:hidden">
            {timeRange === "24h" ? "Last 24 hours" :
             timeRange === "7d" ? "Last 7 days" :
             timeRange === "30d" ? "Last 30 days" :
             "Last 3 months"}
          </span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
            <ToggleGroupItem value="24h">Last 24 hours</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
              <SelectItem value="24h" className="rounded-lg">
                Last 24 hours
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
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
