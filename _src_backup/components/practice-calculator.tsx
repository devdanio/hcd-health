'use client'

import { useState, useMemo, useEffect } from 'react'
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

  // Carousel state
  const [carouselApi, setCarouselApi] = useState<any>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const totalSlides = 4

  // Track carousel slide changes
  useEffect(() => {
    if (!carouselApi) return

    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap())
    }

    carouselApi.on('select', onSelect)
    onSelect()

    return () => {
      carouselApi.off('select', onSelect)
    }
  }, [carouselApi])

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
    <div className="w-full flex-1 max-w-7xl  flex flex-col gap-2 p-2 h-full">
      {/* Carousel Section - Top 50% */}
      <div className="h-1/2 overflow-hidden relative">
        <Carousel className="w-full h-full" setApi={setCarouselApi}>
          <CarouselContent className="h-full">
            {/* Slide 1: Financial Breakdown */}
            <CarouselItem className="h-full">
              <Card className="h-full rounded-xl overflow-y-auto">
                <CardHeader className="p-3">
                  <CardTitle className="text-base">
                    Financial Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 flex flex-col items-center justify-center h-[calc(100%-5rem)]">
                  <div className="flex flex-col items-center gap-2 md:gap-4 w-full max-w-xs">
                    <ChartContainer
                      config={chartConfig}
                      className="shrink-0 aspect-square w-[clamp(140px,40vw,200px)] h-[clamp(140px,40vw,200px)]"
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
                          innerRadius="30%"
                          outerRadius="48%"
                          strokeWidth={3}
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
                                      className="fill-foreground text-lg sm:text-xl md:text-2xl font-bold"
                                    >
                                      {formatCurrencyShort(total)}
                                    </tspan>
                                    <tspan
                                      x={viewBox.cx}
                                      y={(viewBox.cy || 0) + 18}
                                      className="fill-muted-foreground text-xs sm:text-sm"
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
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:gap-x-4 md:gap-x-6 md:gap-y-1.5">
                      {chartData.map((entry, index) => (
                        <div
                          key={`legend-${index}`}
                          className="flex items-center gap-1.5 md:gap-2"
                        >
                          <div
                            className="h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: entry.fill }}
                          />
                          <span className="text-[10px] sm:text-xs text-muted-foreground">
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
                    <div className="flex gap-3 bg-white rounded-lg p-3">
                      <div className="w-1.5 bg-teal-600 rounded-full" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          Revenue/patient
                        </div>
                        <div className="text-3xl font-bold text-teal-600">
                          {formatCurrencyShort(metrics.revenuePerPatient)}
                        </div>
                      </div>
                    </div>

                    {/* CAC */}
                    <div className="flex gap-3 bg-white rounded-lg p-3">
                      <div className="w-1.5 bg-blue-600 rounded-full" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          CAC
                        </div>
                        <div className="text-3xl font-bold text-blue-600">
                          {formatCurrencyShort(metrics.cac)}
                        </div>
                      </div>
                    </div>

                    {/* Gross Profit */}
                    <div className="flex gap-3 bg-white rounded-lg p-3">
                      <div className="w-1.5 bg-emerald-600 rounded-full" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          Gross profit
                        </div>
                        <div className="text-3xl font-bold text-emerald-600">
                          {metrics.grossProfitMargin.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatCurrencyShort(metrics.grossProfit)}
                        </div>
                      </div>
                    </div>

                    {/* Net Profit */}
                    <div className="flex gap-3 bg-white rounded-lg p-3">
                      <div className="w-1.5 bg-pink-600 rounded-full" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          Net profit
                        </div>
                        <div className="text-3xl font-bold text-pink-600">
                          {metrics.netProfitMargin.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatCurrencyShort(metrics.netProfit)}
                        </div>
                      </div>
                    </div>

                    {/* LTV:CAC Ratio */}
                    <div className="flex gap-3 bg-white rounded-lg p-3 col-span-2">
                      <div className="w-1.5 bg-orange-600 rounded-full" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          LTV:CAC Ratio
                        </div>
                        <div className="text-3xl font-bold text-orange-600">
                          {metrics.ltvCacRatio.toFixed(2)}x
                        </div>
                      </div>
                    </div>
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
                    <div className="flex gap-3 bg-white rounded-lg p-3">
                      <div className="w-1.5 bg-green-600 rounded-full" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          Profit per patient
                        </div>
                        <div className="text-3xl font-bold text-green-600">
                          {formatCurrencyShort(metrics.profitPerPatient)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Net profit after costs
                        </div>
                      </div>
                    </div>

                    {/* Cost to Serve per Patient */}
                    <div className="flex gap-3 bg-white rounded-lg p-3">
                      <div className="w-1.5 bg-purple-600 rounded-full" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          Cost to serve
                        </div>
                        <div className="text-3xl font-bold text-purple-600">
                          {formatCurrencyShort(metrics.costToServe)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Operating cost
                        </div>
                      </div>
                    </div>
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
                    <div className="flex gap-3 bg-white rounded-lg p-3">
                      <div className="w-1.5 bg-emerald-600 rounded-full" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          Profit per visit
                        </div>
                        <div className="text-3xl font-bold text-emerald-600">
                          {formatCurrencyShort(metrics.profitPerVisit)}
                        </div>
                      </div>
                    </div>

                    {/* Cost to Serve per Visit */}
                    <div className="flex gap-3 bg-white rounded-lg p-3">
                      <div className="w-1.5 bg-indigo-600 rounded-full" />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          Cost per visit
                        </div>
                        <div className="text-3xl font-bold text-indigo-600">
                          {formatCurrencyShort(metrics.costToServePerVisit)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Operating cost
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          </CarouselContent>
          <CarouselPrevious className="left-2" />
          <CarouselNext className="right-2" />

          {/* Carousel Dot Indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {Array.from({ length: totalSlides }).map((_, index) => (
              <button
                key={index}
                onClick={() => carouselApi?.scrollTo(index)}
                className={`h-2 w-2 rounded-full transition-all ${
                  currentSlide === index
                    ? 'bg-primary w-6'
                    : 'bg-primary/30 hover:bg-primary/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </Carousel>
      </div>

      {/* Form Section - Bottom 50% */}
      <Card className="flex-1 rounded-xl overflow-y-auto shadow-xl h-fit pb-42">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-2xl md:text-4xl font-normal">
            Calculate your practice's metrics in minutes
          </CardTitle>
          <CardDescription>
            Enter your practice's info below to get real time metrics.
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
