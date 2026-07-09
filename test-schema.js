
require('dotenv').config({ path: './backend/.env' });
const pool = require('./backend/config/db');

async function test() {
  try {
    const [jobs] = await pool.query('DESCRIBE jobs;');
    console.log('Jobs Schema:');
    console.table(jobs);

    const [items] = await pool.query('DESCRIBE inventory_items;');
    console.log('\nInventory Items Schema:');
    console.table(items);

    const [logs] = await pool.query('DESCRIBE inventory_logs;');
    console.log('\nInventory Logs Schema:');
    console.table(logs);

  } catch(err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
test();

