const express = require('express');
const pool    = require('../config/db');
const bcrypt  = require('bcryptjs');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const ADMIN_ROLES = ['super_admin', 'admin'];

// ── GET /api/users — List all users (admin only) ───────────
router.get('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.role, u.status,
              u.team_id, t.team_name, u.profile_image, u.created_at, u.allow_late_time,
              GROUP_CONCAT(ur.role ORDER BY ur.role SEPARATOR ',') AS roles_csv
       FROM users u
       LEFT JOIN teams t      ON t.id = u.team_id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       GROUP BY u.id, u.username, u.full_name, u.role, u.status, u.team_id, t.team_name, u.profile_image, u.created_at
       ORDER BY u.created_at DESC`
    );
    res.json(rows.map((r) => ({ ...r, roles: r.roles_csv ? r.roles_csv.split(',') : [r.role] })));
  } catch (err) {
    console.error('GET /api/users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/users/teams — List all teams ──────────────────
router.get('/teams', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, COUNT(u.id) AS member_count
       FROM teams t
       LEFT JOIN users u ON u.team_id = t.id
       GROUP BY t.id ORDER BY t.team_name`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/users/teams error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/users/teams — Create a new team ──────────────────
router.post('/teams', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { team_name } = req.body;
  if (!team_name) {
    return res.status(400).json({ error: 'team_name is required' });
  }
  try {
    const [result] = await pool.query('INSERT INTO teams (team_name) VALUES (?)', [team_name]);
    res.status(201).json({ message: 'Team created', id: result.insertId });
  } catch (err) {
    console.error('Create team error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Team name already exists' });
    }
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── POST /api/users — Create user ──────────────────────────
router.post('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { username, password, full_name, role = 'technician', status = 'approved', team_id, extra_roles = [], allow_late_time = '08:30:00' } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'username, password, full_name required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const hash = await bcrypt.hash(password, 10);
    const [result] = await conn.query(
      `INSERT INTO users (username, password_hash, full_name, role, status, team_id, allow_late_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, hash, full_name, role, status, team_id || null, allow_late_time]
    );
    const userId = result.insertId;

    // Seed user_roles with primary + extra roles
    const allRoles = [...new Set([role, ...extra_roles])];
    for (const r of allRoles) {
      await conn.query(
        `INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)`, [userId, r]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'User created', id: userId });
  } catch (err) {
    await conn.rollback();
    console.error('Create user error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── PUT /api/users/:id/roles — Update user's multi-roles ───
router.put('/:id/roles', auth, requireRole(['super_admin']), async (req, res) => {
  const { roles = [] } = req.body;
  const userId = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    for (const r of roles) {
      await conn.query(
        `INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)`, [userId, r]
      );
    }
    // Keep primary role in sync
    if (roles.length > 0) {
      await conn.query(`UPDATE users SET role = ? WHERE id = ?`, [roles[0], userId]);
    }
    await conn.commit();
    res.json({ message: 'Roles updated' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── PUT /api/users/:id — Update user details ──────────────
router.put('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  let { username, password, full_name, role, status, team_id, extra_roles = [], allow_late_time } = req.body;
  if (!allow_late_time) allow_late_time = '08:30:00';
  const userId = req.params.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let query = 'UPDATE users SET username=?, full_name=?, role=?, status=?, team_id=?, allow_late_time=?';
    let params = [username, full_name, role, status, team_id || null, allow_late_time];

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query += ', password_hash=?';
      params.push(hash);
    }
    
    query += ' WHERE id=?';
    params.push(userId);

    await conn.query(query, params);

    // Update user_roles
    await conn.query(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    const allRoles = [...new Set([role, ...extra_roles])];
    for (const r of allRoles) {
      await conn.query(
        `INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)`, [userId, r]
      );
    }

    await conn.commit();
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── DELETE /api/users/:id — Delete user ───────────────────
router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const userId = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Delete child rows first
    await conn.query('DELETE FROM user_roles WHERE user_id = ?', [userId]);
    
    // Attempt to delete the user
    await conn.query('DELETE FROM users WHERE id = ?', [userId]);
    
    await conn.commit();
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('Delete user error:', err);
    // Handle foreign key constraint error
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(400).json({ error: 'ไม่สามารถลบได้ เนื่องจากผู้ใช้นี้มีประวัติผูกกับข้อมูลอื่นแล้ว (เช่น ข้อมูลงาน หรือรายการน้ำมัน) แนะนำให้ไปที่แก้ไขแล้วเปลี่ยนสถานะเป็น "ระงับการใช้งาน" แทนครับ' });
    }
    res.status(500).json({ error: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── GET /api/users/settings/late_time — Get late times ─────
router.get('/settings/late_time', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'late_time%'`
    );
    const settings = rows.reduce((acc, row) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/users/settings/late_time — Update late times ───
router.put('/settings/late_time', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const settings = req.body; // e.g., { late_time: '08:30:00', late_time_technician: '09:00:00' }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [key, value] of Object.entries(settings)) {
      if (key.startsWith('late_time')) {
        await conn.query(
          `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = ?`,
          [key, value, value]
        );
      }
    }
    await conn.commit();
    res.json({ message: 'Late times updated successfully' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

module.exports = router;
