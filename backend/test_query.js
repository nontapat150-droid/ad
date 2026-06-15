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
    const [rows] = await pool.query(`
      SELECT * FROM (
        (SELECT 1 as id ORDER BY id LIMIT 1)
        UNION ALL
        (SELECT 2 as id ORDER BY id LIMIT 1)
      ) AS c
    `);
    console.log('SUCCESS:', rows);
  } catch(e) {
    console.error('ERROR:', e.message);
  }
  process.exit();
}
test();
