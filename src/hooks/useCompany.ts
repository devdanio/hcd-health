import { convexQuery } from '@convex-dev/react-query'
import { useParams } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { Id } from 'convex/_generated/dataModel'
import { useQuery } from 'convex/react'

export const useCompany = () => {
  const companyId = useParams({
    strict: false,
    select: (params) => params.companyId,
  })

  const company = useQuery(api.companies.getCompany, {
    companyId: companyId as Id<'companies'>,
  })

  return company
}
