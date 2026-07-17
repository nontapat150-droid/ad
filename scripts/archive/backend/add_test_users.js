const pool = require('./config/db');
const bcrypt = require('bcryptjs');

async function addUsers() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const passwordHash = await bcrypt.hash('111', 10);

    // 1. Admin: username 'mmm', role 'admin', full_name 'ผู้ดูแลระบบ'
    try {
      let [res] = await conn.query(
        `INSERT INTO users (username, password_hash, full_name, role, status, allow_late_time) VALUES (?, ?, ?, ?, ?, ?)`,
        ['mmm', passwordHash, 'ผู้ดูแลระบบ mmm', 'admin', 'approved', '08:30:00']
      );
      let adminId = res.insertId;
      await conn.query(`INSERT INTO user_roles (user_id, role) VALUES (?, ?)`, [adminId, 'admin']);
      console.log('Added admin user: mmm');
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') console.log('Admin user mmm already exists.');
      else throw e;
    }

    // 2. Tech: username 'tt', role 'technician', full_name 'ช่าง tt'
    try {
      let [res] = await conn.query(
        `INSERT INTO users (username, password_hash, full_name, role, status, allow_late_time) VALUES (?, ?, ?, ?, ?, ?)`,
        ['tt', passwordHash, 'ช่าง tt', 'technician', 'approved', '08:30:00']
      );
      let techId = res.insertId;
      await conn.query(`INSERT INTO user_roles (user_id, role) VALUES (?, ?)`, [techId, 'technician']);
      console.log('Added tech user: tt');
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') console.log('Tech user tt already exists.');
      else throw e;
    }

    await conn.commit();
    console.log('Done.');
  } catch (err) {
    await conn.rollback();
    console.error('Error adding users:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

addUsers();
