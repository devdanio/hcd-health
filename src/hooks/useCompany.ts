import { useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getCompany } from '@/server/functions/companies'

export const useCompany = () => {
  const companyId = useParams({
    strict: false,
    select: (params) => params.companyId,
  })

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  })

  return company
}
