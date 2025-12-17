# High Country Health - Quick Start Guide

Get up and running with attribution tracking in 5 minutes.

## Prerequisites

- Node.js installed
- pnpm installed (`npm install -g pnpm`)
- A Convex account (free at https://convex.dev)

## Step 1: Install Dependencies

```bash
pnpm install
```

## Step 2: Set Up Convex

### Initialize Convex

```bash
npx convex dev
```

This will:
1. Ask you to log in to Convex (or create account)
2. Create a new Convex project
3. Deploy your schema and functions
4. Give you a deployment URL like: `https://happy-cat-123.convex.cloud`
5. Create a `.env.local` file with environment variables

**Keep this terminal running** - it watches for changes and auto-deploys.

## Step 3: Start Development Server

Open a **new terminal** and run:

```bash
pnpm dev
```

Access the dashboard at: **http://localhost:3000**

## Step 4: Create Your First Project

1. Go to **http://localhost:3000**
2. Click **"View Projects"**
3. Click **"Create Project"**
4. Enter:
   - **Name**: Test Project
   - **Domain**: localhost
5. Click **"Create"**
6. **Copy the API key** (starts with `la_...`)

## Step 5: Update Test Page

Edit `public/test-page.html` and replace these values:

```html
<script
  src="/tracker/tracker.js"
  data-api-key="REPLACE_WITH_YOUR_API_KEY"
  data-api-url="REPLACE_WITH_YOUR_CONVEX_URL"
></script>
```

Replace:
- `REPLACE_WITH_YOUR_API_KEY` with the API key you copied
- `REPLACE_WITH_YOUR_CONVEX_URL` with your Convex URL (from step 2)

**Example:**
```html
<script
  src="/tracker/tracker.js"
  data-api-key="la_abc123xyz456..."
  data-api-url="https://happy-cat-123.convex.cloud"
></script>
```

## Step 6: Test Attribution Tracking

### Test 1: Basic Session Tracking

Visit the test page **with UTM parameters**:

```
http://localhost:3000/test-page.html?utm_source=facebook&utm_medium=cpc&utm_campaign=summer_sale&fbclid=abc123test
```

**Expected Results:**
1. Open browser console (F12 → Console)
2. You should see: "🎯 High Country Health Test Page"
3. Session info should display with visitor ID and session ID
4. URL parameters should show Facebook attribution

**Verify in Dashboard:**
1. Go to **http://localhost:3000/projects**
2. Click your project
3. Scroll to "Recent Sessions"
4. You should see a new session with:
   - Source: facebook
   - Medium: cpc
   - Campaign: summer_sale
   - fbclid: abc123test

### Test 2: Conversion Tracking

On the test page, click:

1. **"Track Conversion (No Revenue)"** button
2. Check the event log on the page
3. Check browser console for confirmation

**Verify in Dashboard:**
1. Refresh the project page
2. Scroll to "Recent Conversions"
3. You should see your conversion:
   - Event: test_signup
   - First Touch Source: facebook
   - Last Touch Source: facebook

### Test 3: Conversion with Revenue

Click **"Track Conversion (With Revenue)"** button

**Verify in Dashboard:**
- Look for conversion with Revenue: $99.99
- Event name: test_purchase

### Test 4: Iframe Tracking

The test page already has an iframe embedded. Look for the form titled **"Test Form in Iframe"**.

1. Fill out the form (name, email, message)
2. Click **"Submit Form"**
3. You should see: "✅ Form submitted! Conversion tracked"

**Verify in Dashboard:**
- Look for conversion: lead_form_submit
- Should be linked to same session as the page visit

## Step 7: Test Multiple Touch Points

To see multi-touch attribution in action:

### Visit 1: Google Ads
```
http://localhost:3000/test-page.html?utm_source=google&utm_medium=cpc&gclid=google123
```

### Visit 2: Facebook Retargeting (Same Session)
Within 30 minutes, visit:
```
http://localhost:3000/test-page.html?utm_source=facebook&utm_medium=retargeting&fbclid=fb456
```

### Visit 3: Convert
Click "Track Conversion (With Revenue)"

**Verify in Dashboard:**
Your conversion should show:
- **First Touch**: google (original source)
- **Last Touch**: facebook (conversion source)

The session will have multiple touchpoints in the array.

## Troubleshooting

### "Tracker not initialized" Error

**Problem**: Tracker script didn't load or configure properly.

**Solutions:**
1. Check that you replaced `REPLACE_WITH_YOUR_API_KEY` and `REPLACE_WITH_YOUR_CONVEX_URL`
2. Check browser console for errors
3. Make sure Convex dev server is running (`npx convex dev`)
4. Verify your API key is correct (go to dashboard → projects)

### "Invalid API key" Error

**Problem**: API key doesn't match any project.

**Solutions:**
1. Copy the API key again from the dashboard
2. Make sure you're using the key from the correct project
3. Check for typos or extra spaces

### No Sessions Appearing in Dashboard

**Problem**: Tracking data not reaching Convex.

**Solutions:**
1. Open browser console and look for errors
2. Check that Convex URL is correct
3. Make sure you visited with UTM parameters (required for initial touchpoint)
4. Check Network tab (F12 → Network) for failed requests

### Iframe Not Connecting

**Problem**: Iframe shows "Could not connect to parent tracker"

**Solutions:**
1. Make sure parent page has tracker.js installed (not iframe-tracker.js)
2. Check that both pages are served from same origin (both localhost:3000)
3. Look for console errors in both parent and iframe

### CORS Errors

**Problem**: Cross-origin errors in console.

**Solutions:**
1. Make sure all files are served from localhost:3000 (not file://)
2. Check that Convex HTTP endpoints are working (`convex/http.ts`)
3. Restart dev server

## Understanding the Data Model

### Visitor
- Long-lived identity (1 year)
- Tied to first-party cookie
- Can have multiple sessions

### Session
- 30-minute timeout
- Contains array of **touchPoints**
- Each touchpoint has: UTM params, click IDs, URL, referrer, timestamp

### Touch Points
All attribution data is stored in the `touchPoints` array:

```javascript
session.touchPoints = [
  {
    utm_source: "google",
    gclid: "google123",
    url: "https://example.com",
    timestamp: 1234567890
  },
  {
    utm_source: "facebook",
    fbclid: "fb456",
    url: "https://example.com/page2",
    timestamp: 1234567920
  }
]
```

**Attribution:**
- First touch: `touchPoints[0]`
- Last touch: `touchPoints[touchPoints.length - 1]`
- All touches: Loop through entire array

### Events
- Linked to a session
- Types: pageview, event, conversion
- Custom metadata supported

### Conversions
- Special type of event
- Can have revenue
- Attribution derived from session's touchPoints

## Next Steps

1. **Integrate on Your Website**
   - Copy tracker script to your website
   - Replace localhost:3000 with your actual domain
   - Update API key and Convex URL

2. **Test Real Campaigns**
   - Run actual Facebook/Google ads
   - Use real UTM parameters
   - Track real conversions

3. **Build Analytics**
   - Create charts for conversions over time
   - Add source/medium breakdown
   - Build custom reports

4. **Deploy to Production**
   - Run `npx convex deploy` for production Convex
   - Deploy dashboard to Vercel/Netlify
   - Update all URLs to production

## Documentation

- **Tracking Scripts**: `public/tracker/README.md`
- **Implementation Details**: `IMPLEMENTATION.md`
- **Schema**: `convex/schema.ts`
- **API Endpoints**: `convex/http.ts`

## Support

If you encounter issues:

1. Check browser console for errors
2. Check Convex dashboard for function logs
3. Verify API keys and URLs are correct
4. Review the test-page.html source code for examples

Happy tracking! 🎯
