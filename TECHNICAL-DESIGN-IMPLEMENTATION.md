# Technical Design Implementation — Healthcare Revenue Intelligence (MVP)
**Date:** Feb 4, 2026  
**Scope:** MVP per `HEALTHCARE-REVENUE-INTELLIGENCE-MVP-SPEC-2026-02-04.md`

## 1) Summary
Build a lightweight multi-tenant SaaS that ingests lead events + Google Ads spend, dedupes by phone, tracks lead→patient conversion, and reports ROI by platform/campaign/location. The current repo is a TanStack Start + Prisma shell; this design outlines the concrete implementation plan.

## 2) Architecture (MVP)
**Runtime:** TanStack Start (SSR via Nitro)  
**DB:** PostgreSQL + Prisma  
**API:** Route-based API handlers in `src/routes/api.*.ts`  
**Jobs:** Server-side scheduled job (cron or external runner) for Google Ads daily sync  
**UI:** TanStack Router pages + TanStack Query + Shadcn UI + Tailwind v4

**Core flows**
1) **Ingest** (events/calls/forms) → normalize + upsert lead → write lead_event  
2) **Sync** (Google Ads daily) → upsert campaigns + ad_spend_daily  
3) **Front desk** → update lead status + patient value  
4) **Reporting** → KPI + campaign table + drilldowns

## 3) Data Model (Prisma)
> **Naming rule:** plural, lowercase, snake_case model names.

### Core tables
**organizations**
- `id` (cuid, pk)
- `name`
- `created_at`, `updated_at`

**locations**
- `id` (cuid, pk)
- `organization_id` (fk)
- `name`
- `created_at`, `updated_at`

**users** (MVP can be minimal or stubbed)
- `id` (cuid, pk)
- `organization_id` (fk)
- `email`
- `created_at`, `updated_at`

**leads**
- `id` (cuid, pk)
- `organization_id` (fk)
- `phone` (string, required; digits-only, optional leading country code)
- `name` (nullable)
- `status` (enum: `new | patient | not_patient`)
- `qualified` (boolean)
- `first_event_at`, `last_event_at`
- **first-event attribution snapshot**: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `campaign_id`, `platform`, `referrer`, `landing_page`
- `created_at`, `updated_at`
**Unique index:** `(organization_id, phone)`

> **Location rule:** Leads belong to an organization and are **displayed under a campaign** based on **first-event attribution** (`campaign_id`). Campaigns are mapped to locations via `campaign_settings`.

**lead_events**
- `id` (cuid, pk)
- `organization_id` (fk)
- `lead_id` (fk, nullable if quarantine)
- `event_type` (enum: `form | chat | booking | call | import`)
- `occurred_at`
- `phone`
- `utm_*`, `gclid`, `campaign_id`, `platform`, `referrer`, `landing_page`
- `qualified` (boolean)
- `raw_payload` (jsonb)
- `created_at`
**Index:** `(lead_id, occurred_at)`

**patient_values**
- `id` (cuid, pk)
- `lead_id` (fk, unique)
- `model` (enum: `ltv | projection`)
- `ltv` (decimal, nullable)
- `cash_collected_to_date` (decimal, nullable)
- `account_balance` (decimal, nullable)
- `expected_collection_rate` (decimal, nullable; stored snapshot)
- `projected_cash` (decimal, nullable)
- `created_at`, `updated_at`

**campaigns** (synced from Google Ads)
- `id` (cuid, pk)
- `organization_id` (fk)
- `campaign_id` (string)
- `campaign_name`
- `status` (enum: `enabled | paused | removed`)
- `last_synced_at`
**Unique index:** `(organization_id, campaign_id)`

**campaign_settings**
- `id` (cuid, pk)
- `organization_id` (fk)
- `campaign_id` (string)
- `location_id` (fk, nullable)
- `include_in_reporting` (boolean, default true)
- `campaign_category` (enum: `branded | non_branded | other`, nullable)
**Unique index:** `(organization_id, campaign_id)`

**ad_spend_daily**
- `id` (cuid, pk)
- `organization_id` (fk)
- `date` (date)
- `campaign_id` (string)
- `campaign_name`
- `cost_micros` (bigint)
- `currency_code`
- `created_at`
**Unique index:** `(organization_id, campaign_id, date)`

### Optional (MVP but recommended)
**organization_api_keys**
- `id` (cuid, pk)
- `organization_id` (fk)
- `key_hash`
- `label`, `last_used_at`

## 4) Ingestion API
Single ingestion endpoint with event type to reduce integration effort.

