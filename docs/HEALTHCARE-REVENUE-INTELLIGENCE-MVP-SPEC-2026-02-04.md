# Healthcare Revenue Intelligence SaaS (MVP) — Product Spec (Feb 4, 2026)

## Problem statement
Healthcare practices spend on Google/Meta but lack a simple, trustworthy way to see:
Spend (by platform + campaign + location) → Leads → Patients → Revenue (cash + projected) → ROI.

## MVP goal
Ship a bare-bones system that:
1) Ingests lead events with attribution (UTMs + gclid + campaign_id)
2) Lets front desk mark lead → patient and enter value
3) Pulls Google Ads spend by campaign
4) Produces a simple dashboard (platform/campaign/location ROI)

Non-goals (MVP): EHR integrations, multi-touch attribution, native call tracking, HIPAA/BAA readiness (acknowledged as near-future).

## Sources & data flow (recommended)
- Website events (form/chat/booking) → RudderStack → **Your SaaS ingestion API** (+ optionally also BigQuery)
- Calls (CallRail/CRM) → webhook/CSV → **Your SaaS ingestion API**
- Google Ads spend → Google Ads API daily pull → Your DB

Why not BigQuery as the operational dependency: multi-tenant access + schema drift + auth per customer adds major complexity. Keep BigQuery as an optional “warehouse copy” later.

## Identity + dedupe (MVP simplification)
Assumption: phone is always present for form fills, bookings, and chats; calls include caller number.
- Canonical lead key: `organization_id + phone_e164`
- Multiple events attach to the same lead (timeline)
- Attribution uses a lookback window (e.g., 30 days); dedupe can be “forever”

### Phone normalization rules
- Store phone as E.164 (e.g., +1XXXXXXXXXX)
- Reject or quarantine invalid numbers (still store raw payload for debugging)

## Attribution model (deterministic)
Default: last-touch, non-direct within lookback at time of lead conversion (or lead creation, if you treat “first event creates lead”).
- Always store full UTM set: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- Prefer `gclid` when present (source of truth for Google Ads)
- Also store `campaign_id` from event payload

### campaign_id type (why it matters)
Google Ads “campaign id” is numeric, but store it as **string/text**:
- avoids 53-bit integer issues in JS/TS and some analytics tools
- matches Google Ads API patterns (IDs and resource names are often strings)
- still supports reliable joins (string-to-string)
Validation: ensure it’s digits-only where expected.

## Campaign settings (location mapping + reporting inclusion)
You want settings so you can:
1) Assign campaign → location
2) Exclude campaigns from reporting (e.g., branded)

### MVP rules
- Campaign belongs to **exactly one** location (MVP constraint)
  - If a campaign truly spans locations, set it to “Unassigned/Shared” and show it only in org-wide reporting (or require them to split campaigns in Google Ads)
- Each campaign has `include_in_reporting` boolean (default true)
  - Excluded campaigns are still ingested and visible in settings; dashboards default to hiding them
- Optional tag: `campaign_category` = `branded | non_branded | other` (MVP can be manual; later can be auto-suggested by name contains “brand”)

### Settings UI (one screen)
Table of Google Ads campaigns (synced daily):
- Campaign (name)
- Status (enabled/paused) from Google Ads
- Location (dropdown)
- Include in reporting (toggle)
- Category (optional dropdown)
- Last spend / last 7d spend (optional columns; helps mapping)

## Qualified leads (MVP)
- Calls: qualified if `duration_sec >= threshold` (default 60; configurable per org)
- Forms/bookings/chats: qualified = true by default (can add manual unqualify later)

## Front desk workflow (MVP)
**Leads Inbox**
- Filters: location, status, date range, platform/campaign, qualified only
- Rows: lead (phone/name), last activity, source/campaign, qualified, status

**Lead detail**
- Timeline of events (form/chat/booking/call) with attribution details (UTMs, gclid, campaign_id)
- Buttons:
  - Mark as Patient
  - Mark as Not a Patient
- Patient value entry (choose one model below)

## Patient value model (pick 1 default for MVP)
Support both, but push one as the default “happy path” to reduce confusion:
- Model A (simplest): enter `LTV` (single number) + optional `cash_collected_to_date`
- Model B (insurance projection): enter `account_balance` (billed) and apply org-level `expected_collection_rate` to compute `projected_cash`

MVP reporting should show:
- Actual cash collected
- Projected cash (if Model B in use) OR LTV (if Model A in use)
- ROI using the selected revenue basis (toggle: Actual vs Projected/LTV)

## Google Ads spend ingestion (MVP)
Daily sync:
- by date + campaign_id + campaign_name + cost
- store Google Ads `customer_id` per org connection
Join to leads:
- primary join: `campaign_id` (string)
- fallback join (only if needed): `utm_campaign` campaign name (breaks on renames)

## Dashboards (MVP)
Filters: date range, location, platform, campaign, include/excluded toggle (default excluded OFF).
KPI cards:
- Spend
- Leads
- Qualified leads
- Patients
- Revenue (cash, projected/LTV)
- ROI = (revenue - spend) / spend
Campaign table:
- Spend, Leads, Patients, Revenue, ROI
- Drilldown: campaign → lead list

## Data model (minimal)
- organization, location, user
- lead (phone_e164 required; attribution snapshot fields)
- lead_event (raw_payload + normalized fields)
- patient_value (per lead; cash + projected/LTV)
- ad_spend_daily (google only)
- campaign_settings (campaign_id → location_id, include_in_reporting, category)

## Key edge cases (handled by product rules)
- Leads without spend (organic/direct): show as “Unknown/Direct” and still count leads/patients
- Spend without leads: show campaign spend with 0 leads/patients (important for accountability)
- Duplicate leads: same phone across multiple events is expected; show timeline
- Re-attribution: if later event has gclid within lookback, update “current attribution” but keep event history
- Refunds/write-offs: allow negative cash adjustments (simple “cash adjustments” list later; MVP can be a single number field)

## Open decisions to finalize (before building UI)
1) Location assignment rule when a phone appears across locations (latest wins vs manual reassignment vs “shared lead”)
2) Whether “Lead created” occurs on first event, or only on certain event types (booking/form)
3) Default revenue model (LTV vs projected cash) and whether to allow both in the same org
