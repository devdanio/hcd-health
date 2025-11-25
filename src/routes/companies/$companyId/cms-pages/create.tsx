import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { CmsPageForm } from '@/components/CmsPageForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Id } from '../../../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useAction } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { toast } from 'sonner'

export const Route = createFileRoute('/companies/$companyId/cms-pages/create')({
  component: CreateCmsPage,
})

function CreateCmsPage() {
  const { companyId } = Route.useParams()
  const navigate = useNavigate()
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedData, setGeneratedData] = useState<any>(null)

  const generatePage = useAction(api.actions.generatePageContent)

  const handleGenerate = async () => {
    if (!prompt) return

    setIsGenerating(true)
    try {
      const result = await generatePage({ prompt, companyId: companyId as Id<'companies'> })
      setGeneratedData(result)
      setIsAiOpen(false)
      toast.success('Page content generated successfully!')
    } catch (error) {
      console.error(error)
      toast.error('Failed to generate page content')
    } finally {
      setIsGenerating(false)
    }
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
          <h1 className="text-3xl font-bold">Create CMS Page</h1>
        </div>
        <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Page Content</DialogTitle>
              <DialogDescription>
                Describe the page you want to create, and AI will generate the content for you.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="E.g., A landing page for our new summer collection with a focus on sustainable materials..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAiOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={!prompt || isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Page Details</CardTitle>
        </CardHeader>
        <CardContent>
          <CmsPageForm
            key={generatedData ? 'generated' : 'empty'} // Force re-render when data changes
            companyId={companyId as Id<'companies'>}
            pageData={generatedData || undefined}
            onSuccess={() => navigate({ to: '/companies/$companyId/cms-pages', params: { companyId } })}
            onCancel={() => navigate({ to: '/companies/$companyId/cms-pages', params: { companyId } })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
