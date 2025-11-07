import { createFileRoute, Link } from '@tanstack/react-router'
import { Target, Smartphone, BarChart3, Zap, Shield, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const features = [
    {
      icon: <Target className="w-12 h-12 text-cyan-400" />,
      title: 'Full Attribution Tracking',
      description:
        'Track UTM parameters, click IDs, referrers, and user journeys across your entire funnel.',
    },
    {
      icon: <Smartphone className="w-12 h-12 text-cyan-400" />,
      title: 'iOS Compatible',
      description:
        'First-party cookies and Safari ITP compliance ensure tracking works on all devices.',
    },
    {
      icon: <Globe className="w-12 h-12 text-cyan-400" />,
      title: 'Cross-Domain & Iframes',
      description:
        'Track conversions even across iframes and different domains with seamless postMessage integration.',
    },
    {
      icon: <BarChart3 className="w-12 h-12 text-cyan-400" />,
      title: 'Multi-Touch Attribution',
      description:
        'Understand your customer journey with first-touch, last-touch, and full path attribution.',
    },
    {
      icon: <Zap className="w-12 h-12 text-cyan-400" />,
      title: 'Real-Time Analytics',
      description:
        'Powered by Convex for instant insights into sessions, events, and conversions.',
    },
    {
      icon: <Shield className="w-12 h-12 text-cyan-400" />,
      title: 'Privacy Focused',
      description:
        'GDPR/CCPA compliant with first-party cookies and no third-party tracking domains.',
    },
  ]

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900">
      <section className="relative py-20 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10"></div>
        <div className="relative max-w-5xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-black text-white mb-6">
            <span className="bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Leadalytics
            </span>
          </h1>
          <p className="text-2xl md:text-3xl text-gray-300 mb-4 font-light">
            Attribution tracking for modern marketing
          </p>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto mb-8">
            Track every touchpoint from ad click to conversion. Understand your
            customer journey with iOS-compatible, cross-domain attribution tracking.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/projects">
              <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600">
                View Projects
              </Button>
            </Link>
            <a
              href="/tracker/README.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" variant="outline">
                Documentation
              </Button>
            </a>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          Everything You Need for Attribution
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10"
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-6 max-w-5xl mx-auto">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Quick Start</h2>
          <div className="space-y-4">
            <div>
              <p className="text-gray-400 mb-2">1. Create a project:</p>
              <code className="block bg-slate-900 p-3 rounded text-cyan-400 text-sm">
                Click "View Projects" → "Create Project"
              </code>
            </div>
            <div>
              <p className="text-gray-400 mb-2">2. Install tracking script:</p>
              <code className="block bg-slate-900 p-3 rounded text-cyan-400 text-sm overflow-x-auto">
                {`<script src="/tracker/tracker.js" data-api-key="YOUR_API_KEY" data-api-url="YOUR_CONVEX_URL"></script>`}
              </code>
            </div>
            <div>
              <p className="text-gray-400 mb-2">3. Track conversions:</p>
              <code className="block bg-slate-900 p-3 rounded text-cyan-400 text-sm">
                {`trackConversion('purchase', { revenue: 99.99 })`}
              </code>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
