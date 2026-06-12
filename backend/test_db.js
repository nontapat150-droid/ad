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

    const [rows] = await pool.query("DESCRIBE checkins");
    console.log("Checkins Schema:", rows);

    pool.end();
  } catch (err) {
    console.error("DB Error:", err);
  }
}
test();
