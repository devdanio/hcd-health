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
  firstName: 'Judith',
  lastName: 'Koubek',
  email: 'judyandluke@gmail.com',
  phone: '6095773896',
  fbCLID:
    'IwZXh0bgNhZW0BMABhZGlkAas4w3578epzcnRjBmFwcF9pZAo2NjI4NTY4Mzc5AAEejr3x9HXrVCoJ2XnY3cdalqNCOoHTNTB6BFjw7UbJ_lLu_J9jVcRqgB8mwy8_aem_0w3RZYpB99BawiNCwZF_3A',
  ipAddress: '2601:86:4300:2440:21be:d38f:aba2:87b5',
  //   This event name is for custom conversion "Event #1"
  eventName: 'Event 1',
  userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 26_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23C71 [FBAN/FBIOS;FBAV/550.0.0.34.65;FBBV/890804754;FBDV/iPhone17,2;FBMD/iPhone;FBSN/iOS;FBSV/26.2.1;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/893384955;IABMV/1]`,
}
const date = new Date('2026-02-27T12:34:00-05:00')
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
