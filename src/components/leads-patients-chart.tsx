"use client"

import * as React from "react"
import { Bar, ComposedChart, CartesianGrid, XAxis, YAxis, Line } from "recharts"

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
  leads: {
    label: "Leads",
    color: "#3b82f6", // Blue
  },
  patients: {
    label: "Patients",
    color: "#10b981", // Emerald green
  },
  revenue: {
    label: "Revenue",
    color: "#f59e0b", // Amber
  },
} satisfies ChartConfig

// Generate fake data for the past 30 days with upward trend
function generateFakeData() {
  const data = []
  const today = new Date()
  
  // Starting values (day 0)
  const baseLeads = 8
  const basePatients = 3
  const baseRevenue = 200
  
  // Trend multipliers (how much to increase by day 29)
  const leadsTrend = 1.6 // 60% increase over 30 days
  const patientsTrend = 1.5 // 50% increase over 30 days
  const revenueTrend = 1.8 // 80% increase over 30 days
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    
    // Calculate progress (0 to 1) from first day to last day
    const progress = (29 - i) / 29
    
    // Calculate trend value (linear interpolation with some smoothing)
    const trendFactor = progress
    
    // Generate base values with trend
    const trendLeads = baseLeads + (baseLeads * leadsTrend - baseLeads) * trendFactor
    const trendPatients = basePatients + (basePatients * patientsTrend - basePatients) * trendFactor
    const trendRevenue = baseRevenue + (baseRevenue * revenueTrend - baseRevenue) * trendFactor
    
    // Add random variation (20-30% of base value) to make it not a straight line
    const leadsVariation = (Math.random() - 0.5) * (trendLeads * 0.25)
    const patientsVariation = (Math.random() - 0.5) * (trendPatients * 0.3)
    const revenueVariation = (Math.random() - 0.5) * (trendRevenue * 0.2)
    
    // Calculate final values
    const leads = Math.max(3, Math.floor(trendLeads + leadsVariation))
    const patients = Math.max(1, Math.floor(trendPatients + patientsVariation))
    const revenue = Math.max(100, Math.floor(trendRevenue + revenueVariation + (patients * 30)))
    
    data.push({
      date: date.toISOString().split('T')[0],
      leads,
      patients,
      revenue,
    })
  }
  
  return data
}

export function LeadsPatientsChart() {
  const [data] = React.useState(() => generateFakeData())

  const totalLeads = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.leads, 0)
  }, [data])

  const totalPatients = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.patients, 0)
  }, [data])

  const totalRevenue = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.revenue, 0)
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads & Patients (Last 30 Days)</CardTitle>
        <CardDescription>
          Total Leads: {totalLeads} • Total Patients: {totalPatients} • Total Revenue: ${totalRevenue.toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ComposedChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12,
              top: 12,
              bottom: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${value}`}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  }}
                />
              }
            />
            <Bar
              yAxisId="left"
              dataKey="leads"
              fill="var(--color-leads)"
              stackId="a"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              yAxisId="left"
              dataKey="patients"
              fill="var(--color-patients)"
              stackId="a"
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

