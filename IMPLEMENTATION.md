# High Country Health - Attribution Tracking Implementation

## Overview

We've built a complete attribution tracking system (like Hyros) with the following components:

1. **Backend** - Convex serverless backend with real-time database
2. **Tracking Scripts** - Client-side JavaScript for attribution capture
3. **Dashboard** - React UI for viewing sessions and conversions
4. **iOS Compatible** - First-party cookies with Safari ITP compliance
5. **Iframe Support** - Cross-domain tracking via postMessage API

---

## Architecture

### Data Model (Convex Schema)

**Projects** - Track different websites/campaigns
- `name`, `domain`, `apiKey`

**Visitors** - Long-lived visitor identity
- `visitorId` (1-year cookie), `firstSeen`, `lastSeen`

**Sessions** - User sessions with attribution data
- `sessionId`, `touchPoints[]` (all attribution data)
- `pageViews`, `duration`, `userAgent`, etc.

**TouchPoints** - Simplified attribution model
```javascript
{
  utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  fbclid, gclid, msclkid, ttclid, twclid, li_fat_id, ScCid,
  url, referrer, timestamp
}
```

**Events** - All tracked events (pageviews, custom events, conversions)
- `type` (pageview | event | conversion)
- `name`, `metadata`

**Conversions** - Conversion events with session linkage
- `eventName`, `revenue`, `metadata`
- Attribution derived from `session.touchPoints[]`
  - First touch: `touchPoints[0]`
  - Last touch: `touchPoints[touchPoints.length - 1]`

---

## Files Created

### Backend (Convex)

1. **`convex/schema.ts`** - Database schema with all tables
2. **`convex/projects.ts`** - Project management (create, list, update)
3. **`convex/tracking.ts`** - Event ingestion mutations and queries
4. **`convex/http.ts`** - HTTP endpoints for tracking API

### Tracking Scripts

1. **`public/tracker/tracker.js`** - Main tracking script for websites
2. **`public/tracker/iframe-tracker.js`** - Iframe-specific tracker
3. **`public/tracker/README.md`** - Complete documentation

### Dashboard UI

1. **`src/routes/index.tsx`** - Landing page
2. **`src/routes/projects/index.tsx`** - Projects list/create page
3. **`src/routes/projects/$projectId.tsx`** - Project dashboard with sessions and conversions
4. **`src/components/Header.tsx`** - Updated navigation

---

## Getting Started

### 1. Start Convex Backend

```bash
npx convex dev
```

This will:
- Deploy the schema and functions
- Give you a Convex URL (like `https://happy-cat-123.convex.cloud`)
- Watch for changes and auto-deploy

### 2. Start Development Server

```bash
pnpm dev
```

Access the dashboard at: `http://localhost:3000`

### 3. Create Your First Project

1. Go to **Projects** page
2. Click **Create Project**
3. Enter:
   - Project Name: "My Website"
   - Domain: "example.com"
4. Copy the generated API key

### 4. Install Tracking Script

On your website, add this to `<head>` or before `</body>`:

```html
<script
  src="http://localhost:3000/tracker/tracker.js"
  data-api-key="la_your_api_key_here"
  data-api-url="https://your-convex-url.convex.cloud"
></script>
```

Replace:
- `la_your_api_key_here` with your project's API key
- `https://your-convex-url.convex.cloud` with your Convex deployment URL

### 5. Test Attribution Tracking

Visit your website with UTM parameters:

```
http://yoursite.com?utm_source=facebook&utm_medium=cpc&fbclid=abc123
```

Check the dashboard - you should see:
- New session created
- Attribution data captured (utm_source: facebook, fbclid: abc123)

### 6. Track Conversions

In your website's JavaScript:

```javascript
// Simple conversion
trackConversion('signup')

// Conversion with revenue
trackConversion('purchase', {
  revenue: 99.99,
  metadata: {
    orderId: 'ORDER-12345',
    productId: 'PROD-456'
  }
})
```

---

## Iframe Tracking Setup

### Parent Page (Landing Page)

```html
<script
  src="/tracker/tracker.js"
  data-api-key="la_your_api_key"
  data-api-url="https://your-convex-url.convex.cloud"
></script>

<!-- Your iframe -->
<iframe src="https://forms.yoursite.com/contact"></iframe>
```

### Iframe Page (Form)

```html
<script src="/tracker/iframe-tracker.js"></script>

<form id="contactForm">
  <input type="email" name="email" required>
  <button type="submit">Submit</button>
</form>

<script>
  document.getElementById('contactForm').addEventListener('submit', async (e) => {
    e.preventDefault()

    // Wait for session data from parent
    await HCH.waitForReady()

    // Track conversion
    trackConversion('lead', {
      metadata: {
        email: e.target.email.value,
        formId: 'contact-form'
      }
    })

    // Submit form
    e.target.submit()
  })
</script>
```

---

## How It Works

### Session Flow

1. **User visits site** with UTM params and click IDs
2. **Tracker captures** all attribution data
3. **Creates/updates session** in Convex
4. **Adds touchpoint** to `session.touchPoints[]` array
5. **Tracks page views** as user navigates
6. **Session persists** for 30 minutes of inactivity

### Conversion Attribution

1. **User converts** (calls `trackConversion()`)
2. **Links to current session**
3. **Attribution calculated** from `session.touchPoints[]`:
   - First touch: `touchPoints[0]` (original source)
   - Last touch: `touchPoints[length-1]` (final source)
   - All touches: Full array for multi-touch attribution

