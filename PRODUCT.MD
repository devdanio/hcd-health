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
