# HCH Identity Tracker - Simple Setup Guide

## What This Script Does

**ONE JOB: Ensure every visitor has an `hch_uuid`**

1. ✅ Creates `hch_uuid` (Contact.id) for new visitors
2. ✅ Stores in cookies + localStorage
3. ✅ Identifies user in PostHog: `posthog.identify(hch_uuid)`
4. ✅ Exposes `window.HCH.getUuid()` for GHL iframes

**What it DOESN'T do:**
- ❌ Event tracking (PostHog does this)
- ❌ Page view tracking (PostHog does this)
- ❌ Session tracking (PostHog does this)
- ❌ Analytics (PostHog does this)

PostHog handles ALL tracking and analytics using the `hch_uuid` as the identity.

---

## Setup (3 Steps)

### Step 1: Build Tracker

```bash
# From root directory
pnpm build

# Or just the tracker
cd public-components/tracker
npm install
npm run build
```

Output: `/public/tracker.js`

---

### Step 2: Get API Key

```sql
SELECT id, name, apiKey FROM "Company";
```

Copy the `apiKey` for your client.

---

### Step 3: Add to Client Website

Add to `<head>` of client's website:

```html
<!-- 1. Configure (with your client's API key) -->
<script>
  window.HCH_CONFIG = {
    apiKey: 'clxxxxx...', // From database
    apiUrl: 'https://yourdomain.com' // Your app URL
  }
</script>

<!-- 2. PostHog (BEFORE tracker) -->
<script>
  !function(t,e){/* PostHog snippet */}
  posthog.init('YOUR_POSTHOG_KEY', {api_host: 'https://us.i.posthog.com'})
</script>

<!-- 3. HCH Tracker (AFTER PostHog) -->
<script src="https://yourdomain.com/tracker.js"></script>
```

**Done!** 🎉

---

## What Happens

```
Visitor lands → Check for hch_uuid → Not found?
  ↓
  Call /api/create-contact
  ↓
  Get contact.id
  ↓
  Store as hch_uuid (cookie + localStorage)
  ↓
  posthog.identify(hch_uuid)
  ↓
  Expose window.HCH.getUuid()

PostHog now tracks everything with hch_uuid ✅
```

---

## Using hch_uuid for GHL

```html
<iframe id="ghlForm" src="https://ghl.com/form/ABC123"></iframe>

<script>
  setTimeout(() => {
    const uuid = window.HCH?.getUuid()
    if (uuid) {
      document.getElementById('ghlForm').src += '?hchuuid=' + uuid
    }
  }, 2000)
</script>
```

**In GHL form:**
- Hidden field: `hchuuid`
- Maps to custom field: `hchuuid`

---

## Testing

### Quick Test

```javascript
// Open browser console
console.log(window.HCH.getUuid()) // Should return: clxxxxx...
console.log(window.posthog.get_distinct_id()) // Should match above
```

### Full Test

Visit: `http://localhost:3000/tracker-test.html`

**Expected:**
- ✅ Shows hch_uuid (looks like: `clxxxxx...`)
- ✅ Cookie set: `hch_uuid=clxxxxx...`
- ✅ localStorage set: `hch_uuid=clxxxxx...`
- ✅ PostHog distinct_id matches hch_uuid
- ✅ Console: `[HCH] Initialized with uuid: clxxxxx...`
- ✅ Console: `[HCH] PostHog identified with uuid: clxxxxx...`

---

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <!-- 1. Configure tracker -->
  <script>
    window.HCH_CONFIG = {
      apiKey: 'clabcdef1234567890',
      apiUrl: 'https://yourdomain.com'
    }
  </script>

  <!-- 2. PostHog -->
  <script>
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('phc_YOUR_KEY_HERE', {api_host: 'https://us.i.posthog.com'})
  </script>

  <!-- 3. HCH Tracker -->
  <script src="https://yourdomain.com/tracker.js"></script>
</head>
<body>
  <h1>Your Website</h1>

  <!-- GHL Form with hch_uuid -->
  <iframe id="ghlForm" src="https://ghl.com/form/ABC123"></iframe>
  <script>
    setTimeout(() => {
      const uuid = window.HCH?.getUuid()
      if (uuid) {
        document.getElementById('ghlForm').src += '?hchuuid=' + uuid
      }
    }, 2000)
  </script>
</body>
</html>
```

---

## Troubleshooting

### PostHog Not Identifying

**Problem:** PostHog distinct_id doesn't match hch_uuid

**Check order:**
```html
<!-- CORRECT -->
<script>window.HCH_CONFIG = {...}</script>
<script>/* PostHog */</script> ← FIRST
<script src="/tracker.js"></script> ← SECOND

<!-- WRONG -->
<script>window.HCH_CONFIG = {...}</script>
<script src="/tracker.js"></script> ← BAD ORDER
<script>/* PostHog */</script> ← BAD ORDER
```

**Fix:** PostHog MUST load before tracker

---

### hch_uuid Not Created

**Check:**
1. API key valid?
2. App running?
3. Browser console errors?
4. Network tab: `/api/create-contact` returns 200?

**Debug:**
```javascript
// Wait 3 seconds, then check
setTimeout(() => {
  console.log('UUID:', window.HCH?.getUuid())
  console.log('Cookie:', document.cookie.includes('hch_uuid'))
  console.log('localStorage:', localStorage.getItem('hch_uuid'))
}, 3000)
```

---

### window.HCH Not Available

**Cause:** Tracker not loaded or failed to initialize

**Check:**
1. Does `/tracker.js` exist? (Run `pnpm build`)
2. Browser console errors?
3. Script tag correct?

---

## Summary

**3 scripts in `<head>`:**
1. Config (with API key)
2. PostHog (BEFORE tracker)
3. Tracker (AFTER PostHog)

**Result:**
- Every visitor gets `hch_uuid`
- PostHog tracks everything with `hch_uuid`
- You can access `hch_uuid` via `window.HCH.getUuid()`
- Pass to GHL iframes as `?hchuuid=VALUE`

**That's it!** PostHog does all the analytics. 🎉
