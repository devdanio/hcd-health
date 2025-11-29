import { createFileRoute } from '@tanstack/react-router'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { useCollections } from '@/routes/__root'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
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

export const Route = createFileRoute('/companies/$companyId/reports/patients/')({
  component: RouteComponent,
})

const chartConfig = {
  count: {
    label: 'Patients',
    color: 'hsl(210 100% 70%)', // blue-300
  },
} satisfies ChartConfig

function RouteComponent() {
  const { companyId } = Route.useParams()
  const { patientsCollection } = useCollections()

  // Use TanStack DB useLiveQuery for reactive data
  const { data: patients } = useLiveQuery((q) =>
    q
      .from({ patient: patientsCollection })
      .where(({ patient }) => eq(patient.contact.companyId, companyId)),
  )

  // Calculate age distribution grouped by 5-year intervals
  const ageDistribution = useMemo(() => {
    if (!patients) return []

    // Initialize age groups (20-25, 25-30, ..., 80-85)
    const ageGroups: { ageRange: string; count: number; sortOrder: number }[] = []
    for (let age = 20; age <= 80; age += 5) {
      ageGroups.push({
        ageRange: `${age}-${age + 5}`,
        count: 0,
        sortOrder: age,
      })
    }

    // Calculate ages and count
    patients.forEach((patient) => {
      if (patient.contact.dateOfBirth) {
        const age = dayjs().diff(dayjs(patient.contact.dateOfBirth), 'year')
        // Only count ages in our range (20-85)
        if (age >= 20 && age < 85) {
          // Find which 5-year group this age belongs to
          const groupIndex = Math.floor((age - 20) / 5)
          if (groupIndex >= 0 && groupIndex < ageGroups.length) {
            ageGroups[groupIndex].count++
          }
        }
      }
    })

    return ageGroups
  }, [patients])

  const totalPatients = ageDistribution.reduce((sum, item) => sum + item.count, 0)

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Age Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Age Distribution</CardTitle>
            <CardDescription>
              {totalPatients.toLocaleString()} total patients (ages 20-85)
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
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
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
    </div>
  )
}
