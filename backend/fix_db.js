const pool = require('./config/db');

async function fix() {
  try {
    const [result] = await pool.query('ALTER TABLE users MODIFY COLUMN id INT AUTO_INCREMENT');
    console.log('Fixed users table', result);
  } catch(e) {
    console.error('Failed to alter users table:', e);
  } finally {
    process.exit();
  }
}
fix();
