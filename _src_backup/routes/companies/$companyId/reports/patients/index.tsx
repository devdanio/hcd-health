import { createFileRoute } from '@tanstack/react-router'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { useCollections } from '@/routes/__root'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getRevenueByAge,
  getRevenuePerPatientByService,
  getPatientsByServiceCount,
  getPatientServiceJourney,
} from '@/collections'
// import Plot from 'react-plotly.js'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import dayjs from 'dayjs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { PatientLocationMap } from '@/components/patient-location-map'

export const Route = createFileRoute('/companies/$companyId/reports/patients/')(
  {
    component: RouteComponent,
  },
)

const chartConfig = {
  count: {
    label: 'Patients',
    color: 'hsl(210 100% 70%)', // blue-300
  },
} satisfies ChartConfig

const genderChartConfig = {
  Male: {
    label: 'Male',
    color: 'hsl(217 91% 60%)', // blue-500
  },
  Female: {
    label: 'Female',
    color: 'hsl(340 82% 52%)', // pink-500
  },
  Other: {
    label: 'Other',
    color: 'hsl(142 76% 36%)', // green-600
  },
  Unknown: {
    label: 'Unknown',
    color: 'hsl(215 16% 47%)', // gray-500
  },
} satisfies ChartConfig

const revenueByAgeChartConfig = {
  '0-10': { label: '0-10', color: 'hsl(210 100% 70%)' }, // blue-300
  '10-20': { label: '10-20', color: 'hsl(217 91% 60%)' }, // blue-500
  '20-30': { label: '20-30', color: 'hsl(142 76% 36%)' }, // green-600
  '30-40': { label: '30-40', color: 'hsl(173 80% 40%)' }, // teal-600
  '40-50': { label: '40-50', color: 'hsl(43 96% 56%)' }, // yellow-500
  '50-60': { label: '50-60', color: 'hsl(25 95% 53%)' }, // orange-500
  '60-70': { label: '60-70', color: 'hsl(340 82% 52%)' }, // pink-500
  '70-80': { label: '70-80', color: 'hsl(291 47% 51%)' }, // purple-500
  '80-90': { label: '80-90', color: 'hsl(262 52% 47%)' }, // violet-600
  '90-100': { label: '90-100', color: 'hsl(215 16% 47%)' }, // gray-500
} satisfies ChartConfig

