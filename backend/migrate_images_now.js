const pool = require('./config/db');

async function runMigration() {
  try {
    console.log('Running image migration...');
    await pool.query('ALTER TABLE inventory_products ADD COLUMN image_url TEXT DEFAULT NULL').catch(() => {});
    await pool.query('CREATE TABLE IF NOT EXISTS inventory_category_metadata (category_name VARCHAR(100) PRIMARY KEY, image_url TEXT)');
    console.log('Success!');
  } catch (err) {
    console.error(err.message);
  } finally {
    process.exit(0);
  }
}

runMigration();
