const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const profile = String(process.env.BOU_ENV || '').trim().toLowerCase();
const envFileName = profile === 'localtest' ? '.env.localtest' : '.env';
const envPath = path.resolve(__dirname, '..', envFileName);

if (!fs.existsSync(envPath) && profile === 'localtest') {
  const examplePath = path.resolve(__dirname, '..', '.env.localtest.example');
  console.warn(`⚠️  Missing ${envFileName} — copy backend/.env.localtest.example and adjust values.`);
  if (fs.existsSync(examplePath)) {
    dotenv.config({ path: examplePath });
  }
} else {
  dotenv.config({ path: envPath });
}

module.exports = { envPath, profile };
