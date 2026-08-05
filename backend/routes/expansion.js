const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const { syncCustomerFromJob } = require('../utils/customerSync');
const { upload, setUpload } = require('../middleware/upload');
const { ensureSplittersSchema } = require('./splitters');
const { notifyEvent, getAdminIds } = require('../utils/notifyEvent');

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

async function tableExists(db, table) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
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
    await addColumnIfMissing(db, 'expansion_jobs', 'approval_request', 'VARCHAR(100) NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'customer_type', "VARCHAR(20) NOT NULL DEFAULT 'general'");
    await addColumnIfMissing(db, 'expansion_jobs', 'non_number', 'VARCHAR(50) NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'follow_up_time', 'TIME NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'follow_up_channel', 'VARCHAR(30) NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'follow_up_note', 'VARCHAR(500) NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'last_contact_at', 'DATETIME NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'surveyed_at', 'DATETIME NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'quoted_at', 'DATETIME NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'won_at', 'DATETIME NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'lost_at', 'DATETIME NULL');
    await addColumnIfMissing(db, 'expansion_jobs', 'handed_off_at', 'DATETIME NULL');
    await db.query(
      `UPDATE expansion_jobs
       SET non_number = TRIM(install_date_text), install_date_text = NULL
       WHERE non_number IS NULL AND UPPER(TRIM(install_date_text)) LIKE 'NON%'`
    );
    await db.query("UPDATE expansion_jobs SET won_at = updated_at WHERE status IN ('won','handed_off') AND won_at IS NULL");
    await db.query("UPDATE expansion_jobs SET lost_at = updated_at WHERE status = 'lost' AND lost_at IS NULL");
    await db.query("UPDATE expansion_jobs SET handed_off_at = updated_at WHERE status = 'handed_off' AND handed_off_at IS NULL");

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

    await db.query(`
      CREATE TABLE IF NOT EXISTS expansion_job_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        expansion_job_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        old_status VARCHAR(30) NULL,
        new_status VARCHAR(30) NULL,
        changed_fields TEXT NULL,
        note TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_exp_history_job (expansion_job_id),
        KEY idx_exp_history_time (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS sales_monthly_targets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        target_month CHAR(7) NOT NULL,
        target_leads INT NOT NULL DEFAULT 0,
        target_won INT NOT NULL DEFAULT 0,
        target_handoffs INT NOT NULL DEFAULT 0,
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_sales_target_owner_month (owner_user_id, target_month),
        KEY idx_sales_target_month (target_month)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    if (await tableExists(db, 'jobs')) {
      await addColumnIfMissing(db, 'jobs', 'source_expansion_id', 'INT NULL');
      await addColumnIfMissing(db, 'jobs', 'source_sales_user_id', 'INT NULL');
      await addColumnIfMissing(db, 'jobs', 'source_sales_name', 'VARCHAR(255) NULL');
      await db.query(
        `UPDATE jobs j
         JOIN expansion_jobs e ON e.handed_off_job_id = j.id
         LEFT JOIN users u ON u.id = e.owner_user_id
         SET j.source_expansion_id = COALESCE(j.source_expansion_id, e.id),
             j.source_sales_user_id = COALESCE(j.source_sales_user_id, e.owner_user_id),
             j.source_sales_name = COALESCE(j.source_sales_name, u.full_name)
         WHERE j.source_expansion_id IS NULL OR j.source_sales_user_id IS NULL OR j.source_sales_name IS NULL`
      );
    }
    if (await tableExists(db, 'installed_customers')) {
      await addColumnIfMissing(db, 'installed_customers', 'source_expansion_id', 'INT NULL');
      await addColumnIfMissing(db, 'installed_customers', 'source_sales_user_id', 'INT NULL');
      await addColumnIfMissing(db, 'installed_customers', 'seller_name', 'VARCHAR(100) NULL');
      if (await tableExists(db, 'jobs')) {
        await db.query(
          `UPDATE installed_customers c
           JOIN jobs j ON j.id = c.job_id
           SET c.source_expansion_id = COALESCE(c.source_expansion_id, j.source_expansion_id),
               c.source_sales_user_id = COALESCE(c.source_sales_user_id, j.source_sales_user_id),
               c.seller_name = COALESCE(c.seller_name, j.source_sales_name)
           WHERE c.source_expansion_id IS NULL OR c.source_sales_user_id IS NULL OR c.seller_name IS NULL`
        );
      }
    }

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

function normalizeDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function validISODate(v) {
  if (!v) return true;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [year, month, day] = s.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function normalizeMonth(v) {
  const month = String(v || '').trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
}

function monthRange(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = `${month}-01`;
  const next = monthNumber === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  return { start, next };
}

async function validateSalesOwner(db, ownerId) {
  const [[row]] = await db.query(
    `SELECT u.id
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'sales'
     WHERE u.id = ? AND u.status = 'approved'
       AND (u.role = 'sales' OR ur.role = 'sales')
     LIMIT 1`,
    [ownerId]
  );
  return Boolean(row);
}

async function findDuplicates(db, fields, excludeId = null) {
  const checks = [];
  const params = [];
  const add = (sql, value) => {
    if (!value) return;
    checks.push(sql);
    params.push(value);
  };
  add('TRIM(id_card) = ?', trimOrNull(fields.id_card));
  add('TRIM(phone) = ?', trimOrNull(fields.phone));
  add('TRIM(access_no) = ?', trimOrNull(fields.access_no));
  add('TRIM(non_number) = ?', trimOrNull(fields.non_number));
  if (!checks.length) return [];
  let exclude = '';
  if (excludeId) {
    exclude = 'AND id <> ?';
    params.push(excludeId);
  }
  const [rows] = await db.query(
    `SELECT id, customer_name, phone, id_card, access_no, non_number, status
     FROM expansion_jobs
     WHERE (${checks.join(' OR ')}) ${exclude}
     ORDER BY id DESC LIMIT 10`,
    params
  );
  return rows;
}

async function addHistory(db, expansionId, action, userId, options = {}) {
  const changedFields = options.changed_fields && Object.keys(options.changed_fields).length
    ? JSON.stringify(options.changed_fields)
    : null;
  await db.query(
    `INSERT INTO expansion_job_history
       (expansion_job_id, action, old_status, new_status, changed_fields, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      expansionId,
      action,
      options.old_status || null,
      options.new_status || null,
      changedFields,
      options.note || null,
      userId || null,
    ]
  );
}

