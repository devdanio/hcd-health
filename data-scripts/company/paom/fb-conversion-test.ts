const res = await fetch('http://localhost:3000/api/fb-conversion/paom', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventName: 'Event 1',
    fbCLID:
      'IwZXh0bgNhZW0BMABhZGlkAas4w3578epzcnRjBmFwcF9pZAo2NjI4NTY4Mzc5AAEejr3x9HXrVCoJ2XnY3cdalqNCOoHTNTB6BFjw7UbJ_lLu_J9jVcRqgB8mwy8_aem_0w3RZYpB99BawiNCwZF_3A',
    firstName: 'Judith',
    lastName: 'Koubek',
    email: 'judyandluke@gmail.com',
    phone: '6095773896',
    ipAddress: '2601:86:4300:2440:21be:d38f:aba2:87b5',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23C71 [FBAN/FBIOS;FBAV/550.0.0.34.65;FBBV/890804754;FBDV/iPhone17,2;FBMD/iPhone;FBSN/iOS;FBSV/26.2.1;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/893384955;IABMV/1]',
    eventTimestamp: Math.floor(new Date('2026-02-27T12:34:00-05:00').getTime() / 1000),
  }),
})

const data = await res.json()
console.log(data)
