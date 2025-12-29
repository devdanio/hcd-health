import { prisma } from '@/server/db/client'
import { createServerFn } from '@tanstack/react-start'
import { getNewPatientsByDateRangeSchema } from './financials'
import z from 'zod'
import { EventType } from '@/generated/prisma/enums'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearch } from '@tanstack/react-router'

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
  before: z.coerce.date().optional(),
  after: z.coerce.date().optional(),
})
export const getWebEvents = createServerFn({ method: 'GET' })
  .inputValidator(getWebEventsSchema)
  .handler(async ({ data }) => {
    const { companyId, before, after } = data

    const result = await prisma.event.findMany({
      where: {
        company_id: companyId,
        timestamp: {
          gte: before,
          lte: after,
        },
        type: EventType.PAGE_VIEW,
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    })

    return result.map((r) => r as typeof r & { metadata: WebMetadata })
  })

export const useWebEvents = (options?: {
  companyId: string
  before: Date
  after: Date
}) => {
  const { companyId } = useParams({
    strict: false,
    select: (params) => ({
      companyId: params.companyId as string,
    }),
  })
  const search = useSearch({
    from: '/companies/$companyId',
  })
  const before = options?.before || search.before
  const after = options?.after || search.after
  return useQuery({
    queryKey: ['webEvents', companyId, before, after],
    queryFn: () => getWebEvents({ data: { companyId, before, after } }),
  })
}
