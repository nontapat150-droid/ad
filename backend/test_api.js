const jwt = require('jsonwebtoken');
const https = require('https');

const token = jwt.sign(
  { id: 1, role: 'super_admin', roles: ['super_admin'] },
  'bou_super_secret_jwt_key_change_in_production',
  { expiresIn: '1h' }
);

const options = {
  hostname: 'bonusais.com',
  path: '/api/checkin/history?limit=50&userId=ALL&date=2026-06-06',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const json = JSON.parse(data);
      console.log('Returned items count:', json.length);
      if (json.length > 0) {
        console.log('First item date:', json[0].checkin_time);
      }
    } catch (e) {
      console.log('Raw data:', data.slice(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});
req.end();
