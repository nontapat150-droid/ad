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
  console.log("Logging in...");
  const loginData = JSON.stringify({ username: 'mmm', password: '111' });
  const loginRes = await request('https://bonusais.com/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  }, loginData);
  
  console.log("Login response:", loginRes);
  if (!loginRes.token) return;

  const token = loginRes.token;
  
  console.log("\nFetching oil records...");
  const records = await request('https://bonusais.com/api/oil/records?limit=5', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log("Records (first 5):");
  if (Array.isArray(records)) {
    records.slice(0, 5).forEach(r => {
      console.log(`ID: ${r.id}, Plate: ${r.license_plate}, Distance: ${r.distance}, is_trip: ${r.is_trip}`);
    });
  } else {
    console.log(records);
  }

  // Trigger recalculate if possible
  console.log("\nTriggering recalculate...");
  const recalc = await request('https://bonusais.com/api/oil/recalculate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log("Recalculate response:", recalc);
  
  console.log("\nFetching oil records again...");
  const records2 = await request('https://bonusais.com/api/oil/records?limit=5', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log("Records (first 5):");
  if (Array.isArray(records2)) {
    records2.slice(0, 5).forEach(r => {
      console.log(`ID: ${r.id}, Plate: ${r.license_plate}, Distance: ${r.distance}, is_trip: ${r.is_trip}`);
    });
  }
}
test();
