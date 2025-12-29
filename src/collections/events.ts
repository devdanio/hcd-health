import { prisma } from '@/server/db/client'
import { createServerFn } from '@tanstack/react-start'
import { getNewPatientsByDateRangeSchema } from './financials'
import z from 'zod'
import { EventType } from '@/generated/prisma/enums'
import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'

interface WebMetadata {
  url: string
  path: string
  gclid: string
  title: string
  fbclid: any
  referrer: any
  utm_term: string
  utm_medium: string
  utm_source: string
  utm_content: string
  utm_campaign: string
}

export const getWebEventsSchema = z.object({
  companyId: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
})
export const getWebEvents = createServerFn({ method: 'GET' })
  .inputValidator(getWebEventsSchema)
  .handler(async ({ data }) => {
    const { companyId, startDate, endDate } = data

    const result = await prisma.event.findMany({
      where: {
        company_id: companyId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
        type: EventType.PAGE_VIEW,
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    })

    return result.map((r) => r as typeof r & { metadata: WebMetadata })
  })

export const useWebEvents = ({
  companyId,
  startDate,
  endDate,
}: {
  companyId: string
  startDate: Date
  endDate: Date
}) => {
  return useQuery({
    queryKey: ['webEvents', companyId, startDate, endDate],
    queryFn: () => getWebEvents({ data: { companyId, startDate, endDate } }),
  })
}
