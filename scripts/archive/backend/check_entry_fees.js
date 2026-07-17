require('dotenv').config({ path: './.env' });
const mysql = require('mysql2/promise');

async function test() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const [rows] = await pool.query("DESCRIBE entry_fees");
    console.log("Columns in entry_fees:", rows.map(r => r.Field));

    pool.end();
  } catch (err) {
    console.error("DB Error:", err);
  }
}
test();
