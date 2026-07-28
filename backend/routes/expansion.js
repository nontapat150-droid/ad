const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const { syncCustomerFromJob } = require('../utils/customerSync');
const { upload, setUpload } = require('../middleware/upload');
const { ensureSplittersSchema } = require('./splitters');

const router = express.Router();

const ALLOWED_ROLES = ['sales', 'admin', 'super_admin'];
const ADMIN_ROLES = ['admin', 'super_admin'];
const STATUSES = ['draft', 'survey', 'quoted', 'won', 'lost', 'handed_off'];
const STATUS_TRANSITIONS = {
  draft: ['survey', 'quoted', 'won', 'lost'],
  survey: ['quoted', 'won', 'lost', 'draft'],
  quoted: ['won', 'lost', 'survey'],
  won: ['quoted', 'survey'],
  lost: ['quoted', 'survey', 'draft'],
  handed_off: [],
};
const MIN_PHOTOS = 3;
const MAX_PHOTOS = 10;

let schemaReady = false;
let schemaPromise = null;

async function columnExists(db, table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.cnt) > 0;
}

async function addColumnIfMissing(db, table, column, def) {
  if (await columnExists(db, table, column)) return;
  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`);
}

async function ensureExpansionSchema(db = pool) {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS expansion_jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_name VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        address TEXT NULL,
        access_no VARCHAR(50) NULL,
        lat DECIMAL(10, 7) NULL,
        lng DECIMAL(10, 7) NULL,
        splitter_note VARCHAR(500) NULL,
        radius_m INT NULL DEFAULT 500,
        status VARCHAR(30) NOT NULL DEFAULT 'draft',
        owner_user_id INT NOT NULL,
        follow_up_at DATE NULL,
        remark TEXT NULL,
        lost_reason VARCHAR(500) NULL,
        handed_off_job_id INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_expansion_owner (owner_user_id),
        KEY idx_expansion_status (status),
        KEY idx_expansion_follow_up (follow_up_at),
        KEY idx_expansion_access (access_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await addColumnIfMissing(db, 'expansion_jobs', 'id_card', 'VARCHAR(20) NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'package_name', 'VARCHAR(150) NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'contract_info', 'VARCHAR(255) NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'occupation', 'VARCHAR(150) NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'entry_fee_request', 'DECIMAL(12,2) NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'install_date', 'DATE NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'install_date_text', 'VARCHAR(255) NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'sales_note', 'TEXT NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'pair_line', 'VARCHAR(100) NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'tech_note', 'TEXT NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'splitter_id', 'INT NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'straight_distance_m', 'DECIMAL(10,2) NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'estimated_cable_m', 'DECIMAL(10,2) NULL');

    await db.query(`
      CREATE TABLE IF NOT EXISTS expansion_job_photos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expansion_job_id INT NOT NULL,
        image_path VARCHAR(500) NOT NULL,
        uploaded_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_exp_photos_job (expansion_job_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await ensureSplittersSchema(db);

    schemaReady = true;
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });

  return schemaPromise;
}

function userRoles(req) {
  return req.user.roles || [req.user.role];
}

function isAdmin(req) {
  return userRoles(req).some((r) => ADMIN_ROLES.includes(r));
}

function canAccessRow(req, row) {
  if (!row) return false;
  if (isAdmin(req)) return true;
  return Number(row.owner_user_id) === Number(req.user.id);
}

function normalizeStatus(status) {
  const s = String(status || 'draft').trim().toLowerCase();
  return STATUSES.includes(s) ? s : null;
}

