const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bou_ad'
  });
  
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM entry_fees");
    console.log('entry_fees columns:', cols.map(c => c.Field));
  } catch(e) {
    console.error('ERROR:', e.message);
  }
  process.exit();
}
test();
