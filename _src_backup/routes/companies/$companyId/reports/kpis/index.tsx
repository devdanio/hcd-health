import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/companies/$companyId/reports/kpis/')({
  component: RouteComponent,
})

const kpis = [
  {
    title: 'PT Apts',
    value: 7,
    description: 'Total PT appointments',
  },
  {
    title: 'OT Apts',
    value: 4,
    description: 'Total OT appointments',
  },
  {
    title: 'Chiro Apts',
    value: 2,
    description: 'Total OT appointments',
  },
  {
    title: 'Acu Apts',
    value: 9,
    description: 'Total OT appointments',
  },
]

function getMeterColor(value: number): string {
  if (value >= 0 && value <= 3) {
    return 'bg-orange-500'
  } else if (value >= 4 && value <= 6) {
    return 'bg-yellow-500'
  } else if (value >= 7 && value <= 10) {
    return 'bg-green-700'
  }
  return 'bg-gray-500'
}

function RouteComponent() {
  const maxValue = 10

  return (
    <div>
      <h1 className="text-2xl font-bold">KPIs</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {kpis.map((kpi) => {
          const percentage = (kpi.value / maxValue) * 100
          return (
            <Card key={kpi.title}>
              <CardHeader>{kpi.title}</CardHeader>
              <CardContent>
                <p>{kpi.value}</p>
                <p>{kpi.description}</p>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`${getMeterColor(kpi.value)} h-2.5 rounded-full`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {kpi.value} / {maxValue}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
