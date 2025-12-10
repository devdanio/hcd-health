import { createFileRoute } from '@tanstack/react-router'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { useCollections } from '@/routes/__root'
import { useMemo } from 'react'
import {
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

function RouteComponent() {
  const { companyId } = Route.useParams()
  const { contactsCollection } = useCollections()

  // Use TanStack DB useLiveQuery for reactive data
  const { data: patients } = useLiveQuery((q) =>
    q
      .from({ contact: contactsCollection })
      .where(({ contact }) => eq(contact.companyId, companyId)),
  )

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

        {/* Second row: Gender Distribution Pie Chart (50% width) */}
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
        </div>
      </div>
    </div>
  )
}
