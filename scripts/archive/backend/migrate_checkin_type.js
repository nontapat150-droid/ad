require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ad',
    port: process.env.DB_PORT || 3306,
  });

  try {
    console.log('Connected to DB');
    await connection.query(`ALTER TABLE checkins ADD COLUMN checkin_type VARCHAR(50) DEFAULT 'general';`);
    console.log('Added checkin_type column successfully.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('checkin_type column already exists.');
    } else {
      console.error('Error adding column:', err);
    }
  } finally {
    await connection.end();
  }
}

run();
