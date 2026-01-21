import { createFileRoute } from '@tanstack/react-router'
import { PracticeCalculator } from '@/components/practice-calculator'
import { getLeadCalculator } from '@/server/functions/lead-calculator'
import { notFound } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/healthcare-practice-metrics-calculator/$id',
)({
  component: SavedReport,
  loader: async ({ params }) => {
    const report = await getLeadCalculator({ data: { id: params.id } })
    if (!report) {
      throw notFound()
    }
    return { report }
  },
})

function SavedReport() {
  const { report } = Route.useLoaderData()

  return (
    <section className="">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Saved Report for {report.name}
          </h1>
          <p className="text-gray-600">
            You can bookmark this page to access your report at any time
          </p>
        </div>

        <PracticeCalculator
          initialRevenue={report.revenue}
          initialPatients={report.patients}
          initialNewPatients={report.newPatients}
          initialAvgVisits={report.avgVisits}
          initialMarketingCosts={report.marketingCosts}
          initialDirectCareCosts={report.directCareCosts}
          initialOverheadCosts={report.overheadCosts}
        />
      </div>
    </section>
  )
}
