'use client'

import { useState, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { PieChart, Pie, Label as RechartsLabel, Cell } from 'recharts'
import {
  DollarSign,
  Users,
  Building2,
  User,
  Calendar,
  Save,
  UserPlus,
  Megaphone,
  Stethoscope,
  Home,
  CalendarCheck,
} from 'lucide-react'
import { createLeadCalculator } from '@/server/functions/lead-calculator'
import { useRouter } from '@tanstack/react-router'

interface PracticeCalculatorProps {
  initialRevenue?: number
  initialPatients?: number
  initialNewPatients?: number
  initialAvgVisits?: number
  initialMarketingCosts?: number
  initialDirectCareCosts?: number
  initialOverheadCosts?: number
}

export function PracticeCalculator({
  initialRevenue = 1500000,
  initialPatients = 200,
  initialNewPatients = 100,
  initialAvgVisits = 8,
  initialMarketingCosts = 130000,
  initialDirectCareCosts = 200000,
  initialOverheadCosts = 20000,
}: PracticeCalculatorProps = {}) {
  const router = useRouter()
  const [revenue, setRevenue] = useState(initialRevenue)
  const [patients, setPatients] = useState(initialPatients)
  const [newPatients, setNewPatients] = useState(initialNewPatients)
  const [avgVisits, setAvgVisits] = useState(initialAvgVisits)
  const [marketingCosts, setMarketingCosts] = useState(initialMarketingCosts)
  const [directCareCosts, setDirectCareCosts] = useState(initialDirectCareCosts)
  const [overheadCosts, setOverheadCosts] = useState(initialOverheadCosts)

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const metrics = useMemo(() => {
    if (patients === 0 || newPatients === 0 || avgVisits === 0) {
      return {
        revenuePerPatient: 0,
        cac: 0,
        costToServe: 0,
        profitPerPatient: 0,
        ltv: 0,
        ltvCacRatio: 0,
        grossProfit: 0,
        grossProfitMargin: 0,
        netProfit: 0,
        netProfitMargin: 0,
        profitPerVisit: 0,
        costToServePerVisit: 0,
      }
    }

    // Revenue per Patient = Total Annual Revenue / Total Patients Served
    const revenuePerPatient = revenue / patients

    // CAC = Total Marketing Costs / Total NEW Patients Acquired
    const cac = marketingCosts / newPatients

    // Cost to Serve per Patient = (Direct Care Costs + Overhead Costs) / Total Patients Served
    const totalOperatingCosts = directCareCosts + overheadCosts
    const costToServe = totalOperatingCosts / patients

    // Gross Profit = Total Revenue - Direct Care Costs
    const grossProfit = revenue - directCareCosts

    // Net Profit = Gross Profit - Marketing Costs - Overhead Costs
    const netProfit = grossProfit - marketingCosts - overheadCosts

    // Profit per Patient = Net Profit / Total Patients Served
    const profitPerPatient = netProfit / patients

    // LTV (per new patient) = Profit per Patient - CAC
    // Assumes new patients behave like average patients and stay 12 months
    const ltv = profitPerPatient - cac

    // LTV:CAC Ratio
    const ltvCacRatio = cac > 0 ? ltv / cac : 0

    // Profit per Visit = Profit per Patient / Average Visits per Patient
    const profitPerVisit = profitPerPatient / avgVisits

    // Cost to Serve per Visit = Cost to Serve per Patient / Average Visits per Patient
    const costToServePerVisit = costToServe / avgVisits

    return {
      revenuePerPatient,
      cac,
      costToServe,
      profitPerPatient,
      ltv,
      ltvCacRatio,
      grossProfit,
      grossProfitMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      netProfit,
      netProfitMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
      profitPerVisit,
      costToServePerVisit,
    }
  }, [
    revenue,
    patients,
    newPatients,
    avgVisits,
    marketingCosts,
    directCareCosts,
    overheadCosts,
  ])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatCurrencyShort = (value: number) => {
    if (value >= 1000000) {
      const millions = value / 1000000
      return `$${millions % 1 === 0 ? millions : millions.toFixed(1)}m`
    } else if (value >= 1000) {
      const thousands = value / 1000
      return `$${thousands % 1 === 0 ? thousands : thousands.toFixed(1)}k`
    }
    return formatCurrency(value)
  }

  // Chart data and config
  const chartData = useMemo(() => {
    const total =
      marketingCosts + directCareCosts + overheadCosts + metrics.netProfit
    return [
      {
        category: 'marketing',
        value: marketingCosts,
        fill: 'var(--color-marketing)',
        percentage:
          total > 0 ? ((marketingCosts / total) * 100).toFixed(1) : '0',
      },
      {
        category: 'directCare',
        value: directCareCosts,
        fill: 'var(--color-directCare)',
        percentage:
          total > 0 ? ((directCareCosts / total) * 100).toFixed(1) : '0',
      },
      {
        category: 'overhead',
        value: overheadCosts,
        fill: 'var(--color-overhead)',
        percentage:
          total > 0 ? ((overheadCosts / total) * 100).toFixed(1) : '0',
      },
      {
        category: 'netProfit',
        value: metrics.netProfit,
        fill: 'var(--color-netProfit)',
        percentage:
          total > 0 ? ((metrics.netProfit / total) * 100).toFixed(1) : '0',
      },
    ]
  }, [marketingCosts, directCareCosts, overheadCosts, metrics.netProfit])

  const chartConfig = {
    value: {
      label: 'Amount',
    },
    marketing: {
      label: 'Marketing',
      color: '#3b82f6',
    },
    directCare: {
      label: 'Direct Care',
      color: '#f97316',
    },
    overhead: {
      label: 'Overhead',
      color: '#ef4444',
    },
    netProfit: {
      label: 'Net Profit',
      color: '#22c55e',
    },
  }

  const formatNumberWithCommas = (value: string) => {
    // Remove all non-digit characters
    const numericValue = value.replace(/\D/g, '')
    // Add commas
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  const handleNumberInput = (value: string, setter: (val: number) => void) => {
    const numericValue = value.replace(/,/g, '')
    setter(Number(numericValue))
  }

  // Check if all required fields are filled (for showing save button)
  const allFieldsFilled =
    revenue > 0 &&
    patients > 0 &&
    newPatients > 0 &&
    avgVisits > 0 &&
    marketingCosts >= 0 &&
    directCareCosts >= 0 &&
    overheadCosts >= 0

  const handleSaveReport = async () => {
    if (!name || !email) {
      setSaveError('Please enter both name and email')
      return
    }

    try {
      // @ts-ignore
      fbq('track', 'CompleteRegistration')
    } catch (error) {
      console.error('Error tracking event:', error)
    }

    setIsSaving(true)
    setSaveError('')

    try {
      const result = await createLeadCalculator({
        data: {
          name,
          email,
          revenue,
          patients,
          newPatients,
          avgVisits,
          marketingCosts,
          directCareCosts,
          overheadCosts,
        },
      })

      // Navigate to the saved report
      router.navigate({
        to: '/healthcare-practice-metrics-calculator/$id',
        params: { id: result.id },
      })
    } catch (error) {
      setSaveError('Failed to save report. Please try again.')
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full h-screen max-w-7xl mx-auto flex flex-col gap-2 p-2">
      {/* Carousel Section - Top 50% */}
      <div className="h-1/2 overflow-hidden">
        <Carousel className="w-full h-full">
          <CarouselContent className="h-full">
            {/* Slide 1: Financial Breakdown */}
            <CarouselItem className="h-full">
              <Card className="h-full rounded-xl overflow-y-auto">
                <CardHeader className="p-3">
                  <CardTitle className="text-base">
                    Financial Breakdown
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Distribution of costs and net profit
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="flex items-center gap-4">
                    <ChartContainer
                      config={chartConfig}
                      className="shrink-0 aspect-square h-[120px] w-[120px]"
                    >
                      <PieChart>
                        <ChartTooltip
                          cursor={false}
                          content={
                            <ChartTooltipContent
                              hideLabel
                              formatter={(value) =>
                                formatCurrency(Number(value))
                              }
                            />
                          }
                        />
                        <Pie
                          data={chartData}
                          dataKey="value"
                          nameKey="category"
                          innerRadius={34}
                          outerRadius={56}
                          strokeWidth={4}
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                          <RechartsLabel
                            content={({ viewBox }) => {
                              if (
                                viewBox &&
                                'cx' in viewBox &&
                                'cy' in viewBox
                              ) {
                                const total = chartData.reduce(
                                  (acc, curr) => acc + curr.value,
                                  0,
                                )
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
                                      className="fill-foreground text-xl font-bold"
                                    >
                                      {formatCurrencyShort(total)}
                                    </tspan>
                                    <tspan
                                      x={viewBox.cx}
                                      y={(viewBox.cy || 0) + 20}
                                      className="fill-muted-foreground text-xs"
                                    >
                                      Total
                                    </tspan>
                                  </text>
                                )
                              }
                            }}
                          />
                        </Pie>
                        <ChartLegend content={() => null} />
                      </PieChart>
                    </ChartContainer>
                    <div className="flex-1">
                      <div className="grid grid-cols-1 gap-1.5">
                        {chartData.map((entry, index) => (
                          <div
                            key={`legend-${index}`}
                            className="flex items-center gap-1"
                          >
                            <div
                              className="h-1.5 w-1.5 shrink-0 rounded-[2px]"
                              style={{ backgroundColor: entry.fill }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {
                                chartConfig[
                                  entry.category as keyof typeof chartConfig
                                ]?.label
                              }{' '}
                              ({entry.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>

            {/* Slide 2: Practice Overview */}
            <CarouselItem className="h-full">
              <Card className="h-full rounded-xl overflow-y-auto">
                <CardHeader className="p-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-teal-600" />
                    <CardTitle className="text-base">
                      Practice Overview
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Revenue per Patient */}
                    <Card className="border border-teal-100 shadow">
                      <CardHeader className="p-2">
                        <CardTitle className="text-xs font-medium text-gray-600">
                          Revenue/Patient
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-2">
                        <div className="text-xl font-bold text-teal-600">
                          {formatCurrencyShort(metrics.revenuePerPatient)}
                        </div>
                      </CardContent>
                    </Card>

                    {/* CAC */}
                    <Card className="border border-blue-100 shadow">
                      <CardHeader className="p-2">
                        <CardTitle className="text-xs font-medium text-gray-600">
                          CAC
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-2">
                        <div className="text-xl font-bold text-blue-600">
                          {formatCurrencyShort(metrics.cac)}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Gross Profit */}
                    <Card className="border border-emerald-100 shadow">
                      <CardHeader className="p-2">
                        <CardTitle className="text-xs font-medium text-gray-600">
                          Gross Profit
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-2">
                        <div className="text-xl font-bold text-emerald-600">
                          {metrics.grossProfitMargin.toFixed(1)}%
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatCurrencyShort(metrics.grossProfit)}
                        </p>
                      </CardContent>
                    </Card>

                    {/* Net Profit */}
                    <Card className="border border-pink-100 shadow">
                      <CardHeader className="p-2">
                        <CardTitle className="text-xs font-medium text-gray-600">
                          Net Profit
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-2">
                        <div className="text-xl font-bold text-pink-600">
                          {metrics.netProfitMargin.toFixed(1)}%
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatCurrencyShort(metrics.netProfit)}
                        </p>
                      </CardContent>
                    </Card>

                    {/* LTV:CAC Ratio */}
                    <Card className="border border-orange-100 shadow col-span-2">
                      <CardHeader className="p-2">
                        <CardTitle className="text-xs font-medium text-gray-600">
                          LTV:CAC Ratio
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-2">
                        <div className="text-xl font-bold text-orange-600">
                          {metrics.ltvCacRatio.toFixed(2)}x
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>

            {/* Slide 3: Patient Overview */}
            <CarouselItem className="h-full">
              <Card className="h-full rounded-xl overflow-y-auto">
                <CardHeader className="p-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-green-600" />
                    <CardTitle className="text-base">
                      Patient Overview
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Profit per Patient */}
                    <Card className="border border-green-100 shadow">
                      <CardHeader className="p-2">
                        <CardTitle className="text-xs font-medium text-gray-600">
                          Profit per Patient
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-2">
                        <div className="text-xl font-bold text-green-600">
                          {formatCurrencyShort(metrics.profitPerPatient)}
                        </div>
                        <p className="text-xs text-gray-500">
                          Net profit after costs
                        </p>
                      </CardContent>
                    </Card>

                    {/* Cost to Serve per Patient */}
                    <Card className="border border-purple-100 shadow">
                      <CardHeader className="p-2">
                        <CardTitle className="text-xs font-medium text-gray-600">
                          Cost to Serve
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-2">
                        <div className="text-xl font-bold text-purple-600">
                          {formatCurrencyShort(metrics.costToServe)}
                        </div>
                        <p className="text-xs text-gray-500">Operating cost</p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>

            {/* Slide 4: Visit Overview */}
            <CarouselItem className="h-full">
              <Card className="h-full rounded-xl overflow-y-auto">
                <CardHeader className="p-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <CardTitle className="text-base">Visit Overview</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Profit per Visit */}
                    <Card className="border border-emerald-100 shadow">
                      <CardHeader className="p-2">
                        <CardTitle className="text-xs font-medium text-gray-600">
                          Profit per Visit
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-2">
                        <div className="text-xl font-bold text-emerald-600">
                          {formatCurrencyShort(metrics.profitPerVisit)}
                        </div>
                        <p className="text-xs text-gray-500">
                          Profit per visit
                        </p>
                      </CardContent>
                    </Card>

                    {/* Cost to Serve per Visit */}
                    <Card className="border border-indigo-100 shadow">
                      <CardHeader className="p-2">
                        <CardTitle className="text-xs font-medium text-gray-600">
                          Cost per Visit
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-2">
                        <div className="text-xl font-bold text-indigo-600">
                          {formatCurrencyShort(metrics.costToServePerVisit)}
                        </div>
                        <p className="text-xs text-gray-500">Operating cost</p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          </CarouselContent>
          <CarouselPrevious className="left-2" />
          <CarouselNext className="right-2" />
        </Carousel>
      </div>

      {/* Form Section - Bottom 50% */}
      <Card className="h-1/2 rounded-xl overflow-y-auto shadow-xl">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-2xl md:text-4xl font-normal">
            Calculate your practice's metrics in minutes
          </CardTitle>
          <CardDescription>
            <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2">
              <span className="px-2 py-1 md:px-3 md:py-1.5 bg-teal-50 text-teal-700 rounded-full text-xs md:text-sm font-medium">
                Revenue/Patient
              </span>
              <span className="px-2 py-1 md:px-3 md:py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs md:text-sm font-medium">
                CAC
              </span>
              <span className="px-2 py-1 md:px-3 md:py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs md:text-sm font-medium">
                Gross Profit
              </span>
              <span className="px-2 py-1 md:px-3 md:py-1.5 bg-pink-50 text-pink-700 rounded-full text-xs md:text-sm font-medium">
                Net Profit
              </span>
              <span className="px-2 py-1 md:px-3 md:py-1.5 bg-orange-50 text-orange-700 rounded-full text-xs md:text-sm font-medium">
                LTV:CAC
              </span>
              <span className="px-2 py-1 md:px-3 md:py-1.5 bg-gray-50 text-gray-700 rounded-full text-xs md:text-sm font-medium">
                +More
              </span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:pt-6">
          <div className="grid grid-cols-1 gap-3 md:gap-6">
            <div className="space-y-1 md:space-y-2">
              <Label
                htmlFor="revenue"
                className="text-sm md:text-base text-card-foreground"
              >
                Total Annual Revenue
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <Input
                  id="revenue"
                  type="text"
                  value={
                    revenue ? formatNumberWithCommas(revenue.toString()) : ''
                  }
                  onChange={(e) =>
                    handleNumberInput(e.target.value, setRevenue)
                  }
                  placeholder="500,000"
                  className="pl-8 md:pl-10 h-10 md:h-12 text-base md:text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-1 md:space-y-2">
              <Label
                htmlFor="patients"
                className="text-sm md:text-base text-card-foreground"
              >
                Total Patients Served
              </Label>
              <div className="relative">
                <Users className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <Input
                  id="patients"
                  type="text"
                  value={
                    patients ? formatNumberWithCommas(patients.toString()) : ''
                  }
                  onChange={(e) =>
                    handleNumberInput(e.target.value, setPatients)
                  }
                  placeholder="1,000"
                  className="pl-8 md:pl-10 h-10 md:h-12 text-base md:text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-1 md:space-y-2">
              <Label
                htmlFor="newPatients"
                className="text-sm md:text-base text-card-foreground"
              >
                Total New Patients Acquired
              </Label>
              <div className="relative">
                <UserPlus className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <Input
                  id="newPatients"
                  type="text"
                  value={
                    newPatients
                      ? formatNumberWithCommas(newPatients.toString())
                      : ''
                  }
                  onChange={(e) =>
                    handleNumberInput(e.target.value, setNewPatients)
                  }
                  placeholder="200"
                  className="pl-8 md:pl-10 h-10 md:h-12 text-base md:text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-1 md:space-y-2">
              <Label
                htmlFor="marketing"
                className="text-sm md:text-base text-card-foreground"
              >
                Total Marketing Spend
              </Label>
              <div className="relative">
                <Megaphone className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <Input
                  id="marketing"
                  type="text"
                  value={
                    marketingCosts
                      ? formatNumberWithCommas(marketingCosts.toString())
                      : ''
                  }
                  onChange={(e) =>
                    handleNumberInput(e.target.value, setMarketingCosts)
                  }
                  placeholder="50,000"
                  className="pl-8 md:pl-10 h-10 md:h-12 text-base md:text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-1 md:space-y-2">
              <Label
                htmlFor="directCare"
                className="text-sm md:text-base text-card-foreground"
              >
                Direct Care Costs
              </Label>
              <div className="relative">
                <Stethoscope className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <Input
                  id="directCare"
                  type="text"
                  value={
                    directCareCosts
                      ? formatNumberWithCommas(directCareCosts.toString())
                      : ''
                  }
                  onChange={(e) =>
                    handleNumberInput(e.target.value, setDirectCareCosts)
                  }
                  placeholder="200,000"
                  className="pl-8 md:pl-10 h-10 md:h-12 text-base md:text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-1 md:space-y-2">
              <Label
                htmlFor="overhead"
                className="text-sm md:text-base text-card-foreground"
              >
                Overhead Costs
              </Label>
              <div className="relative">
                <Home className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <Input
                  id="overhead"
                  type="text"
                  value={
                    overheadCosts
                      ? formatNumberWithCommas(overheadCosts.toString())
                      : ''
                  }
                  onChange={(e) =>
                    handleNumberInput(e.target.value, setOverheadCosts)
                  }
                  placeholder="100,000"
                  className="pl-8 md:pl-10 h-10 md:h-12 text-base md:text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-1 md:space-y-2">
              <Label
                htmlFor="avgVisits"
                className="text-sm md:text-base text-card-foreground"
              >
                Avg Visits per Patient/Year
              </Label>
              <div className="relative">
                <CalendarCheck className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                <Input
                  id="avgVisits"
                  type="number"
                  step="0.1"
                  value={avgVisits || ''}
                  onChange={(e) => setAvgVisits(Number(e.target.value))}
                  placeholder="4.5"
                  className="pl-8 md:pl-10 h-10 md:h-12 text-base md:text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floating Save Button */}
      {allFieldsFilled && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500 col-span-4">
          <Button
            onClick={() => setShowSaveModal(true)}
            size="lg"
            className="bg-teal-600 hover:bg-teal-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 px-8 py-6 text-lg "
          >
            <Save className="w-5 h-5 mr-2" />
            Save Report
          </Button>
        </div>
      )}

      {/* Save Modal */}
      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Your Report</DialogTitle>
            <DialogDescription>
              Enter your information below, and we'll generate a private link
              for you to access this report at any time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              />
            </div>

            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowSaveModal(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveReport}
              disabled={isSaving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isSaving ? 'Saving...' : 'Generate Link'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
