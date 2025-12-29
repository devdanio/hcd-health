import { useWebEvents } from '@/collections/events'
import { createFileRoute } from '@tanstack/react-router'
import groupBy from 'lodash/groupBy'
import { useMemo } from 'react'

export const Route = createFileRoute(
  '/companies/$companyId/reports/marketing/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { data: webEvents } = useWebEvents()

  const campaigns = useMemo(() => {
    return groupBy(webEvents, 'metadata.utm_campaign')
  }, [webEvents])
  console.log('campaigns', campaigns)
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold">Marketing</h1>
    </div>
  )
}
