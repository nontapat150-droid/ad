const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/.env' });

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ad_system',
  });

  const [cols] = await pool.query(`DESCRIBE jobs`);
  console.log(cols);
  process.exit(0);
}
run();
