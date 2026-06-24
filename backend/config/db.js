const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'zvucfpsz_BO',
  password: process.env.DB_PASSWORD || '@2*]BC9AuGO^%P&-',
  database: process.env.DB_NAME || 'zvucfpsz_RT',
  waitForConnections: true,
  connectionLimit: 5,
  maxIdle: 5,
  idleTimeout: 30000,
  queueLimit: 0,
  timezone: '+07:00',
  charset: 'utf8mb4',
});

// Verify connection on startup
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log(`✅ MySQL connected — database: ${process.env.DB_NAME || 'zvucfpsz_RT'}`);
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed on startup:', err);
    // ไม่สั่ง process.exit(1) เพื่อไม่ให้เซิร์ฟเวอร์พัง 503
  }
})();

// Attach custom helper methods expected by server.js
pool.checkConnection = async () => {
  const conn = await pool.getConnection();
  conn.release();
  return { ok: true };
};

pool.formatError = (err) => err ? err.message : 'Unknown error';

pool.getConnectionInfo = () => ({
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'zvucfpsz_RT'
});
module.exports = pool;