**POST** `api.ingest.events.ts`
```json
{
  "organization_id": "org_...",
  "event_type": "form|chat|booking|call|import",
  "occurred_at": "2026-02-04T12:34:56Z",
  "phone": "+13035551212",
  "name": "Jane Doe",
  "utm_source": "...",
  "utm_medium": "...",
  "utm_campaign": "...",
  "utm_content": "...",
  "utm_term": "...",
  "gclid": "...",
  "campaign_id": "1234567890",
  "platform": "google|meta|unknown",
  "referrer": "https://example.com/",
  "landing_page": "https://example.com/landing",
  "call": { "duration_sec": 90 }
}
```

**Validation**
- Sanitize phone to **digits-only** with optional leading country code (no spaces or special chars).
- Reject/quarantine invalid numbers (still store raw_payload).
- `campaign_id` stored as string; validate digits-only when present.
- `occurred_at` required; default to server time if omitted.

**Dedupe & lead upsert**
- `lead = upsert(organization_id + phone)`
- Append `lead_event`
- Update `leads.last_event_at`
- **Lead created:** on first event ingested (any event type)
- Update `leads.qualified`:
  - Call: `duration_sec >= org.threshold` (default 60)
  - Form/chat/booking: true

## 5) Attribution Rules (MVP)
**Model:** **first-touch at lead creation** (use attribution from the first event that creates the lead)  
**Prefer:** `gclid` when present  
**Fallback:** `utm_*` or `campaign_id`  
**Storage:** every event stores full attribution; `leads` stores **first-event attribution snapshot**

**Re-attribution logic**
- None for MVP; preserve first attribution to keep campaign assignment stable

## 6) Google Ads Spend Sync
**Job:** daily sync (00:30 org-local time)  
**Inputs:** org Google Ads connection (customer_id + credentials)

**Steps**
1) Fetch campaigns (id, name, status)
2) Upsert `campaigns`
3) Fetch daily spend for date range
4) Upsert `ad_spend_daily`

**Credentials (env)**
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (optional)

## 7) UI Routes (TanStack Start)
**Dashboard**
- `src/routes/index.tsx` (KPI + campaign table)
- Filters: date range, location, platform, campaign, include_excluded toggle

**Leads**
- `src/routes/leads.tsx` (inbox)
- `src/routes/leads.$leadId.tsx` (detail)

**Settings**
- `src/routes/settings.campaigns.tsx` (campaign mapping)
- `src/routes/settings.org.tsx` (qualified threshold, revenue model)

## 8) Reporting Queries (MVP)
**KPI aggregations**
- Spend: `SUM(ad_spend_daily.cost_micros)`
- Leads: `COUNT(leads where first_event_at in range)`
- Qualified: `COUNT(leads where qualified=true)`
- Patients: `COUNT(leads where status=patient)`
- Revenue:
  - Model A: sum(`patient_values.ltv` or `cash_collected_to_date`)
  - Model B: sum(`projected_cash`) + sum(`cash_collected_to_date`)
**ROI:** `(revenue - spend) / spend`

**Campaign table**
- Join `campaigns` + `campaign_settings` + `ad_spend_daily`
- Join leads by `campaign_id` (string)
- Fallback: `utm_campaign` (optional, off by default)

## 9) Implementation Plan (Phased)
**Phase 1 — Foundation**
- Create Prisma models + migrations
- Add `src/db.ts` client + seed org/location
- Add env validation in `src/env.ts`

**Phase 2 — Ingestion**
- Implement `api.ingest.events.ts`
- Phone normalization helper
- Attribution + lead upsert logic

**Phase 3 — Google Ads Sync**
- Add minimal sync job runner
- Implement campaigns + spend upsert

**Phase 4 — Front Desk UI**
- Leads inbox + lead detail
- Patient value entry

**Phase 5 — Dashboard**
- KPI cards + campaign table
- Drilldown to lead list

## 10) Decisions (Confirmed)
1) **Default revenue model:** LTV (Model A)  
2) **Lead creation:** first event ingested (any event type)  
3) **Location mapping:** campaign → location; leads display under campaign from first-event attribution  

## 11) Open Decisions (Confirm before build)
None for MVP.

## 12) Ingestion Auth (Confirmed)
Use **organization API keys** for ingestion.  
- Generate a single API key per org (rotatable)  
- Store `key_hash` only (never store raw key)  
- Require `Authorization: Bearer <api_key>` for ingestion endpoints

---
If this looks right, I’ll start implementation with Phase 1 (Prisma schema + envs) and wire the ingestion endpoint next.