### iOS/Safari Compliance

- **First-party cookies** (your domain)
- **7-day session cookie** (ITP compliant)
- **1-year visitor cookie** (for returning users)
- **Server-side session storage** (authoritative source)

### Cross-Domain/Iframe Communication

- **PostMessage API** for cross-origin communication
- **Parent → Iframe**: Sends session ID and API key
- **Iframe → Parent**: Reports conversions
- **Redundancy**: Iframe also sends directly to API

---

## API Endpoints

All endpoints are at: `https://your-convex-url.convex.cloud`

### POST `/trackSession`

Initialize or update a session.

**Body:**
```json
{
  "apiKey": "la_...",
  "visitorId": "uuid",
  "sessionId": "uuid",
  "touchPoint": {
    "utm_source": "facebook",
    "utm_medium": "cpc",
    "fbclid": "abc123",
    "url": "https://example.com",
    "referrer": "https://facebook.com",
    "timestamp": 1234567890
  },
  "userAgent": "...",
  "screenResolution": "1920x1080",
  "timezone": "America/New_York"
}
```

### POST `/trackPageView`

Track a page view.

**Body:**
```json
{
  "apiKey": "la_...",
  "sessionId": "uuid",
  "url": "https://example.com/page"
}
```

### POST `/trackEvent`

Track a custom event.

**Body:**
```json
{
  "apiKey": "la_...",
  "sessionId": "uuid",
  "eventName": "button_clicked",
  "metadata": { "buttonId": "cta-1" }
}
```

### POST `/trackConversion`

Track a conversion.

**Body:**
```json
{
  "apiKey": "la_...",
  "sessionId": "uuid",
  "eventName": "purchase",
  "revenue": 99.99,
  "metadata": {
    "orderId": "ORDER-12345",
    "productId": "PROD-456"
  }
}
```

---

## Dashboard Features

### Projects Page (`/projects`)

- List all tracking projects
- Create new projects
- View API keys
- Click project to see details

### Project Dashboard (`/projects/:projectId`)

**Stats Cards:**
- Total Sessions
- Total Conversions
- Conversion Rate

**Tracking Setup:**
- API key (with copy button)
- Installation code snippet

**Conversions Table:**
- Event name
- Revenue
- First touch source (from `touchPoints[0]`)
- Last touch source (from `touchPoints[last]`)
- Timestamp

**Sessions Table:**
- Session ID
- Source (UTM or referrer)
- Landing page
- Page views
- Duration
- Started timestamp

---

## Next Steps / Enhancements

### Phase 2 Features (Not Yet Implemented)

1. **Analytics Dashboard**
   - Charts for conversions over time
   - Source/medium breakdown
   - Funnel visualization
   - Revenue tracking

2. **Advanced Attribution Models**
   - Linear attribution
   - Time decay
   - Position-based
   - Custom models

3. **Segmentation**
   - Filter by source/medium/campaign
   - Date range selection
   - Custom dimensions

4. **Reporting**
   - Export to CSV
   - Scheduled reports
   - Email notifications

5. **Integration Features**
   - Facebook Conversions API
   - Google Analytics 4
   - Webhook support
   - Zapier integration

6. **User Management**
   - Authentication
   - Multiple users per project
   - Role-based access

7. **Advanced Tracking**
   - Server-side tracking
   - Mobile app SDKs
   - A/B test tracking
   - Cohort analysis

---

## Testing the System

### Test Scenario: Facebook Ad → Landing Page → Iframe Form → Conversion

1. **Create test project** in dashboard
2. **Set up test page** with tracker script
3. **Visit with Facebook params**:
   ```
   http://localhost:3000?utm_source=facebook&utm_medium=cpc&utm_campaign=summer_sale&fbclid=test123
   ```
4. **Check dashboard** - should see new session with:
   - utm_source: facebook
   - utm_medium: cpc
   - fbclid: test123

5. **Add iframe** to test page with iframe-tracker.js
6. **Submit form in iframe** with `trackConversion('lead')`
7. **Check dashboard** - should see conversion attributed to Facebook

### Debug Console

Open browser console to see tracking activity:

```javascript
// Check tracker status
console.log(window.HCH)

// Get session info
console.log(HCH.getSessionInfo())

// For iframe tracker, check if ready
console.log(HCH.isReady())
```

---

## Production Deployment

### 1. Deploy Convex

```bash
npx convex deploy
```

This gives you a production Convex URL.

### 2. Build and Deploy Frontend

```bash
pnpm build
```

Deploy the `dist/` folder to your hosting (Vercel, Netlify, etc.).

### 3. Host Tracker Scripts

The tracker scripts in `public/tracker/` need to be publicly accessible:

- Option 1: Serve from your main domain (`yoursite.com/tracker/tracker.js`)
- Option 2: Use a CDN (CloudFlare, Fastly)
- Option 3: Create subdomain (`track.yoursite.com/tracker.js`)

**Important**: For iOS/Safari ITP compliance, serve trackers from first-party domain (not a third-party CDN).

### 4. Update Installation Code

Use production URLs in your installation:

```html
<script
  src="https://yoursite.com/tracker/tracker.js"
  data-api-key="la_production_key"
  data-api-url="https://your-prod-convex.convex.cloud"
></script>
```

---

## Support

- **Documentation**: `/tracker/README.md`
- **Schema**: `convex/schema.ts`
- **API**: `convex/http.ts`, `convex/tracking.ts`
- **Dashboard**: `src/routes/projects/`

For questions or issues, refer to the inline code comments and console logs.