function changedSalesFields(before, after) {
  const ignored = new Set(['updated_at', 'created_at', 'owner_name', 'photos', 'photo_count', 'id_card']);
  const out = {};
  Object.keys(after).forEach((key) => {
    if (ignored.has(key) || !(key in before)) return;
    const oldValue = before[key] == null ? null : String(before[key]);
    const newValue = after[key] == null ? null : String(after[key]);
    if (oldValue !== newValue) out[key] = { old: oldValue, new: newValue };
  });
  return out;
}

function normalizeCustomerType(v) {
  const s = String(v || '').trim().toLowerCase();
  return s === 'corporate' ? 'corporate' : 'general';
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
  if (!trimOrNull(body.customer_name)) errors.push('กรุณากรอกชื่อผู้ติดต่อ (ลูกค้า/บริษัท)');
  if (!trimOrNull(body.id_card)) errors.push('กรุณากรอกเลขอ้างอิง (บัตรประชาชน/ผู้เสียภาษี)');
  if (!trimOrNull(body.address)) errors.push('กรุณากรอกที่อยู่ติดตั้ง');
  if (!trimOrNull(body.phone)) errors.push('กรุณากรอกเบอร์ติดต่อ');
  if (!trimOrNull(body.package_name)) errors.push('กรุณากรอกแพ็กเกจ');
  if (!trimOrNull(body.contract_info)) errors.push('กรุณากรอกสัญญา');
  if (!trimOrNull(body.occupation)) errors.push('กรุณากรอกอาชีพ/ผู้ติดต่อ');
  if (!trimOrNull(body.install_date) && !trimOrNull(body.install_date_text)) {
    errors.push('กรุณาระบุขอวันติดตั้ง (วันที่หรือเลข NON)');
  }
  if (parseCoord(body.lat) == null || parseCoord(body.lng) == null) {
    errors.push('กรุณาปักพิกัดบ้านลูกค้า');
  } else if (parseCoord(body.lat) < 5 || parseCoord(body.lat) > 21 || parseCoord(body.lng) < 97 || parseCoord(body.lng) > 106.5) {
    errors.push('พิกัดอยู่นอกพื้นที่ประเทศไทย กรุณาตรวจสอบอีกครั้ง');
  }
  if (parseDecimal(body.estimated_cable_m) == null) {
    errors.push('กรุณากรอกระยะสายประมาณ');
  } else if (parseDecimal(body.estimated_cable_m) < 0) {
    errors.push('ระยะสายต้องไม่ติดลบ');
  }
  const phoneDigits = normalizeDigits(body.phone);
  if (phoneDigits && (phoneDigits.length < 9 || phoneDigits.length > 15)) {
    errors.push('เบอร์โทรศัพท์ต้องมี 9-15 หลัก');
  }
  const idDigits = normalizeDigits(body.id_card);
  if (idDigits && idDigits.length !== 13) {
    errors.push('เลขบัตรประชาชน/เลขผู้เสียภาษีต้องมี 13 หลัก');
  }
  if (!validISODate(body.install_date)) errors.push('วันที่ติดตั้งไม่ถูกต้อง');
  if (!validISODate(body.follow_up_at)) errors.push('วันที่ติดตามไม่ถูกต้อง');
  if (requirePhotos && photoCount != null) {
    if (photoCount < MIN_PHOTOS) errors.push(`ต้องอัปโหลดรูปอย่างน้อย ${MIN_PHOTOS} รูป`);
    if (photoCount > MAX_PHOTOS) errors.push(`อัปโหลดรูปได้ไม่เกิน ${MAX_PHOTOS} รูป`);
  }
  return errors;
}

