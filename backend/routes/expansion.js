const express = require('express');
const pool = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const { syncCustomerFromJob } = require('../utils/customerSync');

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

let schemaReady = false;
let schemaPromise = null;

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

function todayISO() {
  return new Date().toLocaleDateString('en-CA');
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
      where.push('(e.customer_name LIKE ? OR e.phone LIKE ? OR e.address LIKE ? OR e.access_no LIKE ? OR e.splitter_note LIKE ?)');
      params.push(like, like, like, like, like);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT e.*, u.full_name AS owner_name
       FROM expansion_jobs e
       LEFT JOIN users u ON u.id = e.owner_user_id
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
    const [[row]] = await pool.query(
      `SELECT e.*, u.full_name AS owner_name
       FROM expansion_jobs e
       LEFT JOIN users u ON u.id = e.owner_user_id
       WHERE e.id = ?`,
      [req.params.id]
    );
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
    const {
      customer_name, phone, address, access_no,
      lat, lng, splitter_note, radius_m,
      status, follow_up_at, remark, lost_reason,
      owner_user_id,
    } = req.body;

    let nextStatus = normalizeStatus(status) || 'draft';
    if (nextStatus === 'handed_off') nextStatus = 'draft';

    const ownerId = isAdmin(req) && owner_user_id
      ? parseInt(owner_user_id, 10)
      : req.user.id;

    const [result] = await pool.query(
      `INSERT INTO expansion_jobs
         (customer_name, phone, address, access_no, lat, lng, splitter_note, radius_m,
          status, owner_user_id, follow_up_at, remark, lost_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_name || null,
        phone || null,
        address || null,
        access_no || null,
        parseCoord(lat),
        parseCoord(lng),
        splitter_note || null,
        radius_m != null && radius_m !== '' ? parseInt(radius_m, 10) || null : 500,
        nextStatus,
        ownerId,
        follow_up_at || null,
        remark || null,
        lost_reason || null,
      ]
    );

    const [[row]] = await pool.query('SELECT * FROM expansion_jobs WHERE id = ?', [result.insertId]);
    res.status(201).json(row);
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

    const {
      customer_name, phone, address, access_no,
      lat, lng, splitter_note, radius_m,
      status, follow_up_at, remark, lost_reason,
    } = req.body;

    let nextStatus = existing.status;
    if (status != null && status !== '') {
      const normalized = normalizeStatus(status);
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

    if (nextStatus === 'lost' && !(lost_reason || existing.lost_reason)) {
      return res.status(400).json({ error: 'กรุณาระบุเหตุผลเมื่อสถานะเป็นไม่ได้' });
    }

    await pool.query(
      `UPDATE expansion_jobs SET
         customer_name = ?, phone = ?, address = ?, access_no = ?,
         lat = ?, lng = ?, splitter_note = ?, radius_m = ?,
         status = ?, follow_up_at = ?, remark = ?, lost_reason = ?
       WHERE id = ?`,
      [
        customer_name !== undefined ? (customer_name || null) : existing.customer_name,
        phone !== undefined ? (phone || null) : existing.phone,
        address !== undefined ? (address || null) : existing.address,
        access_no !== undefined ? (access_no || null) : existing.access_no,
        lat !== undefined ? parseCoord(lat) : existing.lat,
        lng !== undefined ? parseCoord(lng) : existing.lng,
        splitter_note !== undefined ? (splitter_note || null) : existing.splitter_note,
        radius_m !== undefined
          ? (radius_m != null && radius_m !== '' ? parseInt(radius_m, 10) || null : null)
          : existing.radius_m,
        nextStatus,
        follow_up_at !== undefined ? (follow_up_at || null) : existing.follow_up_at,
        remark !== undefined ? (remark || null) : existing.remark,
        lost_reason !== undefined ? (lost_reason || null) : existing.lost_reason,
        existing.id,
      ]
    );

    const [[row]] = await pool.query('SELECT * FROM expansion_jobs WHERE id = ?', [existing.id]);
    res.json(row);
  } catch (err) {
    console.error('expansion update:', err);
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

    const planDate = req.body.plan_arrival_date || existing.follow_up_at || todayISO();
    const remarkParts = [
      `จากงานขยาย #${existing.id}`,
      existing.splitter_note ? `Splitter: ${existing.splitter_note}` : null,
      existing.remark || null,
    ].filter(Boolean);

    const [ins] = await conn.query(
      `INSERT INTO jobs
         (plan_arrival_date, access_no, customer, phone, address, lat, lng,
          status, task_type, remark, create_user_role, create_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, NOW())`,
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
    await pool.query('DELETE FROM expansion_jobs WHERE id = ?', [existing.id]);
    res.json({ success: true, message: 'ลบงานขยายแล้ว' });
  } catch (err) {
    console.error('expansion delete:', err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;
