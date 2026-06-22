const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bou_ad'
  });
  
  try {
    const [jobsStatus] = await pool.query("SHOW COLUMNS FROM jobs LIKE 'status'");
    console.log('jobs.status:', jobsStatus[0].Type);

    const [jobLogsStatus] = await pool.query("SHOW COLUMNS FROM job_logs LIKE 'status'");
    console.log('job_logs.status:', jobLogsStatus[0].Type);

    const [invItemsStatus] = await pool.query("SHOW COLUMNS FROM inventory_items LIKE 'status'");
    console.log('inventory_items.status:', invItemsStatus[0].Type);

  } catch(e) {
    console.error('ERROR:', e.message);
  }
  process.exit();
}
test();
