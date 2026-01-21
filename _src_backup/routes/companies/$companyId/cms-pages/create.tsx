import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { CmsPageForm } from '@/components/CmsPageForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/companies/$companyId/cms-pages/create')({
  component: CreateCmsPage,
})

function CreateCmsPage() {
  const { companyId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <Link
          to="/companies/$companyId/cms-pages"
          params={{ companyId }}
          className="text-sm text-muted-foreground hover:underline mb-2 inline-block"
        >
          ← Back to Pages
        </Link>
        <h1 className="text-3xl font-bold">Create CMS Page</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Page Details</CardTitle>
        </CardHeader>
        <CardContent>
          <CmsPageForm
            companyId={companyId}
            onSuccess={() => navigate({ to: '/companies/$companyId/cms-pages', params: { companyId } })}
            onCancel={() => navigate({ to: '/companies/$companyId/cms-pages', params: { companyId } })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
