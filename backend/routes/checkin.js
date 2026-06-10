const express = require('express');
const pool    = require('../config/db');
const { auth } = require('../middleware/auth');
const { upload, setUpload } = require('../middleware/upload');

const router = express.Router();

// ── POST /api/checkin — Check in with selfie ───────────────
router.post(
  '/',
  auth,
  setUpload('checkins'),
  upload.single('image'),
  async (req, res) => {
    const userId = req.user.id;
    const today  = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    try {
      // Prevent double check-in on same day
      const [existing] = await pool.query(
        `SELECT id FROM checkins WHERE user_id = ? AND DATE(checkin_time) = ? LIMIT 1`,
        [userId, today]
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Already checked in today', checkin_id: existing[0].id });
      }

      // Removed block preventing admin from checking in. Admins are now allowed.

      // Fetch user specific and global/role settings
      const [userRow] = await pool.query(
        `SELECT allow_late_time, role, team_id FROM users WHERE id = ? LIMIT 1`, [userId]
      );
      const userRole = userRow[0]?.role || 'technician';
      const userTeamId = userRow[0]?.team_id;

      let lateThreshold;
      const type = req.body.type || 'general';

      if (type === 'ma') {
        const [maJobs] = await pool.query(
          `SELECT MIN(plan_arrival_time) as first_job_time 
           FROM ma_jobs 
           WHERE (team_id = ? OR field_engineer_id = ?) 
             AND plan_arrival_date = ?`,
          [userTeamId, userId, today]
        );

        if (maJobs.length > 0 && maJobs[0].first_job_time) {
          lateThreshold = maJobs[0].first_job_time;
        } else {
          // No jobs assigned today, default to not late
          lateThreshold = '23:59:59';
        }
      } else {
        const [settings] = await pool.query(
          `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('late_time', ?)`
          , [`late_time_${userRole}`]
        );

        let roleLateTime = null;
        let globalLateTime = '08:30:00';
        settings.forEach(s => {
          if (s.setting_key === 'late_time') globalLateTime = s.setting_value;
          if (s.setting_key === `late_time_${userRole}`) roleLateTime = s.setting_value;
        });

        lateThreshold = userRow[0]?.allow_late_time || roleLateTime || globalLateTime;
      }

      const nowTime       = new Date().toTimeString().slice(0, 8);
      const isLate        = nowTime > lateThreshold ? 1 : 0;

      const imagePath = req.file ? req.file.filename : null;
      const lat       = req.body.lat  ? parseFloat(req.body.lat)  : null;
      const lng       = req.body.lng  ? parseFloat(req.body.lng)  : null;

      const [result] = await pool.query(
        `INSERT INTO checkins (user_id, image_path, checkin_lat, checkin_lng, is_late)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, imagePath, lat, lng, isLate]
      );

      res.status(201).json({
        message:    isLate ? 'Checked in (late)' : 'Checked in on time',
        checkin_id: result.insertId,
        is_late:    !!isLate,
      });
    } catch (err) {
      console.error('Checkin error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── GET /api/checkin/ma-threshold — Get MA Check-in Deadline ───────────────
router.get('/ma-threshold', auth, async (req, res) => {
  const userId = req.user.id;
  const today  = new Date().toISOString().slice(0, 10);
  try {
    const [userRow] = await pool.query(`SELECT team_id FROM users WHERE id = ? LIMIT 1`, [userId]);
    const userTeamId = userRow[0]?.team_id;

    const [maJobs] = await pool.query(
      `SELECT MIN(plan_arrival_time) as first_job_time 
       FROM ma_jobs 
       WHERE (team_id = ? OR field_engineer_id = ?) 
         AND plan_arrival_date = ?`,
      [userTeamId, userId, today]
    );

    if (maJobs.length > 0 && maJobs[0].first_job_time) {
      res.json({ threshold: maJobs[0].first_job_time });
    } else {
      res.json({ threshold: null });
    }
  } catch (err) {
    console.error('ma-threshold error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/checkin/checkout — Check out, update same row ─
router.put(
  '/checkout',
  auth,
  setUpload('checkouts'),
  upload.single('image'),
  async (req, res) => {
    const userId = req.user.id;
    const today  = new Date().toISOString().slice(0, 10);

    try {
      const [rows] = await pool.query(
        `SELECT id, checkout_time FROM checkins
         WHERE user_id = ? AND DATE(checkin_time) = ?
         ORDER BY checkin_time DESC LIMIT 1`,
        [userId, today]
      );

      if (rows.length === 0) {
        return res.status(400).json({ error: 'No check-in found for today' });
      }
      if (rows[0].checkout_time) {
        return res.status(409).json({ error: 'Already checked out today' });
      }

      const imagePath = req.file ? req.file.filename : null;
      const lat       = req.body.lat ? parseFloat(req.body.lat) : null;
      const lng       = req.body.lng ? parseFloat(req.body.lng) : null;

      await pool.query(
        `UPDATE checkins
         SET checkout_time = NOW(), checkout_image = ?, checkout_lat = ?, checkout_lng = ?
         WHERE id = ?`,
        [imagePath, lat, lng, rows[0].id]
      );

      res.json({ message: 'Checked out successfully', checkin_id: rows[0].id });
    } catch (err) {
      console.error('Checkout error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── GET /api/checkin/today — My status today ───────────────
router.get('/today', auth, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [rows] = await pool.query(
      `SELECT id, checkin_time, checkout_time, is_late, image_path, checkout_image, is_edited
       FROM checkins
       WHERE user_id = ? AND DATE(checkin_time) = ?
       ORDER BY checkin_time DESC LIMIT 1`,
      [req.user.id, today]
    );
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/checkin/ma-performance — MA Team Performance Dashboard ───────────────
router.get('/ma-performance', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.some(r => ['super_admin', 'admin'].includes(r)) || ['super_admin', 'admin'].includes(req.user.role);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { month, allowed_late } = req.query; // e.g., '2023-10'
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });
    }
    
    // Fetch global targets
    const [settings] = await pool.query(
      `SELECT setting_key, setting_value FROM system_settings 
       WHERE setting_key IN ('ma_target_days', 'ma_target_jobs', 'allowed_late_days')`
    );
    const targets = {
      ma_target_days: 26,
      ma_target_jobs: 130,
      allowed_late_days: 0
    };
    settings.forEach(s => {
      targets[s.setting_key] = parseInt(s.setting_value) || 0;
    });

    // Use query param if provided (for backward compatibility), otherwise use DB setting
    const allowedLate = allowed_late !== undefined ? parseInt(allowed_late) : targets.allowed_late_days;
    const targetDays = targets.ma_target_days;
    const targetJobs = targets.ma_target_jobs;

    const [users] = await pool.query(
      `SELECT id, full_name, role, team_id FROM users WHERE role IN ('technician', 'ma') OR team_id IS NOT NULL`
    );

    const results = [];

    for (const u of users) {
      const [checkinStats] = await pool.query(
        `SELECT 
           COUNT(DISTINCT DATE(checkin_time)) as total_days,
           SUM(is_late) as total_late
         FROM checkins
         WHERE user_id = ? AND DATE_FORMAT(checkin_time, '%Y-%m') = ?`,
        [u.id, month]
      );

      const [jobStats] = await pool.query(
        `SELECT COUNT(*) as total_completed
         FROM ma_jobs
         WHERE (assigned_user_id = ? OR (team_id = ? AND team_id IS NOT NULL))
           AND status = 'completed'
           AND DATE_FORMAT(completed_at, '%Y-%m') = ?`,
        [u.id, u.team_id, month]
      );

      const totalDays = checkinStats[0]?.total_days || 0;
      const totalLate = checkinStats[0]?.total_late || 0;
      const totalCompleted = jobStats[0]?.total_completed || 0;

      const passed = totalDays >= targetDays && totalLate <= allowedLate && totalCompleted >= targetJobs;

      results.push({
        id: u.id,
        full_name: u.full_name,
        role: u.role,
        team_id: u.team_id,
        total_days: totalDays,
        total_late: totalLate,
        total_completed: totalCompleted,
        is_passed: passed
      });
    }

    res.json(results);
  } catch (err) {
    console.error('MA Performance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/checkin/history?limit=30 — My recent history (or All for Admin) ─
router.get('/history', auth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 90);
  const filterUserId = req.query.userId;
  const userRoles = req.user.roles || [req.user.role];
  const isAdmin = userRoles.some(r => ['super_admin', 'admin'].includes(r));

  try {
    if (isAdmin) {
      if (filterUserId === 'ALL' || !filterUserId) {
        const [rows] = await pool.query(
          `SELECT c.id, c.checkin_time, c.checkout_time, c.is_late, c.image_path, c.checkout_image, c.is_edited,
                  c.checkin_lat, c.checkin_lng, c.checkout_lat, c.checkout_lng,
                  u.full_name, u.username, u.role
           FROM checkins c
           JOIN users u ON c.user_id = u.id
           ORDER BY c.checkin_time DESC LIMIT ?`,
          [limit * 2]
        );
        return res.json(rows);
      } else if (filterUserId === 'ME') {
        const [rows] = await pool.query(
          `SELECT c.id, c.checkin_time, c.checkout_time, c.is_late, c.image_path, c.checkout_image, c.is_edited,
                  c.checkin_lat, c.checkin_lng, c.checkout_lat, c.checkout_lng,
                  u.full_name, u.username, u.role
           FROM checkins c
           JOIN users u ON c.user_id = u.id
           WHERE c.user_id = ?
           ORDER BY c.checkin_time DESC LIMIT ?`,
          [req.user.id, limit]
        );
        return res.json(rows);
      } else {
        const [rows] = await pool.query(
          `SELECT c.id, c.checkin_time, c.checkout_time, c.is_late, c.image_path, c.checkout_image, c.is_edited,
                  c.checkin_lat, c.checkin_lng, c.checkout_lat, c.checkout_lng,
                  u.full_name, u.username, u.role
           FROM checkins c
           JOIN users u ON c.user_id = u.id
           WHERE c.user_id = ?
           ORDER BY c.checkin_time DESC LIMIT ?`,
          [filterUserId, limit]
        );
        return res.json(rows);
      }
    } else {
      const [rows] = await pool.query(
        `SELECT id, checkin_time, checkout_time, is_late, image_path, checkout_image, is_edited,
                checkin_lat, checkin_lng, checkout_lat, checkout_lng
         FROM checkins WHERE user_id = ?
         ORDER BY checkin_time DESC LIMIT ?`,
        [req.user.id, limit]
      );
      res.json(rows);
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/checkin/edit — Edit Check-in Photo ────────────
router.put(
  '/edit',
  auth,
  setUpload('checkins'),
  upload.single('image'),
  async (req, res) => {
    const userId = req.user.id;
    const today  = new Date().toISOString().slice(0, 10);
    
    if (!req.file) {
      return res.status(400).json({ error: 'ไม่พบรูปภาพ' });
    }

    try {
      const [rows] = await pool.query(
        `SELECT id FROM checkins
         WHERE user_id = ? AND DATE(checkin_time) = ?
         ORDER BY checkin_time DESC LIMIT 1`,
        [userId, today]
      );

      if (rows.length === 0) {
        return res.status(400).json({ error: 'ไม่พบการเช็คอินสำหรับวันนี้' });
      }

      await pool.query(
        `UPDATE checkins
         SET image_path = ?, is_edited = 1
         WHERE id = ?`,
        [req.file.filename, rows[0].id]
      );

      res.json({ message: 'อัพเดทรูปภาพสำเร็จ', checkin_id: rows[0].id });
    } catch (err) {
      console.error('Edit checkin photo error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── GET /api/checkin/stats — My Check-in Stats ──────────────
router.get('/stats', auth, async (req, res) => {
  const filterUserId = req.query.userId;
  const userRoles = req.user.roles || [req.user.role];
  const isAdmin = userRoles.some(r => ['super_admin', 'admin'].includes(r));

  try {
    if (isAdmin) {
      if (filterUserId === 'ALL' || !filterUserId) {
        const [rows] = await pool.query(
          `SELECT 
             SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) AS late_count,
             SUM(CASE WHEN is_late = 0 THEN 1 ELSE 0 END) AS ontime_count
           FROM checkins`
        );
        return res.json({
          late: parseInt(rows[0].late_count || 0),
          ontime: parseInt(rows[0].ontime_count || 0)
        });
      } else if (filterUserId === 'ME') {
        const [rows] = await pool.query(
          `SELECT 
             SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) AS late_count,
             SUM(CASE WHEN is_late = 0 THEN 1 ELSE 0 END) AS ontime_count
           FROM checkins 
           WHERE user_id = ?`,
          [req.user.id]
        );
        return res.json({
          late: parseInt(rows[0].late_count || 0),
          ontime: parseInt(rows[0].ontime_count || 0)
        });
      } else {
        const [rows] = await pool.query(
          `SELECT 
             SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) AS late_count,
             SUM(CASE WHEN is_late = 0 THEN 1 ELSE 0 END) AS ontime_count
           FROM checkins 
           WHERE user_id = ?`,
          [filterUserId]
        );
        return res.json({
          late: parseInt(rows[0].late_count || 0),
          ontime: parseInt(rows[0].ontime_count || 0)
        });
      }
    } else {
      const [rows] = await pool.query(
        `SELECT 
           SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) AS late_count,
           SUM(CASE WHEN is_late = 0 THEN 1 ELSE 0 END) AS ontime_count
         FROM checkins 
         WHERE user_id = ?`,
        [req.user.id]
      );
      res.json({
        late: parseInt(rows[0].late_count || 0),
        ontime: parseInt(rows[0].ontime_count || 0)
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/checkin/summary — Admin Summary Dashboard ────────
router.get('/summary', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const hasAdmin = roles.includes('super_admin') || roles.includes('admin') || req.user.role === 'super_admin' || req.user.role === 'admin';
    if (!hasAdmin) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ในการเข้าถึงข้อมูล' });
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.role,
              COUNT(c.id) AS total_checkins,
              SUM(CASE WHEN c.is_late = 1 THEN 1 ELSE 0 END) AS total_late,
              SUM(CASE WHEN c.is_late = 0 THEN 1 ELSE 0 END) AS total_ontime,
              MAX(c.checkin_time) AS latest_checkin
       FROM users u
       LEFT JOIN checkins c ON u.id = c.user_id
       GROUP BY u.id
       ORDER BY u.role, u.full_name`
    );

    res.json(rows);
  } catch (err) {
    console.error('Summary dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/checkin/user/:id/history — User specific history for calendar ──
router.get('/user/:id/history', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const hasAdmin = roles.includes('super_admin') || roles.includes('admin') || req.user.role === 'super_admin' || req.user.role === 'admin';
    if (!hasAdmin && req.user.id.toString() !== req.params.id) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ในการเข้าถึงข้อมูล' });
    }

    const { month, date } = req.query;
    let query = `SELECT id, checkin_time, checkout_time, is_late, image_path, checkout_image, is_edited
                 FROM checkins WHERE user_id = ?`;
    const params = [req.params.id];

    if (date) {
      query += ` AND DATE(checkin_time) = ?`;
      params.push(date);
    } else if (month) {
      query += ` AND DATE_FORMAT(checkin_time, '%Y-%m') = ?`;
      params.push(month);
    }

    query += ` ORDER BY checkin_time DESC LIMIT 100`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('User history error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/checkin/:id — Admin Delete Check-in ────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const hasAdmin = roles.includes('super_admin') || roles.includes('admin') || req.user.role === 'super_admin' || req.user.role === 'admin';
    if (!hasAdmin) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ในการลบข้อมูล' });
    }
    const [result] = await pool.query(`DELETE FROM checkins WHERE id = ?`, [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'ไม่พบข้อมูล หรืออาจถูกลบไปแล้ว' });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Admin delete error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
  }
});

