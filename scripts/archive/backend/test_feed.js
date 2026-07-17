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

  const [f] = await pool.query(`
          SELECT c.id, c.type, c.created_at, c.action, u.full_name as user_name
          FROM (
            (SELECT id, tech_id AS user_id, 'oil' AS type, date_recorded AS created_at, 'บันทึกบิลลงน้ำมัน' AS action FROM oil_records WHERE DATE(date_recorded) = CURDATE() ORDER BY date_recorded DESC LIMIT 20)
            UNION ALL
            (SELECT id, created_by AS user_id, 'entry_fee' AS type, created_at, 'บันทึกค่าแรกเข้า' AS action FROM entry_fees WHERE DATE(created_at) = CURDATE() ORDER BY created_at DESC LIMIT 20)
            UNION ALL
            (SELECT id, user_id, 'checkin' AS type, checkin_time AS created_at, 'เช็คอินเข้างาน' AS action FROM checkins WHERE DATE(checkin_time) = CURDATE() ORDER BY checkin_time DESC LIMIT 20)
            UNION ALL
            (SELECT id, user_id, 'checkin' AS type, checkin_time AS created_at, 'เช็คอินเข้างาน (MA)' AS action FROM ma_checkins WHERE DATE(checkin_time) = CURDATE() ORDER BY checkin_time DESC LIMIT 20)
            UNION ALL
            (SELECT id, tech_id AS user_id, 'job' AS type, timestamp AS created_at, 'ปิดงานเสร็จสิ้น' AS action FROM job_logs WHERE status='completed' AND DATE(timestamp) = CURDATE() ORDER BY timestamp DESC LIMIT 20)
          ) AS c
          LEFT JOIN users u ON u.id = c.user_id
          ORDER BY c.created_at DESC
          LIMIT 50
  `);
  console.log(JSON.stringify(f, null, 2));
  process.exit(0);
}
run();
