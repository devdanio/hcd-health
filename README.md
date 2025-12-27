## Queries

### GHL Lead count by campaign (using attributionSource, not latestAttribution source)

SELECT
COALESCE(
e.data->'contact'->'lastAttributionSource'->>'campaign',
e.data->'contact'->'attributionSource'->>'campaign'
) as campaign,
COUNT(\*) as total_events,
COUNT(DISTINCT c.id) as unique_contacts
FROM "Contact" c
JOIN "Company" comp ON c."companyId" = comp.id
JOIN "Event" e ON e."contactId" = c.id
WHERE comp.name = 'Thrive'
AND (
e.data->'contact'->'attributionSource'->>'campaign' IS NOT NULL
OR e.data->'contact'->'lastAttributionSource'->>'campaign' IS NOT NULL
)
AND (
e.data->'contact'->'attributionSource'->>'campaign' != ''
OR e.data->'contact'->'lastAttributionSource'->>'campaign' != ''
)
GROUP BY COALESCE(
e.data->'contact'->'lastAttributionSource'->>'campaign',
e.data->'contact'->'attributionSource'->>'campaign'
)
ORDER BY total_events DESC;

### Payments year over year by month

SELECT
EXTRACT(YEAR FROM posted_date) as year,
ROUND(SUM(CASE WHEN EXTRACT(MONTH FROM posted_date) = 1 THEN "amountInCents" ELSE 0 END) / 100.0, 2) as jan,
ROUND(SUM(CASE WHEN EXTRACT(MONTH FROM posted_date) = 2 THEN "amountInCents" ELSE 0 END) / 100.0, 2) as feb,
ROUND(SUM(CASE WHEN EXTRACT(MONTH FROM posted_date) = 3 THEN "amountInCents" ELSE 0 END) / 100.0, 2) as mar,
ROUND(SUM(CASE WHEN EXTRACT(MONTH FROM posted_date) = 4 THEN "amountInCents" ELSE 0 END) / 100.0, 2) as apr,
ROUND(SUM(CASE WHEN EXTRACT(MONTH FROM posted_date) = 5 THEN "amountInCents" ELSE 0 END) / 100.0, 2) as may,
ROUND(SUM(CASE WHEN EXTRACT(MONTH FROM posted_date) = 6 THEN "amountInCents" ELSE 0 END) / 100.0, 2) as jun,
ROUND(SUM(CASE WHEN EXTRACT(MONTH FROM posted_date) = 7 THEN "amountInCents" ELSE 0 END) / 100.0, 2) as jul,
ROUND(SUM(CASE WHEN EXTRACT(MONTH FROM posted_date) = 8 THEN "amountInCents" ELSE 0 END) / 100.0, 2) as aug,
ROUND(SUM(CASE WHEN EXTRACT(MONTH FROM posted_date) = 9 THEN "amountInCents" ELSE 0 END) / 100.0, 2) as sep,
ROUND(SUM(CASE WHEN EXTRACT(MONTH FROM posted_date) = 10 THEN "amountInCents" ELSE 0 END) / 100.0, 2) as oct,
ROUND(SUM(CASE WHEN EXTRACT(MONTH FROM posted_date) = 11 THEN "amountInCents" ELSE 0 END) / 100.0, 2) as nov,
ROUND(SUM(CASE WHEN EXTRACT(MONTH FROM posted_date) = 12 THEN "amountInCents" ELSE 0 END) / 100.0, 2) as dec,
ROUND(SUM("amountInCents") / 100.0, 2) as total
FROM "Payments"
WHERE posted_date >= NOW() - INTERVAL '9 years'
GROUP BY EXTRACT(YEAR FROM posted_date)
ORDER BY year DESC;

### Revenue per campaign

SELECT
COALESCE(
e.data->'contact'->'lastAttributionSource'->>'campaign',
e.data->'contact'->'attributionSource'->>'campaign'
) as campaign,
COUNT(DISTINCT c.id) as leads,
COUNT(DISTINCT p."contactId") as patients,
TO_CHAR(COALESCE(SUM(p."amountInCents"), 0) / 100.0, 'FM$999,999,990.00') AS total_revenue
FROM "Contact" c
JOIN "Company" comp ON c."companyId" = comp.id
JOIN "Event" e ON e."contactId" = c.id
LEFT JOIN "Payments" p ON c.id = p."contactId" AND p.status = 'posted'
WHERE comp.name = 'Eye Health Institute'
AND (
e.data->'contact'->'attributionSource'->>'campaign' IS NOT NULL
OR e.data->'contact'->'lastAttributionSource'->>'campaign' IS NOT NULL
)
AND (
e.data->'contact'->'attributionSource'->>'campaign' != ''
OR e.data->'contact'->'lastAttributionSource'->>'campaign' != ''
)
GROUP BY COALESCE(
e.data->'contact'->'lastAttributionSource'->>'campaign',
e.data->'contact'->'attributionSource'->>'campaign'
)
ORDER BY COALESCE(SUM(p."amountInCents"), 0) DESC;

### Days from 1st seen to payment

<!-- Apparently only 11 days on average for median for 1,200 records -->

SELECT
c.id,
c."fullName",
c.email,
c.phone,
c."firstSeenAt",
MIN(p.posted_date) as first_payment_date,
EXTRACT(DAY FROM (MIN(p.posted_date) - c."firstSeenAt")) as days_to_first_payment
FROM "Contact" c
JOIN "Company" comp ON c."companyId" = comp.id
LEFT JOIN "Payments" p ON c.id = p."contactId" AND p.status = 'posted'
WHERE comp.name = 'Eye Health Institute'
AND c."firstSeenAt" >= '2017-05-19'
GROUP BY c.id, c."fullName", c.email, c.phone, c."firstSeenAt"
HAVING MIN(p.posted_date) IS NOT NULL
AND c."firstSeenAt" <= MIN(p.posted_date)
ORDER BY c."firstSeenAt" DESC;

### Average reve per patient

SELECT
COUNT(DISTINCT p."contactId") as total_patients,
TO_CHAR(COALESCE(SUM(p."amountInCents"), 0) / 100.0, 'FM$999,999,990.00') AS total_revenue,
TO_CHAR(
COALESCE(SUM(p."amountInCents"), 0) / 100.0 / COUNT(DISTINCT p."contactId"),
'FM$999,999,990.00'
) AS average_revenue_per_patient
FROM "Payments" p
JOIN "Contact" c ON p."contactId" = c.id
JOIN "Company" comp ON c."companyId" = comp.id
WHERE comp.name = 'Eye Health Institute'
AND p.status = 'posted';

### Scheduled calls by source

select count(\*), data->'contact'->'attributionSource'->'sessionSource'
src from "Event" where "type" = 'SCHEDULED_CALL' group by src;
