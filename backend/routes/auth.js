const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const pool     = require('../config/db');
const { auth } = require('../middleware/auth');
const { upload, setUpload } = require('../middleware/upload');
const { notifyUserRegistered } = require('../utils/accountNotifications');

const router = express.Router();

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน' });
  }

  try {
    // Check if account exists but not yet approved
    const [[pendingUser]] = await pool.query(
      `SELECT id, status FROM users WHERE username = ? LIMIT 1`,
      [username]
    );
    if (pendingUser && pendingUser.status === 'pending') {
      return res.status(403).json({ error: 'บัญชีของคุณรอผู้ดูแลระบบอนุมัติ กรุณารอสักครู่แล้วลองใหม่' });
    }
    if (pendingUser && pendingUser.status === 'rejected') {
      return res.status(403).json({ error: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' });
    }

    // Fetch user + all roles from user_roles
    const [users] = await pool.query(
      `SELECT u.*, t.team_name,
              GROUP_CONCAT(ur.role ORDER BY ur.role SEPARATOR ',') AS roles_csv
       FROM users u
       LEFT JOIN teams t ON t.id = u.team_id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.username = ? AND u.status = 'approved'
       GROUP BY u.id
       LIMIT 1`,
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = users[0];

    // Support both bcrypt (PHP $2y$ = JS $2b$) hashes
    const normalizedHash = user.password_hash.replace(/^\$2y\$/, '$2b$');
    const valid = await bcrypt.compare(password, normalizedHash);
    if (!valid) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    // Build roles array
    const rolesArr = user.roles_csv
      ? user.roles_csv.split(',')
      : [user.role];

    const payload = {
      id:        user.id,
      username:  user.username,
      role:      user.role,
      roles:     rolesArr,
      team_id:   user.team_id,
      team_name: user.team_name,
      full_name: user.full_name,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'BOU_SECRET_KEY_12345!@#', {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.json({
      token,
      user: {
        id:            user.id,
        username:      user.username,
        full_name:     user.full_name,
        role:          user.role,
        roles:         rolesArr,
        team_id:       user.team_id,
        team_name:     user.team_name,
        profile_image: user.profile_image,
      },
    });
  } catch (err) {
    const isDbConnectionError = pool.isConnectionError?.(err);
    const detail = pool.formatError ? pool.formatError(err) : err.message;
    if (isDbConnectionError) {
      console.error('Login DB error:', detail);
    } else {
      console.error('Login error:', err);
    }
    res.status(isDbConnectionError ? 503 : 500).json({ error: 'Database Error: ' + detail });
  }
});

// ── POST /api/auth/register — Employee self-registration (pending approval) ──
router.post('/register', async (req, res) => {
  const { username, password, full_name, role } = req.body;

  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ-นามสกุล ชื่อผู้ใช้ และรหัสผ่านให้ครบ' });
  }
  if (String(username).trim().length < 3) {
    return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร' });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' });
  }

  const allowedRoles = ['technician', 'ma_technician', 'contractor_office', 'contractor_ma', 'sales'];
  const primaryRole = allowedRoles.includes(role) ? role : 'technician';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const hash = await bcrypt.hash(password, 10);
    const [result] = await conn.query(
      `INSERT INTO users (username, password_hash, full_name, role, status, team_id)
       VALUES (?, ?, ?, ?, 'pending', NULL)`,
      [String(username).trim(), hash, String(full_name).trim(), primaryRole]
    );
    const userId = result.insertId;

    await conn.query(
      `INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)`,
      [userId, primaryRole]
    );

    await conn.commit();

    notifyUserRegistered({
      userId,
      userName: String(full_name).trim(),
      username: String(username).trim(),
      role: primaryRole,
    }).catch((e) => console.error('notifyUserRegistered:', e.message));

    res.status(201).json({
      message: 'ลงทะเบียนสำเร็จ รอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน',
      id: userId,
    });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว กรุณาเลือกชื่ออื่น' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
  } finally {
    conn.release();
  }
});

// ── GET /api/auth/me — refresh own profile ─────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.role, u.team_id,
              u.profile_image, u.status, u.allow_late_time,
              t.team_name,
              GROUP_CONCAT(ur.role SEPARATOR ',') AS roles_csv
       FROM users u
       LEFT JOIN teams t      ON t.id = u.team_id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.id = ?
       GROUP BY u.id`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    res.json({
      ...u,
      roles: u.roles_csv ? u.roles_csv.split(',') : [u.role],
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/auth/change-password ─────────────────────────
router.put('/change-password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'กรุณาระบุรหัสผ่านเดิมและรหัสผ่านใหม่' });
  }

  try {
    const [users] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    
    const user = users[0];
    const normalizedHash = user.password_hash.replace(/^\$2y\$/, '$2b$');
    const valid = await bcrypt.compare(oldPassword, normalizedHash);
    
    if (!valid) {
      return res.status(401).json({ error: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
    res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
  }
});

// ── PUT /api/auth/profile-image ───────────────────────────
router.put('/profile-image', auth, setUpload('profiles'), upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'กรุณาอัปโหลดรูปภาพ' });
  }
  try {
    const filename = req.file.filename;
    await pool.query('UPDATE users SET profile_image = ? WHERE id = ?', [filename, req.user.id]);
    res.json({ message: 'อัปเดตรูปโปรไฟล์สำเร็จ', profile_image: filename });
  } catch (err) {
    console.error('Profile image upload error:', err);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตรูปโปรไฟล์ได้' });
  }
});

module.exports = router;
