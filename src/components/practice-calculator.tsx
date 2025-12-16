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
  TrendingUp,
  DollarSign,
  Users,
  PieChart,
  Building2,
  User,
  Calendar,
  Save,
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
  initialRevenue = 1000000,
  initialPatients = 500,
  initialNewPatients = 250,
  initialAvgVisits = 6.3,
  initialMarketingCosts = 60000,
  initialDirectCareCosts = 500000,
  initialOverheadCosts = 60000,
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
    <div className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6">
      <Card className="col-span-8 rounded-3xl order-1 md:order-0">
        <CardHeader>
          <CardTitle className="text-4xl font-normal">
            Calculate your practice's metrics in minutes
          </CardTitle>
          <CardDescription>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-3 py-1.5 bg-teal-50 text-teal-700 rounded-full text-sm font-medium">
                Revenue/Patient
              </span>
              <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                Customer Acquisition Cost (CAC)
              </span>
              <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
                Gross Profit Margin
              </span>
              <span className="px-3 py-1.5 bg-pink-50 text-pink-700 rounded-full text-sm font-medium">
                Net Profit Margin
              </span>
              <span className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-sm font-medium">
                LTV:CAC Ratio
              </span>
              <span className="px-3 py-1.5 bg-gray-50 text-gray-700 rounded-full text-sm font-medium">
                And more...
              </span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="revenue"
                className="text-base text-card-foreground"
              >
                Total Annual Revenue
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                  className="pl-10 h-12 text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="patients"
                className="text-base  text-card-foreground"
              >
                Total Patients Served
              </Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                  className="pl-10 h-12 text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="newPatients"
                className="text-base  text-card-foreground"
              >
                Total New Patients Acquired
              </Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                  className="pl-10 h-12 text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="marketing"
                className="text-base  text-card-foreground"
              >
                Total Marketing Spend(ads, agency fees, etc.)
              </Label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                  className="pl-10 h-12 text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="directCare"
                className="text-base  text-card-foreground"
              >
                Direct Care Costs (clinical staff, supplies, etc.)
              </Label>
              <div className="relative">
                <PieChart className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                  className="pl-10 h-12 text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="overhead"
                className="text-base  text-card-foreground"
              >
                Overhead Costs (rent, insurance, equipment, admin staff, etc.)
              </Label>
              <div className="relative">
                <PieChart className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                  className="pl-10 h-12 text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="avgVisits"
                className="text-base  text-card-foreground"
              >
                Average Visits per Patient per Year
              </Label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="avgVisits"
                  type="number"
                  step="0.1"
                  value={avgVisits || ''}
                  onChange={(e) => setAvgVisits(Number(e.target.value))}
                  placeholder="4.5"
                  className="pl-10 h-12 text-lg border-2 focus:border-teal-500"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 md:col-span-4">
          {/* Practice Overview */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-6 h-6 text-teal-600" />
              <h4 className="text-2xl  text-gray-800">Practice Overview</h4>
            </div>
            <div className="grid md:grid-cols-2  gap-6">
              {/* Revenue per Patient */}
              <Card className="border-2 border-teal-100 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4 delay-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Revenue per Patient
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-teal-600 mb-2">
                    {formatCurrency(metrics.revenuePerPatient)}
                  </div>
                  <p className="text-sm text-gray-500">
                    Average revenue per patient
                  </p>
                </CardContent>
              </Card>

              {/* CAC */}
              <Card className="border-2 border-blue-100 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4 delay-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Customer Acquisition Cost (CAC)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {formatCurrency(metrics.cac)}
                  </div>
                  <p className="text-sm text-gray-500">
                    Cost to acquire each new patient
                  </p>
                </CardContent>
              </Card>

              {/* Gross Profit */}
              <Card className="border-2 border-emerald-100 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4 delay-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Gross Profit Margin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-emerald-600 mb-2">
                    {metrics.grossProfitMargin.toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(metrics.grossProfit)}
                  </p>
                </CardContent>
              </Card>

              {/* Net Profit */}
              <Card className="border-2 border-pink-100 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4 delay-400">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Net Profit Margin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-pink-600 mb-2">
                    {metrics.netProfitMargin.toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(metrics.netProfit)}
                  </p>
                </CardContent>
              </Card>

              {/* LTV:CAC Ratio */}
              <Card className="border-2 border-orange-100 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4 delay-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    LTV:CAC Ratio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-orange-600 mb-2">
                    {metrics.ltvCacRatio.toFixed(2)}x
                  </div>
                  <p className="text-sm text-gray-500">
                    Lifetime value to acquisition cost
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Patient Overview */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <User className="w-6 h-6 text-green-600" />
              <h4 className="text-2xl  text-gray-800">Patient Overview</h4>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Profit per Patient */}
              <Card className="border-2 border-green-100 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4 delay-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Profit per Patient
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    {formatCurrency(metrics.profitPerPatient)}
                  </div>
                  <p className="text-sm text-gray-500">
                    Net profit after operating costs
                  </p>
                </CardContent>
              </Card>

              {/* Cost to Serve per Patient */}
              <Card className="border-2 border-purple-100 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4 delay-600">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Cost to Serve per Patient
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-purple-600 mb-2">
                    {formatCurrency(metrics.costToServe)}
                  </div>
                  <p className="text-sm text-gray-500">
                    Operating cost per patient
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Visit Overview */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-6 h-6 text-emerald-600" />
              <h4 className="text-2xl  text-gray-800">Visit Overview</h4>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Profit per Visit */}
              <Card className="border-2 border-emerald-100 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4 delay-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Profit per Visit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-emerald-600 mb-2">
                    {formatCurrency(metrics.profitPerVisit)}
                  </div>
                  <p className="text-sm text-gray-500">
                    Profit earned per patient visit
                  </p>
                </CardContent>
              </Card>

              {/* Cost to Serve per Visit */}
              <Card className="border-2 border-indigo-100 shadow-lg hover:shadow-xl transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4 delay-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Cost to Serve per Visit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-indigo-600 mb-2">
                    {formatCurrency(metrics.costToServePerVisit)}
                  </div>
                  <p className="text-sm text-gray-500">
                    Operating cost per visit
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Visual Breakdown */}
          <Card className="border-2 border-gray-200 shadow-lg mt-8 animate-in fade-in slide-in-from-bottom-4 delay-700">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
              <CardTitle className="text-2xl text-gray-900">
                Financial Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Revenue Breakdown Bar */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm  text-gray-700">
                      Revenue Distribution
                    </span>
                    <span className="text-sm  text-gray-900">
                      {formatCurrency(revenue)}
                    </span>
                  </div>
                  <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-teal-600 transition-all duration-1000 ease-out"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* Costs Breakdown */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm  text-gray-700">Total Costs</span>
                    <span className="text-sm  text-gray-900">
                      {formatCurrency(
                        marketingCosts + directCareCosts + overheadCosts,
                      )}
                    </span>
                  </div>
                  <div className="h-8 bg-gray-200 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-1000 ease-out"
                      style={{
                        width: `${(marketingCosts / (marketingCosts + directCareCosts + overheadCosts)) * 100 || 0}%`,
                      }}
                      title={`Marketing: ${formatCurrency(marketingCosts)}`}
                    />
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-1000 ease-out"
                      style={{
                        width: `${(directCareCosts / (marketingCosts + directCareCosts + overheadCosts)) * 100 || 0}%`,
                      }}
                      title={`Direct Care: ${formatCurrency(directCareCosts)}`}
                    />
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-1000 ease-out"
                      style={{
                        width: `${(overheadCosts / (marketingCosts + directCareCosts + overheadCosts)) * 100 || 0}%`,
                      }}
                      title={`Overhead: ${formatCurrency(overheadCosts)}`}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-600">
                    <span>Marketing: {formatCurrency(marketingCosts)}</span>
                    <span>Direct Care: {formatCurrency(directCareCosts)}</span>
                    <span>Overhead: {formatCurrency(overheadCosts)}</span>
                  </div>
                </div>

                {/* Net Profit */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm  text-gray-700">Net Profit</span>
                    <span className="text-sm  text-green-600">
                      {formatCurrency(metrics.netProfit)}
                    </span>
                  </div>
                  <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-1000 ease-out"
                      style={{
                        width: `${Math.max(0, Math.min(100, revenue > 0 ? (metrics.netProfit / revenue) * 100 : 0))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
      </div>

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
