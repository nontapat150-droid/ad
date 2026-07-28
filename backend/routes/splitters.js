const express = require('express');
const pool = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

const READ_ROLES = ['sales', 'admin', 'super_admin'];
const ADMIN_ROLES = ['admin', 'super_admin'];
const DEFAULT_RADIUS_M = 3000;

let schemaReady = false;
let schemaPromise = null;

async function ensureSplittersSchema(db = pool) {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS splitters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(100) NULL,
        name VARCHAR(255) NULL,
        lat DECIMAL(10, 7) NOT NULL,
        lng DECIMAL(10, 7) NOT NULL,
        area VARCHAR(255) NULL,
        remark TEXT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_splitters_status (status),
        KEY idx_splitters_lat_lng (lat, lng),
        KEY idx_splitters_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    schemaReady = true;
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });

  return schemaPromise;
}

function parseCoord(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Haversine distance in meters */
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeStatus(status) {
  const s = String(status || 'active').trim().toLowerCase();
  return s === 'inactive' ? 'inactive' : 'active';
}

// ── GET /api/splitters — list ───────────────────────────────
router.get('/', auth, requireRole(READ_ROLES), async (req, res) => {
  try {
    await ensureSplittersSchema();
    const status = String(req.query.status || 'active').trim().toLowerCase();
    const q = String(req.query.q || '').trim();
    const where = [];
    const params = [];

    if (status === 'active' || status === 'inactive') {
      where.push('s.status = ?');
      params.push(status);
    } else if (status !== 'all') {
      where.push('s.status = ?');
      params.push('active');
    }

    if (q) {
      const like = `%${q}%`;
      where.push('(s.code LIKE ? OR s.name LIKE ? OR s.area LIKE ? OR s.remark LIKE ?)');
      params.push(like, like, like, like);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT s.*, u.full_name AS created_by_name
       FROM splitters s
       LEFT JOIN users u ON u.id = s.created_by
       ${whereClause}
       ORDER BY s.updated_at DESC, s.id DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('splitters list:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── GET /api/splitters/nearby — must be before /:id ─────────
router.get('/nearby', auth, requireRole(READ_ROLES), async (req, res) => {
  try {
    await ensureSplittersSchema();
    const lat = parseCoord(req.query.lat);
    const lng = parseCoord(req.query.lng);
    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'ต้องระบุ lat และ lng' });
    }

    let radiusM = parseInt(req.query.radius_m, 10);
    if (!Number.isFinite(radiusM) || radiusM <= 0) radiusM = DEFAULT_RADIUS_M;
    if (radiusM > 50000) radiusM = 50000;

    // Rough bounding box (~111km per degree) to limit rows before exact haversine
    const deg = radiusM / 111000;
    const [rows] = await pool.query(
      `SELECT s.*
       FROM splitters s
       WHERE s.status = 'active'
         AND s.lat BETWEEN ? AND ?
         AND s.lng BETWEEN ? AND ?`,
      [lat - deg, lat + deg, lng - deg, lng + deg]
    );

    const withDistance = rows
      .map((row) => {
        const distance_m = Math.round(
          distanceMeters(lat, lng, Number(row.lat), Number(row.lng))
        );
        return { ...row, distance_m };
      })
      .filter((row) => row.distance_m <= radiusM)
      .sort((a, b) => a.distance_m - b.distance_m);

    res.json(withDistance);
  } catch (err) {
    console.error('splitters nearby:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── GET /api/splitters/:id ──────────────────────────────────
router.get('/:id', auth, requireRole(READ_ROLES), async (req, res) => {
  try {
    await ensureSplittersSchema();
    const [[row]] = await pool.query(
      `SELECT s.*, u.full_name AS created_by_name
       FROM splitters s
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'ไม่พบ Splitter' });
    res.json(row);
  } catch (err) {
    console.error('splitters get:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── POST /api/splitters ─────────────────────────────────────
router.post('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    await ensureSplittersSchema();
    const { code, name, lat, lng, area, remark, status } = req.body;
    const latN = parseCoord(lat);
    const lngN = parseCoord(lng);
    if (latN == null || lngN == null) {
      return res.status(400).json({ error: 'ต้องระบุพิกัด lat/lng' });
    }

    const [result] = await pool.query(
      `INSERT INTO splitters (code, name, lat, lng, area, remark, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code || null,
        name || null,
        latN,
        lngN,
        area || null,
        remark || null,
        normalizeStatus(status),
        req.user.id,
      ]
    );

    const [[row]] = await pool.query('SELECT * FROM splitters WHERE id = ?', [result.insertId]);
    res.status(201).json(row);
  } catch (err) {
    console.error('splitters create:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── PUT /api/splitters/:id ──────────────────────────────────
router.put('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    await ensureSplittersSchema();
    const [[existing]] = await pool.query('SELECT * FROM splitters WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'ไม่พบ Splitter' });

    const { code, name, lat, lng, area, remark, status } = req.body;
    const latN = lat !== undefined ? parseCoord(lat) : existing.lat;
    const lngN = lng !== undefined ? parseCoord(lng) : existing.lng;
    if (latN == null || lngN == null) {
      return res.status(400).json({ error: 'พิกัดไม่ถูกต้อง' });
    }

    await pool.query(
      `UPDATE splitters SET
         code = ?, name = ?, lat = ?, lng = ?, area = ?, remark = ?, status = ?
       WHERE id = ?`,
      [
        code !== undefined ? (code || null) : existing.code,
        name !== undefined ? (name || null) : existing.name,
        latN,
        lngN,
        area !== undefined ? (area || null) : existing.area,
        remark !== undefined ? (remark || null) : existing.remark,
        status !== undefined ? normalizeStatus(status) : existing.status,
        existing.id,
      ]
    );

    const [[row]] = await pool.query('SELECT * FROM splitters WHERE id = ?', [existing.id]);
    res.json(row);
  } catch (err) {
    console.error('splitters update:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── DELETE /api/splitters/:id — soft delete (inactive) ──────
router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    await ensureSplittersSchema();
    const [[existing]] = await pool.query('SELECT id FROM splitters WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'ไม่พบ Splitter' });

    const hard = String(req.query.hard || '') === '1';
    if (hard) {
      await pool.query('DELETE FROM splitters WHERE id = ?', [existing.id]);
      return res.json({ success: true, message: 'ลบ Splitter แล้ว' });
    }

    await pool.query(`UPDATE splitters SET status = 'inactive' WHERE id = ?`, [existing.id]);
    res.json({ success: true, message: 'ปิดใช้งาน Splitter แล้ว' });
  } catch (err) {
    console.error('splitters delete:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;
module.exports.ensureSplittersSchema = ensureSplittersSchema;
module.exports.distanceMeters = distanceMeters;
