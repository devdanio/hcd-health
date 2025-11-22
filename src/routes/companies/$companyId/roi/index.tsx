import { createFileRoute } from '@tanstack/react-router'
import { AdSpendChart } from '@/components/ad-spend-chart'
import { CampaignSpendCards } from '@/components/campaign-spend-cards'

export const Route = createFileRoute('/companies/$companyId/roi/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">ROI Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <AdSpendChart />
        </div>
      </div>
      <CampaignSpendCards />
    </div>
  )
}
