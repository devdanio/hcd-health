# Journey Service Implementation - Complete! ✅

All core components have been successfully implemented. Here's what's ready:

## ✅ Completed Files

### 1. Identity Resolution Collection
**File:** `src/collections/identity-resolution.ts`

**Functions:**
- `resolveIdentity()` - Core identity matching (hch_uuid → email → phone → external ID → create new)
- `createContactForTracking()` - Creates anonymous contact, returns contact.id
- `validateHchUuid()` - Validates hch_uuid exists in database
- `attachExternalId()` - Links external system IDs (PostHog, GHL) to contacts

### 2. HCH Tracker (Rewritten from Scratch)
**File:** `public-components/tracker/index.ts`

**Features:**
- ✅ hch_uuid management (cookies + localStorage named "hch_uuid")
- ✅ Server validation of hch_uuid
- ✅ PostHog integration (calls `posthog.identify(hch_uuid)`)
- ✅ Exposes `window.HCH.getUuid()` for GHL iframe usage
- ✅ Visitor and session tracking
- ✅ Attribution data capture (UTM params + 7 click IDs)

### 3. Helper API Endpoints
**Files:**
- `src/routes/api.create-contact.ts` - Creates anonymous contact, returns contactId
- `src/routes/api.validate-hch-uuid.ts` - Validates hch_uuid exists

### 4. GHL Webhook Handler
**File:** `src/routes/api.webhooks.ghl.$companyId.ts`

**Features:**
- ✅ Dynamic routing with companyId (`/api/webhooks/ghl/:companyId`)
- ✅ Webhook signature verification (HMAC SHA-256)
- ✅ Contact create/update handling
- ✅ Appointment create handling
- ✅ Identity resolution (hchuuid → email → phone → create new)
- ✅ GHL contact ID storage in ExternalId table
- ✅ Event creation for tracking

---

## 📋 Next Steps: Testing & Deployment

### Step 1: Build the Tracker

```bash
# The tracker is TypeScript, you'll need to build it for production
cd public-components/tracker
# Add build script if needed, or build with your main build process
```

### Step 2: Environment Variables

Add to `.env.local`:
```bash
# GHL Webhook Secret (optional but recommended for security)
GHL_SECRET_TOKEN=your_webhook_secret_from_ghl

# Existing variables (already configured)
DATABASE_URL=postgresql://...
```

### Step 3: Test Tracker Locally

Create a test HTML page to test the tracker:

```html
<!-- test-tracker.html -->
<!DOCTYPE html>
<html>
<head>
  <title>HCH Tracker Test</title>
</head>
<body>
  <h1>HCH Tracker Test</h1>
  <div id="status"></div>

  <!-- Configure tracker -->
  <script>
    window.HCH_CONFIG = {
      apiKey: 'your-company-api-key',
      apiUrl: 'http://localhost:3000', // or your dev server
      autoTrack: true
    }
  </script>

  <!-- Load tracker -->
  <script src="/path/to/built/tracker.js"></script>

  <!-- Test access to hch_uuid -->
  <script>
    setTimeout(() => {
      const uuid = window.HCH?.getUuid()
      document.getElementById('status').innerHTML = `
        <p>HCH UUID: ${uuid}</p>
        <p>Visitor ID: ${window.HCH?.getVisitorId()}</p>
        <p>Session ID: ${window.HCH?.getSessionId()}</p>
      `
      console.log('HCH UUID:', uuid)
    }, 2000)
  </script>
</body>
</html>
```

**Expected Flow:**
1. Tracker initializes
2. Checks for `hch_uuid` cookie/localStorage
3. If not found: calls `/api/create-contact` → stores contact.id as hch_uuid
4. If found: validates with `/api/validate-hch-uuid`
5. Calls `posthog.identify(hch_uuid)`
6. Exposes `window.HCH.getUuid()`
7. Tracks initial page view

### Step 4: Test Identity Resolution

