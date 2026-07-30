const express = require('express');
const pool = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const multer = require('multer');

const router = express.Router();

const READ_ROLES = ['sales', 'admin', 'super_admin'];
const ADMIN_ROLES = ['admin', 'super_admin'];
const DEFAULT_RADIUS_M = 3000;
const DUP_METERS = 8;
const MAX_KML_BYTES = 15 * 1024 * 1024;

const kmlUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_KML_BYTES },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const okExt = name.endsWith('.kml') || name.endsWith('.xml');
    const okMime = /kml|xml|text|octet-stream/i.test(String(file.mimetype || ''));
    if (okExt || okMime) return cb(null, true);
    cb(new Error('รองรับเฉพาะไฟล์ .kml'));
  },
});

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

function stripXml(text) {
  return String(text || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function tagValue(block, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = String(block || '').match(re);
  return m ? stripXml(m[1]) : '';
}

function parsePointCoords(block) {
  const point = String(block || '').match(/<Point\b[^>]*>[\s\S]*?<\/Point>/i);
  const src = point ? point[0] : String(block || '');
  const m = src.match(/<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/i);
  if (!m) return null;
  const first = String(m[1] || '')
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .find(Boolean);
  if (!first) return null;
  const parts = first.split(',');
  const lng = parseCoord(parts[0]);
  const lat = parseCoord(parts[1]);
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Parse Google Earth KML placemarks into splitter-like rows */
function parseKmlPlacemarks(kmlText) {
  const text = String(kmlText || '');
  const items = [];
  const folderStack = [];
  const tokenRe =
    /<(?:Folder|Document)\b[^>]*>|<\/(?:Folder|Document)>|<Placemark\b[^>]*>[\s\S]*?<\/Placemark>/gi;
  let match;
  while ((match = tokenRe.exec(text)) !== null) {
    const chunk = match[0];
    if (/^<\/(?:Folder|Document)>/i.test(chunk)) {
      folderStack.pop();
      continue;
    }
    if (/^<(?:Folder|Document)\b/i.test(chunk)) {
      const lookAhead = text.slice(match.index, match.index + 1200);
      const nameMatch = lookAhead.match(/<name\b[^>]*>([\s\S]*?)<\/name>/i);
      folderStack.push(nameMatch ? stripXml(nameMatch[1]) : '');
      continue;
    }

    const name = tagValue(chunk, 'name');
    const description = tagValue(chunk, 'description');
    const coords = parsePointCoords(chunk);
    if (!coords) continue;

    const area =
      [...folderStack].reverse().find((n) => n && n.trim()) || null;
    const label = (name || '').trim() || `SP-${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;

    items.push({
      code: label.slice(0, 100),
      name: label.slice(0, 255),
      lat: coords.lat,
      lng: coords.lng,
      area: area ? String(area).slice(0, 255) : null,
      remark: description ? String(description).slice(0, 2000) : null,
      status: 'active',
    });
  }

  return items;
}

function classifyImportItems(parsed, existingRows) {
  const existing = Array.isArray(existingRows) ? existingRows : [];
  const codeMap = new Map();
  for (const row of existing) {
    const key = String(row.code || '').trim().toLowerCase();
    if (key) codeMap.set(key, row);
  }

  const seenCodes = new Set();
  const accepted = [];
  const skipped = [];

  for (const item of parsed) {
    const codeKey = String(item.code || '').trim().toLowerCase();
    if (codeKey && (codeMap.has(codeKey) || seenCodes.has(codeKey))) {
      skipped.push({ ...item, skip_reason: 'รหัสซ้ำ' });
      continue;
    }

    const nearExisting = existing.some(
      (row) =>
        distanceMeters(Number(item.lat), Number(item.lng), Number(row.lat), Number(row.lng)) <=
        DUP_METERS
    );
    const nearAccepted = accepted.some(
      (row) =>
        distanceMeters(Number(item.lat), Number(item.lng), Number(row.lat), Number(row.lng)) <=
        DUP_METERS
    );
    if (nearExisting || nearAccepted) {
      skipped.push({ ...item, skip_reason: 'พิกัดซ้ำ/ใกล้จุดเดิมมาก' });
      continue;
    }

    if (codeKey) seenCodes.add(codeKey);
    accepted.push(item);
  }

  return { accepted, skipped };
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

// ── POST /api/splitters/import-kml — preview or confirm import ─
router.post(
  '/import-kml',
  auth,
  requireRole(ADMIN_ROLES),
  (req, res, next) => {
    kmlUpload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'อัปโหลดไฟล์ไม่สำเร็จ' });
      next();
    });
  },
  async (req, res) => {
    try {
      await ensureSplittersSchema();
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'กรุณาเลือกไฟล์ .kml' });
      }

      const kmlText = req.file.buffer.toString('utf8');
      if (!/<kml[\s>]/i.test(kmlText) && !/<Placemark[\s>]/i.test(kmlText)) {
        return res.status(400).json({ error: 'ไฟล์ไม่ใช่ KML ที่ถูกต้อง หรือไม่มีจุด Placemark' });
      }

      const parsed = parseKmlPlacemarks(kmlText);
      if (!parsed.length) {
        return res.status(400).json({
          error: 'ไม่พบจุด (Placemark + Point) ในไฟล์ KML',
        });
      }

      const [existing] = await pool.query('SELECT id, code, lat, lng FROM splitters');
      const { accepted, skipped } = classifyImportItems(parsed, existing);
      const confirm =
        String(req.body?.confirm || req.query?.confirm || '') === '1' ||
        String(req.body?.confirm || req.query?.confirm || '').toLowerCase() === 'true';

      if (!confirm) {
        return res.json({
          dry_run: true,
          filename: req.file.originalname,
          summary: {
            total: parsed.length,
            will_import: accepted.length,
            skipped: skipped.length,
          },
          preview: accepted.slice(0, 50),
          skipped_preview: skipped.slice(0, 30),
        });
      }

      if (!accepted.length) {
        return res.status(400).json({
          error: 'ไม่มีจุดใหม่ให้บันทึก (อาจซ้ำทั้งหมด)',
          summary: {
            total: parsed.length,
            will_import: 0,
            skipped: skipped.length,
          },
        });
      }

      let inserted = 0;
      for (const item of accepted) {
        await pool.query(
          `INSERT INTO splitters (code, name, lat, lng, area, remark, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
          [
            item.code || null,
            item.name || null,
            item.lat,
            item.lng,
            item.area || null,
            item.remark || null,
            req.user.id,
          ]
        );
        inserted += 1;
      }

      res.status(201).json({
        dry_run: false,
        filename: req.file.originalname,
        summary: {
          total: parsed.length,
          imported: inserted,
          skipped: skipped.length,
        },
        message: `นำเข้า Splitter สำเร็จ ${inserted} จุด — เซลจะใช้หาจุดใกล้บ้านได้ทันที`,
      });
    } catch (err) {
      console.error('splitters import-kml:', err);
      res.status(500).json({ error: 'Server error', detail: err.message });
    }
  }
);

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
module.exports.parseKmlPlacemarks = parseKmlPlacemarks;
module.exports.classifyImportItems = classifyImportItems;
