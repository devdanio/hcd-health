fetch('https://backend.leadconnectorhq.com/contacts/eC1eICp3xJgewA3BjJxq', {
  headers: {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    authorization:
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzb3VyY2UiOiJXRUJfVVNFUiIsImNoYW5uZWwiOiJBUFAiLCJzb3VyY2VJZCI6InFzWkFJT1FZMjF2NlBVREIwRExhIiwic291cmNlTmFtZSI6IkRhbiBSYW1vcyIsImNvbXBhbnlJZCI6Im1qVUpSYzNWYjg2OXdkQnFQdFBFIiwibWV0YSI6eyJ1c2VyUm9sZSI6ImFkbWluIiwidXNlclR5cGUiOiJhZ2VuY3kifSwicHJpbWFyeVVzZXIiOnt9LCJpYXQiOjE3NjU5OTUzNzAsImV4cCI6MTc2NTk5ODk3MCwianRpIjoiNjk0MmYzNmE3OTkyNDM2YzA2MzU5NTM5In0.aJkYGh5H31wgn5AG5OKMQusOLlYT_cv1MKavB4EAxr8',
    baggage:
      'sentry-environment=production,sentry-release=d2256107ffbacc251fc18d9f1236df3bd6b4bb84,sentry-public_key=c67431ff70d6440fb529c2705792425f,sentry-trace_id=a14fe22c672b432899fb485ad4f4eaf0,sentry-org_id=176457,sentry-transaction=contact_detail-v2,sentry-sampled=false,sentry-sample_rand=0.7774277125602441,sentry-sample_rate=0.02',
    channel: 'APP',
    'if-none-match': 'W/"f60-fizjTjsowZMGihbmrrZwRkzT7gM"',
    priority: 'u=1, i',
    'sec-ch-ua': '"Not_A Brand";v="99", "Chromium";v="142"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'sentry-trace': 'a14fe22c672b432899fb485ad4f4eaf0-b24d16701ca551f4-0',
    source: 'WEB_USER',
    'token-id':
      'eyJhbGciOiJSUzI1NiIsImtpZCI6IjM4MTFiMDdmMjhiODQxZjRiNDllNDgyNTg1ZmQ2NmQ1NWUzOGRiNWQiLCJ0eXAiOiJKV1QifQ.eyJ1c2VyX2lkIjoicXNaQUlPUVkyMXY2UFVEQjBETGEiLCJjb21wYW55X2lkIjoibWpVSlJjM1ZiODY5d2RCcVB0UEUiLCJyb2xlIjoiYWRtaW4iLCJ0eXBlIjoiYWdlbmN5IiwibG9jYXRpb25zIjpbImhSS2FibFpjMk5VZE5RaEQ1cW15IiwiclBJdXBJa2hSQ2hBRG1aWG1sZFQiLCI5cGw3TktxSmU5YzBOSXMzcWRvZCIsIndKVnJUYlNBaXZ4SHY4QmFiU1paIiwiWGxNazdIdzRkakx2RXhsdjBkVEsiXSwidmVyc2lvbiI6MiwicGVybWlzc2lvbnMiOnsid29ya2Zsb3dzX2VuYWJsZWQiOnRydWUsIndvcmtmbG93c19yZWFkX29ubHkiOmZhbHNlfSwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL2hpZ2hsZXZlbC1iYWNrZW5kIiwiYXVkIjoiaGlnaGxldmVsLWJhY2tlbmQiLCJhdXRoX3RpbWUiOjE3NjU5OTU1NDQsInN1YiI6InFzWkFJT1FZMjF2NlBVREIwRExhIiwiaWF0IjoxNzY1OTk1NTQ0LCJleHAiOjE3NjU5OTkxNDQsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnt9LCJzaWduX2luX3Byb3ZpZGVyIjoiY3VzdG9tIn19.hxz5tUnCF-buk7WVE165BleEdMJH4fuG4x8oEXjuxtrYglaQqMalOav5PuyzPwVWzIZV7ZZ_h-K_Ajw3v-gyUmyglfnJvgcmkjgg_gXuE0fKX19JTAdgsKkFVY9VIIsJi0c3iGQP5AbPUAXE-wFd6AlI7ROYeQwzaApIOh-3rEbXC26JS2_my0plygGWRuI00QONWF93Rq8JupeIIsGtpap4PL4xkuPyh64DRMQeUJUxYhscHGmaWAPcjXDqbnywpqqg1MLk_gAV9467jsSLnLNtKqc96Drs-LB9CHrHoE2S0ow7BSUcAEhVZvvTi_Zzkv25uHOl8Dbx-dvzKvTQzA',
    'x-translations-lang': 'en-US',
    Referer: 'https://app.highcountrydigital.io/',
  },
  body: null,
  method: 'GET',
})
  .then((res) => res.json())
  .then((data) => {
    console.log(data)
  })
  .catch((err) => {
    console.error(err)
  })
