const https = require('https');

function request(url, options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function test() {
  const loginData = JSON.stringify({ username: 'mmm', password: '111' });
  const loginRes = await request('https://bonusais.com/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  }, loginData);
  const token = loginRes.token;
  
  const users = await request('https://bonusais.com/api/users', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log("Users:", users.map(u => ({id: u.id, name: u.full_name, role: u.role, team_id: u.team_id})));
}
test();
