const pool = require('./config/db');

async function runMigration() {
  try {
    console.log('Connecting to database...');
    await pool.query('ALTER TABLE inventory_products ADD COLUMN category VARCHAR(100) DEFAULT NULL');
    console.log('Success!');
  } catch (err) {
    console.error(err.message);
  } finally {
    process.exit(0);
  }
}

runMigration();
