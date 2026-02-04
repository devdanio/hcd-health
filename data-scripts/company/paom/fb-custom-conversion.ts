import crypto from 'crypto'
function hashValue(val) {
  return crypto
    .createHash('sha256')
    .update(val.trim().toLowerCase())
    .digest('hex')
}

// 2026 PAOM
const pixelId = '667439912697145'
const accessToken =
  'EAATzPGr8cBUBQWco4BFFheCMV3f0WnW5nhZAw0lM2aywMK65byvnHnVlVQt7BgMMcZBW8ZBQLzMOn0j0jlonjZBbnywan4f3dQ2Q5UatcqYYc78q5KNNhI7HhrYVyZAPVbZAvmoeF6KX6Wqo9trQ2JanZAlRdFdR3N1aTEHizYLhWBe44ckl6AqjCr5qw3OPQZDZD'

const data = {
  firstName: 'Donna',
  lastName: null,
  email: 'dmraki@comcast.net',
  phone: '9082298369',
  fbCLID:
    'IwZXh0bgNhZW0BMABhZGlkAas4w4Ic5mpzcnRjBmFwcF9pZAwzNTA2ODU1MzE3MjgAAR5O-R_g29gSIIc2XAWe1bsWNxcHCXAKKHJo_yKu7hLhKk6x-ekqozEdK1KMcQ_aem_Z3by6G3t_Srhf86hKhHLaQ',
  ipAddress: '2601:86:400:2d80:dc08:acee:6f1a:26a0',
  //   This event name is for custom conversion "Event #1"
  eventName: 'Event 1',
  userAgent: `Mozilla/5.0 (Linux; Android 14; SM-P613 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/144.0.7559.107 Safari/537.36 [FB_IAB/FB4A;FBAV/546.0.0.42.66;IABMV/1;]`,
}
const date = new Date('2026-02-04T04:42:00-05:00')
const unixTime = Math.floor(date.getTime() / 1000)

const createPayload = (input) => {
  const hashedEmail = hashValue(input.email)
  const hashedPhone = hashValue(input.phone)
  const hashedFirstName = hashValue(input.firstName)
  return [
    {
      event_name: input.eventName,
      event_time: unixTime,
      user_data: {
        em: [hashedEmail],
        ph: [hashedPhone],
        fn: hashedFirstName,
        client_ip_address: input.ipAddress,
        client_user_agent: input.userAgent,
        fbc: input.fbCLID,
      },
      action_source: 'website',
    },
  ]
}

const formData = new URLSearchParams()
formData.append('data', JSON.stringify(createPayload(data)))
formData.append('access_token', accessToken)

fetch(`https://graph.facebook.com/v24.0/${pixelId}/events`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: formData.toString(),
})
  .then((response) => response.json())
  .then((data) => console.log(data))
  .catch((error) => console.error('Error:', error))
