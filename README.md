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

### Scheduled calls by source

select count(\*), data->'contact'->'attributionSource'->'sessionSource'
src from "Event" where "type" = 'SCHEDULED_CALL' group by src;

### Revenue/patient shopify and patient

SELECT
COUNT(DISTINCT CASE WHEN pur.source = 'SHOPIFY' THEN pur.person_id END) as shopify_customer_count,
COUNT(DISTINCT CASE WHEN pur.source = 'JASMINE' THEN pur.person_id END) as jasmine_patient_count,
SUM(CASE WHEN pur.source = 'SHOPIFY' THEN pur.amount_in_cents ELSE 0 END) / 100.0 as shopify_total_revenue_dollars,
SUM(CASE WHEN pur.source = 'JASMINE' THEN pur.amount_in_cents ELSE 0 END) / 100.0 as jasmine_total_revenue_dollars,
CASE
WHEN COUNT(DISTINCT CASE WHEN pur.source = 'SHOPIFY' THEN pur.person_id END) > 0
THEN (SUM(CASE WHEN pur.source = 'SHOPIFY' THEN pur.amount_in_cents ELSE 0 END)::float / COUNT(DISTINCT CASE WHEN pur.source = 'SHOPIFY' THEN pur.person_id END)) / 100.0
ELSE 0
END as avg_revenue_per_shopify_customer_dollars,
CASE
WHEN COUNT(DISTINCT CASE WHEN pur.source = 'JASMINE' THEN pur.person_id END) > 0
THEN (SUM(CASE WHEN pur.source = 'JASMINE' THEN pur.amount_in_cents ELSE 0 END)::float / COUNT(DISTINCT CASE WHEN pur.source = 'JASMINE' THEN pur.person_id END)) / 100.0
ELSE 0
END as avg_revenue_per_jasmine_patient_dollars
FROM purchase pur
INNER JOIN person p ON pur.person_id = p.id
WHERE p.company_id = 'cmjq8rjqi0000doap08up0s41'
AND pur.source IN ('SHOPIFY', 'JASMINE');

## GHL Chat Widget

Since we can't inject the anonymous_id into the chat widget, we register an onBeforeSubmit event handler to the chat widget, call "identify", then the chat is sent. On the server we use a workflow to send the "CHAT_MESSAGE" event along w/ the email/phone and can match the people that way

Add the following BEFORE loading the GHL chat script

<script>
    function beforeSubmit(values, host) {
    window.__HCH.identify({ email: values?.email, phone: values?.phone, metadata :{firstName, lastName, fullName} })
    return true;
    }

    window.addEventListener(
    "LC_chatWidgetLoaded",
    function (e) {
        window.leadConnector.chatWidget.registerBeforeSubmit(beforeSubmit);
    },
    false
    );
</script>

### GHL Forms

Inside the funnel tracking code add the following code an ensure that the HCH id is added and hidden to the form.

Create a "form submitted" workflow that calls both identify AND form_submitted

<script>
(function () {
  const TARGET_ATTR = 'data-q="hch_id"';
  const MAX_WAIT_MS = 10000;
  const INTERVAL_MS = 250;

  const start = Date.now();

  const interval = setInterval(() => {
    const input = document.querySelector(`input[${TARGET_ATTR}]`);

    if (!input) {
      if (Date.now() - start > MAX_WAIT_MS) {
        clearInterval(interval);
      }
      return;
    }

    if (window.__HCH && window.__HCH.anonymousId) {
      input.value = window.__HCH.anonymousId;

      // Trigger events in case a framework is watching the field
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      clearInterval(interval);
    }
  }, INTERVAL_MS);
})();
</script>

## RUDDERSTACK

### CHAT

See EHI codebase for implementation. Workflow goes as follows

1. Once rudder loads, then register an onBeforeSubmit event to the GHL Chat widget
2. Call identify when the chat message is sent w/ the rudder anonymous ID
3. In GHL, create a workflow for when a new chat that is received where we call identify again and "chat recieved" event

### Form submissions

1. GHL - on form submit send track + form submitted events
2. Forms - ensure that the rudderstack SDK is loaded and you dynamically insert it into the form

## IFRAME SCRIPT, ensure you add the hch_id as hidden input

<script>
(function() {
  let injected = false;

  function inject(value) {
    if (injected) return;
    const input = document.querySelector('input[data-q="hch_id"]');
    if (input) {
      input.value = value;
      injected = true;
    }
  }

  window.addEventListener('message', function(event) {
    if (event.data.type === 'hch_id') {
      inject(event.data.value);
    }
  });
    window.parent.postMessage({ type: 'IFRAME_READY' }, '*');
})();
</script>

Identify
Page views
