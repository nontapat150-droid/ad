const https = require('https');

const req = https.request('https://bonusais.com/api/oil/recalculate-debug', { method: 'POST' }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});

req.on('error', console.error);
req.end();