function parseCoord(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDecimal(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function todayISO() {
  return new Date().toLocaleDateString('en-CA');
}

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

async function getPhotoCount(db, expansionId) {
  const [[{ cnt }]] = await db.query(
    'SELECT COUNT(*) AS cnt FROM expansion_job_photos WHERE expansion_job_id = ?',
    [expansionId]
  );
  return Number(cnt) || 0;
}

async function loadPhotos(db, expansionId) {
  const [rows] = await db.query(
    `SELECT id, expansion_job_id, image_path, uploaded_by, created_at
     FROM expansion_job_photos
     WHERE expansion_job_id = ?
     ORDER BY id ASC`,
    [expansionId]
  );
  return rows;
}

function validateSalesRequired(body, { photoCount = null, requirePhotos = true } = {}) {
  const errors = [];
  if (!trimOrNull(body.customer_name)) errors.push('กรุณากรอกชื่อ-นามสกุลลูกค้า');
  if (!trimOrNull(body.id_card)) errors.push('กรุณากรอกเลขบัตรประชาชน');
  if (!trimOrNull(body.address)) errors.push('กรุณากรอกที่อยู่ติดตั้ง');
  if (!trimOrNull(body.phone)) errors.push('กรุณากรอกเบอร์ติดต่อ');
  if (!trimOrNull(body.package_name)) errors.push('กรุณากรอกแพ็กเกจ');
  if (!trimOrNull(body.contract_info)) errors.push('กรุณากรอกสัญญา');
  if (!trimOrNull(body.occupation)) errors.push('กรุณากรอกอาชีพ');
  if (!trimOrNull(body.install_date) && !trimOrNull(body.install_date_text)) {
    errors.push('กรุณาระบุวันติดตั้ง (วันที่หรือข้อความ)');
  }
  if (parseCoord(body.lat) == null || parseCoord(body.lng) == null) {
    errors.push('กรุณาปักพิกัดบ้านลูกค้า');
  }
  if (!trimOrNull(body.pair_line)) errors.push('กรุณากรอกคู่สาย');
  if (parseDecimal(body.estimated_cable_m) == null) {
    errors.push('กรุณากรอกระยะสายประมาณ');
  }
  if (requirePhotos && photoCount != null) {
    if (photoCount < MIN_PHOTOS) errors.push(`ต้องอัปโหลดรูปอย่างน้อย ${MIN_PHOTOS} รูป`);
    if (photoCount > MAX_PHOTOS) errors.push(`อัปโหลดรูปได้ไม่เกิน ${MAX_PHOTOS} รูป`);
  }
  return errors;
}

function pickSalesFields(body, existing = {}) {
  return {
    customer_name: body.customer_name !== undefined ? trimOrNull(body.customer_name) : existing.customer_name,
    phone: body.phone !== undefined ? trimOrNull(body.phone) : existing.phone,
    address: body.address !== undefined ? trimOrNull(body.address) : existing.address,
    access_no: body.access_no !== undefined ? trimOrNull(body.access_no) : existing.access_no,
    lat: body.lat !== undefined ? parseCoord(body.lat) : existing.lat,
    lng: body.lng !== undefined ? parseCoord(body.lng) : existing.lng,
    splitter_note: body.splitter_note !== undefined ? trimOrNull(body.splitter_note) : existing.splitter_note,
    radius_m: body.radius_m !== undefined
      ? (body.radius_m != null && body.radius_m !== '' ? parseInt(body.radius_m, 10) || null : null)
      : existing.radius_m,
    follow_up_at: body.follow_up_at !== undefined ? (body.follow_up_at || null) : existing.follow_up_at,
    remark: body.remark !== undefined ? trimOrNull(body.remark) : existing.remark,
    lost_reason: body.lost_reason !== undefined ? trimOrNull(body.lost_reason) : existing.lost_reason,
    id_card: body.id_card !== undefined ? trimOrNull(body.id_card) : existing.id_card,
    package_name: body.package_name !== undefined ? trimOrNull(body.package_name) : existing.package_name,
    contract_info: body.contract_info !== undefined ? trimOrNull(body.contract_info) : existing.contract_info,
    occupation: body.occupation !== undefined ? trimOrNull(body.occupation) : existing.occupation,
    entry_fee_request: body.entry_fee_request !== undefined
      ? parseDecimal(body.entry_fee_request)
      : existing.entry_fee_request,
    install_date: body.install_date !== undefined ? (body.install_date || null) : existing.install_date,
    install_date_text: body.install_date_text !== undefined
      ? trimOrNull(body.install_date_text)
      : existing.install_date_text,
    sales_note: body.sales_note !== undefined ? trimOrNull(body.sales_note) : existing.sales_note,
    pair_line: body.pair_line !== undefined ? trimOrNull(body.pair_line) : existing.pair_line,
    tech_note: body.tech_note !== undefined ? trimOrNull(body.tech_note) : existing.tech_note,
    splitter_id: body.splitter_id !== undefined
      ? (body.splitter_id != null && body.splitter_id !== '' ? parseInt(body.splitter_id, 10) || null : null)
      : existing.splitter_id,
    straight_distance_m: body.straight_distance_m !== undefined
      ? parseDecimal(body.straight_distance_m)
      : existing.straight_distance_m,
    estimated_cable_m: body.estimated_cable_m !== undefined
      ? parseDecimal(body.estimated_cable_m)
      : existing.estimated_cable_m,
  };
}

async function fetchJobWithExtras(db, id) {
  const [[row]] = await db.query(
    `SELECT e.*, u.full_name AS owner_name,
            s.code AS splitter_code, s.name AS splitter_name,
            s.lat AS splitter_lat, s.lng AS splitter_lng
     FROM expansion_jobs e
     LEFT JOIN users u ON u.id = e.owner_user_id
     LEFT JOIN splitters s ON s.id = e.splitter_id
     WHERE e.id = ?`,
    [id]
  );
  if (!row) return null;
  const photos = await loadPhotos(db, id);
  return { ...row, photos, photo_count: photos.length };
}

// ── GET /api/expansion/summary — dashboard counts ───────────
router.get('/summary', auth, requireRole(ALLOWED_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const today = todayISO();
    const monthStart = `${today.slice(0, 7)}-01`;
    const params = [today, monthStart];
    let ownerClause = '';
    if (!isAdmin(req)) {
      ownerClause = 'AND owner_user_id = ?';
      params.push(req.user.id);
    }

    const [[row]] = await pool.query(
      `SELECT
         SUM(CASE WHEN status IN ('draft','survey','quoted','won') THEN 1 ELSE 0 END) AS open_count,
         SUM(CASE WHEN follow_up_at = ? AND status NOT IN ('lost','handed_off') THEN 1 ELSE 0 END) AS follow_today,
         SUM(CASE WHEN status IN ('won','handed_off') AND updated_at >= ? THEN 1 ELSE 0 END) AS won_month
       FROM expansion_jobs
       WHERE 1=1 ${ownerClause}`,
      params
    );

    res.json({
      open: Number(row?.open_count) || 0,
      follow_today: Number(row?.follow_today) || 0,
      won_month: Number(row?.won_month) || 0,
    });
  } catch (err) {
    console.error('expansion summary:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── GET /api/expansion — list ───────────────────────────────
router.get('/', auth, requireRole(ALLOWED_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const { status, follow_up, q } = req.query;
    const where = [];
    const params = [];

    if (!isAdmin(req)) {
      where.push('e.owner_user_id = ?');
      params.push(req.user.id);
    }

    if (status && normalizeStatus(status)) {
      where.push('e.status = ?');
      params.push(normalizeStatus(status));
    }

    if (String(follow_up || '') === 'today') {
      where.push('e.follow_up_at = ?');
      params.push(todayISO());
    }

    const scope = String(req.query.scope || '').trim().toLowerCase();
    if (scope === 'open') {
      where.push(`e.status IN ('draft','survey','quoted','won')`);
    } else if (scope === 'done') {
      where.push(`e.status IN ('lost','handed_off')`);
    }

    const search = String(q || '').trim();
    if (search) {
      const like = `%${search}%`;
      where.push('(e.customer_name LIKE ? OR e.phone LIKE ? OR e.address LIKE ? OR e.access_no LIKE ? OR e.splitter_note LIKE ? OR e.package_name LIKE ? OR e.id_card LIKE ?)');
      params.push(like, like, like, like, like, like, like);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT e.*, u.full_name AS owner_name,
              s.code AS splitter_code, s.name AS splitter_name,
              (SELECT COUNT(*) FROM expansion_job_photos p WHERE p.expansion_job_id = e.id) AS photo_count
       FROM expansion_jobs e
       LEFT JOIN users u ON u.id = e.owner_user_id
       LEFT JOIN splitters s ON s.id = e.splitter_id
       ${whereClause}
       ORDER BY
         CASE e.status
           WHEN 'won' THEN 0
           WHEN 'quoted' THEN 1
           WHEN 'survey' THEN 2
           WHEN 'draft' THEN 3
           WHEN 'lost' THEN 4
           ELSE 5
         END,
         e.follow_up_at IS NULL, e.follow_up_at ASC, e.updated_at DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error('expansion list:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── GET /api/expansion/:id ──────────────────────────────────
router.get('/:id', auth, requireRole(ALLOWED_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const row = await fetchJobWithExtras(pool, req.params.id);
    if (!row) return res.status(404).json({ error: 'ไม่พบงานขยาย' });
    if (!canAccessRow(req, row)) return res.status(403).json({ error: 'Access denied' });
    res.json(row);
  } catch (err) {
    console.error('expansion get:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── POST /api/expansion — create ────────────────────────────
router.post('/', auth, requireRole(ALLOWED_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const fields = pickSalesFields(req.body, {});

    let nextStatus = normalizeStatus(req.body.status) || 'draft';
    if (nextStatus === 'handed_off') nextStatus = 'draft';

    // Photos are uploaded after create; full photo validation runs on PUT.
    const fieldErrors = validateSalesRequired({ ...fields }, { requirePhotos: false });
    if (fieldErrors.length) {
      return res.status(400).json({ error: fieldErrors[0], errors: fieldErrors });
    }

    const ownerId = isAdmin(req) && req.body.owner_user_id
      ? parseInt(req.body.owner_user_id, 10)
      : req.user.id;

    const [result] = await pool.query(
      `INSERT INTO expansion_jobs
         (customer_name, phone, address, access_no, lat, lng, splitter_note, radius_m,
          status, owner_user_id, follow_up_at, remark, lost_reason,
          id_card, package_name, contract_info, occupation, entry_fee_request,
          install_date, install_date_text, sales_note, pair_line, tech_note,
          splitter_id, straight_distance_m, estimated_cable_m)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fields.customer_name,
        fields.phone,
        fields.address,
        fields.access_no,
        fields.lat,
        fields.lng,
        fields.splitter_note,
        fields.radius_m ?? 500,
        nextStatus,
        ownerId,
        fields.follow_up_at,
        fields.remark,
        fields.lost_reason || null,
        fields.id_card,
        fields.package_name,
        fields.contract_info,
        fields.occupation,
        fields.entry_fee_request,
        fields.install_date,
        fields.install_date_text,
        fields.sales_note,
        fields.pair_line,
        fields.tech_note,
        fields.splitter_id,
        fields.straight_distance_m,
        fields.estimated_cable_m,
      ]
    );

    const row = await fetchJobWithExtras(pool, result.insertId);
    res.status(201).json({ ...row, photos_required: true, min_photos: MIN_PHOTOS, max_photos: MAX_PHOTOS });
  } catch (err) {
    console.error('expansion create:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── PUT /api/expansion/:id — update ─────────────────────────
router.put('/:id', auth, requireRole(ALLOWED_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const [[existing]] = await pool.query('SELECT * FROM expansion_jobs WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'ไม่พบงานขยาย' });
    if (!canAccessRow(req, existing)) return res.status(403).json({ error: 'Access denied' });
    if (existing.status === 'handed_off') {
      return res.status(400).json({ error: 'งานที่ส่งต่อติดตั้งแล้วแก้ไขไม่ได้' });
    }

    const fields = pickSalesFields(req.body, existing);
    const photoCount = await getPhotoCount(pool, existing.id);
    const statusOnly =
      Object.keys(req.body).every((k) => ['status', 'lost_reason'].includes(k));

    let nextStatus = existing.status;
    if (req.body.status != null && req.body.status !== '') {
      const normalized = normalizeStatus(req.body.status);
      if (!normalized) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
      if (normalized !== existing.status) {
        const allowed = STATUS_TRANSITIONS[existing.status] || [];
        if (!allowed.includes(normalized)) {
          return res.status(400).json({
            error: `เปลี่ยนจาก ${existing.status} เป็น ${normalized} ไม่ได้`,
          });
        }
        nextStatus = normalized;
      }
    }

    if (nextStatus === 'lost' && !(fields.lost_reason || existing.lost_reason)) {
      return res.status(400).json({ error: 'กรุณาระบุเหตุผลเมื่อสถานะเป็นไม่ได้' });
    }

    if (!statusOnly) {
      const errors = validateSalesRequired(
        { ...fields, lost_reason: fields.lost_reason },
        { photoCount, requirePhotos: true }
      );
      if (errors.length) {
        return res.status(400).json({ error: errors[0], errors });
      }
    }

    await pool.query(
      `UPDATE expansion_jobs SET
         customer_name = ?, phone = ?, address = ?, access_no = ?,
         lat = ?, lng = ?, splitter_note = ?, radius_m = ?,
         status = ?, follow_up_at = ?, remark = ?, lost_reason = ?,
         id_card = ?, package_name = ?, contract_info = ?, occupation = ?,
         entry_fee_request = ?, install_date = ?, install_date_text = ?,
         sales_note = ?, pair_line = ?, tech_note = ?,
         splitter_id = ?, straight_distance_m = ?, estimated_cable_m = ?
       WHERE id = ?`,
      [
        fields.customer_name,
        fields.phone,
        fields.address,
        fields.access_no,
        fields.lat,
        fields.lng,
        fields.splitter_note,
        fields.radius_m,
        nextStatus,
        fields.follow_up_at,
        fields.remark,
        fields.lost_reason,
        fields.id_card,
        fields.package_name,
        fields.contract_info,
        fields.occupation,
        fields.entry_fee_request,
        fields.install_date,
        fields.install_date_text,
        fields.sales_note,
        fields.pair_line,
        fields.tech_note,
        fields.splitter_id,
        fields.straight_distance_m,
        fields.estimated_cable_m,
        existing.id,
      ]
    );

    const row = await fetchJobWithExtras(pool, existing.id);
    res.json(row);
  } catch (err) {
    console.error('expansion update:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── GET photos ──────────────────────────────────────────────
router.get('/:id/photos', auth, requireRole(ALLOWED_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const [[existing]] = await pool.query('SELECT * FROM expansion_jobs WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'ไม่พบงานขยาย' });
    if (!canAccessRow(req, existing)) return res.status(403).json({ error: 'Access denied' });
    const photos = await loadPhotos(pool, existing.id);
    res.json(photos);
  } catch (err) {
    console.error('expansion photos list:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── POST photos ─────────────────────────────────────────────
router.post(
  '/:id/photos',
  auth,
  requireRole(ALLOWED_ROLES),
  setUpload('expansion'),
  upload.array('images', MAX_PHOTOS),
  async (req, res) => {
    try {
      await ensureExpansionSchema();
      const [[existing]] = await pool.query('SELECT * FROM expansion_jobs WHERE id = ?', [req.params.id]);
      if (!existing) return res.status(404).json({ error: 'ไม่พบงานขยาย' });
      if (!canAccessRow(req, existing)) return res.status(403).json({ error: 'Access denied' });
      if (existing.status === 'handed_off') {
        return res.status(400).json({ error: 'งานที่ส่งต่อติดตั้งแล้วแก้ไขไม่ได้' });
      }

      const files = req.files || [];
      if (!files.length) return res.status(400).json({ error: 'ไม่พบไฟล์รูป' });

      const current = await getPhotoCount(pool, existing.id);
      if (current + files.length > MAX_PHOTOS) {
        return res.status(400).json({
          error: `อัปโหลดรูปได้ไม่เกิน ${MAX_PHOTOS} รูป (มีอยู่ ${current} รูป)`,
        });
      }

      const inserted = [];
      for (const file of files) {
        const imagePath = `/uploads/expansion/${file.filename}`;
        const [ins] = await pool.query(
          `INSERT INTO expansion_job_photos (expansion_job_id, image_path, uploaded_by)
           VALUES (?, ?, ?)`,
          [existing.id, imagePath, req.user.id]
        );
        inserted.push({
          id: ins.insertId,
          expansion_job_id: existing.id,
          image_path: imagePath,
          uploaded_by: req.user.id,
        });
      }

      const photos = await loadPhotos(pool, existing.id);
      res.status(201).json({ photos, photo_count: photos.length, added: inserted });
    } catch (err) {
      console.error('expansion photos upload:', err);
      res.status(500).json({ error: 'Server error', detail: err.message });
    }
  }
);

// ── DELETE photo ────────────────────────────────────────────
router.delete('/:id/photos/:photoId', auth, requireRole(ALLOWED_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const [[existing]] = await pool.query('SELECT * FROM expansion_jobs WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'ไม่พบงานขยาย' });
    if (!canAccessRow(req, existing)) return res.status(403).json({ error: 'Access denied' });
    if (existing.status === 'handed_off') {
      return res.status(400).json({ error: 'งานที่ส่งต่อติดตั้งแล้วแก้ไขไม่ได้' });
    }

    const [[photo]] = await pool.query(
      'SELECT * FROM expansion_job_photos WHERE id = ? AND expansion_job_id = ?',
      [req.params.photoId, existing.id]
    );
    if (!photo) return res.status(404).json({ error: 'ไม่พบรูป' });

    await pool.query('DELETE FROM expansion_job_photos WHERE id = ?', [photo.id]);

    try {
      const abs = path.join(__dirname, '..', photo.image_path.replace(/^\//, ''));
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch (unlinkErr) {
      console.warn('expansion photo unlink:', unlinkErr.message);
    }

    const photos = await loadPhotos(pool, existing.id);
    res.json({ success: true, photos, photo_count: photos.length });
  } catch (err) {
    console.error('expansion photo delete:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── POST /api/expansion/:id/handoff — create install job ────
router.post('/:id/handoff', auth, requireRole(ALLOWED_ROLES), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await ensureExpansionSchema(conn);
    await conn.beginTransaction();

    const [[existing]] = await conn.query(
      'SELECT * FROM expansion_jobs WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบงานขยาย' });
    }
    if (!canAccessRow(req, existing)) {
      await conn.rollback();
      return res.status(403).json({ error: 'Access denied' });
    }
    if (existing.status === 'handed_off' && existing.handed_off_job_id) {
      await conn.rollback();
      return res.json({
        success: true,
        already: true,
        job_id: existing.handed_off_job_id,
        message: 'ส่งต่อติดตั้งไปแล้ว',
      });
    }
    if (existing.status !== 'won') {
      await conn.rollback();
      return res.status(400).json({ error: 'ส่งต่อได้เฉพาะงานที่สถานะปิดได้ (won)' });
    }

    const accessNo = String(req.body.access_no || existing.access_no || '').trim();
    if (!accessNo) {
      await conn.rollback();
      return res.status(400).json({ error: 'กรุณากรอก Access Number ก่อนส่งต่อติดตั้ง' });
    }

    const [[dup]] = await conn.query(
      'SELECT id FROM jobs WHERE access_no = ? LIMIT 1',
      [accessNo]
    );
    if (dup) {
      await conn.rollback();
      return res.status(409).json({
        error: `Access Number ${accessNo} มีงานติดตั้งในระบบแล้ว (#${dup.id})`,
      });
    }

    const planDate = req.body.plan_arrival_date || existing.follow_up_at || existing.install_date || todayISO();
    const remarkParts = [
      `จากงานขยาย #${existing.id}`,
      existing.splitter_note ? `Splitter: ${existing.splitter_note}` : null,
      existing.pair_line ? `คู่สาย: ${existing.pair_line}` : null,
      existing.estimated_cable_m != null ? `ระยะสายประมาณ: ${existing.estimated_cable_m} ม.` : null,
      existing.tech_note ? `ถึงช่าง: ${existing.tech_note}` : null,
      existing.sales_note || existing.remark || null,
    ].filter(Boolean);

    const [ins] = await conn.query(
      `INSERT INTO jobs
         (plan_arrival_date, access_no, customer, phone, address, lat, lng,
          status, task_type, remark, package, create_user_role, create_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, NOW())`,
      [
        planDate,
        accessNo,
        existing.customer_name || null,
        existing.phone || null,
        existing.address || null,
        existing.lat,
        existing.lng,
        'งานขยาย',
        remarkParts.join(' · ') || null,
        existing.package_name || null,
        req.user.role || 'sales',
      ]
    );

    const jobId = ins.insertId;
    try {
      await syncCustomerFromJob(conn, jobId);
    } catch (syncErr) {
      console.warn('expansion handoff customer sync:', syncErr.message);
    }

    await conn.query(
      `UPDATE expansion_jobs
       SET status = 'handed_off', access_no = ?, handed_off_job_id = ?
       WHERE id = ?`,
      [accessNo, jobId, existing.id]
    );

    await conn.commit();
    res.json({
      success: true,
      job_id: jobId,
      expansion_id: existing.id,
      access_no: accessNo,
      message: 'ส่งต่อเป็นงานติดตั้งแล้ว',
    });
  } catch (err) {
    await conn.rollback();
    console.error('expansion handoff:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  } finally {
    conn.release();
  }
});

// ── DELETE /api/expansion/:id — admin only ──────────────────
router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const [[existing]] = await pool.query(
      'SELECT id, status FROM expansion_jobs WHERE id = ?',
      [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'ไม่พบงานขยาย' });
    if (existing.status === 'handed_off') {
      return res.status(400).json({ error: 'งานที่ส่งต่อติดตั้งแล้วลบไม่ได้' });
    }

    const photos = await loadPhotos(pool, existing.id);
    await pool.query('DELETE FROM expansion_job_photos WHERE expansion_job_id = ?', [existing.id]);
    await pool.query('DELETE FROM expansion_jobs WHERE id = ?', [existing.id]);

    for (const photo of photos) {
      try {
        const abs = path.join(__dirname, '..', photo.image_path.replace(/^\//, ''));
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch (_) { /* ignore */ }
    }

    res.json({ success: true, message: 'ลบงานขยายแล้ว' });
  } catch (err) {
    console.error('expansion delete:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;
