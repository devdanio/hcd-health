"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

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
} satisfies ChartConfig

// Generate fake data for the past 30 days
function generateFakeData() {
  const data = []
  const today = new Date()
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    
    // Generate random but realistic data
    // Leads: typically higher numbers, varies more
    const leads = Math.floor(Math.random() * 15) + 5 // 5-20 leads per day
    
    // Patients: typically lower numbers, more stable
    // Usually 20-30% of leads convert to patients
    const patients = Math.floor(Math.random() * 6) + 2 // 2-8 patients per day
    
    data.push({
      date: date.toISOString().split('T')[0],
      leads,
      patients,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads & Patients (Last 30 Days)</CardTitle>
        <CardDescription>
          Total Leads: {totalLeads} • Total Patients: {totalPatients}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart
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
              dataKey="leads"
              fill="var(--color-leads)"
              stackId="a"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="patients"
              fill="var(--color-patients)"
              stackId="a"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