```bash
# Test via server functions (from a route or API endpoint)
import { resolveIdentity } from '@/collections/identity-resolution'

// Test 1: Create new contact
const result1 = await resolveIdentity({
  data: { companyId: 'your-company-id' }
})
console.log('New contact:', result1) // isNew: true

// Test 2: Find by email
const result2 = await resolveIdentity({
  data: {
    companyId: 'your-company-id',
    email: 'test@example.com'
  }
})
console.log('Found by email:', result2) // isNew: false

// Test 3: Find by hch_uuid
const result3 = await resolveIdentity({
  data: {
    companyId: 'your-company-id',
    hchUuid: 'contact-id-from-step-1'
  }
})
console.log('Found by hch_uuid:', result3) // isNew: false
```

### Step 5: Configure GHL Webhooks

For **each client** (company):

1. **Get Company ID** from your database
   ```sql
   SELECT id, name, apiKey FROM "Company";
   ```

2. **In GHL Dashboard:**
   - Go to: Settings → Integrations → Webhooks
   - Click: Create Webhook
   - **URL**: `https://yourdomain.com/api/webhooks/ghl/{companyId}`
     - Replace `{companyId}` with actual company ID
   - **Events**: Select:
     - ✅ Contact Create
     - ✅ Contact Update
     - ✅ Appointment Create
   - **Secret**: Copy the webhook secret
   - Add to `.env.local` as `GHL_SECRET_TOKEN`

3. **In GHL Forms/Funnels:**
   - Add **hidden field**: `hchuuid`
   - Map to **custom field**: `hchuuid`
   - In the iframe URL, manually append: `?hchuuid=` + value from `window.HCH.getUuid()`

   **Example:**
   ```html
   <iframe id="ghlForm" src="https://ghl.com/form"></iframe>
   <script>
     // Wait for HCH tracker to initialize
     setTimeout(() => {
       const uuid = window.HCH?.getUuid()
       if (uuid) {
         const iframe = document.getElementById('ghlForm')
         iframe.src = iframe.src + `?hchuuid=${uuid}`
       }
     }, 1000)
   </script>
   ```

### Step 6: Test GHL Webhook

Use GHL's webhook test feature or create a test contact:

1. **Create Test Contact in GHL:**
   - Include `hchuuid` custom field with a valid contact ID
   - Or leave empty to test new contact creation

2. **Check Logs:**
   ```bash
   # Your app logs should show:
   [GHL Webhook] Processing contact: ghl_contact_id
   [GHL Webhook] Extracted hchuuid: contact-id-or-undefined
   [GHL Webhook] Created/Updated contact: contact-id
   [GHL Webhook] Created ExternalId for GHL contact: ghl_contact_id
   [GHL Webhook] Contact processed successfully
   ```

3. **Verify Database:**
   ```sql
   -- Check ExternalId was created
   SELECT * FROM "ExternalId" WHERE source = 'GHL';

   -- Check Event was created
   SELECT * FROM "Event" WHERE type = 'custom_event' AND data->>'source' = 'ghl';
   ```

### Step 7: Test End-to-End Flow

**Full Journey:**
1. Visitor lands on website → Tracker creates hch_uuid
2. Visitor fills GHL form with hchuuid parameter → GHL stores in custom field
3. GHL webhook fires → Your server receives contact data
4. Identity resolved via hchuuid → GHL contact ID stored in ExternalId
5. Visitor books appointment → GHL webhook fires
6. Appointment created, linked to contact via GHL external ID

**Verify:**
```sql
-- Get a contact's full journey
SELECT
  c.id,
  c.email,
  c.phone,
  c."createdAt",
  (SELECT COUNT(*) FROM "ExternalId" WHERE "contactId" = c.id) as external_ids_count,
  (SELECT COUNT(*) FROM "Event" WHERE "contactId" = c.id) as events_count,
  (SELECT COUNT(*) FROM "Appointment" WHERE "contactId" = c.id) as appointments_count
FROM "Contact" c
WHERE c.id = 'your-test-hch-uuid';

-- See all external IDs for a contact
SELECT * FROM "ExternalId" WHERE "contactId" = 'your-test-hch-uuid';
```

