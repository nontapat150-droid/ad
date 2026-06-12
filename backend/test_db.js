require('dotenv').config({ path: './backend/.env' });
const mysql = require('mysql2/promise');

async function test() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const filterDate = '2026-06-06';
    const [rows] = await pool.query("SELECT id, checkin_time, DATE(checkin_time) as d FROM checkins WHERE DATE(checkin_time) = ?", [filterDate]);
    console.log("Records in DB:", rows);

    pool.end();
  } catch (err) {
    console.error("DB Error:", err);
  }
}
test();
