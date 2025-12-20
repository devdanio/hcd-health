## The KPIs that matter for all clients

- Website visitors
- Leads (from GHL)
- Appointments
- Revenue
- Adspend

## LLM

Good convo: https://claude.ai/chat/f0693212-6f56-430b-89d3-7fcd817e54ef

## EHRS

### UNIFIED PRACTICE

1. Export from here https://ehr.unifiedpractice.com/Public/app/#/reports/clinic-activity-details-report
2. Select "Practicioner details"
3. Select the provider
4. Export
5. Upload: $ node data-scripts/integrations/unified-practice/upload-apts-from-xlsx.ts

## FACEBOOK

To get access token: https://developers.facebook.com/tools/explorer/839548005120095/

## TODOS

For all agg\_ tables we are going to run cron jobs that periodically update the database. We can eventually add manual interaction to regernnate the data

## Tracking script

new HCHTracker({ apiKey:'756e492d359a44b5c86c28eaff272d599043d14a1de8dcc476f49acf0b6b6058', apiUrl:'http://localhost:3000' })

## DEPRECTATED SEE EDCGECASESE BELOW

- High Country Health is the singular source of truth
- New contact created in GHL sends a webhook req to /api/$locationID/ghl-event = stores the raw payload w/ attributation data
  - upserts into Contact using Contact.ExternalId. ExternalId.source = ExternalIdSource.GHL

- Posthog will identify with custom Thrive chat widget and Shopify
- EHRs will upsert contacts based upon phone/email

EDGECASES

- When contacts come from Thrive chat or Shopify we are missing attribution data. BUT we can identify this via posthog
- Contact is created w/ organic, but they click on an ad, book

## how it works 2.0

- We just use our own tracking script (posthog is overkill, i just need the data i'll probably use meta base for create reports)
- DOES NOT work with GHL chat widget, i'll provide my own
- I'll recreate DNI by replicating

## As a service

<!-- 1. Export all the GHL contacts
2. Run the contact details script to get all of the attribution data for each contact
3. Insert them into Contact and Session
4. Pull the data from the EHR starting from the first created date in GHL
5. Use bigquery/metabase to compare this data

PROFIT - !see how we can analyze this data and if it make sense before we go building a full saas! -->
