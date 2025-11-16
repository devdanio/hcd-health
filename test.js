// login-up.js
import 'dotenv/config' // optional, if using .env
// Node 18+ has fetch globally; if you're on an older version, see the node-fetch example below.

const BASE_URL = 'https://staging.unifiedpractice.com/API'

async function loginUnifiedPractice(username, password) {
  const url = `${BASE_URL}/api/Account/Login`

  //   const payload = {
  //     UserName: username,
  //     Password: password,
  //   }

  const payload = {
    Parameter: {
      UserName: username,
      Password: password,
      Token: '6ecc26c8-33c6-4618-ae25-559a3ff595dd',
      //   IgnoreTokenExpiryDate: true,
      //   RedirectToMetabaseDashboard: true,
      //   ClientDevice: {
      //     ClientSoftwareVersion: 'sample string 1',
      //     DeviceId: 2,
      //     Id: '6a19cd8d-92eb-4b35-b166-195f2b7e9a50',
      //     Type: 1,
      //     Name: 'sample string 4',
      //     Information: 'sample string 5',
      //     Client: 'sample string 6',
      //   },
      //   RememberMe: true,
      //   ReturnUrl: 'sample string 4',
      //   IPAddress: 'sample string 5',
      //   IsEhrLogin: true,
      //   HasPushNotifications: true,
    },
  }

  const res = await fetch(BASE_URL + '/api/Account/GetEhrAuthorizationToken')
  console.log('dan', res)
  //   const a = await res.json().catch(() => null)
  //   const res = await fetch(url, {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       // If your browser sends additional headers on login (like X-Requested-With),
  //       // copy those here too.
  //     },
  //     body: JSON.stringify(payload),
  //     redirect: 'manual',
  //   })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Login failed: ${res.status} ${res.statusText} - ${text}`)
  }

  const data = await res.json().catch(() => null)
  console.log('Login response:', data)

  // IMPORTANT: Node’s fetch DOES NOT persist cookies by default.
  // If the app uses auth cookies, you’ll need a cookie jar implementation
  // (e.g. undici + tough-cookie, or fetch-cookie + node-fetch) to reuse
  // the session for follow-up API calls.

  return { data, headers: res.headers }
}

;(async () => {
  try {
    const username = 'steve@pa-om.com'
    const password = 'DeNise246!'

    await loginUnifiedPractice(username, password)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()