// ── PUT /api/checkin/admin/edit-photo/:id — Admin Replace Check-in Photo ──
router.put(
  '/admin/edit-photo/:id',
  auth,
  setUpload('checkins'),
  upload.single('image'),
  async (req, res) => {
    try {
      const roles = req.user.roles || [];
      const hasAdmin = roles.includes('super_admin') || roles.includes('admin') || req.user.role === 'super_admin' || req.user.role === 'admin';
      if (!hasAdmin) {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์แก้ไขรูปภาพ' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'ไม่พบรูปภาพ' });
      }
      const [result] = await pool.query(
        `UPDATE checkins SET image_path = ?, is_edited = 1 WHERE id = ?`,
        [req.file.filename, req.params.id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'ไม่พบข้อมูล' });
      }
      res.json({ message: 'อัปเดตรูปภาพสำเร็จ', checkin_id: req.params.id });
    } catch (err) {
      console.error('Admin edit-photo error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── PUT /api/checkin/admin/edit/:id — Admin Edit Check-in ──
router.put('/admin/edit/:id', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const hasAdmin = roles.includes('super_admin') || roles.includes('admin') || req.user.role === 'super_admin' || req.user.role === 'admin';
    if (!hasAdmin) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ในการแก้ไขข้อมูล' });
    }
    const { checkin_time, checkout_time, is_late } = req.body;
    await pool.query(
      `UPDATE checkins SET checkin_time = ?, checkout_time = ?, is_late = ? WHERE id = ?`,
      [checkin_time || null, checkout_time || null, is_late ? 1 : 0, req.params.id]
    );
    res.json({ message: 'Updated successfully' });
  } catch (err) {
    console.error('Admin edit error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
  }
});

module.exports = router;
