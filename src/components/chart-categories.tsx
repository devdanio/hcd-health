"use client"

import * as React from "react"
import { Pie, PieChart, Cell, Label } from "recharts"
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

const chartConfig = {
  sessions: {
    label: "Sessions",
  },
  "Organic Google": {
    label: "Organic Google",
    color: "hsl(24.6 95% 53.1%)", // Orange
  },
  "Paid Google": {
    label: "Paid Google",
    color: "hsl(24.6 95% 40%)", // Darker Orange
  },
  "Organic Facebook": {
    label: "Organic Facebook",
    color: "hsl(221.2 83.2% 53.3%)", // Blue
  },
  "Paid Facebook": {
    label: "Paid Facebook",
    color: "hsl(221.2 83.2% 40%)", // Darker Blue
  },
  Email: {
    label: "Email",
    color: "hsl(262.1 83.3% 57.8%)", // Purple
  },
  Direct: {
    label: "Direct",
    color: "hsl(142.1 76.2% 36.3%)", // Green
  },
  Other: {
    label: "Other",
    color: "hsl(var(--muted-foreground))",
  },
} satisfies ChartConfig

interface ChartCategoriesProps {
  companyId: Id<"companies">
  timeRange: "24h" | "7d" | "30d" | "90d"
}

export function ChartCategories({ companyId, timeRange }: ChartCategoriesProps) {
  // Fetch real data from Convex
  const chartData = useQuery(api.tracking.getCategoryAnalytics, {
    companyId,
    timeRange,
  })

  // Use real data or empty array while loading
  const rawData = chartData || []

  // Transform data for donut chart - aggregate by category
  const { pieData, totalSessions } = React.useMemo(() => {
    const categoryTotals: Record<string, number> = {}

    // Sum up sessions across all time periods for each category
    rawData.forEach((day) => {
      Object.entries(day).forEach(([key, value]) => {
        if (key !== 'date' && typeof value === 'number') {
          categoryTotals[key] = (categoryTotals[key] || 0) + value
        }
      })
    })

    // Convert to array format for pie chart
    const data = Object.entries(categoryTotals)
      .map(([category, count]) => ({
        category,
        sessions: count,
        fill: `var(--color-${category})`,
      }))
      .filter((item) => item.sessions > 0)
      .sort((a, b) => b.sessions - a.sessions)

    const total = data.reduce((sum, item) => sum + item.sessions, 0)

    return { pieData: data, totalSessions: total }
  }, [rawData])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Traffic Sources</CardTitle>
        <CardDescription>
          {totalSessions.toLocaleString()} total sessions
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={pieData}
              dataKey="sessions"
              nameKey="category"
              innerRadius={60}
              outerRadius={100}
              strokeWidth={5}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {totalSessions.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Sessions
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        {pieData.length > 0 && (
          <div className="mt-4 grid gap-2 text-sm">
            {pieData.map((item) => {
              const config = chartConfig[item.category as keyof typeof chartConfig]
              const percentage = ((item.sessions / totalSessions) * 100).toFixed(1)
              return (
                <div
                  key={item.category}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-muted-foreground">
                      {config?.label || item.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {item.sessions.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      ({percentage}%)
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
