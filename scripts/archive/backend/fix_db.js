require('dotenv').config({path: './.env'});
const mysql = require('mysql2/promise');
const { recalculateOilData } = require('./routes/oil'); // wait, recalculateOilData is not exported

async function run() {
  let pool;
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'test',
    });
    const conn = await pool.getConnection();
    
    // Update all variations of 8645 to 'กบ 8645 วีออส'
    const [result] = await conn.query(`UPDATE oil_records SET license_plate = 'กบ 8645 วีออส' WHERE license_plate LIKE '%8645%'`);
    console.log(`Updated ${result.affectedRows} rows to 'กบ 8645 วีออส'`);
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error("Connection Error:", err.message);
    process.exit(1);
  }
}
run();