function RouteComponent() {
  const { companyId } = Route.useParams()
  const { contactsCollection } = useCollections()

  // Use TanStack DB useLiveQuery for reactive data
  const { data: patients } = useLiveQuery((q) =>
    q
      .from({ contact: contactsCollection })
      .where(({ contact }) => eq(contact.companyId, companyId)),
  )

  // Fetch revenue by age data
  const { data: revenueByAge } = useQuery({
    queryKey: ['revenue-by-age', companyId],
    queryFn: () => getRevenueByAge({ data: { companyId } }),
  })

  // Fetch revenue per patient by service
  const { data: revenuePerPatientByService } = useQuery({
    queryKey: ['revenue-per-patient-by-service', companyId],
    queryFn: () => getRevenuePerPatientByService({ data: { companyId } }),
  })

  // Fetch patients by service count distribution
  const { data: patientsByServiceCount } = useQuery({
    queryKey: ['patients-by-service-count', companyId],
    queryFn: () => getPatientsByServiceCount({ data: { companyId } }),
  })

  // Fetch patient service journey for Sankey diagram
  const { data: patientServiceJourney } = useQuery({
    queryKey: ['patient-service-journey', companyId],
    queryFn: () => getPatientServiceJourney({ data: { companyId } }),
  })
  console.log('patientServiceJourney', patientServiceJourney)

  // Calculate age distribution grouped by 10-year intervals
  const ageDistribution = useMemo(() => {
    if (!patients) return []

    // Initialize age groups (0-10, 10-20, 20-30, ..., 90-100)
    const ageGroups: { ageRange: string; count: number; sortOrder: number }[] =
      []
    for (let age = 0; age <= 90; age += 10) {
      ageGroups.push({
        ageRange: `${age}-${age + 10}`,
        count: 0,
        sortOrder: age,
      })
    }

    // Calculate ages and count
    patients.forEach((patient) => {
      if (patient.dateOfBirth) {
        const age = dayjs().diff(dayjs(patient.dateOfBirth), 'year')
        // Only count ages in our range (0-100)
        if (age >= 0 && age < 100) {
          // Find which 10-year group this age belongs to
          const groupIndex = Math.floor(age / 10)
          if (groupIndex >= 0 && groupIndex < ageGroups.length) {
            ageGroups[groupIndex].count++
          }
        }
      }
    })

    return ageGroups
  }, [patients])

  // Calculate gender distribution (only Male and Female)
  const genderDistribution = useMemo(() => {
    if (!patients) return []

    const genderCounts: Record<string, number> = {}

    patients.forEach((patient) => {
      const gender = patient.gender
      if (!gender) return // Skip if no gender data

      // Normalize gender values - only include Male and Female
      const normalizedGender =
        gender.toLowerCase() === 'm' || gender.toLowerCase() === 'male'
          ? 'Male'
          : gender.toLowerCase() === 'f' || gender.toLowerCase() === 'female'
            ? 'Female'
            : null

      // Only count if it's a valid Male or Female value
      if (normalizedGender) {
        genderCounts[normalizedGender] =
          (genderCounts[normalizedGender] || 0) + 1
      }
    })

    // Convert to array format for chart, filtering out Other and Unknown
    return Object.entries(genderCounts)
      .filter(([gender]) => gender === 'Male' || gender === 'Female')
      .map(([gender, count]) => ({
        gender,
        count,
      }))
  }, [patients])

  const totalPatients = ageDistribution.reduce(
    (sum, item) => sum + item.count,
    0,
  )
  const totalPatientsWithGender = genderDistribution.reduce(
    (sum, item) => sum + item.count,
    0,
  )

  // Calculate total revenue from age groups
  const totalRevenue = useMemo(() => {
    if (!revenueByAge) return 0
    return revenueByAge.reduce((sum, item) => sum + item.revenue, 0)
  }, [revenueByAge])

  if (patients === undefined) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Patient Age Distribution</CardTitle>
              <CardDescription>Loading patient data...</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                Loading chart...
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Patient Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                Loading map...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col gap-6">
        {/* First row: Age Distribution and Patient Location Map */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Age Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Patient Age Distribution</CardTitle>
              <CardDescription>
                {totalPatients.toLocaleString()} total patients (ages 0-100)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalPatients === 0 ? (
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  No patient data available
                </div>
              ) : (
                <ChartContainer config={chartConfig}>
                  <BarChart
                    data={ageDistribution}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="ageRange"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      label={{
                        value: 'Age Range',
                        position: 'insideBottom',
                        offset: -50,
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      label={{
                        value: 'Patient Count',
                        angle: -90,
                        position: 'insideLeft',
                      }}
                      allowDecimals={false}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Bar
                      dataKey="count"
                      fill="var(--color-count)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Patient Location Map */}
          <PatientLocationMap patients={patients} />
        </div>

        {/* Second row: Gender Distribution and Revenue by Age Pie Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Patient Gender Distribution</CardTitle>
              <CardDescription>
                {totalPatientsWithGender.toLocaleString()} patients with gender
                data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalPatientsWithGender === 0 ? (
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  No gender data available
                </div>
              ) : (
                <ChartContainer
                  config={genderChartConfig}
                  className="mx-auto aspect-square max-h-[400px] w-full max-w-full"
                >
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent />}
                    />
                    <Pie
                      data={genderDistribution}
                      dataKey="count"
                      nameKey="gender"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      label={({ gender, percent }) =>
                        `${gender}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {genderDistribution.map((entry, index) => {
                        const colorKey =
                          entry.gender as keyof typeof genderChartConfig
                        const config =
                          genderChartConfig[colorKey] ||
                          genderChartConfig.Unknown
                        return (
                          <Cell key={`cell-${index}`} fill={config.color} />
                        )
                      })}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Revenue by Age Distribution Pie Chart */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Revenue by Age Group</CardTitle>
              <CardDescription>
                $
                {totalRevenue.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                total revenue
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!revenueByAge ||
              revenueByAge.length === 0 ||
              totalRevenue === 0 ? (
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  No revenue data available
                </div>
              ) : (
                <ChartContainer
                  config={revenueByAgeChartConfig}
                  className="mx-auto aspect-square max-h-[400px] w-full max-w-full"
                >
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Pie
                      data={revenueByAge}
                      dataKey="revenue"
                      nameKey="ageGroup"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      label={({ ageGroup, percent }) =>
                        percent > 0.05
                          ? `${ageGroup}: ${(percent * 100).toFixed(0)}%`
                          : ''
                      }
                    >
                      {revenueByAge.map((entry, index) => {
                        const colorKey =
                          entry.ageGroup as keyof typeof revenueByAgeChartConfig
                        const config = revenueByAgeChartConfig[colorKey]
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={config?.color || 'hsl(215 16% 47%)'}
                          />
                        )
                      })}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Third row: Revenue Per Patient by Service */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Per Patient by Service</CardTitle>
            <CardDescription>
              Average revenue generated per unique patient for each service
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!revenuePerPatientByService ||
            revenuePerPatientByService.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No service revenue data available
              </div>
            ) : (
              <div className="space-y-4">
                {revenuePerPatientByService
                  .filter((service) => service.patientCount > 0)
                  .map((service) => (
                    <div
                      key={service.serviceId}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">
                          {service.serviceName}
                        </h3>
                        <div className="flex gap-4 mt-1">
                          <p className="text-sm text-muted-foreground">
                            {service.patientCount.toLocaleString()}{' '}
                            {service.patientCount === 1
                              ? 'patient'
                              : 'patients'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Total: $
                            {service.totalRevenue.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          $
                          {service.revenuePerPatient.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Per patient
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fourth row: Patient Service Diversity Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Service Diversity</CardTitle>
            <CardDescription>
              Distribution of patients by number of unique services received
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!patientsByServiceCount || patientsByServiceCount.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No patient service data available
              </div>
            ) : (
              <ChartContainer
                config={{
                  1: { label: '1 Service', color: 'hsl(210 100% 70%)' },
                  2: { label: '2 Services', color: 'hsl(217 91% 60%)' },
                  3: { label: '3 Services', color: 'hsl(142 76% 36%)' },
                  4: { label: '4 Services', color: 'hsl(173 80% 40%)' },
                  5: { label: '5 Services', color: 'hsl(43 96% 56%)' },
                  6: { label: '6 Services', color: 'hsl(25 95% 53%)' },
                  7: { label: '7 Services', color: 'hsl(340 82% 52%)' },
                  8: { label: '8 Services', color: 'hsl(291 47% 51%)' },
                  9: { label: '9 Services', color: 'hsl(262 52% 47%)' },
                  10: { label: '10 Services', color: 'hsl(215 16% 47%)' },
                }}
                className="mx-auto aspect-square max-h-[400px] w-full max-w-full"
              >
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] uppercase text-muted-foreground">
                                  Services
                                </span>
                                <span className="font-bold text-foreground">
                                  {data.serviceCount}{' '}
                                  {data.serviceCount === 1
                                    ? 'service'
                                    : 'services'}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] uppercase text-muted-foreground">
                                  Patients
                                </span>
                                <span className="font-bold text-foreground">
                                  {data.patientCount.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Pie
                    data={patientsByServiceCount.filter(
                      (d) => d.patientCount > 0,
                    )}
                    dataKey="patientCount"
                    nameKey="serviceCount"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ serviceCount, percent }) =>
                      percent > 0.05
                        ? `${serviceCount} ${serviceCount === 1 ? 'service' : 'services'}: ${(percent * 100).toFixed(0)}%`
                        : ''
                    }
                  >
                    {patientsByServiceCount
                      .filter((d) => d.patientCount > 0)
                      .map((entry, index) => {
                        // Use predefined colors or cycle through them
                        const colors = [
                          'hsl(210 100% 70%)',
                          'hsl(217 91% 60%)',
                          'hsl(142 76% 36%)',
                          'hsl(173 80% 40%)',
                          'hsl(43 96% 56%)',
                          'hsl(25 95% 53%)',
                          'hsl(340 82% 52%)',
                          'hsl(291 47% 51%)',
                          'hsl(262 52% 47%)',
                          'hsl(215 16% 47%)',
                        ]
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={colors[index % colors.length]}
                          />
                        )
                      })}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Fifth row: Patient Service Journey Sankey Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Service Journey</CardTitle>
            <CardDescription>
              Flow of patients through different services (only shows
              transitions when service changes)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!patientServiceJourney ||
            !patientServiceJourney.nodes ||
            patientServiceJourney.nodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No patient journey data available
              </div>
            ) : (
              <div className="w-full">
                {/* <Plot
                  data={[
                    {
                      type: 'sankey',
                      orientation: 'h',
                      node: {
                        pad: 15,
                        thickness: 20,
                        line: {
                          color: 'black',
                          width: 0.5,
                        },
                        label: patientServiceJourney.nodes.map((n) => n.name),
                        color: [
                          '#93c5fd',
                          '#60a5fa',
                          '#3b82f6',
                          '#2563eb',
                          '#1d4ed8',
                          '#1e40af',
                          '#1e3a8a',
                          '#86efac',
                          '#4ade80',
                          '#22c55e',
                          '#16a34a',
                          '#15803d',
                          '#fde047',
                          '#facc15',
                          '#eab308',
                          '#fca5a5',
                          '#f87171',
                          '#ef4444',
                          '#dc2626',
                          '#b91c1c',
                        ],
                      },
                      link: {
                        source: patientServiceJourney.links.map((l) => {
                          const sourceIndex =
                            patientServiceJourney.nodes.findIndex(
                              (n) => n.id === l.source,
                            )
                          return sourceIndex
                        }),
                        target: patientServiceJourney.links.map((l) => {
                          const targetIndex =
                            patientServiceJourney.nodes.findIndex(
                              (n) => n.id === l.target,
                            )
                          return targetIndex
                        }),
                        value: patientServiceJourney.links.map((l) => l.value),
                        color: 'rgba(0,0,0,0.2)',
                      },
                    },
                  ]}
                  layout={{
                    height: 500,
                    font: {
                      size: 12,
                    },
                    margin: { l: 20, r: 20, t: 20, b: 20 },
                  }}
                  config={{
                    responsive: true,
                    displayModeBar: false,
                  }}
                  style={{ width: '100%' }}
                /> */}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