---

## 🎯 Success Criteria Checklist

- [ ] Tracker creates hch_uuid correctly (check cookies + localStorage)
- [ ] Tracker validates hch_uuid with server
- [ ] PostHog identify() called with hch_uuid
- [ ] `window.HCH.getUuid()` exposed and accessible
- [ ] GHL webhooks process contact events (check logs)
- [ ] GHL webhooks process appointment events (check logs)
- [ ] GHL contact IDs stored in ExternalId table (check database)
- [ ] Identity resolution matches contacts by email/phone/hchuuid
- [ ] End-to-end test: Visitor → GHL form → Webhook → Identity resolved

---

## 🔧 Troubleshooting

### Tracker Not Initializing
- Check browser console for errors
- Verify `window.HCH_CONFIG` is set before tracker loads
- Check API key is valid

### hch_uuid Not Created
- Check `/api/create-contact` endpoint is accessible
- Check company API key is correct
- Check browser network tab for failed requests

### PostHog Not Identifying
- Verify PostHog is loaded before tracker
- Check `window.posthog` is available
- Look for console message: `[HCH Tracker] PostHog identified with hch_uuid:`

### GHL Webhook Failing
- Check webhook secret matches `.env.local`
- Check company ID in webhook URL is correct
- Check webhook signature verification (disable temporarily for testing)
- Check server logs for detailed error messages

### Identity Not Resolving
- Check `hchuuid` is being passed from GHL form
- Check `hchuuid` custom field is mapped correctly in GHL
- Check contact exists in database
- Check GHL contact ID is being stored in ExternalId table

---

## 📚 API Reference

### Tracker API

```typescript
// Initialize tracker
const tracker = new HCHTracker({
  apiKey: 'your-api-key',
  apiUrl: 'https://yourdomain.com',
  autoTrack: true // optional, default true
})

// Get hch_uuid
const uuid = tracker.getUuid() // or window.HCH.getUuid()

// Track custom event
tracker.track('button_clicked', { button: 'cta' })

// Identify user
tracker.identify('user@example.com', '+1234567890', { plan: 'pro' })

// Track page view
tracker.trackPageView('/custom-page')
```

### Identity Resolution API

```typescript
import { resolveIdentity, attachExternalId } from '@/collections/identity-resolution'

// Resolve identity
const result = await resolveIdentity({
  data: {
    companyId: 'company-id',
    hchUuid: 'contact-id', // optional
    email: 'user@example.com', // optional
    phone: '+1234567890', // optional
    externalId: 'external-system-id', // optional
    externalSource: 'POSTHOG', // optional
  }
})
// Returns: { contactId, isNew, contact }

// Attach external ID
const result = await attachExternalId({
  data: {
    contactId: 'contact-id',
    externalId: 'ghl-contact-id',
    source: 'GHL'
  }
})
// Returns: { success, conflict, externalId }
```

---

## 🚀 Production Deployment

1. **Build tracker** for production
2. **Set environment variables** on production server
3. **Deploy application**
4. **Configure GHL webhooks** with production URL
5. **Test with one client** first
6. **Monitor logs** for errors
7. **Roll out to remaining clients** gradually

---

## 📝 Notes

- **No database schema changes required** - Uses existing ExternalId table
- **Legacy files not modified** - `tracking.ts` and `api.track-event.ts` left as-is (you'll handle integration)
- **Manual iframe management** - You'll manually append `hchuuid` to GHL iframe URLs (no automatic injection)
- **PostHog kept** - PostHog identify() is called, but your system is the source of truth

---

Good luck with testing! Let me know if you encounter any issues. 🎉
