const mysql = require('mysql2/promise');
require('dotenv').config();
async function test() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bou_db'
  });
  try {
    const [users] = await pool.query("SELECT id, full_name, role, team_id FROM users WHERE role IN ('technician', 'ma') OR team_id IS NOT NULL");
    console.log(`Found ${users.length} users.`);
    for (const u of users) {
       const [checkinStats] = await pool.query(
        `SELECT 
           COUNT(DISTINCT DATE(checkin_time)) as total_days,
           SUM(is_late) as total_late
         FROM checkins
         WHERE user_id = ? AND DATE_FORMAT(checkin_time, '%Y-%m') = ?`,
        [u.id, '2026-06']
      );

      const [jobStats] = await pool.query(
        `SELECT COUNT(*) as total_completed
         FROM ma_jobs
         WHERE (field_engineer_id = ? OR (team_id = ? AND team_id IS NOT NULL))
           AND status = 'completed'
           AND DATE_FORMAT(completed_at, '%Y-%m') = ?`,
        [u.id, u.team_id, '2026-06']
      );
    }
    console.log('Success');
  } catch(e) {
    console.error('SQL Error:', e.message);
  }
  process.exit(0);
}
test();
