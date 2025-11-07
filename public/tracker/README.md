# Leadalytics Attribution Tracker

JavaScript tracking scripts for attribution tracking and conversion analytics.

## Installation

### Main Website (Parent Page)

Add this script to your website's `<head>` or just before `</body>`:

```html
<script
  src="https://your-domain.com/tracker/tracker.js"
  data-api-key="la_your_api_key_here"
  data-api-url="https://your-convex-deployment.convex.cloud"
></script>
```

Replace:
- `your-domain.com` with where you host the tracker.js file
- `la_your_api_key_here` with your project's API key
- `your-convex-deployment.convex.cloud` with your Convex deployment URL

### Iframe (Embedded Forms/Content)

If you have forms or content in an iframe, add the iframe tracker:

```html
<script src="https://your-domain.com/tracker/iframe-tracker.js"></script>
```

## Usage

### Automatic Tracking

The tracker automatically captures:
- UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, etc.)
- Click IDs (`fbclid`, `gclid`, `msclkid`, etc.)
- Referrer information
- Page views (including SPA route changes)
- Session management

### Manual Event Tracking

Track custom events anywhere in your code:

```javascript
// Simple event
Leadalytics.trackEvent('button_clicked')

// Event with metadata
Leadalytics.trackEvent('video_watched', {
  videoId: '12345',
  duration: 120,
  completed: true
})
```

### Conversion Tracking

Track conversions (purchases, signups, leads, etc.):

```javascript
// Simple conversion
trackConversion('signup')

// Conversion with revenue
trackConversion('purchase', {
  revenue: 99.99,
  metadata: {
    orderId: 'ORDER-12345',
    productId: 'PROD-456',
    quantity: 2
  }
})

// Lead form submission
trackConversion('lead', {
  metadata: {
    formId: 'contact-form',
    email: 'user@example.com'
  }
})
```

### Iframe Conversion Tracking

From within an iframe:

```javascript
// Wait for session data from parent (optional but recommended)
await Leadalytics.waitForReady()

// Track conversion
trackConversion('form_submit', {
  metadata: {
    formId: 'embedded-form',
    leadType: 'demo-request'
  }
})
```

### Get Session Info

```javascript
const info = Leadalytics.getSessionInfo()
console.log(info)
// {
//   visitorId: "uuid-here",
//   sessionId: "uuid-here",
//   sessionStart: 1234567890
// }
```

## Attribution Flow Example

**Scenario**: User clicks Facebook ad → Landing page → Iframe form → Conversion

1. **User clicks Facebook ad** with `fbclid=abc123`
   ```
   https://yoursite.com/landing?fbclid=abc123&utm_source=facebook&utm_medium=cpc
   ```

2. **Landing page loads** with main tracker
   ```html
   <script src="tracker.js" data-api-key="..." data-api-url="..."></script>
   ```
   - Captures `fbclid`, `utm_source`, `utm_medium`
   - Creates visitor ID and session
   - Stores touchpoint with attribution data

3. **Landing page has iframe form**
   ```html
   <iframe src="https://forms.yoursite.com/contact"></iframe>
   ```

4. **Iframe loads** with iframe tracker
   ```html
   <script src="iframe-tracker.js"></script>
   ```
   - Requests session data from parent via postMessage
   - Receives session ID and visitor ID

5. **User submits form in iframe**
   ```javascript
   trackConversion('lead', {
     metadata: { formId: 'contact', email: 'user@example.com' }
   })
   ```
   - Conversion linked to session
   - Attribution traced back to `fbclid=abc123`

## iOS/Safari Compatibility

The tracker is designed for iOS Safari ITP (Intelligent Tracking Prevention) compliance:

- Uses **first-party cookies** (domain of your website)
- Session cookies expire in 7 days (ITP compliant)
- Visitor cookies expire in 1 year
- Server-side session storage for authoritative data
- No third-party tracking domains

## Cross-Domain Tracking

For tracking across multiple domains (e.g., landing page → checkout):

1. Pass session ID via URL parameter:
   ```javascript
   const sessionInfo = Leadalytics.getSessionInfo()
   const checkoutUrl = `https://checkout.com/cart?_la_sid=${sessionInfo.sessionId}`
   ```

2. On destination page, initialize with session ID (feature to be added).

## Security & Privacy

- API key required for all tracking requests
- CORS-enabled for cross-domain iframes
- No PII captured automatically
- GDPR/CCPA compliant (with proper consent implementation)
- First-party cookies only

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari (macOS): ✅ Full support
- Safari (iOS): ✅ Full support with ITP compliance
- Opera/Brave: ✅ Full support

## Example: Complete Implementation

### Landing Page HTML
```html
<!DOCTYPE html>
<html>
<head>
  <title>My Landing Page</title>
  <!-- Leadalytics Tracker -->
  <script
    src="/tracker/tracker.js"
    data-api-key="la_abc123..."
    data-api-url="https://your-app.convex.cloud"
  ></script>
</head>
<body>
  <h1>Special Offer!</h1>
  <iframe src="/form.html" width="500" height="400"></iframe>
</body>
</html>
```

### Iframe Form HTML
```html
<!DOCTYPE html>
<html>
<head>
  <title>Contact Form</title>
  <!-- Leadalytics Iframe Tracker -->
  <script src="/tracker/iframe-tracker.js"></script>
</head>
<body>
  <form id="contactForm">
    <input type="email" name="email" required>
    <input type="text" name="name" required>
    <button type="submit">Submit</button>
  </form>

  <script>
    document.getElementById('contactForm').addEventListener('submit', async (e) => {
      e.preventDefault()

      // Wait for session data
      await Leadalytics.waitForReady()

      // Track conversion
      trackConversion('lead', {
        metadata: {
          email: e.target.email.value,
          name: e.target.name.value
        }
      })

      // Submit form
      e.target.submit()
    })
  </script>
</body>
</html>
```

## Debugging

Check console for debug messages:

```javascript
// Check if tracker is loaded
console.log(window.Leadalytics)

// Get session info
console.log(Leadalytics.getSessionInfo())

// For iframe tracker, check if ready
console.log(Leadalytics.isReady())
```

## Support

For issues or questions, contact your development team.
