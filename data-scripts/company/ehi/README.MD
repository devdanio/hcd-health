## Completed tasks

- Imported all contacts from Jasmine w/ all purchase data
- Imported all contacts from GHL
- Webhooks
  - All new contacts created are sent to HCH
  - All new scheduled appointments are sent with SCHEDULED_CALL

## TODO

- I need to get the appointment dates or at the very least the first appointment date for each contact. Also need to create a separate "ehr profile" schema

## Shopify

### Export customers

1. https://admin.shopify.com/store/a0jrqz-aj/customers
2. Select all
3. Export plain CSV

### Export Orders

1. https://admin.shopify.com/store/a0jrqz-aj/orders
2. Select all
3. Export plain CSV

## Queries

Average revenue per person per year
WITH first_purchases AS (
SELECT
person_id,
MIN(purchased_at) AS first_purchase_date
FROM purchase
GROUP BY person_id
)
SELECT
EXTRACT(YEAR FROM fp.first_purchase_date) AS year,
COUNT(DISTINCT p.person_id) AS distinct_people,
SUM(p.amount_in_cents) / 100.0 / COUNT(DISTINCT p.person_id) AS avg_revenue_per_person
FROM purchase p
JOIN first_purchases fp ON p.person_id = fp.person_id
GROUP BY EXTRACT(YEAR FROM fp.first_purchase_date)
ORDER BY year;

19731024

## Data

Years: '21-24 - $8,062 average revenue/patient
Andys target: 5:1 ROI ($1,610 to aquire a patient)
Scheduled calls since June 1, 2024 - Dec 31, 2025: 182
Calls/mo: 30
8 patients/mo
GHL shows from mid sept: 33 booked telehealth and 19 in office
13.8 telehealth/mo (estimating using the above data point)

30 calls = $54,900 = 13.8 telehealth( $6,900 ) and 8 patients ($48k)

1 call = $1,830 revenue to business

Hes willing to pay $366/call

SUMMARY
30 calls/mo

- 8 patients ($48k)
- 14 telehealth ($7k)
  = $55k

1 call = $1,833 (does not take into considerination shopify purchases)
4:1 ROI = $458 andy should be willing to pay

My goal: $200-$250 cost per call

Deal:

- Andy pays me $250/call
-

Example:

- $4,500 ad spend ($3k increase)
- 22.5 calls (assuming $200/call)
- $41,242 revenue
- $4,500 in profit to dan ($200 \* 22.5)

* $2k/mo min OR comission whatever is higher
* 1 meeting per month. I'll work on building out the tracking

Total telehealth + new patients: 21.8 = $175/mo (new)
Close rate(patient or telehealth): 22 patients / 30 calls = 73%

Leads worth ($8062/.73) = $5,885
