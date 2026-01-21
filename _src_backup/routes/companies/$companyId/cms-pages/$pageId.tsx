import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { useCollections } from '@/routes/__root'
import { CmsPageForm } from '@/components/CmsPageForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from 'sonner'

export const Route = createFileRoute('/companies/$companyId/cms-pages/$pageId')({
  component: EditCmsPage,
})

function EditCmsPage() {
  const { companyId, pageId } = Route.useParams()
  const { cmsPagesCollection } = useCollections()
  const navigate = useNavigate()

  const { data: pages } = useLiveQuery((q) =>
    q
      .from({ page: cmsPagesCollection })
      .where(({ page }) => eq(page.companyId, companyId)),
  )

  const page = pages?.find((p) => p.id === pageId)

  const handleDelete = async () => {
    try {
      await cmsPagesCollection.delete(pageId)
      toast.success('Page deleted successfully')
      navigate({ to: '/companies/$companyId/cms-pages', params: { companyId } })
    } catch (error) {
      toast.error('Failed to delete page')
      console.error(error)
    }
  }

  if (pages === undefined) {
    return <div className="container mx-auto p-8">Loading...</div>
  }

  if (!page) {
    return <div className="container mx-auto p-8">Page not found</div>
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            to="/companies/$companyId/cms-pages"
            params={{ companyId }}
            className="text-sm text-muted-foreground hover:underline mb-2 inline-block"
          >
            ← Back to Pages
          </Link>
          <h1 className="text-3xl font-bold">Edit Page: {page.pageTitle}</h1>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete Page
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the page
                and remove it from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Page Details</CardTitle>
        </CardHeader>
        <CardContent>
          <CmsPageForm
            companyId={companyId}
            pageId={pageId}
            pageData={{
              h1: page.h1,
              pageTitle: page.pageTitle,
              pageDescription: page.pageDescription,
              slug: page.slug,
              markdownContent: page.markdownContent,
              jsonSchema: page.jsonSchema ? JSON.stringify(page.jsonSchema, null, 2) : undefined,
            }}
            onSuccess={() => navigate({ to: '/companies/$companyId/cms-pages', params: { companyId } })}
            onCancel={() => navigate({ to: '/companies/$companyId/cms-pages', params: { companyId } })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
