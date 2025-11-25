import { Button } from '@/components/ui/button'
import { useCompany } from '@/hooks/useCompany'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Check } from 'lucide-react'

export const Route = createFileRoute('/companies/$companyId/tracking/')({
  component: RouteComponent,
})

const AVATARS = [
  {
    id: 'avatar-1',
    src: '/images/chat-widget/avatar-1.png',
    label: 'Avatar 1',
  },
  {
    id: 'avatar-2',
    src: '/images/chat-widget/avatar-2.png',
    label: 'Avatar 2',
  },
  {
    id: 'avatar-3',
    src: '/images/chat-widget/avatar-3.png',
    label: 'Avatar 3',
  },
  {
    id: 'avatar-4',
    src: '/images/chat-widget/avatar-4.png',
    label: 'Avatar 4',
  },
  {
    id: 'avatar-5',
    src: '/images/chat-widget/avatar-5.png',
    label: 'Avatar 5',
  },
]

function RouteComponent() {
  const company = useCompany()
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0])

  const previewHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="${window.location.origin}/chat-widget.css">
        <style>
          body { font-family: sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .placeholder { text-align: center; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="placeholder">
          <h1>Your Website</h1>
          <p>The chat widget will appear in the bottom right.</p>
        </div>
        <script>
          window.chatWidgetConfig = {
            avatarUrl: "${window.location.origin}${selectedAvatar.src}"
          };
        </script>
        <script src="${window.location.origin}/chat-widget.js"></script>
      </body>
    </html>
  `

  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-8">Tracking & Chat Widget</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          {/* API Key Section */}
          <div className="p-6 border rounded-lg bg-card">
            <h2 className="text-lg font-semibold mb-4">Tracking Setup</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  API Key
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-muted p-3 rounded text-sm overflow-x-auto font-mono">
                    {company?.apiKey}
                  </code>
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigator.clipboard.writeText(company?.apiKey ?? '')
                    }
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Widget Configuration */}
          <div className="p-6 border rounded-lg bg-card">
            <h2 className="text-lg font-semibold mb-4">
              Chat Widget Customization
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-3">
                Select Avatar
              </label>
              <div className="flex flex-wrap gap-4">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`relative rounded-full p-1 transition-all ${
                      selectedAvatar.id === avatar.id
                        ? 'ring-2 ring-primary ring-offset-2'
                        : 'hover:ring-2 hover:ring-muted ring-offset-1'
                    }`}
                  >
                    <img
                      src={avatar.src}
                      alt={avatar.label}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                    {selectedAvatar.id === avatar.id && (
                      <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Installation Code
              </label>
              <div className="relative">
                <code className="block bg-muted p-4 rounded-lg text-sm overflow-x-auto font-mono whitespace-pre text-wrap break-all">
                  {`<!-- Chat Widget Configuration -->
<script>
  window.chatWidgetConfig = {
    avatarUrl: "https://app.leadalytics.ai${selectedAvatar.src}"
  };
</script>

<!-- Leadalytics Tracker & Chat Widget -->
<!-- Note: CSS is embedded in chat-widget.js and injected into Shadow DOM -->
<script src="https://app.leadalytics.ai/chat-widget.js"></script>
<script
  src="https://app.leadalytics.ai/tracker/tracker.js"
  data-api-key="${company?.apiKey}"
  data-api-url="${import.meta.env.VITE_CONVEX_URL}/http"
></script>`}
                </code>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    const code = `<!-- Chat Widget Configuration -->
<script>
  window.chatWidgetConfig = {
    avatarUrl: "https://app.leadalytics.ai${selectedAvatar.src}"
  };
</script>

<!-- Leadalytics Tracker & Chat Widget -->
<!-- Note: CSS is embedded in chat-widget.js and injected into Shadow DOM -->
<script src="https://app.leadalytics.ai/chat-widget.js"></script>
<script
  src="https://app.leadalytics.ai/tracker/tracker.js"
  data-api-key="${company?.apiKey}"
  data-api-url="${import.meta.env.VITE_CONVEX_URL}/http"
></script>`
                    navigator.clipboard.writeText(code)
                  }}
                >
                  Copy Code
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Live Preview</h2>
          <div className="border rounded-xl overflow-hidden shadow-sm bg-background h-[600px] relative">
            <div className="absolute inset-0 bg-muted/20 pointer-events-none z-0" />
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full border-0 relative z-10"
              title="Chat Widget Preview"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
