require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'test',
  });

  const [rows] = await pool.query("SELECT id, license_plate, mileage, distance, total_price, is_trip, date_recorded FROM oil_records WHERE license_plate LIKE '%3605%' ORDER BY date_recorded ASC");
  console.table(rows);
  process.exit(0);
}
run();
