const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/.env' });

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ad_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Find all team-related records mentioning ผบ
  const [tables] = await pool.query(`SHOW TABLES`);
  const tableNames = tables.map(t => Object.values(t)[0]);
  console.log('Tables:', tableNames.join(', '));

  // Search teams table specifically
  for (const tbl of tableNames) {
    if (tbl.includes('team')) {
      const [rows] = await pool.query(`SELECT * FROM \`${tbl}\``);
      console.log(`\n=== ${tbl} ===`);
      console.log(JSON.stringify(rows, null, 2));
    }
  }

  // Also search users for team field
  try {
    const [users] = await pool.query(`SELECT id, full_name, team_id, team_name, role FROM users WHERE full_name LIKE '%ผบ%' OR team_name LIKE '%ผบ%'`);
    console.log('\n=== Users with ผบ ===', JSON.stringify(users, null, 2));
  } catch(e) { console.log('users search error:', e.message); }

  // Check oil_records for team info
  try {
    const [orec] = await pool.query(`SELECT DISTINCT team_name, license_plate FROM oil_records WHERE team_name LIKE '%ผบ%' LIMIT 20`);
    console.log('\n=== oil_records team_name with ผบ ===', JSON.stringify(orec, null, 2));
  } catch(e) { console.log('oil_records error:', e.message); }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
