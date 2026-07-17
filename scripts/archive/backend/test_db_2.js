const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [rows] = await pool.query('SELECT id, user_id, checkin_time, checkout_time, image_path, checkout_image FROM checkins ORDER BY id DESC LIMIT 5;');
  console.table(rows);
  process.exit(0);
}
run();
