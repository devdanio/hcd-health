import { useForm } from '@tanstack/react-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useCollections } from '@/routes/__root'

type CmsPageFormData = {
  h1: string
  pageTitle: string
  pageDescription: string
  slug: string
  markdownContent: string
  jsonSchema?: string
}

type CmsPageFormProps = {
  companyId: string
  pageId?: string
  pageData?: Partial<CmsPageFormData>
  onSuccess?: () => void
  onCancel?: () => void
}

export function CmsPageForm({
  companyId,
  pageId,
  pageData,
  onSuccess,
  onCancel,
}: CmsPageFormProps) {
  const { cmsPagesCollection } = useCollections()

  const isUpdateMode = !!pageId

  const form = useForm({
    defaultValues: {
      h1: pageData?.h1 || '',
      pageTitle: pageData?.pageTitle || '',
      pageDescription: pageData?.pageDescription || '',
      slug: pageData?.slug || '',
      markdownContent: pageData?.markdownContent || '',
      jsonSchema: pageData?.jsonSchema || '',
    },
    onSubmit: async ({ value }) => {
      try {
        let parsedJsonSchema = null
        if (value.jsonSchema) {
          try {
            parsedJsonSchema = JSON.parse(value.jsonSchema)
          } catch (e) {
            toast.error('Invalid JSON Schema')
            return
          }
        }

        if (isUpdateMode && pageId) {
          await cmsPagesCollection.update(pageId, {
            h1: value.h1,
            pageTitle: value.pageTitle,
            pageDescription: value.pageDescription,
            slug: value.slug,
            markdownContent: value.markdownContent,
            jsonSchema: parsedJsonSchema,
          })
          toast.success('Page updated successfully')
        } else {
          await cmsPagesCollection.insert({
            companyId,
            h1: value.h1,
            pageTitle: value.pageTitle,
            pageDescription: value.pageDescription,
            slug: value.slug,
            markdownContent: value.markdownContent,
            jsonSchema: parsedJsonSchema,
          })
          toast.success('Page created successfully')
        }
        onSuccess?.()
      } catch (error) {
        toast.error(
          isUpdateMode ? 'Failed to update page' : 'Failed to create page'
        )
        console.error(error)
      }
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="space-y-6"
    >
      <div className="grid gap-4">
        {/* H1 */}
        <form.Field
          name="h1"
          validators={{
            onBlur: ({ value }) => (!value ? 'H1 is required' : undefined),
          }}
        >
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor="h1">H1 *</Label>
              <Input
                id="h1"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.length > 0 && (
                <span className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </span>
              )}
            </div>
          )}
        </form.Field>

        {/* Page Title */}
        <form.Field
          name="pageTitle"
          validators={{
            onBlur: ({ value }) => (!value ? 'Page Title is required' : undefined),
          }}
        >
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor="pageTitle">Page Title *</Label>
              <Input
                id="pageTitle"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.length > 0 && (
                <span className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </span>
              )}
            </div>
          )}
        </form.Field>

        {/* Page Description */}
        <form.Field
          name="pageDescription"
          validators={{
            onBlur: ({ value }) => (!value ? 'Page Description is required' : undefined),
          }}
        >
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor="pageDescription">Page Description *</Label>
              <Textarea
                id="pageDescription"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.length > 0 && (
                <span className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </span>
              )}
            </div>
          )}
        </form.Field>

        {/* Slug */}
        <form.Field
          name="slug"
          validators={{
            onBlur: ({ value }) => (!value ? 'Slug is required' : undefined),
          }}
        >
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.length > 0 && (
                <span className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </span>
              )}
            </div>
          )}
        </form.Field>

        {/* Markdown Content */}
        <form.Field
          name="markdownContent"
          validators={{
            onBlur: ({ value }) => (!value ? 'Content is required' : undefined),
          }}
        >
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor="markdownContent">Markdown Content *</Label>
              <Textarea
                id="markdownContent"
                className="min-h-[300px] font-mono"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.length > 0 && (
                <span className="text-sm text-destructive">
                  {field.state.meta.errors[0]}
                </span>
              )}
            </div>
          )}
        </form.Field>

        {/* JSON Schema */}
        <form.Field name="jsonSchema">
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor="jsonSchema">JSON Schema (Optional)</Label>
              <Textarea
                id="jsonSchema"
                className="font-mono"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="{}"
              />
            </div>
          )}
        </form.Field>
      </div>

      <div className="flex justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit">
          {isUpdateMode ? 'Save Changes' : 'Create Page'}
        </Button>
      </div>
    </form>
  )
}
