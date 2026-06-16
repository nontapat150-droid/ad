const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'zvucfpsz_RT',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  const [rows] = await pool.query('SELECT * FROM jobs LIMIT 5');
  console.log(rows.map(r => ({ id: r.id, access_no: r.access_no })));
  process.exit(0);
}
test();
