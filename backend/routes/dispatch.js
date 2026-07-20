const express = require('express');
const pool    = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const { upload, setUpload } = require('../middleware/upload');
const { syncCustomerFromJob, syncMaCustomerFromJob } = require('../utils/customerSync');
const { sendToUser } = require('../config/firebase-admin');

const router = express.Router();

// ── Push notification helper: send to all members of a team ──
async function notifyTeamMembers(teamId, title, body, data = {}, senderId = null) {
  try {
    const [members] = await pool.query(
      'SELECT id FROM users WHERE team_id = ? AND status = ?',
      [teamId, 'approved']
    );
    for (const member of members) {
      // 1. Send push notification
      sendToUser(member.id, title, body, data).catch(e => console.error('Push to team member failed:', e.message));
      
      // 2. Save to inbox (messages table)
      try {
        await pool.query(
          `INSERT INTO messages (sender_id, receiver_id, title, body, type, related_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [senderId || 1, member.id, title, body, data.type || 'system', data.related_id || null]
        );
      } catch (dbErr) {
        console.error('Failed to save message for user', member.id, dbErr);
      }
    }
  } catch (e) {
    console.error('notifyTeamMembers error:', e.message);
  }
}

// ── Push notification helper: send to all admins ──
async function notifyAdmins(title, body, data = {}) {
  try {
    const [admins] = await pool.query(
      `SELECT DISTINCT u.id FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.status = 'approved' AND (u.role IN ('super_admin','admin') OR ur.role IN ('super_admin','admin'))`
    );
    for (const admin of admins) {
      sendToUser(admin.id, title, body, data).catch(e => console.error('Push to admin failed:', e.message));
    }
  } catch (e) {
    console.error('notifyAdmins error:', e.message);
  }
}

const ADMIN_ROLES = ['super_admin', 'admin'];

async function safeSyncCustomer(conn, jobId) {
  try {
    await syncCustomerFromJob(conn, jobId);
  } catch (e) {
    if (e.message && e.message.includes("doesn't exist")) {
      console.warn('customers sync skipped (run migrate-fix):', e.message);
    } else {
      throw e;
    }
  }
}

const DEVICE_ROLE_INSTALL_PREFIX = {
  SOA: 'SOA', ONU: 'ONU', PB: 'PB', Mesh: 'Mesh', SIM: 'SIM', Cam: 'Cam',
};

/** Who owns the bag / gets usage credit — assignee when set, else the person completing */
function resolveBagOwnerId(job, completerId, { isMa = false } = {}) {
  const assignee = isMa ? job?.assigned_user_id : job?.field_engineer_id;
  if (assignee) return Number(assignee);
  return Number(completerId);
}

function parseInstallDevice(str) {
  if (!str) return {};
  const map = {
    SOA: 'soa_device', ONU: 'sn_onu', PB: 'sn_playbox', Mesh: 'sn_mesh',
    SIM: 'sn_sim', Cam: 'sn_ip_camera', Sp: 'split_no', Pt: 'port_no',
    L3: 'l3_name', 'สาย': 'cable_length', '3BB': 'ref_id_3bb', 'SCฟ้า': 'sc_blue',
  };
  const out = {};
  for (const part of str.split(/[\n|]/)) {
    const line = part.trim();
    if (!line) continue;
    const ci = line.indexOf(':');
    if (ci === -1) continue;
    const key = line.slice(0, ci).trim();
    let val = line.slice(ci + 1).trim();
    const field = map[key];
    if (!field) continue;
    if (field === 'cable_length') val = val.replace(/M$/i, '');
    out[field] = val;
  }
  return out;
}

function parseUsedInventoryBody(body) {
  if (!body.usedInventory) return [];
  try {
    const parsed = typeof body.usedInventory === 'string' ? JSON.parse(body.usedInventory) : body.usedInventory;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function processUsedInventory(conn, { jobId, techId, accessNo, usedItems }) {
  const seenIds = new Set();
  const installParts = [];

  for (const entry of usedItems) {
    const itemId = parseInt(entry.inventory_item_id, 10);
    const role = entry.device_role;
    if (!itemId || !role || !DEVICE_ROLE_INSTALL_PREFIX[role]) continue;
    if (seenIds.has(itemId)) {
      throw new Error('เลือกอุปกรณ์ซ้ำกันในรายการ');
    }
    seenIds.add(itemId);

    const [[item]] = await conn.query(
      `SELECT ii.*, pm.model_name, p.name AS product_name, p.has_sn
       FROM inventory_items ii
       JOIN inventory_models pm ON pm.id = ii.model_id
       JOIN inventory_products p ON p.id = pm.product_id
       WHERE ii.id = ? AND ii.owner_id = ? AND ii.status = 'dispatched'
       FOR UPDATE`,
      [itemId, techId]
    );
    if (!item) {
      throw new Error(`ไม่พบอุปกรณ์ในกระเป๋า (ID: ${itemId})`);
    }

    await conn.query(`UPDATE inventory_items SET status = 'used', quantity = 0 WHERE id = ?`, [itemId]);
    await conn.query(
      `INSERT INTO inventory_logs (item_id, from_user_id, action, quantity, note) VALUES (?, ?, 'used', 1, ?)`,
      [itemId, techId, `ติดตั้งให้ลูกค้า: ${accessNo || jobId}`]
    );
    await conn.query(
      `INSERT INTO job_used_inventory (job_id, inventory_item_id, device_role, sn, product_name, model_name, quantity, used_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobId, itemId, role, item.sn, item.product_name, item.model_name, item.quantity, techId]
    );

    const prefix = DEVICE_ROLE_INSTALL_PREFIX[role];
    const displayVal = role === 'SOA'
      ? `${item.product_name} ${item.model_name}`.trim()
      : item.sn;
    installParts.push({ prefix, value: displayVal });
  }

  return installParts;
}

function buildInstallDeviceString(installParts, manualParts) {
  const tokens = [
    ...installParts.map(({ prefix, value }) => `${prefix}:${value}`),
    ...manualParts.filter(Boolean),
  ];
  return tokens.join(' | ') || null;
}

// ─ parse noSnItems from body ─
function parseNoSnItems(body) {
  if (!body.noSnItems) return [];
  try {
    const parsed = typeof body.noSnItems === 'string' ? JSON.parse(body.noSnItems) : body.noSnItems;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─ process no-SN inventory items (deduct quantity, log, insert job_used_inventory) ─
async function processNoSnItems(conn, { jobId, techId, accessNo, noSnItems }) {
  const summaryParts = [];
  for (const entry of noSnItems) {
    const itemId = parseInt(entry.item_id, 10);
    const qty    = parseInt(entry.quantity, 10);
    if (!itemId || !qty || qty <= 0) continue;

    const [[item]] = await conn.query(
      `SELECT ii.*, pm.model_name, p.name AS product_name, p.unit
       FROM inventory_items ii
       JOIN inventory_models pm ON pm.id = ii.model_id
       JOIN inventory_products p ON p.id = pm.product_id
       WHERE ii.id = ? AND ii.owner_id = ? AND ii.status = 'dispatched'
       FOR UPDATE`,
      [itemId, techId]
    );
    if (!item) continue; // skip if not found (silent, user may have partial bag)

    if (item.quantity < qty) {
      throw new Error(`อุปกรณ์ ${item.product_name} ไม่เพียงพอ (คงเหลือ: ${item.quantity})`);
    }

    if (item.quantity === qty) {
      // ใช้หมด → เปลี่ยนสถานะเป็น used
      await conn.query(`UPDATE inventory_items SET status = 'used', quantity = 0 WHERE id = ?`, [itemId]);
    } else {
      // ใช้บางส่วน → หักจำนวน
      await conn.query(`UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?`, [qty, itemId]);
    }

    // บันทึก log
    const note = `ติดตั้งให้ลูกค้า: ${accessNo || jobId}`;
    try {
      await conn.query(
        `INSERT INTO inventory_logs (item_id, from_user_id, action, quantity, note) VALUES (?, ?, 'used', ?, ?)`,
        [itemId, techId, qty, note]
      );
    } catch(le) {
      if (le.message.includes("Field 'id' doesn't have a default value")) {
        const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM inventory_logs');
        await conn.query(
          `INSERT INTO inventory_logs (id, item_id, from_user_id, action, quantity, note) VALUES (?, ?, ?, 'used', ?, ?)`,
          [(maxId||0)+1, itemId, techId, qty, note]
        );
      } else throw le;
    }

    // บันทึก job_used_inventory
    const productName = entry.product_name || item.product_name;
    const modelName   = entry.model_name   || item.model_name || '-';
    try {
      await conn.query(
        `INSERT INTO job_used_inventory (job_id, inventory_item_id, device_role, sn, product_name, model_name, quantity, used_by)
         VALUES (?, ?, 'NoSN', '-', ?, ?, ?, ?)`,
        [jobId, itemId, productName, modelName, qty, techId]
      );
    } catch(je) {
      if (je.message.includes("Field 'id' doesn't have a default value")) {
        const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM job_used_inventory');
        await conn.query(
          `INSERT INTO job_used_inventory (id, job_id, inventory_item_id, device_role, sn, product_name, model_name, quantity, used_by)
           VALUES (?, ?, ?, 'NoSN', '-', ?, ?, ?, ?)`,
          [(maxId||0)+1, jobId, itemId, productName, modelName, qty, techId]
        );
      } else throw je;
    }

    const unit = entry.unit || item.unit || 'ชิ้น';
    summaryParts.push(`${productName} ${modelName} x${qty} ${unit}`.trim());
  }
  return summaryParts;
}

async function ensureMaJobSchema(connOrPool) {
  const db = connOrPool || pool;
  const cols = [
    ['area_name', "VARCHAR(150) DEFAULT NULL COMMENT 'พื้นที่'"],
    ['srt', 'VARCHAR(100) DEFAULT NULL'],
    ['spt', 'VARCHAR(100) DEFAULT NULL'],
    ['fail_cause', 'TEXT DEFAULT NULL'],
    ['fix_method', 'TEXT DEFAULT NULL'],
    ['old_sn', 'TEXT DEFAULT NULL'],
    ['new_sn', 'TEXT DEFAULT NULL'],
    ['cable_used', 'TEXT DEFAULT NULL'],
    ['used_equipment', 'TEXT DEFAULT NULL'],
    ['lat', 'VARCHAR(50) DEFAULT NULL'],
    ['lng', 'VARCHAR(50) DEFAULT NULL'],
  ];
  for (const [name, def] of cols) {
    try {
      await db.query(`ALTER TABLE ma_jobs ADD COLUMN ${name} ${def}`);
    } catch (e) {
      if (!String(e.message || '').includes('Duplicate column')) {
        // ignore other alter races
      }
    }
  }
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ma_job_used_inventory (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ma_job_id INT NOT NULL,
        inventory_item_id INT NOT NULL,
        device_role VARCHAR(50) DEFAULT 'NoSN',
        sn VARCHAR(255) DEFAULT NULL,
        product_name VARCHAR(255) DEFAULT NULL,
        model_name VARCHAR(255) DEFAULT NULL,
        quantity DECIMAL(10,2) DEFAULT 1.00,
        used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        used_by INT DEFAULT NULL,
        KEY idx_mjui_job (ma_job_id),
        KEY idx_mjui_item (inventory_item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (e) { /* exists */ }
}

// ── Shared Excel import aliases (normalized nickname → user/team) ─────────────
// Schema also lives in backend/scripts/job_audit_and_aliases.sql
async function ensureImportAliasSchema(db) {
  await (db || pool).query(`
    CREATE TABLE IF NOT EXISTS user_import_aliases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job_type ENUM('office','ma','any') NOT NULL DEFAULT 'any',
      normalized_alias VARCHAR(150) NOT NULL,
      user_id INT DEFAULT NULL,
      team_id INT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_alias (job_type, normalized_alias),
      KEY idx_uia_user (user_id),
      KEY idx_uia_team (team_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// ── Central job audit log (office + MA) ──────────────────────────────────────
// Schema also lives in backend/scripts/job_audit_and_aliases.sql
let jobAuditSchemaReady = false;
async function ensureJobAuditSchema(db) {
  if (jobAuditSchemaReady) return;
  await (db || pool).query(`
    CREATE TABLE IF NOT EXISTS job_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      job_type ENUM('office','ma') NOT NULL,
      job_id INT NOT NULL,
      action VARCHAR(50) NOT NULL,
      old_status VARCHAR(50) DEFAULT NULL,
      new_status VARCHAR(50) DEFAULT NULL,
      old_team_id INT DEFAULT NULL,
      new_team_id INT DEFAULT NULL,
      old_assignee_id INT DEFAULT NULL,
      new_assignee_id INT DEFAULT NULL,
      actor_id INT DEFAULT NULL,
      remark TEXT DEFAULT NULL,
      meta_json JSON DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_jal_job (job_type, job_id),
      KEY idx_jal_actor (actor_id),
      KEY idx_jal_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  jobAuditSchemaReady = true;
}

/** Write one audit row. Never throws — audit must never break the main flow. */
async function writeJobAudit(db, {
  job_type, job_id, action,
  old_status = null, new_status = null,
  old_team_id = null, new_team_id = null,
  old_assignee_id = null, new_assignee_id = null,
  actor_id = null, remark = null, meta_json = null,
}) {
  try {
    const conn = db || pool;
    await ensureJobAuditSchema(conn);
    await conn.query(
      `INSERT INTO job_audit_logs
         (job_type, job_id, action, old_status, new_status,
          old_team_id, new_team_id, old_assignee_id, new_assignee_id,
          actor_id, remark, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job_type, job_id, action,
        old_status || null, new_status || null,
        old_team_id || null, new_team_id || null,
        old_assignee_id || null, new_assignee_id || null,
        actor_id || null, remark || null,
        meta_json ? JSON.stringify(meta_json) : null,
      ]
    );
  } catch (e) {
    console.warn('audit write failed:', e.message);
  }
}

async function processMaNoSnItems(conn, { maJobId, techId, nonNumber, noSnItems }) {
  const summaryParts = [];
  for (const entry of noSnItems) {
    const itemId = parseInt(entry.item_id, 10);
    const qty = parseInt(entry.quantity, 10);
    if (!itemId || !qty || qty <= 0) continue;

    const [[item]] = await conn.query(
      `SELECT ii.*, pm.model_name, p.name AS product_name, p.unit
       FROM inventory_items ii
       JOIN inventory_models pm ON pm.id = ii.model_id
       JOIN inventory_products p ON p.id = pm.product_id
       WHERE ii.id = ? AND ii.owner_id = ? AND ii.status = 'dispatched'
       FOR UPDATE`,
      [itemId, techId]
    );
    if (!item) continue;

    if (item.quantity < qty) {
      throw new Error(`อุปกรณ์ ${item.product_name} ไม่เพียงพอ (คงเหลือ: ${item.quantity})`);
    }

    if (item.quantity === qty) {
      await conn.query(`UPDATE inventory_items SET status = 'used', quantity = 0 WHERE id = ?`, [itemId]);
    } else {
      await conn.query(`UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?`, [qty, itemId]);
    }

    const note = `MA ติดตั้งให้ลูกค้า: ${nonNumber || maJobId}`;
    try {
      await conn.query(
        `INSERT INTO inventory_logs (item_id, from_user_id, action, quantity, note) VALUES (?, ?, 'used', ?, ?)`,
        [itemId, techId, qty, note]
      );
    } catch (le) {
      if (String(le.message || '').includes("Field 'id' doesn't have a default value")) {
        const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM inventory_logs');
        await conn.query(
          `INSERT INTO inventory_logs (id, item_id, from_user_id, action, quantity, note) VALUES (?, ?, ?, 'used', ?, ?)`,
          [(maxId || 0) + 1, itemId, techId, qty, note]
        );
      } else throw le;
    }

    const productName = entry.product_name || item.product_name;
    const modelName = entry.model_name || item.model_name || '-';
    await conn.query(
      `INSERT INTO ma_job_used_inventory (ma_job_id, inventory_item_id, device_role, sn, product_name, model_name, quantity, used_by)
       VALUES (?, ?, 'NoSN', '-', ?, ?, ?, ?)`,
      [maJobId, itemId, productName, modelName, qty, techId]
    );

    const unit = entry.unit || item.unit || 'ชิ้น';
    summaryParts.push(`${productName} ${modelName} x${qty} ${unit}`.trim());
  }
  return summaryParts;
}

/** MA: cut SN items from bag and record in ma_job_used_inventory */
async function processMaSnItems(conn, { maJobId, techId, nonNumber, snItems }) {
  const summaryParts = [];
  const seenIds = new Set();

  for (const entry of snItems) {
    const itemId = parseInt(entry.inventory_item_id || entry.item_id, 10);
    if (!itemId) continue;
    if (seenIds.has(itemId)) throw new Error('เลือกอุปกรณ์ SN ซ้ำกันในรายการ');
    seenIds.add(itemId);

    const [[item]] = await conn.query(
      `SELECT ii.*, pm.model_name, p.name AS product_name, p.has_sn
       FROM inventory_items ii
       JOIN inventory_models pm ON pm.id = ii.model_id
       JOIN inventory_products p ON p.id = pm.product_id
       WHERE ii.id = ? AND ii.owner_id = ? AND ii.status = 'dispatched'
       FOR UPDATE`,
      [itemId, techId]
    );
    if (!item) {
      throw new Error(`ไม่พบอุปกรณ์ SN ในกระเป๋า (ID: ${itemId})`);
    }

    await conn.query(`UPDATE inventory_items SET status = 'used', quantity = 0 WHERE id = ?`, [itemId]);

    const note = `MA ติดตั้งให้ลูกค้า: ${nonNumber || maJobId}`;
    try {
      await conn.query(
        `INSERT INTO inventory_logs (item_id, from_user_id, action, quantity, note) VALUES (?, ?, 'used', 1, ?)`,
        [itemId, techId, note]
      );
    } catch (le) {
      if (String(le.message || '').includes("Field 'id' doesn't have a default value")) {
        const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM inventory_logs');
        await conn.query(
          `INSERT INTO inventory_logs (id, item_id, from_user_id, action, quantity, note) VALUES (?, ?, ?, 'used', 1, ?)`,
          [(maxId || 0) + 1, itemId, techId, note]
        );
      } else throw le;
    }

    const productName = entry.product_name || item.product_name;
    const modelName = entry.model_name || item.model_name || '-';
    const sn = item.sn || entry.sn || '-';
    await conn.query(
      `INSERT INTO ma_job_used_inventory (ma_job_id, inventory_item_id, device_role, sn, product_name, model_name, quantity, used_by)
       VALUES (?, ?, 'SN', ?, ?, ?, 1, ?)`,
      [maJobId, itemId, sn, productName, modelName, techId]
    );

    summaryParts.push(`${productName} ${modelName} (SN: ${sn})`.trim());
  }
  return summaryParts;
}

// ── GET /api/dispatch/jobs — List jobs (team-filtered for techs) ─
router.get('/jobs', auth, async (req, res) => {
  try {
    const { status, date, team_id, type, user_id, q } = req.query;
    const userRoles = req.user.roles || [req.user.role];
    const isAdmin   = userRoles.some((r) => ADMIN_ROLES.includes(r));

    let where   = [];
    let params  = [];
    let table = 'jobs';

    if (type === 'ma') {
      table = 'ma_jobs';
    }

    if (type === 'postponed') {
      where.push(`(j.status = 'postponed' OR j.id IN (SELECT job_id FROM job_logs WHERE status='postponed'))`);
    } else if (type === 'failed') {
      where.push(`j.status = 'failed'`);
    } else {
      // For normal tabs (office, ma), hide jobs that are postponed to a future date
      // Once the date arrives (<= CURDATE()), they will reappear.
      where.push(`(j.status != 'postponed' OR j.plan_arrival_date <= CURDATE() OR j.plan_arrival_date IS NULL)`);
    }

    // Non-admin: restrict to own team only or own assignments
    if (!isAdmin) {
      if (type === 'ma') {
        if (!req.user.team_id) {
          where.push('j.assigned_user_id = ?');
          params.push(req.user.id);
        } else {
          where.push('(j.team_id = ? OR j.assigned_user_id = ?)');
          params.push(req.user.team_id, req.user.id);
        }
      } else if (!req.user.team_id) {
        where.push('j.field_engineer_id = ?');
        params.push(req.user.id);
      } else {
        where.push('(j.team_id = ? OR j.field_engineer_id = ?)');
        params.push(req.user.team_id, req.user.id);
      }
    } else if (team_id) {
      where.push('j.team_id = ?');
      params.push(team_id);
    }

    if (user_id) {
      if (type === 'ma') {
        where.push('(j.team_id = (SELECT team_id FROM users WHERE id = ?) OR j.assigned_user_id = ?)');
      } else {
        where.push('(j.team_id = (SELECT team_id FROM users WHERE id = ?) OR j.field_engineer_id = ?)');
      }
      params.push(user_id, user_id);
    }

    if (status) { where.push('j.status = ?'); params.push(status); }
    
    // For postponed tab, we might want to ignore date filter or include it
    if (date && type !== 'postponed')   { where.push('j.plan_arrival_date = ?'); params.push(date); }

    const search = String(q || '').trim();
    if (search) {
      const like = `%${search}%`;
      if (type === 'ma') {
        where.push(`(
          j.access_no LIKE ? OR j.non_number LIKE ? OR j.customer LIKE ? OR j.phone LIKE ?
          OR j.address LIKE ? OR j.area_name LIKE ?
          OR EXISTS (SELECT 1 FROM teams t2 WHERE t2.id = j.team_id AND t2.team_name LIKE ?)
          OR EXISTS (SELECT 1 FROM users u2 WHERE u2.id = j.assigned_user_id AND u2.full_name LIKE ?)
        )`);
        params.push(like, like, like, like, like, like, like, like);
      } else {
        where.push(`(
          j.access_no LIKE ? OR j.customer LIKE ? OR j.phone LIKE ? OR j.address LIKE ?
          OR j.order_no LIKE ? OR j.customer_order_no LIKE ? OR j.area_name LIKE ?
          OR EXISTS (SELECT 1 FROM teams t2 WHERE t2.id = j.team_id AND t2.team_name LIKE ?)
          OR EXISTS (SELECT 1 FROM users u2 WHERE u2.id = j.field_engineer_id AND u2.full_name LIKE ?)
        )`);
        params.push(like, like, like, like, like, like, like, like, like);
      }
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const selectCols = type === 'ma'
      ? `j.*, j.job_time AS plan_arrival_time, j.assigned_user_id AS field_engineer_id,
         COALESCE(j.non_number, j.access_no) AS display_non,
         'ma' AS job_type`
      : `j.*, 'office' AS job_type`;

    const assigneeJoinCol = type === 'ma' ? 'j.assigned_user_id' : 'j.field_engineer_id';

    const [rows] = await pool.query(
      `SELECT ${selectCols}, j.id AS id, t.team_name,
              u.full_name AS completed_by_name,
              assignee.full_name AS assignee_name,
              (SELECT GROUP_CONCAT(m.full_name SEPARATOR ', ')
                 FROM users m
                WHERE m.team_id = j.team_id AND m.status = 'approved'
              ) AS tech_names
       FROM ${table} j
       LEFT JOIN teams t ON t.id = j.team_id
       LEFT JOIN users u ON u.id = j.completed_by
       LEFT JOIN users assignee ON assignee.id = ${assigneeJoinCol}
       ${whereClause}
       ORDER BY j.plan_arrival_date ASC, j.seq ASC, j.id ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Get jobs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/dispatch/jobs/:id — Single job detail ─────────
router.get('/jobs/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT j.*, t.team_name FROM jobs j
       LEFT JOIN teams t ON t.id = j.team_id
       WHERE j.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/dispatch/jobs/:id/details — Job completion details + equipment ─
router.get('/jobs/:id/details', auth, async (req, res) => {
  try {
    const jobId = req.params.id;
    const table = req.query.type === 'ma' ? 'ma_jobs' : 'jobs';

    const [[job]] = await pool.query(
      `SELECT j.*, t.team_name, u.full_name AS completed_by_name
       FROM ${table} j
       LEFT JOIN teams t ON t.id = j.team_id
       LEFT JOIN users u ON u.id = j.completed_by
       WHERE j.id = ?`,
      [jobId]
    );
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Get completion images
    let images = [];
    try {
      if (req.query.type === 'ma') {
        const [imgRows] = await pool.query(
          'SELECT image_path, uploaded_by, created_at FROM ma_job_completion_images WHERE ma_job_id = ? ORDER BY id',
          [jobId]
        );
        images = imgRows;
      } else {
        const [imgRows] = await pool.query(
          'SELECT image_path, uploaded_by, created_at FROM job_completion_images WHERE job_id = ? ORDER BY id',
          [jobId]
        );
        images = imgRows;
      }
    } catch (e) { /* table may not exist */ }

    // Get used equipment
    let usedDevices = [];
    try {
      if (req.query.type === 'ma') {
        const [devRows] = await pool.query(
          `SELECT device_role, sn, product_name, model_name, quantity, used_at
           FROM ma_job_used_inventory WHERE ma_job_id = ? ORDER BY id ASC`,
          [jobId]
        );
        usedDevices = devRows;
      } else {
        const [devRows] = await pool.query(
          `SELECT device_role, sn, product_name, model_name, quantity, used_at
           FROM job_used_inventory WHERE job_id = ? ORDER BY id ASC`,
          [jobId]
        );
        usedDevices = devRows;
      }
    } catch (e) { /* table may not exist */ }

    // Get postpone history (job_logs)
    let logs = [];
    try {
      const [logRows] = await pool.query(
        `SELECT jl.*, u.full_name AS action_by_name FROM job_logs jl LEFT JOIN users u ON u.id = jl.action_by WHERE jl.job_id = ? ORDER BY jl.created_at DESC`,
        [jobId]
      );
      logs = logRows;
    } catch (e) { /* table may not exist */ }

    res.json({ ...job, images, used_devices: usedDevices, logs });
  } catch (err) {
    console.error('Job details error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/dispatch/jobs/:id/audit — Audit trail for a job (admin) ─────────
router.get('/jobs/:id/audit', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    await ensureJobAuditSchema(pool);
    const jobType = req.query.type === 'ma' ? 'ma' : 'office';
    const [rows] = await pool.query(
      `SELECT a.*,
              actor.full_name AS actor_name,
              ot.team_name AS old_team_name,
              nt.team_name AS new_team_name,
              oa.full_name AS old_assignee_name,
              na.full_name AS new_assignee_name
       FROM job_audit_logs a
       LEFT JOIN users actor ON actor.id = a.actor_id
       LEFT JOIN teams ot ON ot.id = a.old_team_id
       LEFT JOIN teams nt ON nt.id = a.new_team_id
       LEFT JOIN users oa ON oa.id = a.old_assignee_id
       LEFT JOIN users na ON na.id = a.new_assignee_id
       WHERE a.job_type = ? AND a.job_id = ?
       ORDER BY a.created_at DESC, a.id DESC`,
      [jobType, req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Job audit fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/dispatch/jobs/:id/set-off — Tech sets off ─────────
router.put('/jobs/:id/set-off', auth, async (req, res) => {
  const jobId = req.params.id;
  const techId = req.user.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[job]] = await conn.query('SELECT * FROM jobs WHERE id = ? LIMIT 1', [jobId]);
    if (!job) { await conn.rollback(); return res.status(404).json({ error: 'Job not found' }); }
    
    await conn.query(`UPDATE jobs SET status = 'in_progress', set_off_time = NOW() WHERE id = ?`, [jobId]);
    
    try {
      await conn.query(`INSERT INTO job_logs (job_id, tech_id, status) VALUES (?, ?, 'set_off')`, [jobId, techId]);
    } catch(e) {
      if (e.message.includes("Field 'id' doesn't have a default value")) {
        const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM job_logs');
        await conn.query(`INSERT INTO job_logs (id, job_id, tech_id, status) VALUES (?, ?, ?, 'set_off')`, [(maxId || 0) + 1, jobId, techId]);
      } else throw e;
    }

    await safeSyncCustomer(conn, jobId);
    await conn.commit();
    res.json({ message: 'Set off successful' });
  } catch (err) {
    await conn.rollback();
    console.error('Set off error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── PUT /api/dispatch/jobs/:id/arrive — Tech arrives at site ──
router.put('/jobs/:id/arrive', auth, async (req, res) => {
  const jobId = req.params.id;
  const techId = req.user.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[job]] = await conn.query('SELECT * FROM jobs WHERE id = ? LIMIT 1', [jobId]);
    if (!job) { await conn.rollback(); return res.status(404).json({ error: 'Job not found' }); }
    
    await conn.query(`UPDATE jobs SET status = 'in_progress', arrival_time = NOW() WHERE id = ?`, [jobId]);
    
    try {
      await conn.query(`INSERT INTO job_logs (job_id, tech_id, status) VALUES (?, ?, 'arrival')`, [jobId, techId]);
    } catch(e) {
      if (e.message.includes("Field 'id' doesn't have a default value")) {
        const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM job_logs');
        await conn.query(`INSERT INTO job_logs (id, job_id, tech_id, status) VALUES (?, ?, ?, 'arrival')`, [(maxId || 0) + 1, jobId, techId]);
      } else throw e;
    }

    await safeSyncCustomer(conn, jobId);
    await conn.commit();
    res.json({ message: 'Arrival successful' });
  } catch (err) {
    await conn.rollback();
    console.error('Arrival error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── PUT /api/dispatch/jobs/:id/complete — Tech completes a job ─
router.put(
  '/jobs/:id/complete',
  auth,
  setUpload('job_evidence'),
  upload.fields([{ name: 'images', maxCount: 40 }, { name: 'entryFeeSlip', maxCount: 1 }]),
  async (req, res) => {
    const jobId  = req.params.id;
    const techId = req.user.id;
    const conn   = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Fetch job & verify access
      const [[job]] = await conn.query(
        `SELECT * FROM jobs WHERE id = ? LIMIT 1`, [jobId]
      );
      if (!job) { await conn.rollback(); return res.status(404).json({ error: 'Job not found' }); }

      const userRoles = req.user.roles || [req.user.role];
      const isAdmin   = userRoles.some((r) => ADMIN_ROLES.includes(r));
      const isAssignee = job.field_engineer_id && Number(job.field_engineer_id) === Number(techId);
      const isSameTeam = job.team_id && req.user.team_id && Number(job.team_id) === Number(req.user.team_id);
      if (!isAdmin && !isAssignee && !isSameTeam) {
        await conn.rollback();
        return res.status(403).json({ error: 'Job does not belong to your team' });
      }
      if (job.status === 'completed') {
        await conn.rollback();
        return res.status(409).json({ error: 'Job already completed' });
      }

      // 2. Process tech-bag inventory usage (SN items)
      // Attribute stock + usage to assignee when set (admin completing on behalf)
      const bagOwnerId = resolveBagOwnerId(job, techId, { isMa: false });
      const usedItems = parseUsedInventoryBody(req.body);
      let installPartsFromBag = [];
      if (usedItems.length > 0) {
        installPartsFromBag = await processUsedInventory(conn, {
          jobId, techId: bagOwnerId, accessNo: job.access_no, usedItems,
        });
      }

      // 2b. Process no-SN items (quantity-based equipment)
      const noSnItems = parseNoSnItems(req.body);
      let noSnSummaryParts = [];
      if (noSnItems.length > 0) {
        noSnSummaryParts = await processNoSnItems(conn, {
          jobId, techId: bagOwnerId, accessNo: job.access_no, noSnItems,
        });
      }

      const manualParts = [
        req.body.splitNo ? `Sp:${req.body.splitNo}` : null,
        req.body.portNo ? `Pt:${req.body.portNo}` : null,
        req.body.l3Name ? `L3:${req.body.l3Name}` : null,
        req.body.cableLength ? `สาย:${req.body.cableLength}M` : null,
        req.body.refId3bb ? `3BB:${req.body.refId3bb}` : null,
        req.body.scBlue ? `SCฟ้า:${req.body.scBlue}` : null,
      ];

      // Merge installDevice: frontend may send a pre-built string (preferred) or we build it here
      const installDeviceStr = req.body.installDevice
        || buildInstallDeviceString(installPartsFromBag, [...manualParts, ...noSnSummaryParts]);

      // 3. Update job status
      await conn.query(
        `UPDATE jobs SET 
          status = 'completed', 
          finish_time = NOW(),
          completed_at = NOW(),
          completed_by = ?,
          remark = ?,
          plan_arrival_date = COALESCE(?, plan_arrival_date),
          access_no = COALESCE(?, access_no),
          customer = COALESCE(?, customer),
          package = COALESCE(?, package),
          install_device = COALESCE(?, install_device),
          split_no = ?,
          port_no = ?,
          l3_name = ?,
          cable_length = ?,
          ref_id_3bb = ?,
          sc_blue = ?
         WHERE id = ?`,
        [
          techId,
          req.body.remark || null,
          req.body.installDate || null,
          req.body.accessNo || null,
          req.body.customerName || null,
          req.body.mainPackage || null,
          installDeviceStr,
          req.body.splitNo || null,
          req.body.portNo || null,
          req.body.l3Name || null,
          req.body.cableLength ? req.body.cableLength.replace(/[^0-9.]/g, '') : null,
          req.body.refId3bb || null,
          req.body.scBlue || null,
          jobId
        ]
      );

      // 4. Log to job_logs
      try {
        await conn.query(
          `INSERT INTO job_logs (job_id, tech_id, status, remark) VALUES (?, ?, 'completed', ?)`,
          [jobId, techId, req.body.remark || null]
        );
      } catch (logErr) {
        if (logErr.message.includes("Field 'id' doesn't have a default value")) {
          const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM job_logs');
          const nextId = (maxId || 0) + 1;
          await conn.query(
            `INSERT INTO job_logs (id, job_id, tech_id, status, remark) VALUES (?, ?, ?, 'completed', ?)`,
            [nextId, jobId, techId, req.body.remark || null]
          );
        } else {
          throw logErr;
        }
      }

      // 4. Insert images
      const images = req.files?.images || [];
      if (images.length > 0) {
        for (const file of images) {
          try {
            await conn.query(
              `INSERT INTO job_completion_images (job_id, image_path, uploaded_by) VALUES (?, ?, ?)`,
              [jobId, `/uploads/job_evidence/${file.filename}`, techId]
            );
          } catch(e) { 
            if (e.message.includes("Field 'id' doesn't have a default value")) {
              const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM job_completion_images');
              const nextId = (maxId || 0) + 1;
              await conn.query(
                `INSERT INTO job_completion_images (id, job_id, image_path, uploaded_by) VALUES (?, ?, ?, ?)`,
                [nextId, jobId, `/uploads/job_evidence/${file.filename}`, techId]
              );
            } else {
              console.error('Image insert error:', e.message); 
            }
          }
        }
      }

      // 4.5 Insert Entry Fee (3 modes: slip/cash/backdate)
      const { entryFeeStatus, accessNo, customerName, entryFeeBackdate } = req.body;
      if (entryFeeStatus && entryFeeStatus !== 'none') {
        let slipPath = null;
        let feeType = entryFeeStatus; // 'slip', 'cash', 'backdate'
        let backdateVal = null;

        if (entryFeeStatus === 'cash') {
          slipPath = 'รับหน้างาน';
          feeType = 'cash';
        } else if (entryFeeStatus === 'slip' || entryFeeStatus === 'transfer') {
          const slipFile = req.files?.entryFeeSlip ? req.files.entryFeeSlip[0] : null;
          if (slipFile) {
            slipPath = `/uploads/job_evidence/${slipFile.filename}`;
          }
          feeType = 'slip';
        } else if (entryFeeStatus === 'backdate') {
          const slipFile = req.files?.entryFeeSlip ? req.files.entryFeeSlip[0] : null;
          if (slipFile) {
            slipPath = `/uploads/job_evidence/${slipFile.filename}`;
          }
          feeType = 'backdate';
          backdateVal = entryFeeBackdate || null;
        }
        
        if (slipPath) {
          const efAccessNo = accessNo || job.access_no;
          const efCustomer = customerName || job.customer;
          try {
            await conn.query(
              'INSERT INTO entry_fees (access_no, customer_name, image_path, created_by, fee_type, backdate) VALUES (?, ?, ?, ?, ?, ?)',
              [efAccessNo, efCustomer, slipPath, techId, feeType, backdateVal]
            );
          } catch(e) { 
            if (e.message.includes("Field 'id' doesn't have a default value")) {
              const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM entry_fees');
              const nextId = (maxId || 0) + 1;
              await conn.query(
                'INSERT INTO entry_fees (id, access_no, customer_name, image_path, created_by, fee_type, backdate) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [nextId, efAccessNo, efCustomer, slipPath, techId, feeType, backdateVal]
              );
            } else {
              console.error('Entry fee insert error:', e.message); 
            }
          }
          // Sync entry_fee_status to customers
          try {
            await conn.query(
              `UPDATE customers SET entry_fee_status = ?, entry_fee_date = NOW() WHERE access_no = ?`,
              [feeType, efAccessNo]
            );
          } catch(e) { /* ignore if column doesn't exist yet */ }
        }
      }

      // 5. syncTeamOilMonth — increment case_count
      if (job.team_id) {
        try {
          const yearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
          await conn.query(
            `INSERT INTO team_oil_cases (team_id, \`year_month\`, case_count)
             VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE case_count = case_count + 1`,
            [job.team_id, yearMonth]
          );
        } catch(e) {
          if (e.message && e.message.includes("Field 'id' doesn't have a default value")) {
            try {
              const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM team_oil_cases');
              await conn.query(
                `INSERT INTO team_oil_cases (id, team_id, \`year_month\`, case_count) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE case_count = case_count + 1`,
                [(maxId || 0) + 1, job.team_id, yearMonth]
              );
            } catch(e2) {
              console.error('Oil cases insert error fallback:', e2.message);
            }
          } else {
            console.error('Oil cases insert error:', e.message);
          }
        }
      }

      await safeSyncCustomer(conn, jobId);

      await conn.commit();

      writeJobAudit(pool, {
        job_type: 'office', job_id: jobId, action: 'complete',
        old_status: job.status, new_status: 'completed',
        old_team_id: job.team_id, new_team_id: job.team_id,
        old_assignee_id: job.field_engineer_id, new_assignee_id: job.field_engineer_id,
        actor_id: techId, remark: req.body.remark || null,
      });

      // 🔔 Push notification to admins when tech completes a job
      const techName = req.user.full_name || req.user.username || 'ช่าง';
      notifyAdmins(
        '✅ งานเสร็จสิ้น',
        `${techName} ปิดงาน ${job.access_no || ''} - ${job.customer || 'ลูกค้า'} เรียบร้อยแล้ว`,
        { type: 'job_completed', job_id: String(jobId) }
      );

      res.json({ message: 'Job completed successfully', job_id: jobId });
    } catch (err) {
      await conn.rollback();
      console.error('Complete job error:', err);
      res.status(500).json({ error: 'DB Error: ' + err.message, details: err.message });
    } finally {
      conn.release();
    }
  }
);

// ── PUT /api/dispatch/jobs/:id/incomplete — Tech marks job as failed ──
router.put('/jobs/:id/incomplete', auth, async (req, res) => {
  const jobId  = req.params.id;
  const techId = req.user.id;
  const { remark } = req.body;

  if (!remark || !String(remark).trim()) {
    return res.status(400).json({ error: 'กรุณาระบุสาเหตุที่ไม่จบงาน' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[job]] = await conn.query('SELECT * FROM jobs WHERE id = ? LIMIT 1', [jobId]);
    if (!job) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบงาน' });
    }

    // อัปเดตสถานะงาน → failed
    await conn.query(
      `UPDATE jobs SET
        status = 'failed',
        finish_time = IFNULL(finish_time, NOW()),
        fail_reason  = ?,
        remark       = ?
       WHERE id = ?`,
      [remark.trim(), remark.trim(), jobId]
    );

    // บันทึก job_log
    try {
      await conn.query(
        `INSERT INTO job_logs (job_id, tech_id, status, remark) VALUES (?, ?, 'failed', ?)`,
        [jobId, techId, remark.trim()]
      );
    } catch (le) {
      if (le.message.includes("Field 'id' doesn't have a default value")) {
        const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM job_logs');
        await conn.query(
          `INSERT INTO job_logs (id, job_id, tech_id, status, remark) VALUES (?, ?, ?, 'failed', ?)`,
          [(maxId || 0) + 1, jobId, techId, remark.trim()]
        );
      } else throw le;
    }

    // Sync ไป customers table
    await safeSyncCustomer(conn, jobId);

    // อัปเดต customers.latest_job_status = 'failed' + บันทึก fail_reason
    try {
      await conn.query(
        `UPDATE customers SET
           latest_job_status = 'failed',
           fail_reason = ?
         WHERE access_no = ?`,
        [remark.trim(), job.access_no]
      );
    } catch(ce) { /* ignore if columns don't exist */ }

    await conn.commit();

    writeJobAudit(pool, {
      job_type: 'office', job_id: jobId, action: 'incomplete',
      old_status: job.status, new_status: 'failed',
      old_team_id: job.team_id, new_team_id: job.team_id,
      old_assignee_id: job.field_engineer_id, new_assignee_id: job.field_engineer_id,
      actor_id: techId, remark: remark.trim(),
    });

    // Push notification to admins
    const techName = req.user.full_name || req.user.username || 'ช่าง';
    notifyAdmins(
      '❌ งานไม่จบ',
      `${techName} รายงานงาน ${job.access_no || ''} ไม่สำเร็จ: ${remark.trim()}`,
      { type: 'job_failed', job_id: String(jobId) }
    );

    res.json({ message: 'บันทึกงานไม่จบสำเร็จ' });
  } catch (err) {
    await conn.rollback();
    console.error('Incomplete job error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── PUT /api/dispatch/ma-jobs/:id/incomplete — Mark MA job as failed ──
router.put('/ma-jobs/:id/incomplete', auth, async (req, res) => {
  const maJobId = req.params.id;
  const techId = req.user.id;
  const { remark } = req.body;
  if (!remark || !String(remark).trim()) {
    return res.status(400).json({ error: 'กรุณาระบุสาเหตุที่ไม่จบงาน' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await ensureMaJobSchema(conn);

    const [[job]] = await conn.query('SELECT * FROM ma_jobs WHERE id = ? LIMIT 1', [maJobId]);
    if (!job) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบงาน MA' });
    }

    await conn.query(
      `UPDATE ma_jobs SET
         status = 'failed',
         fail_cause = ?,
         remark = ?,
         completed_at = IFNULL(completed_at, NOW()),
         completed_by = ?
       WHERE id = ?`,
      [remark.trim(), remark.trim(), techId, maJobId]
    );

    await syncMaCustomerFromJob(conn, maJobId, { action: 'failed', techId });
    await conn.commit();

    writeJobAudit(pool, {
      job_type: 'ma', job_id: maJobId, action: 'incomplete',
      old_status: job.status, new_status: 'failed',
      old_team_id: job.team_id, new_team_id: job.team_id,
      old_assignee_id: job.assigned_user_id, new_assignee_id: job.assigned_user_id,
      actor_id: techId, remark: remark.trim(),
    });

    const techName = req.user.full_name || req.user.username || 'ช่าง';
    notifyAdmins(
      '❌ งาน MA ไม่จบ',
      `${techName} รายงานงาน ${job.non_number || job.access_no || ''} ไม่สำเร็จ: ${remark.trim()}`,
      { type: 'ma_job_failed', job_id: String(maJobId) }
    );

    res.json({ message: 'บันทึกงาน MA ไม่จบสำเร็จ' });
  } catch (err) {
    await conn.rollback();
    console.error('MA incomplete error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── PUT /api/dispatch/ma-jobs/:id/postpone — Postpone MA job ──
router.put('/ma-jobs/:id/postpone', auth, async (req, res) => {
  const maJobId = req.params.id;
  const techId = req.user.id;
  const { new_date, new_time, remark } = req.body;
  if (!new_date) return res.status(400).json({ error: 'กรุณาเลือกวันที่ต้องการเลื่อน' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await ensureMaJobSchema(conn);

    const [[job]] = await conn.query('SELECT * FROM ma_jobs WHERE id = ? LIMIT 1', [maJobId]);
    if (!job) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบงาน MA' });
    }

    const timeVal = (new_time || '').toString().trim() || null;
    const oldDateStr = job.plan_arrival_date
      ? new Date(job.plan_arrival_date).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : 'ไม่ระบุวันที่';
    const timeText = timeVal ? ` เวลา ${String(timeVal).slice(0, 5)} น.` : '';
    const postponeReason = ` [เลื่อนจาก ${oldDateStr} เป็น ${new_date}${timeText}${remark ? ` สาเหตุ: ${remark}` : ''}]`;

    await conn.query(
      `UPDATE ma_jobs SET
         status = 'postponed',
         plan_arrival_date = ?,
         job_time = COALESCE(?, job_time),
         remark = CONCAT(IFNULL(remark, ''), ?),
         team_id = NULL,
         assigned_user_id = NULL,
         seq = NULL,
         team_match_status = 'unmatched'
       WHERE id = ?`,
      [new_date, timeVal, postponeReason, maJobId]
    );

    try {
      await conn.query(
        `INSERT INTO ma_job_reschedules (ma_job_id, previous_plan_date, new_plan_date, remark, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [maJobId, job.plan_arrival_date || null, new_date, remark || null, techId]
      );
    } catch (e) {
      console.warn('ma_job_reschedules insert skipped:', e.message);
    }

    await syncMaCustomerFromJob(conn, maJobId, { action: 'postponed', techId });
    await conn.commit();

    writeJobAudit(pool, {
      job_type: 'ma', job_id: maJobId, action: 'postpone',
      old_status: job.status, new_status: 'postponed',
      old_team_id: job.team_id, new_team_id: null,
      old_assignee_id: job.assigned_user_id, new_assignee_id: null,
      actor_id: techId,
      remark: `เลื่อนเป็น ${new_date}${timeVal ? ` ${String(timeVal).slice(0, 5)}` : ''}${remark ? ` — ${remark}` : ''}`,
    });

    const techName = req.user.full_name || req.user.username || 'ช่าง';
    notifyAdmins(
      '📅 เลื่อนนัดงาน MA',
      `${techName} เลื่อนนัดงาน ${job.non_number || job.access_no || ''} ไปวันที่ ${new_date}${remark ? ': ' + String(remark).substring(0, 60) : ''}`,
      { type: 'ma_job_postponed', job_id: String(maJobId) }
    );

    res.json({ message: 'เลื่อนนัดงาน MA สำเร็จ' });
  } catch (err) {
    await conn.rollback();
    console.error('MA postpone error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── PUT /api/dispatch/jobs/:id/cancel-completion — Admin cancels job completion ──
router.put('/jobs/:id/cancel-completion', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const jobId = req.params.id;
  const adminId = req.user.id;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[job]] = await conn.query('SELECT * FROM jobs WHERE id = ? LIMIT 1', [jobId]);
    if (!job) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบงาน' });
    }

    if (job.status !== 'completed') {
      await conn.rollback();
      return res.status(400).json({ error: 'งานนี้ยังไม่ได้จบงาน ไม่สามารถยกเลิกได้' });
    }

    // 1. Return inventory items
    const [usedItems] = await conn.query('SELECT * FROM job_used_inventory WHERE job_id = ?', [jobId]);
    for (const item of usedItems) {
      if (item.device_role === 'NoSN') {
        // No-SN item
        await conn.query(
          `UPDATE inventory_items SET quantity = quantity + ?, status = 'dispatched' WHERE id = ?`,
          [item.quantity, item.inventory_item_id]
        );
      } else {
        // SN item
        await conn.query(
          `UPDATE inventory_items SET status = 'dispatched', quantity = 1 WHERE id = ?`,
          [item.inventory_item_id]
        );
      }
      
      // Log the return
      const note = `ยกเลิกการจบงาน: คืนอุปกรณ์จากงาน ${job.access_no || jobId}`;
      try {
        await conn.query(
          `INSERT INTO inventory_logs (item_id, from_user_id, action, quantity, note) VALUES (?, ?, 'cancel_used', ?, ?)`,
          [item.inventory_item_id, adminId, item.quantity, note]
        );
      } catch (le) {
        if (le.message.includes("Field 'id' doesn't have a default value")) {
          const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM inventory_logs');
          await conn.query(
            `INSERT INTO inventory_logs (id, item_id, from_user_id, action, quantity, note) VALUES (?, ?, ?, 'cancel_used', ?, ?)`,
            [(maxId||0)+1, item.inventory_item_id, adminId, item.quantity, note]
          );
        } else {
          console.error(le);
        }
      }
    }
    await conn.query('DELETE FROM job_used_inventory WHERE job_id = ?', [jobId]);

    // 2. Delete job completion images
    await conn.query('DELETE FROM job_completion_images WHERE job_id = ?', [jobId]);

    // 3. Delete entry fees related to this job
    if (job.access_no && job.completed_by) {
      await conn.query(
        'DELETE FROM entry_fees WHERE access_no = ? AND created_by = ?',
        [job.access_no, job.completed_by]
      );
      // Reset customer entry fee status if needed
      try {
        await conn.query(
          `UPDATE customers SET entry_fee_status = NULL, entry_fee_date = NULL WHERE access_no = ?`,
          [job.access_no]
        );
      } catch(e) {}
    }

    // 4. Decrement team oil cases
    if (job.team_id && job.completed_at) {
      try {
        // If completed_at is Date object
        const completedDate = typeof job.completed_at === 'string' ? new Date(job.completed_at) : job.completed_at;
        const yearMonth = completedDate.toISOString().slice(0, 7);
        await conn.query(
          `UPDATE team_oil_cases SET case_count = GREATEST(0, case_count - 1)
           WHERE team_id = ? AND \`year_month\` = ?`,
          [job.team_id, yearMonth]
        );
      } catch(e) {
        console.error('Oil cases decrement error:', e.message);
      }
    }

    // 5. Update job status back to in_progress
    await conn.query(
      `UPDATE jobs SET
        status = 'in_progress',
        finish_time = NULL,
        completed_at = NULL,
        completed_by = NULL,
        install_device = NULL
       WHERE id = ?`,
      [jobId]
    );

    // 6. Add job log
    try {
      await conn.query(
        `INSERT INTO job_logs (job_id, tech_id, status, remark) VALUES (?, ?, 'cancel_completion', 'Admin ยกเลิกการจบงานและคืนอุปกรณ์')`,
        [jobId, adminId]
      );
    } catch (le) {
      if (le.message.includes("Field 'id' doesn't have a default value")) {
        const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM job_logs');
        await conn.query(
          `INSERT INTO job_logs (id, job_id, tech_id, status, remark) VALUES (?, ?, ?, 'cancel_completion', 'Admin ยกเลิกการจบงานและคืนอุปกรณ์')`,
          [(maxId || 0) + 1, jobId, adminId]
        );
      }
    }

    // 7. Sync customer
    await safeSyncCustomer(conn, jobId);

    await conn.commit();

    writeJobAudit(pool, {
      job_type: 'office', job_id: jobId, action: 'cancel_completion',
      old_status: 'completed', new_status: 'in_progress',
      old_team_id: job.team_id, new_team_id: job.team_id,
      old_assignee_id: job.field_engineer_id, new_assignee_id: job.field_engineer_id,
      actor_id: adminId, remark: 'Admin ยกเลิกการจบงานและคืนอุปกรณ์',
    });

    res.json({ message: 'ยกเลิกการจบงานสำเร็จ อุปกรณ์ถูกคืนกลับเข้ากระเป๋าช่างเรียบร้อยแล้ว' });
  } catch (err) {
    await conn.rollback();
    console.error('Cancel completion error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── PUT /api/dispatch/jobs/:id/change-completed-team ────
router.put('/jobs/:id/change-completed-team', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const jobId = req.params.id;
  const { new_team_id } = req.body;
  const adminId = req.user.id;

  if (!new_team_id) return res.status(400).json({ error: 'กรุณาระบุทีมใหม่' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[job]] = await conn.query('SELECT * FROM jobs WHERE id = ? LIMIT 1', [jobId]);
    if (!job) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบงาน' });
    }
    if (job.status !== 'completed' && job.status !== 'failed') {
      await conn.rollback();
      return res.status(400).json({ error: 'เปลี่ยนทีมได้เฉพาะงานที่เสร็จสิ้นหรือล้มเหลวแล้วเท่านั้น' });
    }

    const oldTeamId = job.team_id;
    if (oldTeamId === parseInt(new_team_id, 10)) {
      await conn.rollback();
      return res.status(400).json({ error: 'ทีมใหม่เหมือนกับทีมปัจจุบัน' });
    }

    if (job.status === 'completed') {
      // Find the month when it was completed
      const [[jobLog]] = await conn.query(`SELECT timestamp FROM job_logs WHERE job_id = ? AND status = 'completed' ORDER BY id DESC LIMIT 1`, [jobId]);
      const ym = jobLog ? new Date(jobLog.timestamp).toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7);

      // Decrement old team
      if (oldTeamId) {
        await conn.query(`UPDATE team_oil_cases SET case_count = GREATEST(0, case_count - 1) WHERE team_id = ? AND \`year_month\` = ?`, [oldTeamId, ym]);
      }

      // Increment new team
      try {
        await conn.query(
          `INSERT INTO team_oil_cases (team_id, \`year_month\`, case_count) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE case_count = case_count + 1`,
          [new_team_id, ym]
        );
      } catch (e) {
        if (e.message && e.message.includes("Field 'id' doesn't have a default value")) {
          const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM team_oil_cases');
          await conn.query(
            `INSERT INTO team_oil_cases (id, team_id, \`year_month\`, case_count) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE case_count = case_count + 1`,
            [(maxId || 0) + 1, new_team_id, ym]
          );
        } else {
          throw e;
        }
      }
    }

    // Update job
    await conn.query(`UPDATE jobs SET team_id = ? WHERE id = ?`, [new_team_id, jobId]);

    // Log the change
    const remark = `Admin เปลี่ยนทีมที่จบงานจากเดิม ${oldTeamId || 'ไม่มี'} เป็น ${new_team_id}`;
    try {
      await conn.query(
        `INSERT INTO job_logs (job_id, tech_id, status, remark) VALUES (?, ?, 'change_team', ?)`,
        [jobId, adminId, remark]
      );
    } catch (le) {
      if (le.message.includes("Field 'id' doesn't have a default value")) {
        const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM job_logs');
        await conn.query(
          `INSERT INTO job_logs (id, job_id, tech_id, status, remark) VALUES (?, ?, ?, 'change_team', ?)`,
          [(maxId || 0) + 1, jobId, adminId, remark]
        );
      }
    }

    await conn.commit();

    writeJobAudit(pool, {
      job_type: 'office', job_id: jobId, action: 'change_team',
      old_status: job.status, new_status: job.status,
      old_team_id: oldTeamId, new_team_id: new_team_id,
      old_assignee_id: job.field_engineer_id, new_assignee_id: job.field_engineer_id,
      actor_id: adminId, remark,
    });

    res.json({ message: 'เปลี่ยนทีมที่จบงานสำเร็จ ระบบปรับยอดผลงานเรียบร้อยแล้ว' });
  } catch (err) {
    await conn.rollback();
    console.error('Change team error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── POST /api/dispatch/jobs — Admin creates/imports job ────
router.post('/jobs', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const {
    plan_arrival_date, plan_arrival_time, access_no, customer, phone, package: pkg, address,
    field_engineer_id, reject_reason, task_status, product, lat, lng, order_no,
    called_assigner, called_engineer, task_order, product_owner, order_type,
    install_device, service_note, sub_access_mode, region, task_type,
    customer_order_no, contract_team, team_product_owner, province, task_duration,
    sla_status, create_time, deadline, set_off_time, arrival_time, finish_time,
    area_code, area_name, processing_status, create_user_role, fail_reason,
    event, service_level, type_of_installation, reason_sync_system_failed,
    status, remark, seq, map_link, team_id
  } = req.body;

  if (!access_no) return res.status(400).json({ error: 'access_no is required' });

  try {
    // Duplicate pre-check: access_no / customer_order_no must be unique
    const dupParams = [String(access_no).trim()];
    let dupSql = 'SELECT id, access_no, customer_order_no FROM jobs WHERE access_no = ?';
    if (customer_order_no && String(customer_order_no).trim() !== '') {
      dupSql += ' OR customer_order_no = ?';
      dupParams.push(String(customer_order_no).trim());
    }
    const [[dup]] = await pool.query(`${dupSql} LIMIT 1`, dupParams);
    if (dup) {
      const msg = String(dup.access_no) === String(access_no).trim()
        ? `Access No. "${access_no}" มีอยู่ในระบบแล้ว (งาน #${dup.id}) กรุณาตรวจสอบก่อนบันทึกซ้ำ`
        : `Customer Order No. "${customer_order_no}" มีอยู่ในระบบแล้ว (งาน #${dup.id}) กรุณาตรวจสอบก่อนบันทึกซ้ำ`;
      return res.status(409).json({ error: msg });
    }

    let formatted_time = plan_arrival_time || null;
    if (formatted_time && !formatted_time.includes('-') && plan_arrival_date) {
      formatted_time = `${plan_arrival_date} ${formatted_time}:00`;
    }

    const [result] = await pool.query(
      `INSERT INTO jobs
         (plan_arrival_date, plan_arrival_time, access_no, customer, phone, package, address,
          field_engineer_id, reject_reason, task_status, product, lat, lng, order_no,
          called_assigner, called_engineer, task_order, product_owner, order_type,
          install_device, service_note, sub_access_mode, region, task_type,
          customer_order_no, contract_team, team_product_owner, province, task_duration,
          sla_status, create_time, deadline, set_off_time, arrival_time, finish_time,
          area_code, area_name, processing_status, create_user_role, fail_reason,
          event, service_level, type_of_installation, reason_sync_system_failed,
          status, remark, seq, map_link, team_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plan_arrival_date || null, formatted_time, access_no, customer || null, phone || null, pkg || null, address || null,
        field_engineer_id || null, reject_reason || null, task_status || null, product || null, lat || null, lng || null, order_no || null,
        called_assigner || 'None Call', called_engineer || 'None Call', task_order || null, product_owner || null, order_type || null,
        install_device || null, service_note || null, sub_access_mode || 'N/A', region || 'ROS', task_type || null,
        customer_order_no || null, contract_team || 'หจก.โบนัส แอดว้านซ์ (สุราษฎร์ธานี)#Bonus Advance (Surat Thani) - AISPM_Install_Bonus Advance_Bonus Advance (Surat Thani)_1002136_FTH,PLB', team_product_owner || null, province || null, task_duration || null,
        sla_status || 'Normal', create_time || null, deadline || null, set_off_time || null, arrival_time || null, finish_time || null,
        area_code || null, area_name || null, processing_status || null, create_user_role || req.user.role || null, fail_reason || null,
        event || null, service_level || null, type_of_installation || null, reason_sync_system_failed || null,
        status || 'pending', remark || null, seq || null, map_link || null, team_id || null
      ]
    );
    const conn = await pool.getConnection();
    try {
      await safeSyncCustomer(conn, result.insertId);
    } finally {
      conn.release();
    }

    writeJobAudit(pool, {
      job_type: 'office', job_id: result.insertId, action: 'create',
      new_status: status || 'pending',
      new_team_id: team_id, new_assignee_id: field_engineer_id,
      actor_id: req.user?.id,
    });

    if (team_id) {
      const [[team]] = await pool.query('SELECT team_name FROM teams WHERE id = ?', [team_id]);
      const teamName = team?.team_name || 'ทีม';
      let firstJobTime = 'ไม่ได้ระบุเวลา';
      if (formatted_time) {
        firstJobTime = formatted_time.substring(11, 16) + ' น.';
      }
      notifyTeamMembers(
        team_id,
        '📋 มีงานใหม่เข้า!',
        `${teamName} ได้รับมอบหมายงานใหม่ 1 งาน\nเวลาเข้างานแรก: ${firstJobTime}`,
        { type: 'job_assigned', count: '1' },
        req.user?.id
      );
    }

    res.status(201).json({ message: 'Job created', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Access No. หรือ Customer Order No. นี้มีอยู่ในระบบแล้ว กรุณาตรวจสอบก่อนบันทึกซ้ำ' });
    }
    console.error('Job Creation Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/dispatch/import-aliases — Shared engineer/team aliases for import ─
router.get('/import-aliases', auth, async (req, res) => {
  try {
    await ensureImportAliasSchema(pool);
    const jobType = ['office', 'ma'].includes(req.query.job_type) ? req.query.job_type : null;
    // Order 'any' first so job-type-specific rows win when the client builds a map
    const [rows] = jobType
      ? await pool.query(
          `SELECT id, job_type, normalized_alias, user_id, team_id
           FROM user_import_aliases
           WHERE job_type IN (?, 'any')
           ORDER BY (job_type = 'any') DESC, id ASC`,
          [jobType]
        )
      : await pool.query(
          `SELECT id, job_type, normalized_alias, user_id, team_id
           FROM user_import_aliases ORDER BY (job_type = 'any') DESC, id ASC`
        );
    res.json(rows);
  } catch (err) {
    console.error('Get import aliases error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/dispatch/import-aliases — Save alias (upsert) ───────────────────
router.post('/import-aliases', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { normalized_alias, user_id, team_id } = req.body;
  const jobType = ['office', 'ma', 'any'].includes(req.body.job_type) ? req.body.job_type : 'any';
  const alias = String(normalized_alias || '').trim();
  if (!alias) return res.status(400).json({ error: 'normalized_alias is required' });
  if (!user_id && !team_id) return res.status(400).json({ error: 'user_id or team_id is required' });

  try {
    await ensureImportAliasSchema(pool);
    await pool.query(
      `INSERT INTO user_import_aliases (job_type, normalized_alias, user_id, team_id, created_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id), team_id = VALUES(team_id), created_by = VALUES(created_by)`,
      [jobType, alias, user_id || null, team_id || null, req.user?.id || null]
    );
    res.json({ message: 'Alias saved' });
  } catch (err) {
    console.error('Save import alias error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Bulk import helpers (re-upload upsert) ───────────────────────────────────
function toDateKey(d) {
  if (!d) return '';
  if (d instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return String(d).slice(0, 10);
}

function isBlankImportVal(v) {
  return v == null || String(v).trim() === '';
}

function normalizeImportTime(v) {
  if (isBlankImportVal(v)) return null;
  const s = String(v).trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
  return s.slice(0, 5);
}

function valuesEqualImport(a, b) {
  const na = isBlankImportVal(a) ? '' : String(a).trim();
  const nb = isBlankImportVal(b) ? '' : String(b).trim();
  return na === nb;
}

/** Empty Excel cells never overwrite; only changed non-empty values are applied. */
function buildImportFieldUpdates(existing, fieldMap) {
  const sets = [];
  const params = [];
  const changed = [];
  for (const [col, raw] of Object.entries(fieldMap)) {
    if (isBlankImportVal(raw)) continue;
    let next = typeof raw === 'string' ? raw.trim() : raw;
    const prev = existing[col];
    if (col === 'plan_arrival_date') {
      if (toDateKey(prev) === toDateKey(next)) continue;
      next = toDateKey(next) || next;
    } else if (col === 'plan_arrival_time' || col === 'job_time') {
      const nt = normalizeImportTime(next);
      const pt = normalizeImportTime(prev);
      if (!nt || nt === pt) continue;
      next = col === 'job_time' ? nt : (nt.length === 5 ? `${nt}:00` : nt);
    } else if (col === 'team_id' || col === 'assigned_user_id' || col === 'field_engineer_id') {
      const nId = Number(next);
      const pId = prev == null || prev === '' ? null : Number(prev);
      if (!Number.isFinite(nId) || nId === pId) continue;
      next = nId;
    } else if (valuesEqualImport(prev, next)) {
      continue;
    }
    sets.push(`${col} = ?`);
    params.push(next);
    changed.push(col);
  }
  return { sets, params, changed };
}

const OFFICE_IMPORT_CLOSED = new Set(['completed', 'failed', 'cancelled']);
const MA_IMPORT_CLOSED = new Set(['completed', 'failed']);

// ── POST /api/dispatch/jobs/bulk — Admin imports office jobs from Excel ────
// Supports ?preflight=1. Re-upload same Access No → update changed fields; skip if unchanged.
router.post('/jobs/bulk', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const jobs = req.body.jobs;
  const preflight = String(req.query.preflight || '') === '1';
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({ error: 'No jobs data provided' });
  }

  const errors = [];
  const duplicates = [];
  const unchanged = [];
  const updatesPreview = [];
  const seenInFile = new Set();
  let candidates = [];
  jobs.forEach((job, i) => {
    const accessNo = String(job.access_no || '').trim();
    if (!accessNo) {
      errors.push({ row: i + 1, access_no: null, error: 'ไม่มี Access No' });
      return;
    }
    if (seenInFile.has(accessNo)) {
      duplicates.push({ row: i + 1, access_no: accessNo, reason: 'ซ้ำกันในไฟล์' });
      return;
    }
    seenInFile.add(accessNo);
    candidates.push({ row: i + 1, accessNo, job });
  });

  let toInsert = [];
  let toUpdate = [];

  try {
    if (candidates.length > 0) {
      const [existingRows] = await pool.query(
        `SELECT id, access_no, status, customer, phone, package, address, lat, lng,
                plan_arrival_date, plan_arrival_time, product, remark,
                order_no, customer_order_no, province, area_code, area_name,
                task_type, task_order, product_owner, order_type, service_note,
                sla_status, region, map_link, team_id, field_engineer_id
         FROM jobs WHERE access_no IN (?)`,
        [candidates.map((c) => c.accessNo)]
      );
      const byAccess = new Map(existingRows.map((r) => [String(r.access_no), r]));

      for (const c of candidates) {
        const ex = byAccess.get(c.accessNo);
        if (!ex) {
          toInsert.push(c);
          continue;
        }
        if (OFFICE_IMPORT_CLOSED.has(String(ex.status || '').toLowerCase())) {
          duplicates.push({
            row: c.row,
            access_no: c.accessNo,
            reason: `งานสถานะ ${ex.status} แล้ว — ไม่แก้ด้วยการนำเข้า`,
          });
          continue;
        }
        const j = c.job;
        let formatted_time = j.plan_arrival_time || null;
        if (formatted_time && !String(formatted_time).includes('-') && j.plan_arrival_date) {
          formatted_time = `${j.plan_arrival_date} ${String(formatted_time).slice(0, 5)}:00`;
        }
        const fieldMap = {
          customer: j.customer,
          phone: j.phone,
          package: j.package,
          address: j.address,
          lat: j.lat,
          lng: j.lng,
          plan_arrival_date: j.plan_arrival_date,
          plan_arrival_time: formatted_time,
          product: j.product,
          remark: j.remark,
          order_no: j.order_no,
          customer_order_no: j.customer_order_no,
          province: j.province,
          area_code: j.area_code,
          area_name: j.area_name,
          task_type: j.task_type,
          task_order: j.task_order,
          product_owner: j.product_owner,
          order_type: j.order_type,
          service_note: j.service_note,
          sla_status: j.sla_status,
          region: j.region,
          map_link: j.map_link,
          team_id: j.team_id,
          field_engineer_id: j.field_engineer_id,
        };
        const built = buildImportFieldUpdates(ex, fieldMap);
        if (built.changed.length === 0) {
          unchanged.push({
            row: c.row,
            access_no: c.accessNo,
            reason: 'Access No ตรงกันและข้อมูลไม่เปลี่ยนแปลง — ข้าม',
          });
          continue;
        }
        toUpdate.push({ ...c, jobId: ex.id, sets: built.sets, params: built.params, changed: built.changed });
        updatesPreview.push({ row: c.row, access_no: c.accessNo, job_id: ex.id, changed: built.changed });
      }
    }
  } catch (err) {
    console.error('Bulk duplicate check error:', err);
    return res.status(500).json({ error: 'Server error' });
  }

  if (preflight) {
    return res.json({
      ready: toInsert.length,
      updateReady: toUpdate.length,
      errors,
      duplicates,
      unchanged,
      updateJobs: updatesPreview,
      total: jobs.length,
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let successCount = 0;
    let updatedCount = 0;

    for (const { row, accessNo, job } of toInsert) {
      const {
        customer, phone, package: pkg, address, lat, lng,
        plan_arrival_date, plan_arrival_time, product, remark,
        order_no, customer_order_no, province, area_code, area_name,
        task_type, task_order, product_owner, order_type, service_note,
        sla_status, region, map_link, status, team_id, field_engineer_id
      } = job;

      let formatted_time = plan_arrival_time || null;
      if (formatted_time && !String(formatted_time).includes('-') && plan_arrival_date) {
        formatted_time = `${plan_arrival_date} ${formatted_time}:00`;
      }

      try {
        const [result] = await conn.query(
          `INSERT INTO jobs
             (access_no, customer, phone, package, address, lat, lng,
              plan_arrival_date, plan_arrival_time, product, remark,
              order_no, customer_order_no, province, area_code, area_name,
              task_type, task_order, product_owner, order_type, service_note,
              sla_status, region, map_link,
              status, create_user_role, team_id, field_engineer_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            accessNo, customer || null, phone || null, pkg || null, address || null,
            lat || null, lng || null, plan_arrival_date || null, formatted_time,
            product || null, remark || null,
            order_no || null, customer_order_no || null, province || null,
            area_code || null, area_name || null,
            task_type || null, task_order || null, product_owner || null,
            order_type || null, service_note || null,
            sla_status || 'Normal', region || 'ROS', map_link || null,
            status || 'pending', req.user.role || null, team_id || null,
            field_engineer_id || null
          ]
        );
        successCount++;
        await safeSyncCustomer(conn, result.insertId);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          duplicates.push({ row, access_no: accessNo, reason: 'มีอยู่ในระบบแล้ว' });
        } else {
          console.error('Bulk insert error for access_no:', accessNo, err);
          errors.push({ row, access_no: accessNo, error: err.message });
        }
      }
    }

    for (const u of toUpdate) {
      try {
        await conn.query(
          `UPDATE jobs SET ${u.sets.join(', ')} WHERE id = ?`,
          [...u.params, u.jobId]
        );
        updatedCount++;
        await safeSyncCustomer(conn, u.jobId);
      } catch (err) {
        console.error('Bulk update error for access_no:', u.accessNo, err);
        errors.push({ row: u.row, access_no: u.accessNo, error: err.message });
      }
    }

    await conn.commit();
    res.json({
      message: 'Bulk import complete',
      successCount,
      updatedCount,
      skippedCount: errors.length + duplicates.length + unchanged.length,
      total: jobs.length,
      errors,
      duplicates,
      unchanged,
      updateJobs: updatesPreview,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Bulk Import Error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── POST /api/dispatch/ma-jobs/bulk — Admin imports MA jobs from Excel ────
// Supports ?preflight=1. Re-upload same NON + appointment date → update; skip if unchanged.
router.post('/ma-jobs/bulk', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const jobs = req.body.jobs;
  const preflight = String(req.query.preflight || '') === '1';
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({ error: 'No jobs data provided' });
  }

  const errors = [];
  const duplicates = [];
  const unchanged = [];
  const updatesPreview = [];
  const seenInFile = new Set();
  let candidates = [];
  jobs.forEach((job, i) => {
    const nonNumber = String(job.non_number || job.access_no || '').trim();
    if (!nonNumber) {
      errors.push({ row: i + 1, non_number: null, error: 'ไม่มีเลข NON' });
      return;
    }
    const dupKey = `${nonNumber}|${toDateKey(job.plan_arrival_date)}`;
    if (seenInFile.has(dupKey)) {
      duplicates.push({ row: i + 1, non_number: nonNumber, reason: 'ซ้ำกันในไฟล์' });
      return;
    }
    seenInFile.add(dupKey);
    candidates.push({ row: i + 1, nonNumber, dupKey, job });
  });

  let toInsert = [];
  let toUpdate = [];

  try {
    if (candidates.length > 0) {
      await ensureMaJobSchema(pool);
      const [existingRows] = await pool.query(
        `SELECT id, non_number, plan_arrival_date, job_time, access_no, customer, phone,
                symptoms, address, area_name, remark, team_id, assigned_user_id, status
         FROM ma_jobs WHERE non_number IN (?)`,
        [candidates.map((c) => c.nonNumber)]
      );
      const existingByKey = new Map(
        existingRows.map((r) => [`${String(r.non_number).trim()}|${toDateKey(r.plan_arrival_date)}`, r])
      );

      for (const c of candidates) {
        const ex = existingByKey.get(c.dupKey);
        if (!ex) {
          toInsert.push(c);
          continue;
        }
        if (MA_IMPORT_CLOSED.has(String(ex.status || '').toLowerCase())) {
          duplicates.push({
            row: c.row,
            non_number: c.nonNumber,
            reason: `งาน MA สถานะ ${ex.status} แล้ว — ไม่แก้ด้วยการนำเข้า`,
          });
          continue;
        }
        const j = c.job;
        const timeVal = (j.job_time || j.plan_arrival_time || '').toString().trim() || null;
        const assigneeId = j.assigned_user_id || j.field_engineer_id || null;
        const fieldMap = {
          customer: j.customer,
          phone: j.phone,
          access_no: j.access_no || c.nonNumber,
          plan_arrival_date: j.plan_arrival_date,
          job_time: timeVal,
          symptoms: j.symptoms,
          address: j.address,
          area_name: j.area_name,
          remark: j.remark,
          team_id: j.team_id,
          assigned_user_id: assigneeId,
        };
        const built = buildImportFieldUpdates(ex, fieldMap);
        if (built.changed.length === 0) {
          unchanged.push({
            row: c.row,
            non_number: c.nonNumber,
            reason: 'NON ตรงกันและข้อมูลไม่เปลี่ยนแปลง — ข้าม',
          });
          continue;
        }
        // Keep team_match_status in sync when assignment columns change
        if (built.changed.includes('team_id') || built.changed.includes('assigned_user_id')) {
          const nextTeam = built.changed.includes('team_id')
            ? built.params[built.changed.indexOf('team_id')]
            : ex.team_id;
          const nextAssignee = built.changed.includes('assigned_user_id')
            ? built.params[built.changed.indexOf('assigned_user_id')]
            : ex.assigned_user_id;
          built.sets.push('team_match_status = ?');
          built.params.push((nextTeam || nextAssignee) ? 'matched' : 'unmatched');
        }
        toUpdate.push({ ...c, jobId: ex.id, sets: built.sets, params: built.params, changed: built.changed });
        updatesPreview.push({ row: c.row, non_number: c.nonNumber, job_id: ex.id, changed: built.changed });
      }
    }
  } catch (err) {
    if (!String(err.message || '').includes("doesn't exist")) {
      console.error('MA bulk duplicate check error:', err);
      return res.status(500).json({ error: 'Server error: ' + err.message });
    }
    toInsert = candidates;
  }

  if (preflight) {
    return res.json({
      ready: toInsert.length,
      updateReady: toUpdate.length,
      errors,
      duplicates,
      unchanged,
      updateJobs: updatesPreview,
      total: jobs.length,
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await ensureMaJobSchema(conn);

    let successCount = 0;
    let updatedCount = 0;

    for (const { row, nonNumber, job } of toInsert) {
      const {
        job_time, plan_arrival_time, plan_arrival_date,
        customer, phone, symptoms, address,
        team_id, field_engineer_id, assigned_user_id,
        area_name, remark, access_no,
      } = job;

      const accessKey = (access_no || nonNumber).toString().trim();
      const timeVal = (job_time || plan_arrival_time || '').toString().trim() || null;
      const assigneeId = assigned_user_id || field_engineer_id || null;

      try {
        const [result] = await conn.query(
          `INSERT INTO ma_jobs
             (plan_arrival_date, job_time, access_no, non_number, customer, phone,
              symptoms, address, area_name, remark, team_id, assigned_user_id, status,
              team_match_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
          [
            plan_arrival_date || null,
            timeVal,
            accessKey,
            nonNumber,
            customer || null,
            phone || null,
            symptoms || null,
            address || null,
            area_name || null,
            remark || null,
            team_id || null,
            assigneeId,
            (team_id || assigneeId) ? 'matched' : 'unmatched',
          ]
        );
        if (result.insertId) {
          successCount++;
          await syncMaCustomerFromJob(conn, result.insertId, { action: 'imported' });
        } else {
          errors.push({ row, non_number: nonNumber, error: 'ไม่สามารถบันทึกได้' });
        }
      } catch (err) {
        console.error('MA bulk insert error for NON:', nonNumber, err.message);
        errors.push({ row, non_number: nonNumber, error: err.message });
      }
    }

    for (const u of toUpdate) {
      try {
        await conn.query(
          `UPDATE ma_jobs SET ${u.sets.join(', ')} WHERE id = ?`,
          [...u.params, u.jobId]
        );
        updatedCount++;
        await syncMaCustomerFromJob(conn, u.jobId, { action: 'import_update' });
      } catch (err) {
        console.error('MA bulk update error for NON:', u.nonNumber, err.message);
        errors.push({ row: u.row, non_number: u.nonNumber, error: err.message });
      }
    }

    await conn.commit();
    res.json({
      message: 'MA bulk import complete',
      successCount,
      updatedCount,
      skippedCount: errors.length + duplicates.length + unchanged.length,
      total: jobs.length,
      count: successCount + updatedCount,
      errors,
      duplicates,
      unchanged,
      updateJobs: updatesPreview,
    });
  } catch (err) {
    await conn.rollback();
    console.error('MA Bulk Import Error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── POST /api/dispatch/ma-jobs — Admin creates a single MA job (Manual Entry) ─
router.post('/ma-jobs', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const {
    plan_arrival_date, job_time, plan_arrival_time,
    customer, non_number, phone, symptoms, address,
    team_id, assigned_user_id, field_engineer_id,
    area_name, remark, access_no, lat, lng,
    allow_duplicate,
  } = req.body;

  const nonNumber = (non_number || access_no || '').toString().trim();
  if (!nonNumber) return res.status(400).json({ error: 'กรุณาระบุเลข NON' });

  const conn = await pool.getConnection();
  try {
    await ensureMaJobSchema(conn);

    const accessKey = (access_no || nonNumber).toString().trim();
    const timeVal = (job_time || plan_arrival_time || '').toString().trim() || null;
    const assigneeId = assigned_user_id || field_engineer_id || null;

    // Duplicate check: same NON on the same plan date is almost always a double entry.
    // Repeats of the same NON on other dates are allowed (recurring MA visits).
    if (plan_arrival_date && !allow_duplicate) {
      const [[dup]] = await conn.query(
        `SELECT id FROM ma_jobs
         WHERE (non_number = ? OR access_no = ?) AND plan_arrival_date = ?
         LIMIT 1`,
        [nonNumber, nonNumber, plan_arrival_date]
      );
      if (dup) {
        return res.status(409).json({
          error: `เลข NON "${nonNumber}" มีงานในวันที่ ${plan_arrival_date} อยู่แล้ว (งาน #${dup.id}) หากต้องการสร้างซ้ำในวันเดียวกัน กรุณายืนยันอีกครั้ง`,
          duplicate: true,
        });
      }
    }

    const [result] = await conn.query(
      `INSERT INTO ma_jobs
         (plan_arrival_date, job_time, access_no, non_number, customer, phone,
          symptoms, address, area_name, remark, lat, lng, team_id, assigned_user_id,
          status, team_match_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        plan_arrival_date || null,
        timeVal,
        accessKey,
        nonNumber,
        customer || null,
        phone || null,
        symptoms || null,
        address || null,
        area_name || null,
        remark || null,
        lat || null,
        lng || null,
        team_id || null,
        assigneeId,
        (team_id || assigneeId) ? 'matched' : 'unmatched',
      ]
    );

    await syncMaCustomerFromJob(conn, result.insertId, { action: 'imported' });

    writeJobAudit(pool, {
      job_type: 'ma', job_id: result.insertId, action: 'create',
      new_status: 'pending',
      new_team_id: team_id, new_assignee_id: assigneeId,
      actor_id: req.user?.id,
    });

    if (team_id) {
      const [[team]] = await conn.query('SELECT team_name FROM teams WHERE id = ?', [team_id]);
      const teamName = team?.team_name || 'ทีม';
      notifyTeamMembers(
        team_id,
        '🔧 มีงาน MA ใหม่เข้า!',
        `${teamName} ได้รับมอบหมายงาน MA ใหม่ 1 งาน${timeVal ? `\nเวลานัด: ${timeVal} น.` : ''}`,
        { type: 'job_assigned', count: '1' },
        req.user?.id
      );
    }

    res.status(201).json({ message: 'MA job created', id: result.insertId });
  } catch (err) {
    console.error('MA Job Creation Error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── PUT /api/dispatch/ma-jobs/:id/complete — Complete MA job ─────────────
router.put(
  '/ma-jobs/:id/complete',
  auth,
  setUpload('job_evidence'),
  upload.fields([{ name: 'images', maxCount: 40 }]),
  async (req, res) => {
    const maJobId = req.params.id;
    const techId = req.user.id;
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();
      await ensureMaJobSchema(conn);

      const [[job]] = await conn.query(`SELECT * FROM ma_jobs WHERE id = ? LIMIT 1`, [maJobId]);
      if (!job) {
        await conn.rollback();
        return res.status(404).json({ error: 'ไม่พบงาน MA' });
      }

      const userRoles = req.user.roles || [req.user.role];
      const isAdmin = userRoles.some((r) => ADMIN_ROLES.includes(r));
      const isAssignee = job.assigned_user_id && Number(job.assigned_user_id) === Number(techId);
      const isSameTeam = job.team_id && req.user.team_id && Number(job.team_id) === Number(req.user.team_id);
      if (!isAdmin && !isAssignee && !isSameTeam) {
        await conn.rollback();
        return res.status(403).json({ error: 'งานนี้ไม่ได้อยู่ในความรับผิดชอบของคุณ' });
      }
      if (job.status === 'completed') {
        await conn.rollback();
        return res.status(409).json({ error: 'งานนี้ปิดแล้ว' });
      }

      const images = req.files?.images || [];
      if (!images.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'กรุณาอัปโหลดรูปจบงานอย่างน้อย 1 รูป' });
      }
      if (images.length > 40) {
        await conn.rollback();
        return res.status(400).json({ error: 'อัปโหลดรูปได้ไม่เกิน 40 รูป' });
      }

      const {
        srt, spt, fail_cause, fix_method, old_sn, new_sn, cable_used, remark,
      } = req.body;

      const bagOwnerId = resolveBagOwnerId(job, techId, { isMa: true });
      const noSnItems = parseNoSnItems(req.body);
      const snItems = parseUsedInventoryBody(req.body);
      const equipParts = [];

      if (snItems.length > 0) {
        const snParts = await processMaSnItems(conn, {
          maJobId,
          techId: bagOwnerId,
          nonNumber: job.non_number || job.access_no,
          snItems,
        });
        equipParts.push(...snParts);
      }

      if (noSnItems.length > 0) {
        const noSnParts = await processMaNoSnItems(conn, {
          maJobId,
          techId: bagOwnerId,
          nonNumber: job.non_number || job.access_no,
          noSnItems,
        });
        equipParts.push(...noSnParts);
      }

      await conn.query(
        `UPDATE ma_jobs SET
           status = 'completed',
           completed_at = NOW(),
           completed_by = ?,
           srt = ?,
           spt = ?,
           fail_cause = ?,
           fix_method = ?,
           old_sn = ?,
           new_sn = ?,
           cable_used = ?,
           used_equipment = ?,
           remark = COALESCE(?, remark)
         WHERE id = ?`,
        [
          techId,
          srt || null,
          spt || null,
          fail_cause || null,
          fix_method || null,
          old_sn || null,
          new_sn || null,
          cable_used || null,
          equipParts.length ? equipParts.join(', ') : null,
          remark || null,
          maJobId,
        ]
      );

      for (const file of images) {
        await conn.query(
          `INSERT INTO ma_job_completion_images (ma_job_id, image_path, uploaded_by) VALUES (?, ?, ?)`,
          [maJobId, file.filename, techId]
        );
      }

      // Oil case for team jobs only
      if (job.team_id) {
        const yearMonth = new Date().toISOString().slice(0, 7);
        try {
          await conn.query(
            `INSERT INTO team_oil_cases (team_id, \`year_month\`, case_count)
             VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE case_count = case_count + 1`,
            [job.team_id, yearMonth]
          );
        } catch (e) { /* optional */ }
      }

      await syncMaCustomerFromJob(conn, maJobId, { action: 'completed', techId });

      await conn.commit();

      writeJobAudit(pool, {
        job_type: 'ma', job_id: maJobId, action: 'complete',
        old_status: job.status, new_status: 'completed',
        old_team_id: job.team_id, new_team_id: job.team_id,
        old_assignee_id: job.assigned_user_id, new_assignee_id: job.assigned_user_id,
        actor_id: techId, remark: remark || null,
      });

      res.json({ message: 'ปิดงาน MA สำเร็จ', id: maJobId });
    } catch (err) {
      await conn.rollback();
      console.error('MA complete error:', err);
      res.status(500).json({ error: err.message || 'Server error' });
    } finally {
      conn.release();
    }
  }
);

// ── PUT /api/dispatch/jobs/bulk-assign — Assign team or individual to jobs ──────
// IMPORTANT: This route MUST be defined BEFORE /jobs/:id routes to avoid Express treating 'bulk-assign' as an :id
router.put('/jobs/bulk-assign', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { ids, team_id, type, target_type, target_id, field_engineer_id, assigned_user_id } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No jobs selected' });
  }

  const table = type === 'ma' ? 'ma_jobs' : 'jobs';
  const mode = target_type || (team_id ? 'team' : (field_engineer_id || assigned_user_id ? 'user' : null));
  const target = target_id || team_id || field_engineer_id || assigned_user_id;

  if (!mode || !target) {
    return res.status(400).json({ error: 'เลือกทีมหรือช่างที่จะมอบหมาย' });
  }

  const OFFICE_ROLES = ['technician', 'office_technician', 'contractor_office'];
  const MA_ROLES = ['ma_technician', 'contractor_ma'];
  const allowedRoles = type === 'ma' ? MA_ROLES : OFFICE_ROLES;

  try {
    const placeholders = ids.map(() => '?').join(',');
    const results = { updated: 0, failed: [], successIds: [] };

    // Snapshot old values for the audit trail (best-effort)
    const assigneeCol = type === 'ma' ? 'assigned_user_id' : 'field_engineer_id';
    let oldRowsById = new Map();
    try {
      const [oldRows] = await pool.query(
        `SELECT id, status, team_id, ${assigneeCol} AS assignee_id FROM ${table} WHERE id IN (${placeholders})`,
        ids
      );
      oldRowsById = new Map(oldRows.map((r) => [Number(r.id), r]));
    } catch (e) { /* audit only */ }

    const auditAssign = (jobId, { newTeamId, newAssigneeId }) => {
      const old = oldRowsById.get(Number(jobId)) || {};
      writeJobAudit(pool, {
        job_type: type === 'ma' ? 'ma' : 'office', job_id: jobId, action: 'assign',
        old_status: old.status, new_status: old.status,
        old_team_id: old.team_id, new_team_id: newTeamId,
        old_assignee_id: old.assignee_id, new_assignee_id: newAssigneeId,
        actor_id: req.user?.id,
      });
    };

    if (mode === 'team') {
      const [[team]] = await pool.query('SELECT id, team_name FROM teams WHERE id = ?', [target]);
      if (!team) return res.status(400).json({ error: 'ไม่พบทีมที่เลือก' });

      let result;
      if (type === 'ma') {
        [result] = await pool.query(
          `UPDATE ma_jobs SET team_id = ?, assigned_user_id = NULL, team_match_status = 'matched' WHERE id IN (${placeholders})`,
          [target, ...ids]
        );
      } else {
        [result] = await pool.query(
          `UPDATE jobs SET team_id = ? WHERE id IN (${placeholders})`,
          [target, ...ids]
        );
      }
      results.updated = result.affectedRows;
      results.successIds = ids;

      for (const id of ids) {
        auditAssign(id, {
          newTeamId: target,
          newAssigneeId: type === 'ma' ? null : (oldRowsById.get(Number(id))?.assignee_id ?? null),
        });
      }

      if (result.affectedRows > 0) {
        notifyTeamMembers(
          target,
          '📋 มีงานใหม่เข้า!',
          `${team.team_name} ได้รับมอบหมายงานใหม่ ${result.affectedRows} งาน`,
          { type: 'job_assigned', count: String(result.affectedRows) },
          req.user?.id
        );
      }
    } else {
      const [[userRow]] = await pool.query(
        `SELECT u.id, u.full_name, u.team_id, u.role,
                (SELECT GROUP_CONCAT(ur.role) FROM user_roles ur WHERE ur.user_id = u.id) AS roles_csv
         FROM users u WHERE u.id = ? AND u.status = 'approved'`,
        [target]
      );
      if (!userRow) return res.status(400).json({ error: 'ไม่พบช่างที่เลือก' });
      const roles = (userRow.roles_csv || userRow.role || '').split(',').filter(Boolean);
      if (!roles.some((r) => allowedRoles.includes(r)) && !allowedRoles.includes(userRow.role)) {
        return res.status(400).json({ error: `ช่างคนนี้ไม่สามารถรับงาน${type === 'ma' ? ' MA' : 'ติดตั้ง'}ได้` });
      }

      const isContractor = roles.some((r) => ['contractor_office', 'contractor_ma'].includes(r));
      for (const id of ids) {
        try {
          if (type === 'ma') {
            await pool.query(
              `UPDATE ma_jobs SET assigned_user_id = ?, team_id = ?, team_match_status = 'matched' WHERE id = ?`,
              [target, isContractor ? null : (userRow.team_id || null), id]
            );
          } else {
            await pool.query(
              `UPDATE jobs SET field_engineer_id = ?, team_id = ? WHERE id = ?`,
              [target, isContractor ? null : (userRow.team_id || null), id]
            );
          }
          results.updated += 1;
          results.successIds.push(id);
          auditAssign(id, {
            newTeamId: isContractor ? null : (userRow.team_id || null),
            newAssigneeId: target,
          });
        } catch (e) {
          results.failed.push({ id, error: e.message });
        }
      }

      if (results.updated > 0) {
        sendToUser(
          target,
          '📋 มีงานใหม่เข้า!',
          `คุณได้รับมอบหมายงานใหม่ ${results.updated} งาน`,
          { type: 'job_assigned' }
        ).catch(() => {});
        if (userRow.team_id && !isContractor) {
          notifyTeamMembers(
            userRow.team_id,
            '📋 มีงานใหม่เข้า!',
            `${userRow.full_name} ได้รับมอบหมายงานใหม่ ${results.updated} งาน`,
            { type: 'job_assigned' },
            req.user?.id
          );
        }
      }
    }

    res.json({
      message: 'มอบหมายสำเร็จ',
      updatedCount: results.updated,
      failed: results.failed,
      successIds: results.successIds,
    });
  } catch (err) {
    console.error('Bulk Assign Error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── PUT /api/dispatch/jobs/reorder-by-location — Reorder job seq from current location ──
// IMPORTANT: Must be defined BEFORE /jobs/:id routes
router.put('/jobs/reorder-by-location', auth, async (req, res) => {
  const { lat, lng, type, team_id } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

  const table = type === 'ma' ? 'ma_jobs' : 'jobs';
  const userRoles = req.user.roles || [req.user.role];
  const isAdmin = userRoles.some(r => ADMIN_ROLES.includes(r));

  try {
    // Fetch jobs that have coordinates and are not yet completed/failed
    let where = `WHERE lat IS NOT NULL AND lng IS NOT NULL AND status NOT IN ('completed','failed')`;
    let params = [];

    if (!isAdmin) {
      if (!req.user.team_id) return res.json({ message: 'No team assigned', updated: 0 });
      where += ` AND team_id = ?`;
      params.push(req.user.team_id);
    } else if (team_id) {
      where += ` AND team_id = ?`;
      params.push(team_id);
    }

    const [jobs] = await pool.query(`SELECT id, lat, lng FROM ${table} ${where}`, params);

    if (jobs.length === 0) return res.json({ message: 'No jobs with coordinates', updated: 0 });

    // Sort by nearest-first using Haversine distance from current location
    const sorted = jobs
      .map(job => ({
        id: job.id,
        distance: getDistance(parseFloat(lat), parseFloat(lng), parseFloat(job.lat), parseFloat(job.lng))
      }))
      .sort((a, b) => a.distance - b.distance);

    // Update seq for each job
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (let i = 0; i < sorted.length; i++) {
        await conn.query(`UPDATE ${table} SET seq = ? WHERE id = ?`, [i + 1, sorted[i].id]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    res.json({ message: 'Jobs reordered successfully', updated: sorted.length, order: sorted.map(j => j.id) });
  } catch (err) {
    console.error('Reorder by location error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/dispatch/jobs/:id/assign — Reassign team ──────
router.put('/jobs/:id/assign', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { team_id } = req.body;
  try {
    const [[old]] = await pool.query('SELECT status, team_id, field_engineer_id FROM jobs WHERE id = ?', [req.params.id]);
    await pool.query(`UPDATE jobs SET team_id = ? WHERE id = ?`, [team_id, req.params.id]);
    writeJobAudit(pool, {
      job_type: 'office', job_id: req.params.id, action: 'assign',
      old_status: old?.status, new_status: old?.status,
      old_team_id: old?.team_id, new_team_id: team_id,
      old_assignee_id: old?.field_engineer_id, new_assignee_id: old?.field_engineer_id,
      actor_id: req.user?.id,
    });
    res.json({ message: 'Team assigned' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Function to calculate distance between two lat/lng coordinates (Haversine formula)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

// ── GET /api/dispatch/summary — Summary for Auto Dispatch ──
router.get('/summary', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [[{ unassignedJobsCount }]] = await pool.query(
      `SELECT COUNT(*) AS unassignedJobsCount FROM jobs WHERE status = 'pending' AND team_id IS NULL`
    );
    const [teamsList] = await pool.query(
      `SELECT id, team_name FROM teams ORDER BY id ASC`
    );
    res.json({ unassignedJobsCount, teams: teamsList, totalTeams: teamsList.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/dispatch/auto-assign — Auto Dispatch Logic ──
router.post('/auto-assign', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { teamQuotas } = req.body; // Array of { team_id, count }
  
  if (!teamQuotas || !Array.isArray(teamQuotas)) {
    return res.status(400).json({ error: 'Invalid teamQuotas array' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Fetch unassigned pending jobs with coordinates
    const [jobs] = await conn.query(
      `SELECT id, lat, lng FROM jobs WHERE status = 'pending' AND team_id IS NULL AND lat IS NOT NULL AND lng IS NOT NULL AND lat != '' AND lng != '' ORDER BY created_at ASC`
    );

    if (!jobs.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'ไม่พบงานที่มีพิกัด (ละติจูด/ลองจิจูด) หรือพิกัดไม่ถูกต้อง ทำให้ไม่สามารถคำนวณระยะทางได้' });
    }

    let unassignedJobs = [...jobs]; // Clone array for processing
    let totalAssigned = 0;

    // 2. Distribute jobs to teams based on proximity and TSP routing
    for (const quota of teamQuotas) {
      const { team_id, count } = quota;
      if (count <= 0) continue;

      let assignedToTeam = [];

      for (let i = 0; i < count; i++) {
        if (unassignedJobs.length === 0) break;

        if (assignedToTeam.length === 0) {
          // Pick the oldest unassigned job as the starting point for this team
          assignedToTeam.push(unassignedJobs[0]);
          unassignedJobs.splice(0, 1);
        } else {
          // Find the closest job to the LAST assigned job (Nearest Neighbor)
          const lastAssigned = assignedToTeam[assignedToTeam.length - 1];
          let closestIndex = 0;
          let minDistance = Infinity;

          for (let j = 0; j < unassignedJobs.length; j++) {
            const candidate = unassignedJobs[j];
            const dist = getDistance(parseFloat(lastAssigned.lat), parseFloat(lastAssigned.lng), parseFloat(candidate.lat), parseFloat(candidate.lng));
            if (dist < minDistance) {
              minDistance = dist;
              closestIndex = j;
            }
          }

          // Add closest job to team and remove from unassigned pool
          assignedToTeam.push(unassignedJobs[closestIndex]);
          unassignedJobs.splice(closestIndex, 1);
        }
      }

      // 3. Update database with team_id and routing sequence
      for (let seq = 0; seq < assignedToTeam.length; seq++) {
        const jobId = assignedToTeam[seq].id;
        // Notice seq+1 to start sequences at 1
        await conn.query(`UPDATE jobs SET team_id = ?, seq = ? WHERE id = ?`, [team_id, (seq + 1).toString(), jobId]);
        totalAssigned++;
      }
    }

    await conn.commit();

    // 🔔 Push notification to all teams that got jobs
    for (const quota of teamQuotas) {
      if (quota.count > 0) {
        const [[team]] = await pool.query('SELECT team_name FROM teams WHERE id = ?', [quota.team_id]);
        const teamName = team?.team_name || 'ทีม';
        notifyTeamMembers(
          quota.team_id,
          '📋 มีงานใหม่จากระบบจัดสรรอัตโนมัติ!',
          `${teamName} ได้รับมอบหมายงาน ${quota.count} งาน`,
          { type: 'auto_dispatch', count: String(quota.count) }
        );
      }
    }

    res.json({ message: 'Auto dispatch successful', assignedCount: totalAssigned, remainingJobs: unassignedJobs.length });
  } catch (err) {
    await conn.rollback();
    console.error('Auto Assign Error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── GET /api/dispatch/search-access/:accessNo — Search Customer/Job by Access No ──
router.get('/search-access/:accessNo', auth, async (req, res) => {
  try {
    const accessNo = req.params.accessNo;

    let customerRow = null;
    try {
      const [[row]] = await pool.query(
        'SELECT * FROM customers WHERE access_no = ? LIMIT 1',
        [accessNo]
      );
      customerRow = row || null;
    } catch (e) {
      if (!e.message.includes("doesn't exist")) throw e;
    }

    const [rows] = await pool.query(
      `SELECT jobs.*, teams.team_name, users.full_name as engineer_name,
              cu.full_name as completed_by_name
       FROM jobs 
       LEFT JOIN teams ON jobs.team_id = teams.id 
       LEFT JOIN users ON jobs.field_engineer_id = users.id 
       LEFT JOIN users cu ON jobs.completed_by = cu.id
       WHERE jobs.access_no = ?
       ORDER BY jobs.id DESC
       LIMIT 1`,
      [accessNo]
    );

    if (rows.length === 0 && !customerRow) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลจาก Access Number นี้' });
    }

    const jobData = rows[0] || {};
    if (customerRow) {
      Object.assign(jobData, {
        access_no: jobData.access_no || customerRow.access_no,
        customer: jobData.customer || customerRow.customer_name,
        phone: jobData.phone || customerRow.phone,
        address: jobData.address || customerRow.address,
        province: jobData.province || customerRow.province,
        area_code: jobData.area_code || customerRow.area_code,
        area_name: jobData.area_name || customerRow.area_name,
        lat: jobData.lat ?? customerRow.lat,
        lng: jobData.lng ?? customerRow.lng,
        map_link: jobData.map_link || customerRow.map_link,
        package: jobData.package || customerRow.package,
        product: jobData.product || customerRow.product,
        order_no: jobData.order_no || customerRow.order_no,
        customer_order_no: jobData.customer_order_no || customerRow.customer_order_no,
        task_type: jobData.task_type || customerRow.task_type,
        task_order: jobData.task_order || customerRow.task_order,
        product_owner: jobData.product_owner || customerRow.product_owner,
        order_type: jobData.order_type || customerRow.order_type,
        service_note: jobData.service_note || customerRow.service_note,
        sla_status: jobData.sla_status || customerRow.sla_status,
        region: jobData.region || customerRow.region,
        install_device: jobData.install_device || customerRow.install_device,
        customer_master_updated_at: customerRow.updated_at,
        // งานไม่จบ
        latest_job_status: customerRow.latest_job_status || jobData.status || null,
        fail_reason: customerRow.fail_reason || jobData.fail_reason || null,
      });
    }

    if (jobData.install_device) {
      Object.assign(jobData, parseInstallDevice(jobData.install_device));
    }

    if (jobData.id) {
      try {
        const [usedRows] = await pool.query(
          `SELECT device_role, sn, product_name, model_name, quantity, used_at
           FROM job_used_inventory WHERE job_id = ? ORDER BY id ASC`,
          [jobData.id]
        );
        if (usedRows.length > 0) {
          jobData.used_devices = usedRows;
        } else {
          // Fallback for legacy data: fetch from inventory_logs using note
          const [logRows] = await pool.query(
            `SELECT 'TechBag' AS device_role, i.sn, p.name AS product_name, m.model_name, l.quantity, l.created_at AS used_at
             FROM inventory_logs l
             JOIN inventory_items i ON l.item_id = i.id
             JOIN inventory_models m ON i.model_id = m.id
             JOIN inventory_products p ON m.product_id = p.id
             WHERE l.action = 'used' AND l.note LIKE ?
             ORDER BY l.id ASC`,
            [`%${jobData.access_no}%`]
          );
          jobData.used_devices = logRows;
        }
      } catch (e) {
        if (!e.message.includes("doesn't exist")) throw e;
        jobData.used_devices = [];
      }
    } else {
      jobData.used_devices = [];
    }

    // Get entry fee info
    const lookupAccess = jobData.access_no || accessNo;
    const [efRows] = await pool.query('SELECT image_path, created_at FROM entry_fees WHERE access_no = ? ORDER BY id DESC LIMIT 1', [lookupAccess]);
    if (efRows.length > 0) {
      jobData.entry_fee_image = efRows[0].image_path;
      jobData.entry_fee_updated_at = efRows[0].created_at;
    }

    // Get completion images
    const lookupAccessImages = jobData.access_no || accessNo;
    if (lookupAccessImages) {
      const [imgRows] = await pool.query(`
        SELECT jci.image_path 
        FROM job_completion_images jci
        JOIN jobs j ON j.id = jci.job_id
        WHERE j.access_no = ?
        ORDER BY jci.id DESC
      `, [lookupAccessImages]);
      jobData.completion_images = imgRows.map(r => r.image_path);
    } else {
      jobData.completion_images = [];
    }

    res.json(jobData);
  } catch (err) {
    console.error('Search Access Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/dispatch/entry-fee — Upload Entry Fee (3 modes: slip/cash/backdate) ──
router.post('/entry-fee', auth, upload.single('image'), async (req, res) => {
  try {
    const { access_no, customer_name, fee_type, backdate, target_user_id, admin_date, network_provider } = req.body;
    if (!access_no) return res.status(400).json({ error: 'Missing access_no' });
    if (!customer_name) return res.status(400).json({ error: 'Missing customer_name' });
    if (!network_provider) return res.status(400).json({ error: 'Missing network_provider (AIS/3BB)' });

    // Check for duplicates
    const [existingFee] = await pool.query('SELECT id FROM entry_fees WHERE access_no = ?', [access_no]);
    if (existingFee.length > 0) {
      return res.status(409).json({ error: 'รหัสลูกค้านี้มีการบันทึกค่าแรกเข้าในระบบแล้ว ไม่สามารถบันทึกซ้ำได้' });
    }

    let finalCreatedBy = req.user.id;
    let finalCreatedAt = null;

    const userRoles = req.user.roles || [req.user.role];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('super_admin');

    if (isAdmin) {
      if (target_user_id) finalCreatedBy = target_user_id;
      if (admin_date) finalCreatedAt = admin_date + ' 12:00:00'; // Make it a DATETIME
    }

    const type = fee_type || 'slip';
    let imagePath = null;

    if (type === 'slip') {
      if (!req.file) return res.status(400).json({ error: 'กรุณาแนบสลิปค่าแรกเข้า' });
      imagePath = '/uploads/' + req.file.filename;
    } else if (type === 'cash') {
      imagePath = 'รับหน้างาน';
    } else if (type === 'backdate') {
      if (!backdate) return res.status(400).json({ error: 'กรุณาเลือกวันที่ย้อนหลัง' });
      if (!req.file) return res.status(400).json({ error: 'กรุณาแนบสลิปค่าแรกเข้า (ย้อนหลัง)' });
      imagePath = '/uploads/' + req.file.filename;
    } else {
      return res.status(400).json({ error: 'ประเภทค่าแรกเข้าไม่ถูกต้อง' });
    }

    let query = 'INSERT INTO entry_fees (access_no, customer_name, image_path, created_by, fee_type, backdate, network_provider) VALUES (?, ?, ?, ?, ?, ?, ?)';
    let params = [access_no, customer_name, imagePath, finalCreatedBy, type, type === 'backdate' ? backdate : null, network_provider];

    if (finalCreatedAt) {
      query = 'INSERT INTO entry_fees (access_no, customer_name, image_path, created_by, fee_type, backdate, network_provider, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
      params.push(finalCreatedAt);
    }

    await pool.query(query, params);

    // Sync entry_fee_status to customers table or Create if not exists
    try {
      const [existing] = await pool.query('SELECT id FROM customers WHERE access_no = ?', [access_no]);
      if (existing.length > 0) {
        await pool.query(
          `UPDATE customers SET entry_fee_status = ?, entry_fee_date = NOW(), customer_name = COALESCE(NULLIF(customer_name, '-'), ?) WHERE access_no = ?`,
          [type, customer_name, access_no]
        );
      } else {
        await pool.query(
          `INSERT INTO customers (
            access_no, customer_name, entry_fee_status, entry_fee_date,
            phone, address, province, area_code, area_name,
            lat, lng, map_link, package, product, order_no, customer_order_no,
            task_type, task_order, product_owner, order_type, service_note, sla_status, region
          ) VALUES (?, ?, ?, NOW(), '-', '-', '-', '-', '-', 0, 0, '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-')`,
          [access_no, customer_name, type]
        );
      }
    } catch (e) {
      console.error('Customers Sync Error:', e.message);
    }

    return res.json({ message: 'Entry fee saved successfully', imagePath, fee_type: type });
  } catch (err) {
    console.error('Entry fee error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/dispatch/entry-fee/:id — Update Entry Fee ──
router.put('/entry-fee/:id', auth, requireRole(ADMIN_ROLES), upload.single('image'), async (req, res) => {
  try {
    const feeId = req.params.id;
    const { access_no, customer_name, fee_type, backdate, target_user_id, admin_date, network_provider } = req.body;
    
    if (!access_no) return res.status(400).json({ error: 'Missing access_no' });
    if (!customer_name) return res.status(400).json({ error: 'Missing customer_name' });
    
    const [old] = await pool.query('SELECT * FROM entry_fees WHERE id = ?', [feeId]);
    if (old.length === 0) return res.status(404).json({ error: 'Not found' });

    let imagePath = old[0].image_path;
    const type = fee_type || old[0].fee_type;
    
    if (type === 'slip' || type === 'backdate') {
      if (req.file) {
        imagePath = '/uploads/' + req.file.filename;
      }
    } else if (type === 'cash') {
      imagePath = 'รับหน้างาน';
    }

    let created_by = target_user_id || old[0].created_by;
    let created_at = old[0].created_at;
    if (admin_date) {
      created_at = admin_date.includes(' ') ? admin_date : admin_date + ' 12:00:00';
    }

    await pool.query(
      `UPDATE entry_fees 
       SET access_no = ?, customer_name = ?, image_path = ?, created_by = ?, fee_type = ?, backdate = ?, network_provider = ?, created_at = ?
       WHERE id = ?`,
      [access_no, customer_name, imagePath, created_by, type, type === 'backdate' ? backdate : null, network_provider || old[0].network_provider, created_at, feeId]
    );

    // Sync entry_fee_status to customers table
    try {
      await pool.query(
        `UPDATE customers SET entry_fee_status = ?, customer_name = ? WHERE access_no = ?`,
        [type, customer_name, access_no]
      );
    } catch (e) {
      console.error('Customers Sync Error on Update:', e.message);
    }

    res.json({ message: 'Updated successfully' });
  } catch (err) {
    console.error('Entry fee update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/dispatch/entry-fee/:id — Delete Entry Fee ──
router.delete('/entry-fee/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const feeId = req.params.id;
    await pool.query('DELETE FROM entry_fees WHERE id = ?', [feeId]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Entry fee delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/dispatch/entry-fee/history — Get Entry Fee History (filterable) ──
router.get('/entry-fee/history', auth, async (req, res) => {
  try {
    const { month, created_by } = req.query; // month: 'YYYY-MM', created_by: user_id
    
    const userRoles = req.user.roles || [req.user.role];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('super_admin');
    const targetUserId = isAdmin ? created_by : req.user.id;

    let query = `
      SELECT ef.*, u.full_name as creator_name, u.profile_image
      FROM entry_fees ef
      LEFT JOIN users u ON ef.created_by = u.id
    `;
    const conditions = [];
    const params = [];
    
    if (month) {
      conditions.push(`DATE_FORMAT(ef.created_at, '%Y-%m') = ?`);
      params.push(month);
    }
    if (targetUserId) {
      conditions.push(`ef.created_by = ?`);
      params.push(targetUserId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ` ORDER BY ef.created_at DESC`;
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Entry Fee History Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/dispatch/jobs/:id/postpone — Tech postpones a job ─
router.put('/jobs/:id/postpone', auth, async (req, res) => {
  const jobId = req.params.id;
  const techId = req.user.id;
  const { new_date, new_time, remark } = req.body;
  if (!new_date) return res.status(400).json({ error: 'New date is required' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[job]] = await conn.query('SELECT * FROM jobs WHERE id = ? LIMIT 1', [jobId]);
    if (!job) { await conn.rollback(); return res.status(404).json({ error: 'Job not found' }); }
    
    let timeText = new_time ? ` เวลา ${new_time} น.` : '';
    const oldDateStr = job.plan_arrival_date 
      ? new Date(job.plan_arrival_date).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : 'ไม่ระบุวันที่';
    const postponeReason = ` [เลื่อนจาก ${oldDateStr} เป็น ${new_date}${timeText}${remark ? ` สาเหตุ: ${remark}` : ''}]`;

    let formattedTime = null;
    if (new_time) {
      formattedTime = String(new_time).includes('-')
        ? new_time
        : `${new_date} ${String(new_time).slice(0, 5)}:00`;
    }
    
    await conn.query(
      `UPDATE jobs SET
         status = 'postponed',
         plan_arrival_date = ?,
         plan_arrival_time = COALESCE(?, plan_arrival_time),
         remark = CONCAT(IFNULL(remark, ''), ?),
         team_id = NULL,
         field_engineer_id = NULL,
         seq = NULL
       WHERE id = ?`,
      [new_date, formattedTime, postponeReason, jobId]
    );

    const logRemark = `Postponed to ${new_date}${timeText}. Reason: ${remark || ''}`;
    try {
      await conn.query('INSERT INTO job_logs (job_id, tech_id, status, remark) VALUES (?, ?, \'postponed\', ?)', [jobId, techId, logRemark]);
    } catch (e) {
      if (e.message && e.message.includes("Field 'id' doesn't have a default value")) {
        const [[{ maxId }]] = await conn.query('SELECT MAX(id) as maxId FROM job_logs');
        await conn.query(
          'INSERT INTO job_logs (id, job_id, tech_id, status, remark) VALUES (?, ?, ?, \'postponed\', ?)',
          [(maxId || 0) + 1, jobId, techId, logRemark]
        );
      } else {
        throw e;
      }
    }

    await safeSyncCustomer(conn, jobId);
    await conn.commit();

    writeJobAudit(pool, {
      job_type: 'office', job_id: jobId, action: 'postpone',
      old_status: job.status, new_status: 'postponed',
      old_team_id: job.team_id, new_team_id: null,
      old_assignee_id: job.field_engineer_id, new_assignee_id: null,
      actor_id: techId,
      remark: `เลื่อนเป็น ${new_date}${new_time ? ` ${new_time}` : ''}${remark ? ` — ${remark}` : ''}`,
    });

    // 🔔 Push notification to admins when tech postpones a job
    const techName = req.user.full_name || req.user.username || 'ช่าง';
    notifyAdmins(
      '📅 เลื่อนนัดงาน',
      `${techName} เลื่อนนัดงาน ${job.access_no || ''} ไปวันที่ ${new_date}${remark ? ': ' + remark.substring(0, 60) : ''}`,
      { type: 'job_postponed', job_id: String(jobId) }
    );

    res.json({ message: 'Job postponed' });
  } catch (err) {
    await conn.rollback();
    console.error('Postpone job error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── PUT /api/dispatch/jobs/clear-dispatch — Clear team assignments ─
router.put('/jobs/clear-dispatch', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { date } = req.body;
    let query = 'UPDATE jobs SET team_id = NULL WHERE status = \'pending\'';
    let params = [];
    if (date) {
      query += ' AND plan_arrival_date = ?';
      params.push(date);
    }
    await pool.query(query, params);
    res.json({ message: 'Cleared all pending dispatches' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/dispatch/jobs/clear-queue — Clear seq ─
router.put('/jobs/clear-queue', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { date } = req.body;
    let query = 'UPDATE jobs SET seq = NULL WHERE status = \'pending\'';
    let params = [];
    if (date) {
      query += ' AND plan_arrival_date = ?';
      params.push(date);
    }
    await pool.query(query, params);
    res.json({ message: 'Cleared queue order' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


// ── PUT /api/dispatch/jobs/:id — Update job details ─
router.put('/jobs/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const {
    customer, phone, address, team_id, field_engineer_id, assigned_user_id, lat, lng, type,
    plan_arrival_date, plan_arrival_time, job_time, symptoms,
    package: pkg, product, order_no, customer_order_no, province,
    area_code, area_name, task_type, task_order, product_owner, order_type,
    service_note, sla_status, region, map_link, remark
  } = req.body;
  const table = type === 'ma' ? 'ma_jobs' : 'jobs';
  const conn = await pool.getConnection();
  try {
    let formatted_time = plan_arrival_time || null;
    if (formatted_time && !formatted_time.includes('-') && plan_arrival_date) {
      formatted_time = `${plan_arrival_date} ${formatted_time}:00`;
    }

    // Snapshot old values for the audit trail (best-effort)
    let oldJob = null;
    try {
      const assigneeCol = table === 'ma_jobs' ? 'assigned_user_id' : 'field_engineer_id';
      [[oldJob]] = await conn.query(
        `SELECT status, team_id, ${assigneeCol} AS assignee_id FROM ${table} WHERE id = ?`,
        [req.params.id]
      );
    } catch (e) { /* audit only */ }

    if (table === 'ma_jobs') {
      // ma_jobs uses assigned_user_id + job_time (plain HH:MM), not the office column names
      const maAssignee = assigned_user_id || field_engineer_id || null;
      const maTime = (job_time || plan_arrival_time || '').toString().trim() || null;
      await conn.query(
        `UPDATE ma_jobs SET
           customer = COALESCE(?, customer), phone = COALESCE(?, phone), address = COALESCE(?, address),
           lat = ?, lng = ?, team_id = ?, assigned_user_id = ?,
           plan_arrival_date = COALESCE(?, plan_arrival_date), job_time = COALESCE(?, job_time),
           symptoms = COALESCE(?, symptoms), area_name = COALESCE(?, area_name), remark = COALESCE(?, remark)
         WHERE id = ?`,
        [customer, phone, address, lat || null, lng || null, team_id || null, maAssignee, plan_arrival_date || null, maTime, symptoms || null, area_name || null, remark || null, req.params.id]
      );
    } else {
      await conn.query(
        `UPDATE jobs SET
          customer = COALESCE(?, customer), phone = COALESCE(?, phone), address = COALESCE(?, address),
          lat = ?, lng = ?, team_id = ?, field_engineer_id = ?,
          plan_arrival_date = COALESCE(?, plan_arrival_date), plan_arrival_time = COALESCE(?, plan_arrival_time),
          package = COALESCE(?, package), product = COALESCE(?, product),
          order_no = COALESCE(?, order_no), customer_order_no = COALESCE(?, customer_order_no),
          province = COALESCE(?, province), area_code = COALESCE(?, area_code), area_name = COALESCE(?, area_name),
          task_type = COALESCE(?, task_type), task_order = COALESCE(?, task_order),
          product_owner = COALESCE(?, product_owner), order_type = COALESCE(?, order_type),
          service_note = COALESCE(?, service_note), sla_status = COALESCE(?, sla_status),
          region = COALESCE(?, region), map_link = COALESCE(?, map_link), remark = COALESCE(?, remark)
         WHERE id = ?`,
        [
          customer, phone, address, lat || null, lng || null, team_id || null, field_engineer_id || null,
          plan_arrival_date || null, formatted_time,
          pkg || null, product || null, order_no || null, customer_order_no || null,
          province || null, area_code || null, area_name || null,
          task_type || null, task_order || null, product_owner || null, order_type || null,
          service_note || null, sla_status || null, region || null, map_link || null, remark || null,
          req.params.id
        ]
      );
      await safeSyncCustomer(conn, req.params.id);
    }

    const newAssignee = table === 'ma_jobs'
      ? (assigned_user_id || field_engineer_id || null)
      : (field_engineer_id || null);
    writeJobAudit(pool, {
      job_type: table === 'ma_jobs' ? 'ma' : 'office', job_id: req.params.id, action: 'update',
      old_status: oldJob?.status, new_status: oldJob?.status,
      old_team_id: oldJob?.team_id, new_team_id: team_id || null,
      old_assignee_id: oldJob?.assignee_id, new_assignee_id: newAssignee,
      actor_id: req.user?.id,
    });

    res.json({ message: 'Job updated' });
  } catch (err) {
    console.error('Job update error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    conn.release();
  }
});

// ── DELETE /api/dispatch/jobs/bulk — Admin deletes multiple jobs ─
router.delete('/jobs/bulk', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { ids, type } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No job IDs provided' });
  }
  const table = type === 'ma' ? 'ma_jobs' : 'jobs';
  try {
    const placeholders = ids.map(() => '?').join(',');
    await pool.query(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ids);
    res.json({ message: 'Jobs deleted successfully' });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/dispatch/jobs/all — Admin deletes all pending jobs ─
router.delete('/jobs/all', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { date, type } = req.query;
  const table = type === 'ma' ? 'ma_jobs' : 'jobs';
  try {
    let query = `DELETE FROM ${table} WHERE status = 'pending'`;
    let params = [];
    if (date) {
      query += ' AND plan_arrival_date = ?';
      params.push(date);
    }
    const [result] = await pool.query(query, params);
    res.json({ message: 'All pending jobs deleted', deletedCount: result.affectedRows });
  } catch (err) {
    console.error('Delete all error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/dispatch/jobs/:id — Admin deletes a single job ─
router.delete('/jobs/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { type } = req.query;
  const table = type === 'ma' ? 'ma_jobs' : 'jobs';
  try {
    await pool.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Job deleted' });
  } catch (err) {
    console.error('Single delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
