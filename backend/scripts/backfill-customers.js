/**
 * One-time backfill: sync all existing jobs into customers table.
 * Run: node backend/scripts/backfill-customers.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/db');
const { syncCustomerFromJob } = require('../utils/customerSync');

(async () => {
  const conn = await pool.getConnection();
  try {
    const [jobs] = await conn.query('SELECT id FROM jobs WHERE access_no IS NOT NULL ORDER BY id ASC');
    console.log(`Backfilling ${jobs.length} jobs...`);
    let synced = 0;
    for (const { id } of jobs) {
      await syncCustomerFromJob(conn, id);
      synced++;
      if (synced % 100 === 0) console.log(`  ${synced}/${jobs.length}`);
    }
    console.log(`Done. Synced ${synced} customers.`);
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
  }
})();
