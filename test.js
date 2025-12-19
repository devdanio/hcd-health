fetch('https://services.leadconnectorhq.com/contacts/96if2SXMInxvFw6QeiPN', {
  headers: {
    version: '2021-07-28',
    accept: 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    baggage:
      'sentry-environment=production,sentry-release=d2256107ffbacc251fc18d9f1236df3bd6b4bb84,sentry-public_key=c67431ff70d6440fb529c2705792425f,sentry-trace_id=7e234d2da23a4516919b03b39ea3d384,sentry-org_id=176457,sentry-transaction=contact_detail-v2,sentry-sampled=false,sentry-sample_rand=0.6960025521824562,sentry-sample_rate=0.02',
    'cache-control': 'max-age=0',
    channel: 'APP',
    'if-none-match': 'W/"b0b-yhUZsadNZWwChDZsPtBlBsQrchc"',
    priority: 'u=1, i',
    'sec-ch-ua': '"Chromium";v="143", "Not A(Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'sentry-trace': '7e234d2da23a4516919b03b39ea3d384-807db3196a632f01-0',
    source: 'WEB_USER',
    'token-id':
      'eyJhbGciOiJSUzI1NiIsImtpZCI6Ijk4OGQ1YTM3OWI3OGJkZjFlNTBhNDA5MTEzZjJiMGM3NWU0NTJlNDciLCJ0eXAiOiJKV1QifQ.eyJ1c2VyX2lkIjoicXNaQUlPUVkyMXY2UFVEQjBETGEiLCJjb21wYW55X2lkIjoibWpVSlJjM1ZiODY5d2RCcVB0UEUiLCJyb2xlIjoiYWRtaW4iLCJ0eXBlIjoiYWdlbmN5IiwibG9jYXRpb25zIjpbImhSS2FibFpjMk5VZE5RaEQ1cW15IiwiclBJdXBJa2hSQ2hBRG1aWG1sZFQiLCI5cGw3TktxSmU5YzBOSXMzcWRvZCIsIndKVnJUYlNBaXZ4SHY4QmFiU1paIiwiWGxNazdIdzRkakx2RXhsdjBkVEsiXSwidmVyc2lvbiI6MiwicGVybWlzc2lvbnMiOnsid29ya2Zsb3dzX2VuYWJsZWQiOnRydWUsIndvcmtmbG93c19yZWFkX29ubHkiOmZhbHNlfSwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL2hpZ2hsZXZlbC1iYWNrZW5kIiwiYXVkIjoiaGlnaGxldmVsLWJhY2tlbmQiLCJhdXRoX3RpbWUiOjE3NjYxNjM0MTIsInN1YiI6InFzWkFJT1FZMjF2NlBVREIwRExhIiwiaWF0IjoxNzY2MTYzNDEyLCJleHAiOjE3NjYxNjcwMTIsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnt9LCJzaWduX2luX3Byb3ZpZGVyIjoiY3VzdG9tIn19.QTwRSc24qkKoIw771J7XPNcEhBBHGJ5Kjg5hqkK9KJbWt66TownsJj1LjCU9bIHPYX4P1z7NjzuC3r1FhNueEKSEVA2FOEGxoky21NB72DdyQqznPSp-D17LKeadyayFioGPnCI2m2ExFRNfzeH12k5NjOsCLbdnRGhFdDIYKEaGn9k_WijdsnA0NfVUdfxenkMoodxVmedTcyIVq9fqKELJVOZxNdwH1Bi1twrumoYT1hokhqA84RssUwzX3XxfEyv82jSHcqbsnCZjjxyG9JZs4hRDQUykzPmzuGW9uer5Po2L6TyaGqbLrAiJ-a2rS45i6NCCjTJ4bCE3gnrtUw',
    Referer: 'https://app.highcountrydigital.io/',
  },
  body: null,
  method: 'GET',
})
  .then((res) => res.json())
  .then((data) => {
    console.log(data)
  })
