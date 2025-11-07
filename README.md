# Leadalytics

A comprehensive attribution tracking system for modern marketing, built with React, TanStack Start, and Convex.

## Overview

Leadalytics is a full-featured attribution tracking platform (similar to Hyros) that captures UTM parameters, click IDs, referrers, and user journeys across your entire funnel. Track conversions from ad click to purchase, even through iframes and across domains.

### Key Features

- 🎯 **Full Attribution Tracking** - UTM parameters, click IDs (fbclid, gclid, etc.), referrers
- 📱 **iOS Compatible** - First-party cookies with Safari ITP compliance
- 🌐 **Cross-Domain & Iframes** - Track conversions through iframes via postMessage API
- 📊 **Multi-Touch Attribution** - First touch, last touch, and full path tracking
- ⚡ **Real-Time Analytics** - Powered by Convex for instant insights
- 🔒 **Privacy Focused** - GDPR/CCPA compliant, first-party cookies only

## Quick Start

See **[QUICKSTART.md](./QUICKSTART.md)** for detailed setup instructions.

### Prerequisites

- Node.js 18+
- pnpm
- Convex account (free at https://convex.dev)

### Installation

```bash
# Install dependencies
pnpm install

# Start Convex backend
npx convex dev

# Start dev server (in new terminal)
pnpm dev
```

### Create Your First Project

1. Go to http://localhost:3000
2. Navigate to **Projects** → **Create Project**
3. Copy your API key
4. Install tracking script on your website

### Test the System

Visit the test page with UTM parameters:

```
http://localhost:3000/test-page.html?utm_source=facebook&utm_medium=cpc&fbclid=test123
```

## Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get up and running in 5 minutes
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** - Complete implementation details
- **[public/tracker/README.md](./public/tracker/README.md)** - Tracking script documentation
- **[CLAUDE.md](./CLAUDE.md)** - Developer guidance for Claude Code

## Architecture

### Tech Stack

- **Frontend**: React 19 + TanStack Start (SSR)
- **Backend**: Convex (serverless, real-time)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Routing**: TanStack Router (file-based)
- **State**: TanStack Query + Convex React Query

### Data Model

**Simplified TouchPoints Approach:**

All attribution data is stored in a `touchPoints` array within each session:

```typescript
session.touchPoints = [
  {
    utm_source: "facebook",
    fbclid: "abc123",
    url: "https://example.com",
    timestamp: 1234567890
  },
  {
    utm_source: "google",
    gclid: "xyz789",
    url: "https://example.com/page2",
    timestamp: 1234567920
  }
]
```

**Attribution:**
- First touch: `touchPoints[0]`
- Last touch: `touchPoints[touchPoints.length - 1]`
- All touches: Full array available for multi-touch models

## Usage

### Install Tracking Script

```html
<script
  src="https://your-domain.com/tracker/tracker.js"
  data-api-key="la_your_api_key"
  data-api-url="https://your-convex-deployment.convex.cloud"
></script>
```

### Track Conversions

```javascript
// Simple conversion
trackConversion('signup')

// With revenue and metadata
trackConversion('purchase', {
  revenue: 99.99,
  metadata: {
    orderId: 'ORDER-12345',
    product: 'Premium Plan'
  }
})
```

### Iframe Tracking

**Parent page:**
```html
<script src="/tracker/tracker.js" data-api-key="..." data-api-url="..."></script>
<iframe src="https://forms.yoursite.com/contact"></iframe>
```

**Iframe:**
```html
<script src="/tracker/iframe-tracker.js"></script>
<script>
  // Wait for session data
  await Leadalytics.waitForReady()

  // Track conversion
  trackConversion('lead', { metadata: { formId: 'contact' } })
</script>
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Start Convex backend
npx convex dev

# Start dev server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Lint and format
pnpm check
```

## Project Structure

```
leadalytics/
├── convex/                 # Backend (Convex)
│   ├── schema.ts          # Database schema
│   ├── tracking.ts        # Event ingestion mutations
│   ├── projects.ts        # Project management
│   └── http.ts            # HTTP API endpoints
├── public/
│   └── tracker/           # Tracking scripts
│       ├── tracker.js     # Main tracking script
│       ├── iframe-tracker.js
│       └── README.md
├── src/
│   ├── routes/            # TanStack Router pages
│   │   ├── index.tsx     # Landing page
│   │   └── projects/     # Dashboard pages
│   ├── components/        # React components
│   └── integrations/      # Convex & TanStack Query setup
└── docs/
    ├── QUICKSTART.md      # Quick start guide
    └── IMPLEMENTATION.md  # Implementation details
```

## Features

### Attribution Tracking
- UTM parameters (source, medium, campaign, content, term)
- Click IDs (Facebook, Google, TikTok, Twitter, LinkedIn, Snapchat, Microsoft)
- Referrer tracking
- Landing page capture
- Session management (30-minute timeout)
- Page view tracking
- Custom events

### iOS/Safari Compatibility
- First-party cookies (your domain)
- 7-day session cookie (ITP compliant)
- 1-year visitor cookie
- Server-side session storage

### Cross-Domain & Iframes
- PostMessage API for communication
- Session ID passing via URL
- Redundant tracking (parent + direct API)
- Same-domain and cross-domain support

### Dashboard
- Projects management
- Real-time session tracking
- Conversion analytics
- Multi-touch attribution display
- API key management
- Installation code snippets

## Testing

Test page included at `/test-page.html` with:
- Session info display
- URL parameter detection
- Conversion tracking buttons
- Embedded iframe for cross-domain testing

## Deployment

### Deploy Backend

```bash
npx convex deploy
```

### Deploy Frontend

```bash
pnpm build
# Deploy dist/ folder to Vercel, Netlify, etc.
```

### Host Tracking Scripts

For iOS/Safari ITP compliance, serve tracker scripts from first-party domain (not third-party CDN).

## Support

For issues or questions:
1. Check browser console for errors
2. Review [QUICKSTART.md](./QUICKSTART.md) for setup steps
3. Check [IMPLEMENTATION.md](./IMPLEMENTATION.md) for technical details
4. Review inline code comments

## License

MIT
