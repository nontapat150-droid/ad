const mysql = require('mysql2/promise');
require('dotenv').config();
async function addNote() {
  const pool = mysql.createPool({ 
    host: process.env.DB_HOST, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME 
  });
  try {
    await pool.query('ALTER TABLE inventory_logs ADD COLUMN note TEXT;');
    console.log('Added note column successfully!');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists!');
    } else {
      console.error('Error:', e.message);
    }
  } finally {
    pool.end();
  }
}
addNote();
