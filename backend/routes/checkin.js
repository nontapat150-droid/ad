const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const { upload, setUpload } = require('../middleware/upload');

const router = express.Router();

function normalizeTimeToHms(raw) {
  if (!raw) return null;
  if (raw instanceof Date) {
    return raw.toTimeString().slice(0, 8);
  }
  const s = String(raw).trim();
  // "2026-07-12 08:30:00" or "08:30:00" or "08:30"
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const hh = m[1].padStart(2, '0');
  const mm = m[2];
  const ss = (m[3] || '00').padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

async function ensureLeaveTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leave_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      leave_date DATE NOT NULL,
      reason TEXT,
      image_path VARCHAR(255) DEFAULT NULL,
      leave_type VARCHAR(50) DEFAULT 'general',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_leave_date (user_id, leave_date),
      INDEX idx_leave_date (leave_date),
      CONSTRAINT fk_leave_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

// ── POST /api/checkin/leave — Request leave ─────────────────
router.post(
  '/leave',
  auth,
  setUpload('leaves'),
  upload.single('image'),
  async (req, res) => {
    try {
      await ensureLeaveTable();

      const userId = req.user.id;
      const { leave_date, reason, leave_type } = req.body;
      const today = new Date().toISOString().slice(0, 10);

      if (!leave_date) {
        return res.status(400).json({ error: 'กรุณาเลือกวันที่ลา' });
      }
      if (leave_date < today) {
        return res.status(400).json({ error: 'ไม่สามารถลาย้อนหลังได้' });
      }

      const reasonText = (reason || '').trim();
      const imagePath = req.file ? req.file.filename : null;
      if (!reasonText && !imagePath) {
        return res.status(400).json({ error: 'กรุณาระบุสาเหตุหรือแนบรูปภาพ' });
      }

      const [existingCheckin] = await pool.query(
        `SELECT id FROM checkins WHERE user_id = ? AND DATE(checkin_time) = ? LIMIT 1`,
        [userId, leave_date]
      );
      if (existingCheckin.length > 0) {
        return res.status(409).json({ error: 'วันนี้มีการเช็คอินแล้ว ไม่สามารถลาได้' });
      }

      const [existingLeave] = await pool.query(
        `SELECT id FROM leave_records WHERE user_id = ? AND leave_date = ? LIMIT 1`,
        [userId, leave_date]
      );
      if (existingLeave.length > 0) {
        return res.status(409).json({ error: 'คุณได้แจ้งลาในวันนี้แล้ว' });
      }

      const [result] = await pool.query(
        `INSERT INTO leave_records (user_id, leave_date, reason, image_path, leave_type)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, leave_date, reasonText || null, imagePath, leave_type || 'general']
      );

      res.status(201).json({ message: 'บันทึกการลาสำเร็จ', id: result.insertId });
    } catch (err) {
      console.error('Leave request error:', err);
      res.status(500).json({ error: 'Server error: ' + err.message });
    }
  }
);

// ── GET /api/checkin/leaves — Leave history ─────────────────
router.get('/leaves', auth, async (req, res) => {
  try {
    await ensureLeaveTable();

    const limit = Math.min(parseInt(req.query.limit) || 30, 90);
    const filterUserId = req.query.userId;
    const userRoles = req.user.roles || [req.user.role];
    const isAdmin = userRoles.some(r => ['super_admin', 'admin'].includes(r));
    const { cond: timeCond, params: timeParams } = buildTimeFilter(req.query, 'l.leave_date');

    if (isAdmin) {
      if (filterUserId === 'ALL' || !filterUserId) {
        const [rows] = await pool.query(
          `SELECT l.id, l.leave_date, l.reason, l.image_path, l.leave_type, l.created_at,
                  u.full_name, u.username, u.role
           FROM leave_records l
           JOIN users u ON l.user_id = u.id
           WHERE 1=1${timeCond}
           ORDER BY l.leave_date DESC, l.created_at DESC
           LIMIT ?`,
          [...timeParams, limit]
        );
        return res.json(rows);
      }
      const targetId = filterUserId === 'ME' ? req.user.id : filterUserId;
      const [rows] = await pool.query(
        `SELECT l.id, l.leave_date, l.reason, l.image_path, l.leave_type, l.created_at,
                u.full_name, u.username, u.role
         FROM leave_records l
         JOIN users u ON l.user_id = u.id
         WHERE l.user_id = ?${timeCond}
         ORDER BY l.leave_date DESC, l.created_at DESC
         LIMIT ?`,
        [targetId, ...timeParams, limit]
      );
      return res.json(rows);
    }

    const [rows] = await pool.query(
      `SELECT id, leave_date, reason, image_path, leave_type, created_at
       FROM leave_records
       WHERE user_id = ?
       ORDER BY leave_date DESC, created_at DESC
       LIMIT ?`,
      [req.user.id, limit]
    );
    res.json(rows);
  } catch (err) {
    console.error('Leave history error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/checkin/reverse-geocode — Address from GPS ────
router.get('/reverse-geocode', auth, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      return res.status(400).json({ error: 'พิกัดไม่ถูกต้อง' });
    }

    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'th');
    url.searchParams.set('zoom', '18');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'BountCheckin/1.0 (attendance reverse-geocode)',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'ไม่สามารถค้นหาที่อยู่ได้' });
    }

    const data = await response.json();
    const a = data.address || {};

    // Thai OSM fields vary; pick best available for ซอย / ตำบล / อำเภอ / จังหวัด
    const road = a.road || a.pedestrian || a.path || a.residential || '';
    const isSoiRoad = /ซอย|soi/i.test(road);
    const soi = a.alley || (isSoiRoad ? road : '') || '';
    const street = road && !isSoiRoad ? road : '';
    const tambon =
      a.suburb ||
      a.subdistrict ||
      a.village ||
      a.quarter ||
      a.hamlet ||
      a.neighbourhood ||
      '';
    const amphoe =
      a.city_district ||
      a.municipality ||
      a.city ||
      a.town ||
      a.county ||
      a.district ||
      '';
    const province = a.state || a.province || '';
    const houseNumber = a.house_number || '';

    const withPrefix = (value, prefixes, defaultPrefix) => {
      if (!value) return '';
      if (prefixes.some((p) => value.startsWith(p))) return value;
      return `${defaultPrefix}${value}`;
    };

    const parts = [];
    if (houseNumber) parts.push(`เลขที่ ${houseNumber}`);
    if (soi) parts.push(withPrefix(soi, ['ซอย', 'Soi', 'soi'], 'ซอย '));
    if (street) parts.push(street);
    if (tambon) parts.push(withPrefix(tambon, ['ตำบล', 'แขวง'], 'ตำบล'));
    if (amphoe) parts.push(withPrefix(amphoe, ['อำเภอ', 'เขต'], 'อำเภอ'));
    if (province) parts.push(withPrefix(province, ['จังหวัด'], 'จังหวัด'));

    const detail = parts.filter(Boolean).join(' ');
    const display = detail || data.display_name || '';

    res.json({
      display,
      detail,
      soi: soi || null,
      tambon: tambon || null,
      amphoe: amphoe || null,
      province: province || null,
      road: street || road || null,
      house_number: houseNumber || null,
      raw: a,
    });
  } catch (err) {
    console.error('Reverse geocode error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/checkin — Check in with selfie ───────────────
router.post(
  '/',
  auth,
  setUpload('checkins'),
  upload.single('image'),
  async (req, res) => {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    try {
      // Prevent check-in if leave recorded for today
      await ensureLeaveTable();
      const [leaveToday] = await pool.query(
        `SELECT id FROM leave_records WHERE user_id = ? AND leave_date = ? LIMIT 1`,
        [userId, today]
      );
      if (leaveToday.length > 0) {
        return res.status(409).json({ error: 'วันนี้คุณได้แจ้งลาแล้ว ไม่สามารถเช็คอินได้' });
      }

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
          `SELECT MIN(job_time) as first_job_time 
           FROM ma_jobs 
           WHERE (team_id = ? OR assigned_user_id = ?) 
             AND plan_arrival_date = ?
             AND job_time IS NOT NULL AND job_time != ''`,
          [userTeamId || -1, userId, today]
        );

        if (maJobs.length > 0 && maJobs[0].first_job_time) {
          lateThreshold = normalizeTimeToHms(maJobs[0].first_job_time);
        } else {
          // No jobs assigned today, prevent check-in
          return res.status(400).json({ error: 'ยังไม่มีงานที่ได้รับมอบหมายในวันนี้ ไม่สามารถเช็คอินได้' });
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

        lateThreshold = normalizeTimeToHms(userRow[0]?.allow_late_time || roleLateTime || globalLateTime);
      }

      const nowTime = new Date().toTimeString().slice(0, 8);
      // เช็คอินก่อนหรือตรงเวลาเข้างานแรก = ไม่สาย (nowTime > threshold เท่านั้นถึงจะสาย)
      const isLate = lateThreshold && nowTime > lateThreshold ? 1 : 0;

      const imagePath = req.file ? req.file.filename : null;
      const lat = req.body.lat ? parseFloat(req.body.lat) : null;
      const lng = req.body.lng ? parseFloat(req.body.lng) : null;

      const [result] = await pool.query(
        `INSERT INTO checkins (user_id, image_path, checkin_lat, checkin_lng, is_late, checkin_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, imagePath, lat, lng, isLate, type]
      );

      res.status(201).json({
        message: isLate ? 'Checked in (late)' : 'Checked in on time',
        checkin_id: result.insertId,
        is_late: !!isLate,
      });
    } catch (err) {
      console.error('Checkin error:', err);
      res.status(500).json({ error: 'Server error: ' + err.message });
    }
  }
);

// ── POST /api/checkin/admin/manual — Admin Manual Checkin ───────────────
router.post(
  '/admin/manual',
  auth,
  setUpload('checkins'),
  upload.fields([{ name: 'checkin_image', maxCount: 1 }, { name: 'checkout_image', maxCount: 1 }]),
  async (req, res) => {
    // Only admin can do this
    const roles = req.user.roles || [];
    const hasAdmin = roles.includes('super_admin') || roles.includes('admin') || req.user.role === 'super_admin' || req.user.role === 'admin';
    if (!hasAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { user_id, checkin_time, checkout_time, is_late } = req.body;
    if (!user_id || !checkin_time) {
      return res.status(400).json({ error: 'Missing user_id or checkin_time' });
    }

    const checkinImagePath = req.files && req.files['checkin_image'] ? req.files['checkin_image'][0].filename : null;
    const checkoutImagePath = req.files && req.files['checkout_image'] ? req.files['checkout_image'][0].filename : null;

    try {
      const [result] = await pool.query(
        `INSERT INTO checkins (user_id, checkin_time, checkout_time, image_path, checkout_image, is_late, is_edited)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          user_id,
          new Date(checkin_time),
          checkout_time ? new Date(checkout_time) : null,
          checkinImagePath,
          checkoutImagePath,
          is_late === '1' || is_late === 1 ? 1 : 0
        ]
      );

      res.status(201).json({ message: 'Manual checkin added successfully', id: result.insertId });
    } catch (err) {
      console.error('Manual checkin error:', err);
      res.status(500).json({ error: 'Server error: ' + err.message });
    }
  }
);

// ── GET /api/checkin/migrate-db ────────────────────────────
router.get('/migrate-db', async (req, res) => {
  try {
    await pool.query(`ALTER TABLE checkins ADD COLUMN checkin_type VARCHAR(50) DEFAULT 'general'`);
    res.json({ message: 'Migration successful' });
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      res.json({ message: 'Column already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// ── GET /api/checkin/ma-threshold — Get MA Check-in Deadline ───────────────
router.get('/ma-threshold', auth, async (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [userRow] = await pool.query(`SELECT team_id FROM users WHERE id = ? LIMIT 1`, [userId]);
    const userTeamId = userRow[0]?.team_id;

    const [maJobs] = await pool.query(
      `SELECT MIN(job_time) as first_job_time 
       FROM ma_jobs 
       WHERE (team_id = ? OR assigned_user_id = ?) 
         AND plan_arrival_date = ?
         AND job_time IS NOT NULL AND job_time != ''`,
      [userTeamId || -1, userId, today]
    );

    if (maJobs.length > 0 && maJobs[0].first_job_time) {
      const threshold = normalizeTimeToHms(maJobs[0].first_job_time);
      res.json({ threshold, rule: 'ก่อนหรือตรงเวลาเข้างานแรก = ไม่สาย' });
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
    const today = new Date().toISOString().slice(0, 10);

    try {
      const [rows] = await pool.query(
        `SELECT id, checkout_time FROM checkins
         WHERE user_id = ? AND DATE(checkin_time) = ?
         ORDER BY checkin_time DESC LIMIT 1`,
        [userId, today]
      );

      if (rows.length === 0) {
        return res.status(400).json({ error: 'ไม่พบข้อมูลการเข้างานในวันนี้ กรุณาเข้างานก่อน' });
      }
      if (rows[0].checkout_time) {
        return res.status(409).json({ error: 'คุณได้ทำการเลิกงานไปแล้วในวันนี้' });
      }

      const imagePath = req.file ? req.file.filename : null;
      const lat = req.body.lat ? parseFloat(req.body.lat) : null;
      const lng = req.body.lng ? parseFloat(req.body.lng) : null;

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
      `SELECT u.id, u.full_name, u.role, u.team_id,
              t.team_name,
              GROUP_CONCAT(ur2.role ORDER BY ur2.role SEPARATOR ',') AS roles_csv
       FROM users u
       LEFT JOIN teams t ON t.id = u.team_id
       LEFT JOIN user_roles ur2 ON ur2.user_id = u.id
       WHERE u.status = 'approved'
         AND (
           u.role IN ('ma_technician', 'contractor_ma')
           OR u.id IN (SELECT user_id FROM user_roles WHERE role IN ('ma_technician', 'contractor_ma'))
         )
       GROUP BY u.id, u.full_name, u.role, u.team_id, t.team_name`
    );

    const results = [];

    for (const u of users) {
      const [checkinStats] = await pool.query(
        `SELECT 
           COUNT(DISTINCT DATE(checkin_time)) as total_days,
           SUM(is_late) as total_late
         FROM checkins
         WHERE user_id = ? AND DATE_FORMAT(checkin_time, '%Y-%m') = ?
           AND checkin_type = 'ma'`,
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
        team_name: u.team_name || null,
        roles: u.roles_csv ? u.roles_csv.split(',') : [u.role],
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

// Build an extra SQL condition from ?date=YYYY-MM-DD or ?month=YYYY-MM
function buildTimeFilter(query, column) {
  if (query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
    return { cond: ` AND DATE(${column}) = ?`, params: [query.date] };
  }
  if (query.month && /^\d{4}-\d{2}$/.test(query.month)) {
    return { cond: ` AND DATE_FORMAT(${column}, '%Y-%m') = ?`, params: [query.month] };
  }
  return { cond: '', params: [] };
}

// Optional ?checkin_type=general|ma|sales — separate KPI for multi-role users
function buildCheckinTypeFilter(query, column = 'checkin_type') {
  const t = (query.checkin_type || query.type || '').toString().trim();
  if (['general', 'ma', 'sales'].includes(t)) {
    return { cond: ` AND ${column} = ?`, params: [t] };
  }
  return { cond: '', params: [] };
}

// ── GET /api/checkin/history?limit=30 — My recent history (or All for Admin) ─
router.get('/history', auth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 90);
  const filterUserId = req.query.userId;
  const userRoles = req.user.roles || [req.user.role];
  const isAdmin = userRoles.some(r => ['super_admin', 'admin'].includes(r));
  const { cond: timeCond, params: timeParams } = buildTimeFilter(req.query, 'c.checkin_time');
  const { cond: typeCond, params: typeParams } = buildCheckinTypeFilter(req.query, 'c.checkin_type');

  try {
    const baseSelect = `SELECT c.id, c.checkin_time, c.checkout_time, c.is_late, c.image_path, c.checkout_image, c.is_edited,
                c.checkin_lat, c.checkin_lng, c.checkout_lat, c.checkout_lng, c.checkin_type,
                u.full_name, u.username, u.role
         FROM checkins c
         JOIN users u ON c.user_id = u.id`;

    if (isAdmin && (filterUserId === 'ALL' || !filterUserId)) {
      const [rows] = await pool.query(
        `${baseSelect} WHERE 1=1${timeCond}${typeCond} ORDER BY c.checkin_time DESC LIMIT ?`,
        [...timeParams, ...typeParams, limit * 2]
      );
      return res.json(rows);
    }

    const targetId = isAdmin
      ? (filterUserId === 'ME' ? req.user.id : filterUserId)
      : req.user.id;
    const [rows] = await pool.query(
      `${baseSelect} WHERE c.user_id = ?${timeCond}${typeCond} ORDER BY c.checkin_time DESC LIMIT ?`,
      [targetId, ...timeParams, ...typeParams, limit]
    );
    return res.json(rows);
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
    const today = new Date().toISOString().slice(0, 10);

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
  const { cond: timeCond, params: timeParams } = buildTimeFilter(req.query, 'checkin_time');
  const { cond: typeCond, params: typeParams } = buildCheckinTypeFilter(req.query, 'checkin_type');

  try {
    const baseSelect = `SELECT
         SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) AS late_count,
         SUM(CASE WHEN is_late = 0 THEN 1 ELSE 0 END) AS ontime_count
       FROM checkins`;

    let rows;
    if (isAdmin && (filterUserId === 'ALL' || !filterUserId)) {
      [rows] = await pool.query(
        `${baseSelect} WHERE 1=1${timeCond}${typeCond}`,
        [...timeParams, ...typeParams]
      );
    } else {
      const targetId = isAdmin
        ? (filterUserId === 'ME' ? req.user.id : filterUserId)
        : req.user.id;
      [rows] = await pool.query(
        `${baseSelect} WHERE user_id = ?${timeCond}${typeCond}`,
        [targetId, ...timeParams, ...typeParams]
      );
    }
    res.json({
      late: parseInt(rows[0].late_count || 0),
      ontime: parseInt(rows[0].ontime_count || 0)
    });
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

      const type = req.body.type || 'checkin';
      const fieldName = type === 'checkout' ? 'checkout_image' : 'image_path';

      let filename = req.file.filename;

      // ถ้าเป็น checkout ต้องย้ายไฟล์จากโฟลเดอร์ checkins ไปที่ checkouts
      if (type === 'checkout') {
        const fs = require('fs');
        const path = require('path');
        const oldPath = req.file.path;
        const newDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', 'checkouts');

        fs.mkdirSync(newDir, { recursive: true });

        // สร้างโฟลเดอร์ถ้ายังไม่มี
        fs.mkdirSync(newDir, { recursive: true });

        // เปลี่ยน prefix ชื่อไฟล์จาก checkins_ เป็น checkouts_
        filename = filename.replace(/^checkins_/, 'checkouts_');
        const newPath = path.join(newDir, filename);

        if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
        }
      }

      const [result] = await pool.query(
        `UPDATE checkins SET ${fieldName} = ?, is_edited = 1 WHERE id = ?`,
        [filename, req.params.id]
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

// ── POST /api/checkin/admin/manual — Admin Manual Check-in ──
router.post(
  '/admin/manual',
  auth,
  setUpload('checkins'),
  upload.fields([{ name: 'checkin_image', maxCount: 1 }, { name: 'checkout_image', maxCount: 1 }]),
  async (req, res) => {
    try {
      const roles = req.user.roles || [];
      const hasAdmin = roles.includes('super_admin') || roles.includes('admin') || req.user.role === 'super_admin' || req.user.role === 'admin';
      if (!hasAdmin) {
        return res.status(403).json({ error: 'คุณไม่มีสิทธิ์' });
      }

      const { user_id, checkin_time, checkout_time, is_late } = req.body;

      if (!user_id || !checkin_time) {
        return res.status(400).json({ error: 'กรุณาระบุพนักงานและเวลาเข้างาน' });
      }

      let checkinImage = null;
      let checkoutImage = null;

      if (req.files && req.files['checkin_image']) {
        checkinImage = req.files['checkin_image'][0].filename;
      }

      if (req.files && req.files['checkout_image']) {
        const file = req.files['checkout_image'][0];
        checkoutImage = file.filename;
        // Move it to checkouts dir
        const fs = require('fs');
        const path = require('path');
        const oldPath = file.path;
        const newDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', 'checkouts');
        if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
        
        checkoutImage = checkoutImage.replace(/^checkins_/, 'checkouts_');
        const newPath = path.join(newDir, checkoutImage);
        fs.renameSync(oldPath, newPath);
      }

      const [result] = await pool.query(
        `INSERT INTO checkins (user_id, checkin_time, checkout_time, is_late, image_path, checkout_image, is_edited)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [user_id, checkin_time, checkout_time || null, is_late === 'true' || is_late === true ? 1 : 0, checkinImage, checkoutImage]
      );

      res.status(201).json({ message: 'บันทึกข้อมูลเรียบร้อยแล้ว', id: result.insertId });
    } catch (err) {
      console.error('Manual checkin error:', err);
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

// ── GET /api/checkin/export-monthly — Export checkins for a month ──
router.get('/export-monthly', auth, async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM
    if (!month) return res.status(400).json({ error: 'Missing month parameter' });

    // Get users (excluding admins)
    const [users] = await pool.query(
      `SELECT id, username, full_name, role 
       FROM users 
       WHERE role != 'admin' AND role != 'super_admin' AND status = 'approved'
       ORDER BY role, full_name, username`
    );

    // Get checkins for the month (both normal and MA checkins)
    const [checkins] = await pool.query(
      `SELECT user_id, 
              DATE_FORMAT(checkin_time, '%Y-%m-%dT%H:%i:%s') AS checkin_time, 
              DATE_FORMAT(checkout_time, '%Y-%m-%dT%H:%i:%s') AS checkout_time, 
              is_late 
       FROM checkins 
       WHERE DATE_FORMAT(checkin_time, '%Y-%m') = ?
       UNION ALL
       SELECT user_id, 
              DATE_FORMAT(checkin_time, '%Y-%m-%dT%H:%i:%s') AS checkin_time, 
              DATE_FORMAT(checkout_time, '%Y-%m-%dT%H:%i:%s') AS checkout_time, 
              is_late 
       FROM ma_checkins 
       WHERE DATE_FORMAT(checkin_time, '%Y-%m') = ?`,
      [month, month]
    );

    res.json({ users, checkins });
  } catch (err) {
    console.error('Export checkins error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
