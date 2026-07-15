require('dotenv').config({path: './.env'});
const mysql = require('mysql2/promise');

async function run() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'test',
    });

    const [rows] = await pool.query("SELECT id, license_plate, mileage, distance, date_recorded FROM oil_records LIMIT 5");
    console.log(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