function pickSalesFields(body, existing = {}) {
  return {
    customer_type: body.customer_type !== undefined
      ? normalizeCustomerType(body.customer_type)
      : normalizeCustomerType(existing.customer_type),
    customer_name: body.customer_name !== undefined ? trimOrNull(body.customer_name) : existing.customer_name,
    phone: body.phone !== undefined ? trimOrNull(body.phone) : existing.phone,
    address: body.address !== undefined ? trimOrNull(body.address) : existing.address,
    access_no: body.access_no !== undefined ? trimOrNull(body.access_no) : existing.access_no,
    non_number: body.non_number !== undefined ? trimOrNull(body.non_number) : existing.non_number,
    lat: body.lat !== undefined ? parseCoord(body.lat) : existing.lat,
    lng: body.lng !== undefined ? parseCoord(body.lng) : existing.lng,
    splitter_note: body.splitter_note !== undefined ? trimOrNull(body.splitter_note) : existing.splitter_note,
    radius_m: body.radius_m !== undefined
      ? (body.radius_m != null && body.radius_m !== '' ? parseInt(body.radius_m, 10) || null : null)
      : existing.radius_m,
    follow_up_at: body.follow_up_at !== undefined ? (body.follow_up_at || null) : existing.follow_up_at,
    follow_up_time: body.follow_up_time !== undefined ? trimOrNull(body.follow_up_time) : existing.follow_up_time,
    follow_up_channel: body.follow_up_channel !== undefined ? trimOrNull(body.follow_up_channel) : existing.follow_up_channel,
    follow_up_note: body.follow_up_note !== undefined ? trimOrNull(body.follow_up_note) : existing.follow_up_note,
    last_contact_at: body.last_contact_at !== undefined ? (body.last_contact_at || null) : existing.last_contact_at,
    remark: body.remark !== undefined ? trimOrNull(body.remark) : existing.remark,
    lost_reason: body.lost_reason !== undefined ? trimOrNull(body.lost_reason) : existing.lost_reason,
    id_card: body.id_card !== undefined ? trimOrNull(body.id_card) : existing.id_card,
    package_name: body.package_name !== undefined ? trimOrNull(body.package_name) : existing.package_name,
    contract_info: body.contract_info !== undefined ? trimOrNull(body.contract_info) : existing.contract_info,
    occupation: body.occupation !== undefined ? trimOrNull(body.occupation) : existing.occupation,
    entry_fee_request: body.entry_fee_request !== undefined
      ? parseDecimal(body.entry_fee_request)
      : existing.entry_fee_request,
    approval_request: body.approval_request !== undefined
      ? trimOrNull(body.approval_request)
      : existing.approval_request,
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
    let ownerClause = '';
    if (!isAdmin(req)) {
      ownerClause = 'AND owner_user_id = ?';
    }

    const [[row]] = await pool.query(
      `SELECT
         SUM(CASE WHEN status IN ('draft','survey','quoted','won') THEN 1 ELSE 0 END) AS open_count,
         SUM(CASE WHEN follow_up_at = ? AND status NOT IN ('lost','handed_off') THEN 1 ELSE 0 END) AS follow_today,
         SUM(CASE WHEN follow_up_at < ? AND status NOT IN ('lost','handed_off') THEN 1 ELSE 0 END) AS follow_overdue,
         SUM(CASE WHEN status IN ('won','handed_off') AND COALESCE(won_at, handed_off_at, updated_at) >= ? THEN 1 ELSE 0 END) AS won_month,
         SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS waiting_handoff,
         SUM(CASE WHEN status = 'handed_off' AND EXISTS (
           SELECT 1 FROM jobs j WHERE j.id = expansion_jobs.handed_off_job_id
             AND j.status = 'pending' AND j.team_id IS NULL AND j.field_engineer_id IS NULL
         ) THEN 1 ELSE 0 END) AS install_waiting_assignment
       FROM expansion_jobs
       WHERE 1=1 ${ownerClause}`,
      [today, today, monthStart, ...(isAdmin(req) ? [] : [req.user.id])]
    );

    res.json({
      open: Number(row?.open_count) || 0,
      follow_today: Number(row?.follow_today) || 0,
      follow_overdue: Number(row?.follow_overdue) || 0,
      won_month: Number(row?.won_month) || 0,
      waiting_handoff: Number(row?.waiting_handoff) || 0,
      install_waiting_assignment: Number(row?.install_waiting_assignment) || 0,
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
    const { status, follow_up, q, date_from, date_to, package_name } = req.query;
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
    } else if (String(follow_up || '') === 'overdue') {
      where.push("e.follow_up_at < ? AND e.status NOT IN ('lost','handed_off')");
      params.push(todayISO());
    } else if (String(follow_up || '') === 'scheduled') {
      where.push("e.follow_up_at IS NOT NULL AND e.status NOT IN ('lost','handed_off')");
    }

    if (isAdmin(req) && req.query.owner_id) {
      where.push('e.owner_user_id = ?');
      params.push(Number(req.query.owner_id));
    }

    if (date_from && validISODate(date_from)) {
      where.push('DATE(e.created_at) >= ?');
      params.push(String(date_from).slice(0, 10));
    }
    if (date_to && validISODate(date_to)) {
      where.push('DATE(e.created_at) <= ?');
      params.push(String(date_to).slice(0, 10));
    }
    if (package_name) {
      where.push('e.package_name = ?');
      params.push(String(package_name).trim());
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
      where.push('(e.customer_name LIKE ? OR e.phone LIKE ? OR e.address LIKE ? OR e.access_no LIKE ? OR e.non_number LIKE ? OR e.splitter_note LIKE ? OR e.package_name LIKE ? OR e.id_card LIKE ?)');
      params.push(like, like, like, like, like, like, like, like);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(100, Math.max(5, parseInt(req.query.per_page, 10) || 12));
    const offset = (page - 1) * perPage;
    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM expansion_jobs e ${whereClause}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT e.*, u.full_name AS owner_name,
              s.code AS splitter_code, s.name AS splitter_name,
              ij.status AS install_status, ij.processing_status AS install_processing_status,
              ij.team_id AS install_team_id, it.team_name AS install_team_name,
              ij.field_engineer_id AS install_assignee_id, ia.full_name AS install_assignee_name,
              ij.plan_arrival_date AS install_plan_date,
              (SELECT COUNT(*) FROM expansion_job_photos p WHERE p.expansion_job_id = e.id) AS photo_count
       FROM expansion_jobs e
       LEFT JOIN users u ON u.id = e.owner_user_id
       LEFT JOIN splitters s ON s.id = e.splitter_id
       LEFT JOIN jobs ij ON ij.id = e.handed_off_job_id
       LEFT JOIN teams it ON it.id = ij.team_id
       LEFT JOIN users ia ON ia.id = ij.field_engineer_id
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
         e.follow_up_at IS NULL, e.follow_up_at ASC, e.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    if (req.query.page != null || req.query.per_page != null) {
      const total = Number(countRow?.total) || 0;
      return res.json({
        rows,
        pagination: {
          page,
          per_page: perPage,
          total,
          total_pages: Math.max(1, Math.ceil(total / perPage)),
        },
      });
    }
    res.json(rows);
  } catch (err) {
    console.error('expansion list:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── GET /api/expansion/sales-users — active sales users for assignment ──
router.get('/sales-users', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT u.id, u.full_name, u.username
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.status = 'approved' AND (u.role = 'sales' OR ur.role = 'sales')
       ORDER BY u.full_name ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── POST /api/expansion/duplicate-check ─────────────────────
router.post('/duplicate-check', auth, requireRole(ALLOWED_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const fields = pickSalesFields(req.body, {});
    const duplicates = await findDuplicates(pool, fields, req.body.exclude_id || null);
    res.json({ duplicate: duplicates.length > 0, rows: duplicates });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── GET /api/expansion/analytics — monthly sales performance ──
router.get('/analytics', auth, requireRole(ALLOWED_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const month = normalizeMonth(req.query.month) || todayISO().slice(0, 7);
    const { start, next } = monthRange(month);
    const ownerId = isAdmin(req) && req.query.owner_id ? Number(req.query.owner_id) : (!isAdmin(req) ? req.user.id : null);
    const ownerSql = ownerId ? ' AND owner_user_id = ?' : '';
    const ownerParams = ownerId ? [ownerId] : [];

    const [[cohort]] = await pool.query(
      `SELECT COUNT(*) AS leads,
              SUM(status = 'draft') AS draft,
              SUM(status = 'survey') AS survey,
              SUM(status = 'quoted') AS quoted,
              SUM(won_at IS NOT NULL) AS won_cohort,
              SUM(status = 'lost') AS lost_cohort
       FROM expansion_jobs
       WHERE created_at >= ? AND created_at < ? ${ownerSql}`,
      [start, next, ...ownerParams]
    );
    const [[activity]] = await pool.query(
      `SELECT
         SUM(won_at >= ? AND won_at < ?) AS won,
         SUM(handed_off_at >= ? AND handed_off_at < ?) AS handoffs,
         SUM(lost_at >= ? AND lost_at < ?) AS lost,
         AVG(CASE WHEN won_at >= ? AND won_at < ? THEN TIMESTAMPDIFF(HOUR, created_at, won_at) / 24 END) AS avg_days_to_win,
         SUM(status IN ('draft','survey','quoted','won')) AS open_now,
         SUM(follow_up_at < CURDATE() AND status NOT IN ('lost','handed_off')) AS overdue_now
       FROM expansion_jobs
       WHERE 1=1 ${ownerSql}`,
      [start, next, start, next, start, next, start, next, ...ownerParams]
    );

    const leaderboardOwnerWhere = ownerId ? 'WHERE u.id = ?' : 'WHERE 1=1';
    const leaderboardParams = ownerId ? [start, next, start, next, start, next, month, ownerId] : [start, next, start, next, start, next, month];
    const [leaderboard] = await pool.query(
      `SELECT u.id AS owner_user_id, u.full_name AS owner_name,
              COALESCE(l.leads, 0) AS leads,
              COALESCE(w.won, 0) AS won,
              COALESCE(h.handoffs, 0) AS handoffs,
              COALESCE(t.target_leads, 0) AS target_leads,
              COALESCE(t.target_won, 0) AS target_won,
              COALESCE(t.target_handoffs, 0) AS target_handoffs
       FROM users u
       LEFT JOIN (
         SELECT owner_user_id, COUNT(*) AS leads FROM expansion_jobs
         WHERE created_at >= ? AND created_at < ? GROUP BY owner_user_id
       ) l ON l.owner_user_id = u.id
       LEFT JOIN (
         SELECT owner_user_id, COUNT(*) AS won FROM expansion_jobs
         WHERE won_at >= ? AND won_at < ? GROUP BY owner_user_id
       ) w ON w.owner_user_id = u.id
       LEFT JOIN (
         SELECT owner_user_id, COUNT(*) AS handoffs FROM expansion_jobs
         WHERE handed_off_at >= ? AND handed_off_at < ? GROUP BY owner_user_id
       ) h ON h.owner_user_id = u.id
       LEFT JOIN sales_monthly_targets t ON t.owner_user_id = u.id AND t.target_month = ?
       ${leaderboardOwnerWhere}
       AND u.status = 'approved'
       AND (u.role = 'sales' OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'sales'))
       ORDER BY won DESC, handoffs DESC, leads DESC, u.full_name ASC`,
      leaderboardParams
    );

    const [packages] = await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(package_name), ''), 'ไม่ระบุแพ็กเกจ') AS package_name,
              COUNT(*) AS won
       FROM expansion_jobs
       WHERE won_at >= ? AND won_at < ? ${ownerSql}
       GROUP BY COALESCE(NULLIF(TRIM(package_name), ''), 'ไม่ระบุแพ็กเกจ')
       ORDER BY won DESC, package_name ASC LIMIT 15`,
      [start, next, ...ownerParams]
    );

    const [trendRows] = await pool.query(
      `SELECT day,
              SUM(leads) AS leads,
              SUM(won) AS won,
              SUM(handoffs) AS handoffs
       FROM (
         SELECT DATE(created_at) AS day, COUNT(*) AS leads, 0 AS won, 0 AS handoffs
         FROM expansion_jobs WHERE created_at >= ? AND created_at < ? ${ownerSql} GROUP BY DATE(created_at)
         UNION ALL
         SELECT DATE(won_at) AS day, 0, COUNT(*), 0
         FROM expansion_jobs WHERE won_at >= ? AND won_at < ? ${ownerSql} GROUP BY DATE(won_at)
         UNION ALL
         SELECT DATE(handed_off_at) AS day, 0, 0, COUNT(*)
         FROM expansion_jobs WHERE handed_off_at >= ? AND handed_off_at < ? ${ownerSql} GROUP BY DATE(handed_off_at)
       ) x
       GROUP BY day ORDER BY day ASC`,
      [
        start, next, ...ownerParams,
        start, next, ...ownerParams,
        start, next, ...ownerParams,
      ]
    );

    const installOwnerSql = ownerId ? ' AND e.owner_user_id = ?' : '';
    const [[installation]] = await pool.query(
      `SELECT
         SUM(e.handed_off_job_id IS NOT NULL AND j.status = 'pending' AND j.team_id IS NULL AND j.field_engineer_id IS NULL) AS waiting_assignment,
         SUM(e.handed_off_job_id IS NOT NULL AND j.status = 'pending' AND (j.team_id IS NOT NULL OR j.field_engineer_id IS NOT NULL)) AS assigned,
         SUM(e.handed_off_job_id IS NOT NULL AND j.status = 'in_progress') AS in_progress,
         SUM(e.handed_off_job_id IS NOT NULL AND j.status = 'completed') AS completed,
         SUM(e.handed_off_job_id IS NOT NULL AND j.status IN ('failed','cancelled','postponed')) AS problem
       FROM expansion_jobs e
       LEFT JOIN jobs j ON j.id = e.handed_off_job_id
       WHERE e.handed_off_at >= ? AND e.handed_off_at < ? ${installOwnerSql}`,
      [start, next, ...ownerParams]
    );

    const leads = Number(cohort?.leads) || 0;
    res.json({
      month,
      metrics: {
        leads,
        draft: Number(cohort?.draft) || 0,
        survey: Number(cohort?.survey) || 0,
        quoted: Number(cohort?.quoted) || 0,
        won_cohort: Number(cohort?.won_cohort) || 0,
        lost_cohort: Number(cohort?.lost_cohort) || 0,
        won: Number(activity?.won) || 0,
        handoffs: Number(activity?.handoffs) || 0,
        lost: Number(activity?.lost) || 0,
        open_now: Number(activity?.open_now) || 0,
        overdue_now: Number(activity?.overdue_now) || 0,
        conversion_rate: leads > 0 ? Number(((Number(cohort?.won_cohort) || 0) * 100 / leads).toFixed(1)) : 0,
        avg_days_to_win: activity?.avg_days_to_win == null ? 0 : Number(Number(activity.avg_days_to_win).toFixed(1)),
      },
      leaderboard: leaderboard.map((row) => ({
        ...row,
        leads: Number(row.leads) || 0,
        won: Number(row.won) || 0,
        handoffs: Number(row.handoffs) || 0,
        target_leads: Number(row.target_leads) || 0,
        target_won: Number(row.target_won) || 0,
        target_handoffs: Number(row.target_handoffs) || 0,
      })),
      packages: packages.map((row) => ({ ...row, won: Number(row.won) || 0 })),
      trend: trendRows.map((row) => ({ ...row, leads: Number(row.leads) || 0, won: Number(row.won) || 0, handoffs: Number(row.handoffs) || 0 })),
      installation: Object.fromEntries(Object.entries(installation || {}).map(([key, value]) => [key, Number(value) || 0])),
    });
  } catch (err) {
    console.error('expansion analytics:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── PUT /api/expansion/targets/:ownerId — monthly target ───
router.put('/targets/:ownerId', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const month = normalizeMonth(req.body.month);
    if (!month) return res.status(400).json({ error: 'เดือนเป้าหมายไม่ถูกต้อง' });
    const ownerId = Number(req.params.ownerId);
    if (!(await validateSalesOwner(pool, ownerId))) return res.status(400).json({ error: 'ไม่พบบัญชีพนักงานขาย' });
    const targetLeads = Math.max(0, parseInt(req.body.target_leads, 10) || 0);
    const targetWon = Math.max(0, parseInt(req.body.target_won, 10) || 0);
    const targetHandoffs = Math.max(0, parseInt(req.body.target_handoffs, 10) || 0);
    await pool.query(
      `INSERT INTO sales_monthly_targets
         (owner_user_id, target_month, target_leads, target_won, target_handoffs, created_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         target_leads = VALUES(target_leads), target_won = VALUES(target_won),
         target_handoffs = VALUES(target_handoffs), created_by = VALUES(created_by)`,
      [ownerId, month, targetLeads, targetWon, targetHandoffs, req.user.id]
    );
    res.json({ success: true, owner_user_id: ownerId, month, target_leads: targetLeads, target_won: targetWon, target_handoffs: targetHandoffs });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ── GET /api/expansion/:id/history ──────────────────────────
router.get('/:id/history', auth, requireRole(ALLOWED_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const [[job]] = await pool.query('SELECT * FROM expansion_jobs WHERE id = ?', [req.params.id]);
    if (!job) return res.status(404).json({ error: 'ไม่พบงานขาย' });
    if (!canAccessRow(req, job)) return res.status(403).json({ error: 'Access denied' });
    const [rows] = await pool.query(
      `SELECT h.*, u.full_name AS created_by_name
       FROM expansion_job_history h
       LEFT JOIN users u ON u.id = h.created_by
       WHERE h.expansion_job_id = ?
       ORDER BY h.created_at DESC, h.id DESC`,
      [job.id]
    );
    res.json(rows.map((row) => ({
      ...row,
      changed_fields: (() => {
        try { return row.changed_fields ? JSON.parse(row.changed_fields) : {}; } catch { return {}; }
      })(),
    })));
  } catch (err) {
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

    if (!(await validateSalesOwner(pool, ownerId))) {
      return res.status(400).json({ error: 'ผู้รับผิดชอบต้องเป็นบัญชีพนักงานขายที่ใช้งานอยู่' });
    }

    const duplicates = await findDuplicates(pool, fields);
    if (duplicates.length && !req.body.override_duplicate) {
      return res.status(409).json({
        error: 'พบข้อมูลลูกค้าที่อาจซ้ำ กรุณาตรวจสอบก่อนบันทึก',
        code: 'DUPLICATE_SALES_LEAD',
        duplicates,
      });
    }

    const [result] = await pool.query(
      `INSERT INTO expansion_jobs
         (customer_type, customer_name, phone, address, access_no, non_number, lat, lng, splitter_note, radius_m,
          status, owner_user_id, follow_up_at, follow_up_time, follow_up_channel, follow_up_note,
          remark, lost_reason,
         id_card, package_name, contract_info, occupation, entry_fee_request, approval_request,
          install_date, install_date_text, sales_note, pair_line, tech_note,
          splitter_id, straight_distance_m, estimated_cable_m)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fields.customer_type,
        fields.customer_name,
        fields.phone,
        fields.address,
        fields.access_no,
        fields.non_number,
        fields.lat,
        fields.lng,
        fields.splitter_note,
        fields.radius_m ?? 500,
        nextStatus,
        ownerId,
        fields.follow_up_at,
        fields.follow_up_time,
        fields.follow_up_channel,
        fields.follow_up_note,
        fields.remark,
        fields.lost_reason || null,
        fields.id_card,
        fields.package_name,
        fields.contract_info,
        fields.occupation,
        fields.entry_fee_request,
        fields.approval_request,
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

    await addHistory(pool, result.insertId, 'created', req.user.id, {
      new_status: nextStatus,
      note: duplicates.length ? 'ยืนยันบันทึกแม้พบข้อมูลที่อาจซ้ำ' : null,
    });

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
    const nextOwnerId = isAdmin(req) && req.body.owner_user_id
      ? Number(req.body.owner_user_id)
      : Number(existing.owner_user_id);
    if (req.body.owner_user_id && nextOwnerId !== Number(existing.owner_user_id) && !(await validateSalesOwner(pool, nextOwnerId))) {
      return res.status(400).json({ error: 'ผู้รับผิดชอบต้องเป็นบัญชีพนักงานขายที่ใช้งานอยู่' });
    }
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
      const duplicates = await findDuplicates(pool, fields, existing.id);
      if (duplicates.length && !req.body.override_duplicate) {
        return res.status(409).json({
          error: 'พบข้อมูลลูกค้าที่อาจซ้ำ กรุณาตรวจสอบก่อนบันทึก',
          code: 'DUPLICATE_SALES_LEAD',
          duplicates,
        });
      }
    }

    await pool.query(
      `UPDATE expansion_jobs SET
         customer_type = ?, customer_name = ?, phone = ?, address = ?, access_no = ?, non_number = ?,
         lat = ?, lng = ?, splitter_note = ?, radius_m = ?,
         status = ?, owner_user_id = ?, follow_up_at = ?, follow_up_time = ?,
         follow_up_channel = ?, follow_up_note = ?, last_contact_at = ?, remark = ?, lost_reason = ?,
         id_card = ?, package_name = ?, contract_info = ?, occupation = ?,
         entry_fee_request = ?, approval_request = ?, install_date = ?, install_date_text = ?,
         sales_note = ?, pair_line = ?, tech_note = ?,
         splitter_id = ?, straight_distance_m = ?, estimated_cable_m = ?
       WHERE id = ?`,
      [
        fields.customer_type,
        fields.customer_name,
        fields.phone,
        fields.address,
        fields.access_no,
        fields.non_number,
        fields.lat,
        fields.lng,
        fields.splitter_note,
        fields.radius_m,
        nextStatus,
        nextOwnerId,
        fields.follow_up_at,
        fields.follow_up_time,
        fields.follow_up_channel,
        fields.follow_up_note,
        fields.last_contact_at,
        fields.remark,
        fields.lost_reason,
        fields.id_card,
        fields.package_name,
        fields.contract_info,
        fields.occupation,
        fields.entry_fee_request,
        fields.approval_request,
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

    if (nextStatus !== existing.status) {
      const timestampColumn = {
        survey: 'surveyed_at', quoted: 'quoted_at', won: 'won_at', lost: 'lost_at',
      }[nextStatus];
      if (timestampColumn) {
        await pool.query(
          `UPDATE expansion_jobs SET \`${timestampColumn}\` = COALESCE(\`${timestampColumn}\`, NOW()) WHERE id = ?`,
          [existing.id]
        );
      }
    }

    const row = await fetchJobWithExtras(pool, existing.id);
    await addHistory(pool, existing.id, nextStatus !== existing.status ? 'status_changed' : (nextOwnerId !== Number(existing.owner_user_id) ? 'assigned' : 'updated'), req.user.id, {
      old_status: existing.status,
      new_status: nextStatus,
      changed_fields: changedSalesFields(existing, row),
      note: req.body.history_note || null,
    });
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

      await addHistory(pool, existing.id, 'photos_added', req.user.id, {
        note: `เพิ่มรูป ${inserted.length} รูป`,
      });

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
    await addHistory(pool, existing.id, 'photo_deleted', req.user.id, { note: `ลบรูป #${photo.id}` });

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
        access_no: existing.access_no,
        queue_status: 'waiting_assignment',
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
    const [[owner]] = await conn.query('SELECT full_name FROM users WHERE id = ? LIMIT 1', [existing.owner_user_id]);
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
          status, task_type, task_status, processing_status,
          remark, package, create_user_role, create_time,
          team_id, field_engineer_id,
          source_expansion_id, source_sales_user_id, source_sales_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'waiting_assignment', 'waiting_assignment', ?, ?, ?, NOW(), NULL, NULL, ?, ?, ?)`,
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
        existing.id,
        existing.owner_user_id,
        owner?.full_name || null,
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
       SET status = 'handed_off', access_no = ?, handed_off_job_id = ?, handed_off_at = NOW()
       WHERE id = ?`,
      [accessNo, jobId, existing.id]
    );

    await addHistory(conn, existing.id, 'handed_off', req.user.id, {
      old_status: existing.status,
      new_status: 'handed_off',
      note: `สร้างงานติดตั้ง #${jobId} · Access ${accessNo}`,
    });

    await conn.commit();
    getAdminIds()
      .then((adminIds) => notifyEvent({
        eventKey: `sales.handoff:${existing.id}:job:${jobId}`,
        actorId: req.user.id,
        title: 'มีงานติดตั้งใหม่รอมอบหมาย',
        body: `${existing.customer_name || accessNo} · Access ${accessNo} · จาก ${owner?.full_name || 'ฝ่ายขาย'}`,
        type: 'job_waiting_assignment',
        data: {
          related_id: jobId,
          expansion_id: existing.id,
          job_type: 'office',
          path: `/dispatch-dashboard?tab=office&openJob=${jobId}`,
        },
        recipients: adminIds,
        push: true,
      }))
      .catch((notifyErr) => console.error('expansion handoff notify:', notifyErr.message));
    res.json({
      success: true,
      job_id: jobId,
      expansion_id: existing.id,
      access_no: accessNo,
      queue_status: 'waiting_assignment',
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

// ── PUT /api/expansion/:id/assign — admin reassign ─────────
router.put('/:id/assign', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const [[existing]] = await pool.query('SELECT * FROM expansion_jobs WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'ไม่พบงานขาย' });
    if (existing.status === 'handed_off') return res.status(400).json({ error: 'งานที่ส่งต่อแล้วไม่สามารถย้ายผู้รับผิดชอบได้' });
    const ownerId = Number(req.body.owner_user_id);
    if (!(await validateSalesOwner(pool, ownerId))) {
      return res.status(400).json({ error: 'ผู้รับผิดชอบต้องเป็นบัญชีพนักงานขายที่ใช้งานอยู่' });
    }
    await pool.query('UPDATE expansion_jobs SET owner_user_id = ? WHERE id = ?', [ownerId, existing.id]);
    const row = await fetchJobWithExtras(pool, existing.id);
    await addHistory(pool, existing.id, 'assigned', req.user.id, {
      changed_fields: { owner_user_id: { old: existing.owner_user_id, new: ownerId } },
      note: `มอบหมายให้ ${row.owner_name || ownerId}`,
    });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// Roll back a just-created record when photo upload/final validation fails.
router.post('/:id/rollback-create', auth, requireRole(ALLOWED_ROLES), async (req, res) => {
  try {
    await ensureExpansionSchema();
    const [[existing]] = await pool.query('SELECT * FROM expansion_jobs WHERE id = ?', [req.params.id]);
    if (!existing) return res.json({ success: true });
    if (!canAccessRow(req, existing)) return res.status(403).json({ error: 'Access denied' });
    if (existing.status === 'handed_off' || existing.handed_off_job_id) {
      return res.status(400).json({ error: 'ไม่สามารถย้อนกลับงานที่ส่งต่อแล้วได้' });
    }
    const createdAt = new Date(existing.created_at).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 15 * 60 * 1000) {
      return res.status(400).json({ error: 'ย้อนกลับได้เฉพาะงานที่เพิ่งสร้างภายใน 15 นาที' });
    }
    const photos = await loadPhotos(pool, existing.id);
    await pool.query('DELETE FROM expansion_job_history WHERE expansion_job_id = ?', [existing.id]);
    await pool.query('DELETE FROM expansion_job_photos WHERE expansion_job_id = ?', [existing.id]);
    await pool.query('DELETE FROM expansion_jobs WHERE id = ?', [existing.id]);
    for (const photo of photos) {
      try {
        const abs = path.join(__dirname, '..', photo.image_path.replace(/^\//, ''));
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch (_) { /* ignore cleanup error */ }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
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
    await pool.query('DELETE FROM expansion_job_history WHERE expansion_job_id = ?', [existing.id]);
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
