import crypto from 'crypto'
function hashValue(val) {
  return crypto
    .createHash('sha256')
    .update(val.trim().toLowerCase())
    .digest('hex')
}

// Amanda I tried at 11:52am mar 26 for the first time with euser eventSourceURL

// 2026 PAOM
const pixelId = '667439912697145'
const accessToken =
  'EAATzPGr8cBUBQWco4BFFheCMV3f0WnW5nhZAw0lM2aywMK65byvnHnVlVQt7BgMMcZBW8ZBQLzMOn0j0jlonjZBbnywan4f3dQ2Q5UatcqYYc78q5KNNhI7HhrYVyZAPVbZAvmoeF6KX6Wqo9trQ2JanZAlRdFdR3N1aTEHizYLhWBe44ckl6AqjCr5qw3OPQZDZD'

const data = {
  firstName: 'Amanda',
  lastName: '',
  email: 'amandastadler016@gmail.com',
  phone: '7323974507',
  fbCLID:
    'IwY2xjawQvCZBleHRuA2FlbQEwAGFkaWQBqzr_4bEUqnNydGMGYXBwX2lkDzI0NTc5MDgxODk1NTg2OAABHjidmNUYKs_wWInbMIX6GQPy8TcPytmoPqm6z3uQfr52drvw8rwCOaeJvvYo_aem_1me2zXQ2js0fdWPMAOMT9A',
  ipAddress: '50.184.105.177',
  //   This event name is for custom conversion "Event #1"
  eventName: 'Event 1',
  eventSourceUrl:
    'https://pa-om.com/online-back-pain-assessment-find-the-root-cause/?campaign_id=120254685607080362&utm_source=fb_ad&utm_medium=Broad+12+mi+-+Event+1&utm_campaign=2026+Back+Pain+Assessment+-+Event+1+Conversion+-+Copy&utm_content=If+you%27ve+been+told&utm_id=120254685607080362&utm_term=120254685607090362&fbclid=IwY2xjawQvCZBleHRuA2FlbQEwAGFkaWQBqzr_4bEUqnNydGMGYXBwX2lkDzI0NTc5MDgxODk1NTg2OAABHjidmNUYKs_wWInbMIX6GQPy8TcPytmoPqm6z3uQfr52drvw8rwCOaeJvvYo_aem_1me2zXQ2js0fdWPMAOMT9A',
  userAgent: `Mozilla/5.0 (Linux; Android 16; moto g - 2025 Build/W1VKS36H.9-12-1; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/145.0.7632.159 Mobile Safari/537.36`,
}
const date = new Date('2026-03-24T10:00:00-05:00')
const unixTime = Math.floor(date.getTime() / 1000)

const createPayload = (input) => {
  const hashedEmail = hashValue(input.email)
  const hashedPhone = hashValue(input.phone)
  const hashedFirstName = hashValue(input.firstName)
  return [
    {
      event_name: input.eventName,
      event_time: unixTime,
      event_source_url: input.eventSourceUrl,
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
