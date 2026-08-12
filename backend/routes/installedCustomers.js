const express = require('express');
const pool = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const { lookupPackageFee } = require('../utils/customerSync');
const { getFraudChurnSettings } = require('../utils/fraudChurnSettings');
const {
  aisDueDayFromInstallDate,
  calculateFirstDueDate,
  billingMonthsFromQcSettings,
  syncAutoBillingSchedule,
} = require('../utils/billingSchedule');

const router = express.Router();
const ADMIN_ROLES = ['super_admin', 'admin'];
const PENDING_PACKAGE_NAME = 'รอระบุชื่อแพ็กเกจ';

function isSpreadsheetError(value) {
  return /^#(?:N\/A|REF!|VALUE!|DIV\/0!|NAME\?|ERROR!)$/i.test(String(value || '').trim());
}

function priceOnlyPackage(value) {
  const text = String(value ?? '').trim();
  if (!/^\d[\d,]*(?:\.\d+)?(?:\s*(?:บาท|THB))?$/i.test(text)) return null;
  const amount = Number(text.replace(/(?:บาท|THB)/gi, '').replace(/,/g, '').trim());
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function isNamedPackage(value) {
  const text = String(value || '').trim();
  return Boolean(text) && text !== PENDING_PACKAGE_NAME && !isSpreadsheetError(text) && priceOnlyPackage(text) == null;
}

function shiftMonth(ym, delta) {
  const [y, m] = String(ym).split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

function monthBounds(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function isValidYm(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function lifecycleFromQcStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (!status) return null;
  if (/(terminate|disconnect|cancel|ยกเลิก|ตัดบริการ)/i.test(status)) return 'cancelled';
  if (/(active|เปิดใช้งาน|ใช้งานปกติ)/i.test(status)) return 'active';
  return null;
}

function parseDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const safeDate = new Date(value.getTime() + (12 * 60 * 60 * 1000));
    return `${safeDate.getUTCFullYear()}-${String(safeDate.getUTCMonth() + 1).padStart(2, '0')}-${String(safeDate.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const excelSerial = Number(s);
  if (!Number.isNaN(excelSerial) && excelSerial > 20000 && excelSerial < 80000) {
    // Excel serial date (days since 1899-12-30)
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(excelSerial));
    return epoch.toISOString().slice(0, 10);
  }
  return null;
}

function parseDateTime(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim().replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text} 00:00:00`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(text)) {
    return text.length === 16 ? `${text}:00` : text.slice(0, 19);
  }
  return null;
}

// ── Ensure tables exist (safe for first use if migrate not run) ──────────────
async function ensureTables(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS package_prices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      package_name VARCHAR(150) NOT NULL,
      monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_package_name (package_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS installed_customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_name VARCHAR(150) NOT NULL,
      non_number VARCHAR(50) NOT NULL,
      package_name VARCHAR(150) NOT NULL,
      monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
      install_date DATE NOT NULL,
      job_id INT DEFAULT NULL,
      status ENUM('active','cancelled') NOT NULL DEFAULT 'active',
      cancelled_at DATE DEFAULT NULL,
      cancel_reason VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_installed_non (non_number),
      KEY idx_install_date (install_date),
      KEY idx_installed_status (status),
      KEY idx_cancelled_at (cancelled_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const extraColumns = [
    ['seller_name', 'VARCHAR(100) DEFAULT NULL'],
    ['contact_phone', 'VARCHAR(100) DEFAULT NULL'],
    ['subdistrict', 'VARCHAR(100) DEFAULT NULL'],
    ['district', 'VARCHAR(100) DEFAULT NULL'],
    ['qc_status', 'VARCHAR(100) DEFAULT NULL'],
    ['billing_status', 'VARCHAR(100) DEFAULT NULL'],
    ['status_changed_at', 'DATE DEFAULT NULL'],
    ['ae_remark', 'TEXT DEFAULT NULL'],
    ['payment_due_day', 'TINYINT UNSIGNED DEFAULT NULL'],
    ['first_due_date', 'DATE DEFAULT NULL'],
    ['payment_due_source', "VARCHAR(20) NOT NULL DEFAULT 'auto'"],
    ['install_month_label', 'VARCHAR(20) DEFAULT NULL'],
    ['tracking_summary', 'VARCHAR(255) DEFAULT NULL'],
    ['bill_check_date', 'DATE DEFAULT NULL'],
    ['expected_terminate_at', 'DATE DEFAULT NULL'],
    ['source_row_number', 'INT DEFAULT NULL'],
    ['source_sheet', 'VARCHAR(190) DEFAULT NULL'],
    ['last_imported_at', 'DATETIME DEFAULT NULL'],
  ];
  for (const [column, definition] of extraColumns) {
    const [found] = await conn.query('SHOW COLUMNS FROM installed_customers LIKE ?', [column]);
    if (!found.length) {
      await conn.query(`ALTER TABLE installed_customers ADD COLUMN \`${column}\` ${definition}`);
    }
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS installed_customer_bills (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      installed_customer_id INT NOT NULL,
      bill_month CHAR(7) NOT NULL,
      bill_status VARCHAR(30) NOT NULL DEFAULT 'unknown',
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      paid_amount DECIMAL(12,2) DEFAULT NULL,
      raw_value VARCHAR(255) DEFAULT NULL,
      imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_customer_bill_month (installed_customer_id, bill_month),
      KEY idx_bill_month_status (bill_month, bill_status),
      CONSTRAINT fk_customer_bills_customer
        FOREIGN KEY (installed_customer_id) REFERENCES installed_customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const billColumns = [
    ['paid_amount', 'DECIMAL(12,2) DEFAULT NULL'],
    ['due_date', 'DATE DEFAULT NULL'],
    ['billing_period_start', 'DATE DEFAULT NULL'],
    ['billing_period_end', 'DATE DEFAULT NULL'],
    ['service_days', 'SMALLINT UNSIGNED DEFAULT NULL'],
    ['days_in_month', 'TINYINT UNSIGNED DEFAULT NULL'],
    ['estimated_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
    ['estimated_vat', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
    ['estimated_total', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
    ['vat_rate', 'DECIMAL(5,2) NOT NULL DEFAULT 7'],
    ['bill_source', "VARCHAR(20) NOT NULL DEFAULT 'import'"],
  ];
  for (const [column, definition] of billColumns) {
    const [found] = await conn.query('SHOW COLUMNS FROM installed_customer_bills LIKE ?', [column]);
    if (!found.length) {
      await conn.query(`ALTER TABLE installed_customer_bills ADD COLUMN \`${column}\` ${definition}`);
    }
  }

  await conn.query(`
    CREATE TABLE IF NOT EXISTS quality_import_runs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      source_file VARCHAR(255) DEFAULT NULL,
      source_sheet VARCHAR(190) DEFAULT NULL,
      total_rows INT NOT NULL DEFAULT 0,
      inserted_rows INT NOT NULL DEFAULT 0,
      updated_rows INT NOT NULL DEFAULT 0,
      bill_rows INT NOT NULL DEFAULT 0,
      error_rows INT NOT NULL DEFAULT 0,
      imported_by INT DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_quality_import_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS quality_follow_up_tasks (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      installed_customer_id INT NOT NULL,
      task_type VARCHAR(20) NOT NULL DEFAULT 'billing',
      bill_month CHAR(7) DEFAULT NULL,
      bill_number TINYINT UNSIGNED DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'unassigned',
      priority VARCHAR(20) NOT NULL DEFAULT 'normal',
      assigned_to INT DEFAULT NULL,
      due_date DATE DEFAULT NULL,
      next_follow_up_at DATETIME DEFAULT NULL,
      contact_result VARCHAR(100) DEFAULT NULL,
      note TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      updated_by INT DEFAULT NULL,
      completed_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_qfut_customer_type_bill (installed_customer_id, task_type, bill_month),
      KEY idx_qfut_status_due (status, due_date),
      KEY idx_qfut_assignee (assigned_to),
      CONSTRAINT fk_qfut_customer FOREIGN KEY (installed_customer_id) REFERENCES installed_customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS quality_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      installed_customer_id INT NOT NULL,
      bill_month CHAR(7) DEFAULT NULL,
      entity_type VARCHAR(30) NOT NULL,
      entity_id BIGINT DEFAULT NULL,
      action VARCHAR(50) NOT NULL,
      old_json LONGTEXT DEFAULT NULL,
      new_json LONGTEXT DEFAULT NULL,
      reason VARCHAR(255) DEFAULT NULL,
      actor_id INT DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_qal_customer_created (installed_customer_id, created_at),
      KEY idx_qal_entity (entity_type, entity_id),
      CONSTRAINT fk_qal_customer FOREIGN KEY (installed_customer_id) REFERENCES installed_customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Repair historical imports where Excel supplied only the package price in the package column.
  await conn.query(
    `UPDATE installed_customers
     SET monthly_fee = CASE
           WHEN monthly_fee <= 0 THEN CAST(REPLACE(TRIM(package_name), ',', '') AS DECIMAL(10,2))
           ELSE monthly_fee
         END,
         package_name = ?
     WHERE REPLACE(TRIM(package_name), ',', '') REGEXP '^[0-9]+([.][0-9]+)?$'`,
    [PENDING_PACKAGE_NAME]
  );

  // Preserve a historical/imported due day before filling the new automatic fields.
  await conn.query(`
    UPDATE installed_customers
    SET payment_due_source = 'import'
    WHERE first_due_date IS NULL
      AND payment_due_day IS NOT NULL
      AND payment_due_source = 'auto'
  `);

  // Backfill the official AIS due-day rule for historical rows that remain automatic.
  await conn.query(`
    UPDATE installed_customers
    SET payment_due_day = CASE
          WHEN DAY(install_date) BETWEEN 1 AND 3 THEN 4
          WHEN DAY(install_date) BETWEEN 4 AND 7 THEN 8
          WHEN DAY(install_date) BETWEEN 8 AND 11 THEN 12
          WHEN DAY(install_date) BETWEEN 12 AND 15 THEN 16
          WHEN DAY(install_date) BETWEEN 16 AND 19 THEN 20
          WHEN DAY(install_date) BETWEEN 20 AND 23 THEN 24
          WHEN DAY(install_date) BETWEEN 24 AND 27 THEN 28
          ELSE 1
        END,
        first_due_date = STR_TO_DATE(CONCAT(
          DATE_FORMAT(DATE_ADD(install_date, INTERVAL 1 MONTH), '%Y-%m-'),
          LPAD(CASE
            WHEN DAY(install_date) BETWEEN 1 AND 3 THEN 4
            WHEN DAY(install_date) BETWEEN 4 AND 7 THEN 8
            WHEN DAY(install_date) BETWEEN 8 AND 11 THEN 12
            WHEN DAY(install_date) BETWEEN 12 AND 15 THEN 16
            WHEN DAY(install_date) BETWEEN 16 AND 19 THEN 20
            WHEN DAY(install_date) BETWEEN 20 AND 23 THEN 24
            WHEN DAY(install_date) BETWEEN 24 AND 27 THEN 28
            ELSE 1
          END, 2, '0')
        ), '%Y-%m-%d'),
        payment_due_source = 'auto'
    WHERE (payment_due_source IS NULL OR payment_due_source = 'auto')
      AND (payment_due_day IS NULL OR first_due_date IS NULL)
  `);

  await conn.query(`
    UPDATE installed_customers
    SET first_due_date = STR_TO_DATE(CONCAT(
      DATE_FORMAT(DATE_ADD(install_date, INTERVAL 1 MONTH), '%Y-%m-'),
      LPAD(LEAST(
        payment_due_day,
        DAY(LAST_DAY(DATE_ADD(install_date, INTERVAL 1 MONTH)))
      ), 2, '0')
    ), '%Y-%m-%d')
    WHERE first_due_date IS NULL AND payment_due_day IS NOT NULL
  `);
}

let tablesReady = false;
async function getDb() {
  if (!tablesReady) {
    await ensureTables(pool);
    tablesReady = true;
  }
  return pool;
}

function auditJson(value) {
  if (value == null) return null;
  try {
    return JSON.stringify(value, (_key, item) => {
      if (item instanceof Date) return item.toISOString();
      return item;
    });
  } catch {
    return JSON.stringify({ value: String(value) });
  }
}

async function writeQualityAudit(db, {
  customerId,
  billMonth = null,
  entityType,
  entityId = null,
  action,
  oldValue = null,
  newValue = null,
  reason = null,
  actorId = null,
}) {
  await db.query(
    `INSERT INTO quality_audit_logs
       (installed_customer_id, bill_month, entity_type, entity_id, action,
        old_json, new_json, reason, actor_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerId,
      billMonth,
      entityType,
      entityId,
      action,
      auditJson(oldValue),
      auditJson(newValue),
      reason ? String(reason).trim().slice(0, 255) : null,
      actorId || null,
    ]
  );
}

async function getAutoBillingMonths(db) {
  try {
    return billingMonthsFromQcSettings(await getFraudChurnSettings(db));
  } catch {
    return 8;
  }
}

async function syncCustomerAutoBills(db, customer) {
  const months = await getAutoBillingMonths(db);
  return syncAutoBillingSchedule(db, customer.id, {
    installDate: parseDate(customer.install_date),
    monthlyFee: Number(customer.monthly_fee) || 0,
    months,
    dueDay: customer.payment_due_day || aisDueDayFromInstallDate(customer.install_date),
    vatRate: 7,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Packages
// ═══════════════════════════════════════════════════════════════════════════

router.get('/packages', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const activeOnly = req.query.active === '1' || req.query.active === 'true';
    const [rows] = await db.query(
      `SELECT * FROM package_prices
       ${activeOnly ? 'WHERE is_active = 1' : ''}
       ORDER BY package_name ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('packages list:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/packages', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const package_name = String(req.body.package_name || '').trim();
    const monthly_fee = parseFloat(req.body.monthly_fee);
    if (!package_name) return res.status(400).json({ error: 'กรุณาระบุชื่อแพ็กเกจ' });
    if (Number.isNaN(monthly_fee) || monthly_fee < 0) {
      return res.status(400).json({ error: 'กรุณาระบุราคาต่อเดือนให้ถูกต้อง' });
    }
    const [result] = await db.query(
      `INSERT INTO package_prices (package_name, monthly_fee, is_active)
       VALUES (?, ?, 1)`,
      [package_name, monthly_fee]
    );
    const [[row]] = await db.query('SELECT * FROM package_prices WHERE id = ?', [result.insertId]);
    res.status(201).json(row);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'ชื่อแพ็กเกจนี้มีอยู่แล้ว' });
    }
    console.error('packages create:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/packages/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const id = Number(req.params.id);
    const [[existing]] = await db.query('SELECT * FROM package_prices WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'ไม่พบแพ็กเกจ' });

    const package_name = req.body.package_name != null
      ? String(req.body.package_name).trim()
      : existing.package_name;
    const monthly_fee = req.body.monthly_fee != null
      ? parseFloat(req.body.monthly_fee)
      : Number(existing.monthly_fee);
    const is_active = req.body.is_active != null
      ? (req.body.is_active ? 1 : 0)
      : existing.is_active;

    if (!package_name) return res.status(400).json({ error: 'กรุณาระบุชื่อแพ็กเกจ' });
    if (Number.isNaN(monthly_fee) || monthly_fee < 0) {
      return res.status(400).json({ error: 'กรุณาระบุราคาต่อเดือนให้ถูกต้อง' });
    }

    await db.query(
      `UPDATE package_prices
       SET package_name = ?, monthly_fee = ?, is_active = ?
       WHERE id = ?`,
      [package_name, monthly_fee, is_active, id]
    );
    const [[row]] = await db.query('SELECT * FROM package_prices WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'ชื่อแพ็กเกจนี้มีอยู่แล้ว' });
    }
    console.error('packages update:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/packages/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const id = Number(req.params.id);
    const [result] = await db.query('DELETE FROM package_prices WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบแพ็กเกจ' });
    res.json({ success: true });
  } catch (err) {
    console.error('packages delete:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// QC (must be before /:id)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/qc-options', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const settings = await getFraudChurnSettings(db);
    const [months] = await db.query(
      `SELECT DATE_FORMAT(install_date, '%Y-%m') AS value, COUNT(*) AS total
       FROM installed_customers
       GROUP BY DATE_FORMAT(install_date, '%Y-%m')
       ORDER BY value DESC`
    );
    const [[billRange]] = await db.query(
      `SELECT MIN(bill_month) AS min_month, MAX(bill_month) AS max_month
       FROM installed_customer_bills`
    );
    res.json({
      months: months.map((item) => ({ value: item.value, total: Number(item.total) || 0 })),
      latest_month: months[0]?.value || null,
      bill_range: billRange || { min_month: null, max_month: null },
      settings,
    });
  } catch (err) {
    console.error('qc options:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/qc', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const type = String(req.query.type || '').toLowerCase();
    const month = String(req.query.month || '').trim();

    if (type !== 'fraud' && type !== 'churn') {
      return res.status(400).json({ error: 'type ต้องเป็น fraud หรือ churn' });
    }
    if (!isValidYm(month)) {
      return res.status(400).json({ error: 'month ต้องเป็นรูปแบบ YYYY-MM' });
    }

    const settings = await getFraudChurnSettings(db);
    const activeConfig = settings[type];
    if (!activeConfig.enabled) {
      return res.status(409).json({
        error: `การตรวจ ${type === 'fraud' ? 'Fraud' : 'Churn'} ถูกปิดใช้งานในการตั้งค่าระบบ`,
        code: 'QC_TYPE_DISABLED',
        settings,
      });
    }

    const monthsBack = activeConfig.months;
    // นับรวมเดือนอ้างอิงเป็นเดือนสุดท้ายของช่วงตรวจสอบ
    const cohortStartMonth = shiftMonth(month, -(monthsBack - 1));
    const { start } = monthBounds(cohortStartMonth);
    const { end } = monthBounds(month);

    const [[summary]] = await db.query(
      `SELECT
         COUNT(*) AS total_installs,
         SUM(
           CASE WHEN status = 'cancelled'
             AND cancelled_at IS NOT NULL
             AND cancelled_at >= install_date
             AND cancelled_at < DATE_ADD(install_date, INTERVAL ? MONTH)
           THEN 1 ELSE 0 END
         ) AS cases
       FROM installed_customers
       WHERE install_date BETWEEN ? AND ?`,
      [monthsBack, start, end]
    );

    const total = Number(summary?.total_installs) || 0;
    const cases = Number(summary?.cases) || 0;
    const rate = total > 0 ? Number(((cases / total) * 100).toFixed(2)) : 0;

    const thresholdRate = activeConfig.threshold_rate;
    const allowedCases = Math.floor((total * thresholdRate) / 100);

    const [[billSummary]] = await db.query(
      `SELECT
         COALESCE(SUM(CASE
           WHEN b.bill_status IN ('outstanding', 'overdue') THEN b.amount
           ELSE 0 END), 0) AS outstanding_total,
         COALESCE(SUM(CASE
           WHEN b.bill_status IN ('outstanding', 'overdue') THEN 1
           ELSE 0 END), 0) AS outstanding_bills
       FROM installed_customer_bills b
       JOIN installed_customers c ON c.id = b.installed_customer_id
       WHERE c.install_date BETWEEN ? AND ?
         AND b.bill_month BETWEEN ? AND ?`,
      [start, end, cohortStartMonth, month]
    );

    const [customers] = await db.query(
      `SELECT c.id, c.customer_name, c.non_number, c.package_name, c.monthly_fee,
              c.install_date, c.status, c.cancelled_at, c.cancel_reason,
              c.seller_name, c.contact_phone, c.subdistrict, c.district,
              c.qc_status, c.billing_status, c.status_changed_at, c.ae_remark,
              c.payment_due_day, c.first_due_date, c.payment_due_source,
              DATE_FORMAT(c.first_due_date, '%Y-%m') AS first_due_month,
              c.install_month_label, c.tracking_summary,
              c.bill_check_date, c.expected_terminate_at, c.source_row_number,
              c.source_sheet, c.last_imported_at,
              DATE_ADD(c.install_date, INTERVAL 127 DAY) AS tracking_due_at,
              DATEDIFF(DATE_ADD(c.install_date, INTERVAL 127 DAY), CURDATE()) + 1 AS tracking_days_remaining,
              CASE WHEN c.status = 'cancelled'
                     AND c.cancelled_at IS NOT NULL
                     AND c.cancelled_at >= c.install_date
                     AND c.cancelled_at < DATE_ADD(c.install_date, INTERVAL ? MONTH)
                   THEN 1 ELSE 0 END AS is_case,
              COALESCE(b.outstanding_total, 0) AS outstanding_total,
              COALESCE(b.outstanding_bills, 0) AS outstanding_bills,
              COALESCE(b.paid_bills, 0) AS paid_bills,
              COALESCE(b.bill_rows, 0) AS bill_rows
       FROM installed_customers c
       LEFT JOIN (
         SELECT installed_customer_id,
                SUM(CASE WHEN bill_status IN ('outstanding', 'overdue') THEN amount ELSE 0 END) AS outstanding_total,
                SUM(CASE WHEN bill_status IN ('outstanding', 'overdue') THEN 1 ELSE 0 END) AS outstanding_bills,
                SUM(CASE WHEN bill_status = 'paid' THEN 1 ELSE 0 END) AS paid_bills,
                COUNT(*) AS bill_rows
         FROM installed_customer_bills
         GROUP BY installed_customer_id
       ) b ON b.installed_customer_id = c.id
       WHERE c.install_date BETWEEN ? AND ?
       ORDER BY c.install_date ASC, COALESCE(c.source_row_number, 999999), c.non_number ASC`,
      [monthsBack, start, end]
    );

    const [billRows] = await db.query(
      `SELECT b.installed_customer_id, b.bill_month, b.bill_status, b.amount, b.paid_amount, b.raw_value,
              DATE_FORMAT(b.due_date, '%Y-%m-%d') AS due_date,
              b.billing_period_start, b.billing_period_end,
              b.service_days, b.days_in_month, b.estimated_amount,
              b.estimated_vat, b.estimated_total, b.vat_rate, b.bill_source
       FROM installed_customer_bills b
       JOIN installed_customers c ON c.id = b.installed_customer_id
       WHERE c.install_date BETWEEN ? AND ?
       ORDER BY b.bill_month ASC, b.installed_customer_id ASC`,
      [start, end]
    );

    const [followUpRows] = await db.query(
      `SELECT t.id, t.installed_customer_id, t.task_type, t.bill_month, t.bill_number,
              t.status, t.priority, t.assigned_to,
              DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
              DATE_FORMAT(t.next_follow_up_at, '%Y-%m-%dT%H:%i') AS next_follow_up_at,
              t.contact_result, t.note, t.completed_at, t.created_at, t.updated_at,
              u.full_name AS assignee_name, u.username AS assignee_username,
              updater.full_name AS updated_by_name, updater.username AS updated_by_username
       FROM quality_follow_up_tasks t
       JOIN installed_customers c ON c.id = t.installed_customer_id
       LEFT JOIN users u ON u.id = t.assigned_to
       LEFT JOIN users updater ON updater.id = t.updated_by
       WHERE c.install_date BETWEEN ? AND ?
       ORDER BY t.updated_at DESC`,
      [start, end]
    );

    const billsByCustomer = new Map();
    const billMonthSet = new Set();
    for (const bill of billRows) {
      billMonthSet.add(bill.bill_month);
      const list = billsByCustomer.get(bill.installed_customer_id) || [];
      list.push({
        bill_month: bill.bill_month,
        bill_status: bill.bill_status,
        amount: Number(bill.amount) || 0,
        paid_amount: bill.paid_amount == null ? null : Number(bill.paid_amount),
        raw_value: bill.raw_value,
        due_date: bill.due_date,
        billing_period_start: bill.billing_period_start,
        billing_period_end: bill.billing_period_end,
        service_days: Number(bill.service_days) || 0,
        days_in_month: Number(bill.days_in_month) || 0,
        estimated_amount: Number(bill.estimated_amount) || 0,
        estimated_vat: Number(bill.estimated_vat) || 0,
        estimated_total: Number(bill.estimated_total) || 0,
        vat_rate: Number(bill.vat_rate) || 0,
        bill_source: bill.bill_source || 'import',
      });
      billsByCustomer.set(bill.installed_customer_id, list);
    }

    const normalizedCustomers = customers.map((customer) => ({
      ...customer,
      is_case: Boolean(customer.is_case),
      outstanding_total: Number(customer.outstanding_total) || 0,
      outstanding_bills: Number(customer.outstanding_bills) || 0,
      paid_bills: Number(customer.paid_bills) || 0,
      bill_rows: Number(customer.bill_rows) || 0,
      bills: billsByCustomer.get(customer.id) || [],
    }));
    const detail = normalizedCustomers.filter((customer) => customer.is_case);
    const suspendedCustomers = normalizedCustomers.filter((customer) => /suspend|debt/i.test(customer.qc_status || '')).length;
    const outstandingCustomers = new Set(
      billRows
        .filter((bill) => bill.bill_month >= cohortStartMonth
          && bill.bill_month <= month
          && ['outstanding', 'overdue'].includes(bill.bill_status))
        .map((bill) => bill.installed_customer_id)
    ).size;

    res.json({
      type,
      ref_month: month,
      cohort_month: cohortStartMonth,
      cohort_start_month: cohortStartMonth,
      cohort_end_month: month,
      months_back: monthsBack,
      cohort_start: start,
      cohort_end: end,
      total_installs: total,
      cases,
      rate,
      threshold_rate: thresholdRate,
      active_config: activeConfig,
      settings,
      allowed_cases: allowedCases,
      over_limit: Math.max(0, cases - allowedCases),
      outstanding_total: Number(billSummary?.outstanding_total) || 0,
      outstanding_bills: Number(billSummary?.outstanding_bills) || 0,
      suspended_customers: suspendedCustomers,
      outstanding_customers: outstandingCustomers,
      bill_months: Array.from(billMonthSet).sort(),
      follow_ups: followUpRows.map((task) => ({
        ...task,
        bill_number: task.bill_number == null ? null : Number(task.bill_number),
        assigned_to: task.assigned_to == null ? null : Number(task.assigned_to),
      })),
      customers: normalizedCustomers,
      detail,
    });
  } catch (err) {
    console.error('qc:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/qc-follow-ups', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const customerId = Number(req.body.installed_customer_id);
    const taskType = String(req.body.task_type || 'billing').trim().toLowerCase();
    const billMonth = String(req.body.bill_month || '').trim() || null;
    const billNumber = req.body.bill_number == null || req.body.bill_number === ''
      ? null
      : Number(req.body.bill_number);
    if (!Number.isInteger(customerId) || customerId <= 0) return res.status(400).json({ error: 'รหัสลูกค้าไม่ถูกต้อง' });
    if (!['billing', 'fraud', 'churn'].includes(taskType)) return res.status(400).json({ error: 'ประเภทงานติดตามไม่ถูกต้อง' });
    if (taskType === 'billing' && !isValidYm(billMonth)) return res.status(400).json({ error: 'กรุณาระบุเดือนบิลให้ถูกต้อง' });
    if (billNumber != null && (!Number.isInteger(billNumber) || billNumber < 1 || billNumber > 36)) {
      return res.status(400).json({ error: 'ลำดับบิลต้องอยู่ระหว่าง 1–36' });
    }

    const [[customer]] = await db.query('SELECT id, customer_name, non_number FROM installed_customers WHERE id = ? LIMIT 1', [customerId]);
    if (!customer) return res.status(404).json({ error: 'ไม่พบข้อมูลลูกค้า' });

    const allowedStatuses = ['assigned', 'in_progress', 'completed'];
    const allowedPriorities = ['low', 'normal', 'high', 'urgent'];
    let status = String(req.body.status || 'assigned').trim().toLowerCase();
    const priority = String(req.body.priority || 'normal').trim().toLowerCase();
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: 'สถานะงานติดตามไม่ถูกต้อง' });
    if (!allowedPriorities.includes(priority)) return res.status(400).json({ error: 'ระดับความสำคัญไม่ถูกต้อง' });

    const assignedTo = req.body.assigned_to == null || req.body.assigned_to === '' ? null : Number(req.body.assigned_to);
    if (assignedTo != null) {
      if (!Number.isInteger(assignedTo) || assignedTo <= 0) return res.status(400).json({ error: 'ผู้รับผิดชอบไม่ถูกต้อง' });
      const [[assignee]] = await db.query('SELECT id FROM users WHERE id = ? AND status = ? LIMIT 1', [assignedTo, 'approved']);
      if (!assignee) return res.status(400).json({ error: 'ไม่พบผู้รับผิดชอบที่พร้อมใช้งาน' });
      if (status === 'unassigned') status = 'assigned';
    } else if (status === 'assigned') {
      status = 'unassigned';
    }

    const dueDate = parseDate(req.body.due_date);
    const nextFollowUpAt = parseDateTime(req.body.next_follow_up_at);
    const contactResult = String(req.body.contact_result || '').trim().slice(0, 100) || null;
    const note = String(req.body.note || '').trim().slice(0, 5000) || null;
    const actorId = Number(req.user?.id);
    if (!Number.isInteger(actorId) || actorId <= 0) {
      return res.status(401).json({ error: 'ไม่พบผู้ใช้งานที่กำลังบันทึกสถานะ กรุณาเข้าสู่ระบบใหม่' });
    }
    const uniqueBillMonth = billMonth || null;
    const [[existing]] = await db.query(
      `SELECT * FROM quality_follow_up_tasks
       WHERE installed_customer_id = ? AND task_type = ? AND bill_month <=> ? LIMIT 1`,
      [customerId, taskType, uniqueBillMonth]
    );

    let billBefore = null;
    let paidAmount = null;
    if (taskType === 'billing' && status === 'completed') {
      [[billBefore]] = await db.query(
        'SELECT * FROM installed_customer_bills WHERE installed_customer_id = ? AND bill_month = ? LIMIT 1',
        [customerId, uniqueBillMonth]
      );
      if (!billBefore) {
        return res.status(400).json({ error: 'ไม่พบบิลรอบนี้ กรุณาเพิ่มข้อมูลบิลก่อนยืนยันว่าชำระแล้ว' });
      }
      const fallbackPaidAmount = billBefore.paid_amount == null
        ? (Number(billBefore.amount) || 0)
        : Number(billBefore.paid_amount);
      paidAmount = req.body.paid_amount == null || req.body.paid_amount === ''
        ? fallbackPaidAmount
        : Number(req.body.paid_amount);
      if (!Number.isFinite(paidAmount) || paidAmount < 0) {
        return res.status(400).json({ error: 'ยอดชำระจริงต้องเป็นตัวเลขตั้งแต่ 0 บาทขึ้นไป' });
      }
    }

    await db.query(
      `INSERT INTO quality_follow_up_tasks
         (installed_customer_id, task_type, bill_month, bill_number, status, priority,
          assigned_to, due_date, next_follow_up_at, contact_result, note,
          created_by, updated_by, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'completed', NOW(), NULL))
       ON DUPLICATE KEY UPDATE
         bill_number = VALUES(bill_number), status = VALUES(status), priority = VALUES(priority),
         assigned_to = VALUES(assigned_to), due_date = VALUES(due_date),
         next_follow_up_at = VALUES(next_follow_up_at), contact_result = VALUES(contact_result),
         note = VALUES(note), updated_by = VALUES(updated_by),
         completed_at = IF(VALUES(status) = 'completed', COALESCE(completed_at, NOW()), NULL)`,
      [
        customerId, taskType, uniqueBillMonth, billNumber, status, priority,
        assignedTo, dueDate, nextFollowUpAt, contactResult, note,
        actorId, actorId, status,
      ]
    );

    const [[task]] = await db.query(
      `SELECT t.*, DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
              DATE_FORMAT(t.next_follow_up_at, '%Y-%m-%dT%H:%i') AS next_follow_up_at,
              u.full_name AS assignee_name, u.username AS assignee_username,
              updater.full_name AS updated_by_name, updater.username AS updated_by_username
       FROM quality_follow_up_tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       LEFT JOIN users updater ON updater.id = t.updated_by
       WHERE t.installed_customer_id = ? AND t.task_type = ? AND t.bill_month <=> ? LIMIT 1`,
      [customerId, taskType, uniqueBillMonth]
    );
    await writeQualityAudit(db, {
      customerId,
      billMonth: uniqueBillMonth,
      entityType: 'follow_up_task',
      entityId: task.id,
      action: existing ? 'follow_up_updated' : 'follow_up_created',
      oldValue: existing,
      newValue: task,
      reason: note || contactResult,
      actorId,
    });
    if (billBefore) {
      await db.query(
        `UPDATE installed_customer_bills
         SET bill_status = 'paid', amount = 0, paid_amount = ?, raw_value = 'จ่ายแล้ว',
             bill_source = 'manual', imported_at = CURRENT_TIMESTAMP
         WHERE installed_customer_id = ? AND bill_month = ?`,
        [paidAmount, customerId, uniqueBillMonth]
      );
      const [[billAfter]] = await db.query(
        'SELECT * FROM installed_customer_bills WHERE installed_customer_id = ? AND bill_month = ? LIMIT 1',
        [customerId, uniqueBillMonth]
      );
      if (billBefore.bill_status !== 'paid' || Number(billBefore.paid_amount) !== paidAmount) {
        await writeQualityAudit(db, {
          customerId,
          billMonth: uniqueBillMonth,
          entityType: 'bill',
          entityId: billAfter.id,
          action: 'bill_marked_paid_from_follow_up',
          oldValue: billBefore,
          newValue: billAfter,
          reason: note || contactResult || 'ยืนยันการชำระจากงานติดตาม',
          actorId,
        });
      }
    }
    res.json({
      ...task,
      assigned_to: task.assigned_to == null ? null : Number(task.assigned_to),
      bill_number: task.bill_number == null ? null : Number(task.bill_number),
    });
  } catch (err) {
    console.error('qc follow-up upsert:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/qc-history', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const customerId = Number(req.params.id);
    if (!Number.isInteger(customerId) || customerId <= 0) return res.status(400).json({ error: 'รหัสลูกค้าไม่ถูกต้อง' });
    const [rows] = await db.query(
      `SELECT a.id, a.bill_month, a.entity_type, a.entity_id, a.action,
              a.old_json, a.new_json, a.reason, a.actor_id, a.created_at,
              u.full_name AS actor_name, u.username AS actor_username
       FROM quality_audit_logs a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.installed_customer_id = ?
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT 100`,
      [customerId]
    );
    const parseJson = (value) => {
      if (!value) return null;
      try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; }
    };
    res.json(rows.map((row) => ({
      ...row,
      old_value: parseJson(row.old_json),
      new_value: parseJson(row.new_json),
      old_json: undefined,
      new_json: undefined,
    })));
  } catch (err) {
    console.error('qc history:', err);
    res.status(500).json({ error: err.message });
  }
});

// นำเข้าไฟล์ติดตาม Fraud/Churn ที่อ่านและตรวจตัวอย่างจากหน้าเว็บแล้ว
router.post('/import-quality-status', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const sourceFile = String(req.body.source_file || '').trim().slice(0, 255) || null;
  const sourceSheet = String(req.body.source_sheet || '').trim().slice(0, 190) || null;
  if (!rows.length) return res.status(400).json({ error: 'ไม่มีข้อมูลนำเข้า' });
  if (rows.length > 5000) return res.status(400).json({ error: 'นำเข้าได้ครั้งละไม่เกิน 5,000 รายการ' });

  let conn;
  try {
    await getDb();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    let inserted = 0;
    let updated = 0;
    let billRows = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const sourceRow = Number(row.source_row) || i + 1;
      const nonNumber = String(row.non_number || row.non || row.access_no || '').trim();
      if (!nonNumber) {
        errors.push({ row: sourceRow, error: 'ไม่มี Access Number / NON' });
        continue;
      }

      await conn.query(`SAVEPOINT qc_import_row`);
      try {
        const [[existing]] = await conn.query(
          'SELECT * FROM installed_customers WHERE non_number = ? LIMIT 1',
          [nonNumber]
        );

        const customerName = String(row.customer_name || '').trim() || existing?.customer_name || '';
        const incomingPackageName = String(row.package_name || '').trim();
        const incomingPriceOnly = priceOnlyPackage(incomingPackageName);
        const existingPackageName = String(existing?.package_name || '').trim();
        const packageName = incomingPriceOnly != null || incomingPackageName === PENDING_PACKAGE_NAME
          ? (isNamedPackage(existingPackageName) ? existingPackageName : PENDING_PACKAGE_NAME)
          : (!isSpreadsheetError(incomingPackageName) && incomingPackageName
            ? incomingPackageName
            : existingPackageName);
        const installDate = parseDate(row.install_date) || parseDate(existing?.install_date);
        if (!customerName || !packageName || !installDate) {
          errors.push({
            row: sourceRow,
            non_number: nonNumber,
            error: 'ข้อมูลลูกค้าใหม่ไม่ครบ: ต้องมีชื่อ แพ็กเกจ และ Register Date',
          });
          await conn.query(`ROLLBACK TO SAVEPOINT qc_import_row`);
          continue;
        }

        let monthlyFee = Number(row.monthly_fee);
        if ((!Number.isFinite(monthlyFee) || monthlyFee < 0) && incomingPriceOnly != null) {
          monthlyFee = incomingPriceOnly;
        }
        if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
          monthlyFee = existing ? Number(existing.monthly_fee) : await lookupPackageFee(conn, packageName);
        }
        if (!Number.isFinite(monthlyFee) || monthlyFee < 0) monthlyFee = 0;

        const qcStatus = String(row.qc_status || '').trim() || existing?.qc_status || null;
        const lifecycle = lifecycleFromQcStatus(qcStatus);
        const status = lifecycle || existing?.status || 'active';
        const statusChangedAt = parseDate(row.status_changed_at || row.status_observed_at)
          || parseDate(existing?.status_changed_at);
        const cancelledAt = status === 'cancelled'
          ? (statusChangedAt || parseDate(existing?.cancelled_at))
          : null;
        const cancelReason = status === 'cancelled' ? qcStatus : null;
        const dueDayValue = Number(row.payment_due_day);
        const hasImportedDueDay = Number.isInteger(dueDayValue) && dueDayValue >= 1 && dueDayValue <= 31;
        const paymentDueSource = hasImportedDueDay
          ? 'import'
          : (existing?.payment_due_source || 'auto');
        const paymentDueDay = hasImportedDueDay
          ? dueDayValue
          : (paymentDueSource === 'auto'
            ? aisDueDayFromInstallDate(installDate)
            : (existing?.payment_due_day || aisDueDayFromInstallDate(installDate)));
        const firstDueDate = calculateFirstDueDate(installDate, paymentDueDay);
        const sourceRowValue = Number(row.source_row);

        const fields = [
          customerName,
          nonNumber,
          packageName,
          monthlyFee,
          installDate,
          String(row.seller_name || '').trim() || existing?.seller_name || null,
          String(row.contact_phone || '').trim() || existing?.contact_phone || null,
          String(row.subdistrict || '').trim() || existing?.subdistrict || null,
          String(row.district || '').trim() || existing?.district || null,
          status,
          cancelledAt,
          cancelReason,
          qcStatus,
          String(row.billing_status || '').trim() || existing?.billing_status || null,
          statusChangedAt,
          String(row.ae_remark || '').trim() || existing?.ae_remark || null,
          paymentDueDay,
          firstDueDate,
          paymentDueSource,
          String(row.install_month_label || '').trim() || existing?.install_month_label || null,
          String(row.tracking_summary || '').trim() || existing?.tracking_summary || null,
          parseDate(row.bill_check_date) || parseDate(existing?.bill_check_date),
          parseDate(row.expected_terminate_at) || parseDate(existing?.expected_terminate_at),
          Number.isInteger(sourceRowValue) && sourceRowValue > 0 ? sourceRowValue : (existing?.source_row_number || null),
          sourceSheet,
        ];

        let customerId;
        let rowAction;
        if (existing) {
          await conn.query(
            `UPDATE installed_customers SET
               customer_name = ?, non_number = ?, package_name = ?, monthly_fee = ?, install_date = ?,
               seller_name = ?, contact_phone = ?, subdistrict = ?, district = ?,
               status = ?, cancelled_at = ?, cancel_reason = ?, qc_status = ?, billing_status = ?,
               status_changed_at = ?, ae_remark = ?, payment_due_day = ?, first_due_date = ?,
               payment_due_source = ?, install_month_label = ?,
               tracking_summary = ?, bill_check_date = ?, expected_terminate_at = ?, source_row_number = ?,
               source_sheet = ?,
               last_imported_at = NOW(), updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [...fields, existing.id]
          );
          customerId = existing.id;
          rowAction = 'updated';
        } else {
          const [result] = await conn.query(
            `INSERT INTO installed_customers
               (customer_name, non_number, package_name, monthly_fee, install_date,
                seller_name, contact_phone, subdistrict, district,
                status, cancelled_at, cancel_reason, qc_status, billing_status,
                status_changed_at, ae_remark, payment_due_day, first_due_date,
                payment_due_source, install_month_label,
                tracking_summary, bill_check_date, expected_terminate_at, source_row_number,
                source_sheet, last_imported_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            fields
          );
          customerId = result.insertId;
          rowAction = 'inserted';
        }

        await syncCustomerAutoBills(conn, {
          id: customerId,
          install_date: installDate,
          monthly_fee: monthlyFee,
          payment_due_day: paymentDueDay,
        });

        const bills = (Array.isArray(row.bills) ? row.bills.slice(0, 36) : [])
          .filter((bill) => isValidYm(bill?.bill_month));
        if (bills.length) {
          const placeholders = bills.map(() => '(?, ?, ?, ?, ?)').join(', ');
          const billValues = bills.flatMap((bill) => {
            const amount = Number(bill.amount);
            return [
              customerId,
              bill.bill_month,
              String(bill.bill_status || 'unknown').slice(0, 30),
              Number.isFinite(amount) && amount >= 0 ? amount : 0,
              bill.raw_value == null ? null : String(bill.raw_value).slice(0, 255),
            ];
          });
          await conn.query(
            `INSERT INTO installed_customer_bills
               (installed_customer_id, bill_month, bill_status, amount, raw_value)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE
               bill_status = VALUES(bill_status), amount = VALUES(amount),
               paid_amount = IF(VALUES(bill_status) = 'paid', paid_amount, NULL),
               raw_value = VALUES(raw_value), bill_source = 'import', imported_at = CURRENT_TIMESTAMP`,
            billValues
          );
        }
        await conn.query(`RELEASE SAVEPOINT qc_import_row`);
        if (rowAction === 'inserted') inserted++;
        else updated++;
        billRows += bills.length;
      } catch (rowError) {
        await conn.query(`ROLLBACK TO SAVEPOINT qc_import_row`);
        errors.push({ row: sourceRow, non_number: nonNumber, error: rowError.message });
      }
    }

    await conn.query(
      `INSERT INTO quality_import_runs
         (source_file, source_sheet, total_rows, inserted_rows, updated_rows, bill_rows, error_rows, imported_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sourceFile, sourceSheet, rows.length, inserted, updated, billRows, errors.length, req.user?.id || null]
    );
    await conn.commit();

    res.json({
      success: true,
      total: rows.length,
      inserted,
      updated,
      bill_rows: billRows,
      errors,
    });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    console.error('import quality status:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Import
// ═══════════════════════════════════════════════════════════════════════════

router.post('/import', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'ไม่มีข้อมูลนำเข้า' });

    let imported = 0;
    let updated = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const non_number = String(row.non_number || row.non || row.access_no || '').trim();
      const customer_name = String(row.customer_name || row.customer || row.name || '').trim();
      const rawPackageName = String(row.package_name || row.package || '').trim();
      const packagePriceOnly = priceOnlyPackage(rawPackageName);
      const package_name = isSpreadsheetError(rawPackageName)
        ? ''
        : (packagePriceOnly != null ? PENDING_PACKAGE_NAME : rawPackageName);
      const install_date = parseDate(row.install_date || row.date || row.installDate);
      let monthly_fee = row.monthly_fee != null && row.monthly_fee !== ''
        ? parseFloat(row.monthly_fee)
        : NaN;

      if (!non_number) {
        errors.push({ row: i + 1, non_number: null, error: 'ไม่มีเลข NON' });
        continue;
      }
      if (!customer_name) {
        errors.push({ row: i + 1, non_number, error: 'ไม่มีชื่อลูกค้า' });
        continue;
      }
      if (!package_name) {
        errors.push({ row: i + 1, non_number, error: 'ไม่มีแพ็กเกจ' });
        continue;
      }
      if (!install_date) {
        errors.push({ row: i + 1, non_number, error: 'วันติดตั้งไม่ถูกต้อง' });
        continue;
      }

      if (Number.isNaN(monthly_fee) || monthly_fee < 0) {
        monthly_fee = packagePriceOnly != null
          ? packagePriceOnly
          : await lookupPackageFee(db, package_name);
      }
      const autoDueDay = aisDueDayFromInstallDate(install_date);
      const autoFirstDueDate = calculateFirstDueDate(install_date, autoDueDay);

      try {
        const [result] = await db.query(
          `INSERT INTO installed_customers
             (customer_name, non_number, package_name, monthly_fee, install_date,
              payment_due_day, first_due_date, payment_due_source, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'auto', 'active')
           ON DUPLICATE KEY UPDATE
             customer_name = IF(status = 'cancelled', customer_name, VALUES(customer_name)),
             package_name  = IF(status = 'cancelled' OR VALUES(package_name) = ?, package_name, VALUES(package_name)),
             monthly_fee   = IF(status = 'cancelled', monthly_fee, VALUES(monthly_fee)),
             install_date  = IF(status = 'cancelled', install_date, VALUES(install_date)),
             payment_due_day = IF(status = 'cancelled' OR payment_due_source <> 'auto', payment_due_day, VALUES(payment_due_day)),
             first_due_date = IF(status = 'cancelled' OR payment_due_source <> 'auto', first_due_date, VALUES(first_due_date)),
             updated_at    = CURRENT_TIMESTAMP`,
          [customer_name, non_number, package_name, monthly_fee, install_date,
            autoDueDay, autoFirstDueDate, PENDING_PACKAGE_NAME]
        );
        const [[savedCustomer]] = await db.query(
          'SELECT id, install_date, monthly_fee, payment_due_day FROM installed_customers WHERE non_number = ? LIMIT 1',
          [non_number]
        );
        if (savedCustomer) await syncCustomerAutoBills(db, savedCustomer);
        if (result.affectedRows === 1) imported++;
        else if (result.affectedRows === 2) updated++;
        else imported++;
      } catch (e) {
        errors.push({ row: i + 1, non_number, error: e.message });
      }
    }

    res.json({ success: true, imported, updated, errors, total: rows.length });
  } catch (err) {
    console.error('import installs:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/import-cancellations', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'ไม่มีข้อมูลนำเข้า' });

    let cancelled = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const non_number = String(row.non_number || row.non || row.access_no || '').trim();
      const cancelled_at = parseDate(row.cancelled_at || row.cancel_date || row.date);
      const cancel_reason = row.cancel_reason != null
        ? String(row.cancel_reason).trim() || null
        : (row.reason != null ? String(row.reason).trim() || null : null);

      if (!non_number) {
        errors.push({ row: i + 1, non_number: null, error: 'ไม่มีเลข NON' });
        continue;
      }
      if (!cancelled_at) {
        errors.push({ row: i + 1, non_number, error: 'วันที่ยกเลิกไม่ถูกต้อง' });
        continue;
      }

      try {
        const [result] = await db.query(
          `UPDATE installed_customers
           SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = CURRENT_TIMESTAMP
           WHERE non_number = ?`,
          [cancelled_at, cancel_reason, non_number]
        );
        if (result.affectedRows === 0) {
          errors.push({ row: i + 1, non_number, error: 'ไม่พบลูกค้าในทะเบียน' });
        } else {
          cancelled++;
        }
      } catch (e) {
        errors.push({ row: i + 1, non_number, error: e.message });
      }
    }

    res.json({ success: true, cancelled, errors, total: rows.length });
  } catch (err) {
    console.error('import cancellations:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Installed customers CRUD
// ═══════════════════════════════════════════════════════════════════════════

router.get('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const { q, package: pkg, status, from, to } = req.query;
    const where = [];
    const params = [];

    if (q && String(q).trim()) {
      const like = `%${String(q).trim()}%`;
      where.push('(customer_name LIKE ? OR non_number LIKE ? OR package_name LIKE ?)');
      params.push(like, like, like);
    }
    if (pkg && String(pkg).trim()) {
      where.push('package_name = ?');
      params.push(String(pkg).trim());
    }
    if (status === 'active' || status === 'cancelled') {
      where.push('status = ?');
      params.push(status);
    }
    if (from) {
      const d = parseDate(from);
      if (d) { where.push('install_date >= ?'); params.push(d); }
    }
    if (to) {
      const d = parseDate(to);
      if (d) { where.push('install_date <= ?'); params.push(d); }
    }

    const sql = `
      SELECT * FROM installed_customers
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY install_date DESC, id DESC
      LIMIT 2000
    `;
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('installed list:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const customer_name = String(req.body.customer_name || '').trim();
    const non_number = String(req.body.non_number || '').trim();
    const package_name = String(req.body.package_name || '').trim();
    const install_date = parseDate(req.body.install_date);
    let monthly_fee = req.body.monthly_fee != null && req.body.monthly_fee !== ''
      ? parseFloat(req.body.monthly_fee)
      : NaN;

    if (!customer_name) return res.status(400).json({ error: 'กรุณาระบุชื่อลูกค้า' });
    if (!non_number) return res.status(400).json({ error: 'กรุณาระบุเลข NON' });
    if (!package_name) return res.status(400).json({ error: 'กรุณาระบุแพ็กเกจ' });
    if (!install_date) return res.status(400).json({ error: 'กรุณาระบุวันติดตั้ง' });

    if (Number.isNaN(monthly_fee) || monthly_fee < 0) {
      monthly_fee = await lookupPackageFee(db, package_name);
    }
    const paymentDueDay = aisDueDayFromInstallDate(install_date);
    const firstDueDate = calculateFirstDueDate(install_date, paymentDueDay);

    const [result] = await db.query(
      `INSERT INTO installed_customers
         (customer_name, non_number, package_name, monthly_fee, install_date,
          payment_due_day, first_due_date, payment_due_source, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'auto', 'active')`,
      [customer_name, non_number, package_name, monthly_fee, install_date, paymentDueDay, firstDueDate]
    );
    await syncCustomerAutoBills(db, {
      id: result.insertId,
      install_date,
      monthly_fee,
      payment_due_day: paymentDueDay,
    });
    const [[row]] = await db.query('SELECT * FROM installed_customers WHERE id = ?', [result.insertId]);
    res.status(201).json(row);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'เลข NON นี้มีในทะเบียนแล้ว' });
    }
    console.error('installed create:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const id = Number(req.params.id);
    const [[existing]] = await db.query('SELECT * FROM installed_customers WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'ไม่พบข้อมูลลูกค้า' });

    const customer_name = req.body.customer_name != null
      ? String(req.body.customer_name).trim()
      : existing.customer_name;
    const non_number = req.body.non_number != null
      ? String(req.body.non_number).trim()
      : existing.non_number;
    const package_name = req.body.package_name != null
      ? String(req.body.package_name).trim()
      : existing.package_name;
    const install_date = req.body.install_date != null
      ? parseDate(req.body.install_date)
      : (existing.install_date instanceof Date
        ? existing.install_date.toISOString().slice(0, 10)
        : String(existing.install_date).slice(0, 10));

    const textField = (key, fallback, maxLength = 255) => {
      if (!Object.prototype.hasOwnProperty.call(req.body, key)) return fallback;
      return String(req.body[key] ?? '').trim().slice(0, maxLength) || null;
    };
    const dateField = (key, fallback) => {
      if (!Object.prototype.hasOwnProperty.call(req.body, key)) return parseDate(fallback);
      return parseDate(req.body[key]);
    };

    let monthly_fee = req.body.monthly_fee != null && req.body.monthly_fee !== ''
      ? parseFloat(req.body.monthly_fee)
      : Number(existing.monthly_fee);

    if (!customer_name) return res.status(400).json({ error: 'กรุณาระบุชื่อลูกค้า' });
    if (!non_number) return res.status(400).json({ error: 'กรุณาระบุเลข NON' });
    if (!package_name) return res.status(400).json({ error: 'กรุณาระบุแพ็กเกจ' });
    if (!install_date) return res.status(400).json({ error: 'กรุณาระบุวันติดตั้ง' });
    if (Number.isNaN(monthly_fee) || monthly_fee < 0) monthly_fee = 0;

    const status = Object.prototype.hasOwnProperty.call(req.body, 'status')
      ? String(req.body.status || '').trim().toLowerCase()
      : existing.status;
    if (!['active', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'สถานะระบบต้องเป็น active หรือ cancelled' });
    }

    const hasDueDayInput = Object.prototype.hasOwnProperty.call(req.body, 'payment_due_day');
    const requestedDueMode = String(req.body.payment_due_mode || '').trim().toLowerCase();
    const payment_due_source = requestedDueMode === 'auto'
      ? 'auto'
      : (requestedDueMode === 'manual'
        ? 'manual'
        : (hasDueDayInput ? 'manual' : (existing.payment_due_source || 'auto')));
    const dueDayInput = payment_due_source === 'auto'
      ? aisDueDayFromInstallDate(install_date)
      : (hasDueDayInput ? req.body.payment_due_day : existing.payment_due_day);
    const payment_due_day = dueDayInput == null || dueDayInput === '' ? null : Number(dueDayInput);
    if (payment_due_day != null && (!Number.isInteger(payment_due_day) || payment_due_day < 1 || payment_due_day > 31)) {
      return res.status(400).json({ error: 'กำหนดชำระต้องเป็นวันที่ 1–31' });
    }
    if (payment_due_day == null) return res.status(400).json({ error: 'กรุณาระบุวันครบกำหนดชำระ' });
    const first_due_date = calculateFirstDueDate(install_date, payment_due_day);

    const cancelled_at = status === 'cancelled'
      ? dateField('cancelled_at', existing.cancelled_at)
      : null;
    const cancel_reason = status === 'cancelled'
      ? textField('cancel_reason', existing.cancel_reason)
      : null;
    const seller_name = textField('seller_name', existing.seller_name, 100);
    const contact_phone = textField('contact_phone', existing.contact_phone, 100);
    const subdistrict = textField('subdistrict', existing.subdistrict, 100);
    const district = textField('district', existing.district, 100);
    const qc_status = textField('qc_status', existing.qc_status, 100);
    const billing_status = textField('billing_status', existing.billing_status, 100);
    const status_changed_at = dateField('status_changed_at', existing.status_changed_at);
    const ae_remark = textField('ae_remark', existing.ae_remark, 10000);
    const install_month_label = textField('install_month_label', existing.install_month_label, 20);
    const tracking_summary = textField('tracking_summary', existing.tracking_summary, 255);
    const bill_check_date = dateField('bill_check_date', existing.bill_check_date);
    const expected_terminate_at = dateField('expected_terminate_at', existing.expected_terminate_at);

    // If package changed and fee not explicitly set, re-lookup
    if (
      req.body.package_name != null &&
      req.body.monthly_fee == null &&
      String(req.body.package_name).trim() !== existing.package_name
    ) {
      const looked = await lookupPackageFee(db, package_name);
      if (looked > 0) monthly_fee = looked;
    }

    await db.query(
      `UPDATE installed_customers
       SET customer_name = ?, non_number = ?, package_name = ?, monthly_fee = ?, install_date = ?,
           seller_name = ?, contact_phone = ?, subdistrict = ?, district = ?,
           status = ?, cancelled_at = ?, cancel_reason = ?, qc_status = ?, billing_status = ?,
           status_changed_at = ?, ae_remark = ?, payment_due_day = ?, first_due_date = ?,
           payment_due_source = ?, install_month_label = ?,
           tracking_summary = ?, bill_check_date = ?, expected_terminate_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        customer_name, non_number, package_name, monthly_fee, install_date,
        seller_name, contact_phone, subdistrict, district,
        status, cancelled_at, cancel_reason, qc_status, billing_status,
        status_changed_at, ae_remark, payment_due_day, first_due_date,
        payment_due_source, install_month_label,
        tracking_summary, bill_check_date, expected_terminate_at, id,
      ]
    );
    await syncCustomerAutoBills(db, {
      id,
      install_date,
      monthly_fee,
      payment_due_day,
    });
    const [[row]] = await db.query('SELECT * FROM installed_customers WHERE id = ?', [id]);
    await writeQualityAudit(db, {
      customerId: id,
      entityType: 'customer',
      entityId: id,
      action: 'customer_updated',
      oldValue: existing,
      newValue: row,
      reason: req.body.change_reason || null,
      actorId: req.user?.id,
    });
    res.json(row);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'เลข NON นี้มีในทะเบียนแล้ว' });
    }
    console.error('installed update:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/bills/:billMonth', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const id = Number(req.params.id);
    const billMonth = String(req.params.billMonth || '').trim();
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'รหัสลูกค้าไม่ถูกต้อง' });
    if (!isValidYm(billMonth)) return res.status(400).json({ error: 'เดือนบิลต้องเป็นรูปแบบ YYYY-MM' });

    const [[customer]] = await db.query(
      'SELECT id, payment_due_day FROM installed_customers WHERE id = ? LIMIT 1',
      [id]
    );
    if (!customer) return res.status(404).json({ error: 'ไม่พบข้อมูลลูกค้า' });
    const [[existingBill]] = await db.query(
      'SELECT * FROM installed_customer_bills WHERE installed_customer_id = ? AND bill_month = ? LIMIT 1',
      [id, billMonth]
    );

    const allowedStatuses = ['paid', 'reserved', 'outstanding', 'overdue', 'note', 'unknown'];
    const billStatus = String(req.body.bill_status || 'unknown').trim().toLowerCase();
    if (!allowedStatuses.includes(billStatus)) {
      return res.status(400).json({ error: 'สถานะบิลไม่ถูกต้อง' });
    }

    let amount = req.body.amount == null || req.body.amount === '' ? 0 : Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'ยอดบิลต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป' });
    if (billStatus === 'paid') amount = 0;

    let paidAmount = null;
    if (billStatus === 'paid' && req.body.paid_amount != null && req.body.paid_amount !== '') {
      paidAmount = Number(req.body.paid_amount);
      if (!Number.isFinite(paidAmount) || paidAmount < 0) {
        return res.status(400).json({ error: 'ยอดชำระจริงต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป' });
      }
    }

    let rawValue = String(req.body.raw_value || '').trim().slice(0, 255) || null;
    if (!rawValue) {
      if (billStatus === 'paid') rawValue = 'จ่ายแล้ว';
      else if (billStatus === 'reserved') rawValue = amount > 0 ? `สำรอง ${amount}` : 'สำรอง';
      else if (['outstanding', 'overdue'].includes(billStatus)) rawValue = String(amount);
    }

    const [billYear, billMonthNumber] = billMonth.split('-').map(Number);
    const lastDay = new Date(billYear, billMonthNumber, 0).getDate();
    const defaultDueDate = `${billMonth}-${String(Math.min(Number(customer.payment_due_day) || 1, lastDay)).padStart(2, '0')}`;
    const dueDate = parseDate(req.body.due_date) || parseDate(existingBill?.due_date) || defaultDueDate;
    if (!dueDate.startsWith(`${billMonth}-`)) {
      return res.status(400).json({ error: 'วันที่ครบชำระต้องอยู่ในเดือนบิลที่เลือก' });
    }

    await db.query(
      `INSERT INTO installed_customer_bills
         (installed_customer_id, bill_month, bill_status, amount, paid_amount, raw_value, due_date, bill_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
       ON DUPLICATE KEY UPDATE
         bill_status = VALUES(bill_status), amount = VALUES(amount), paid_amount = VALUES(paid_amount),
         raw_value = VALUES(raw_value), due_date = VALUES(due_date),
         bill_source = 'manual', imported_at = CURRENT_TIMESTAMP`,
      [id, billMonth, billStatus, amount, paidAmount, rawValue, dueDate]
    );
    const [[bill]] = await db.query(
      `SELECT id, installed_customer_id, bill_month, bill_status, amount, paid_amount, raw_value, due_date,
              billing_period_start, billing_period_end, service_days, days_in_month,
              estimated_amount, estimated_vat, estimated_total, vat_rate, bill_source, imported_at
       FROM installed_customer_bills
       WHERE installed_customer_id = ? AND bill_month = ?`,
      [id, billMonth]
    );
    await writeQualityAudit(db, {
      customerId: id,
      billMonth,
      entityType: 'bill',
      entityId: bill.id || existingBill?.id || null,
      action: existingBill ? 'bill_updated' : 'bill_created',
      oldValue: existingBill,
      newValue: bill,
      reason: req.body.change_reason || null,
      actorId: req.user?.id,
    });
    if (billStatus === 'paid') {
      const [openTasks] = await db.query(
        `SELECT * FROM quality_follow_up_tasks
         WHERE installed_customer_id = ? AND task_type = 'billing' AND bill_month = ?
           AND status <> 'completed'`,
        [id, billMonth]
      );
      if (openTasks.length) {
        await db.query(
          `UPDATE quality_follow_up_tasks
           SET status = 'completed', completed_at = NOW(), updated_by = ?
           WHERE installed_customer_id = ? AND task_type = 'billing' AND bill_month = ?
             AND status <> 'completed'`,
          [req.user?.id || null, id, billMonth]
        );
        for (const task of openTasks) {
          await writeQualityAudit(db, {
            customerId: id,
            billMonth,
            entityType: 'follow_up_task',
            entityId: task.id,
            action: 'follow_up_auto_completed',
            oldValue: task,
            newValue: { ...task, status: 'completed' },
            reason: 'ระบบปิดงานอัตโนมัติหลังบันทึกว่าชำระแล้ว',
            actorId: req.user?.id,
          });
        }
      }
    }
    res.json({
      ...bill,
      amount: Number(bill.amount) || 0,
      paid_amount: bill.paid_amount == null ? null : Number(bill.paid_amount),
    });
  } catch (err) {
    console.error('installed bill upsert:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/bills/:billMonth', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const id = Number(req.params.id);
    const billMonth = String(req.params.billMonth || '').trim();
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'รหัสลูกค้าไม่ถูกต้อง' });
    if (!isValidYm(billMonth)) return res.status(400).json({ error: 'เดือนบิลต้องเป็นรูปแบบ YYYY-MM' });
    const [[existingBill]] = await db.query(
      'SELECT * FROM installed_customer_bills WHERE installed_customer_id = ? AND bill_month = ? LIMIT 1',
      [id, billMonth]
    );
    const [result] = await db.query(
      'DELETE FROM installed_customer_bills WHERE installed_customer_id = ? AND bill_month = ?',
      [id, billMonth]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'ไม่พบข้อมูลบิลเดือนนี้' });
    await writeQualityAudit(db, {
      customerId: id,
      billMonth,
      entityType: 'bill',
      entityId: existingBill?.id || null,
      action: 'bill_deleted',
      oldValue: existingBill,
      reason: req.body?.change_reason || null,
      actorId: req.user?.id,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('installed bill delete:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/cancel', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const id = Number(req.params.id);
    const [[existing]] = await db.query('SELECT * FROM installed_customers WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'ไม่พบข้อมูลลูกค้า' });

    const cancelled_at = parseDate(req.body.cancelled_at) || new Date().toISOString().slice(0, 10);
    const cancel_reason = req.body.cancel_reason != null
      ? String(req.body.cancel_reason).trim() || null
      : null;

    await db.query(
      `UPDATE installed_customers
       SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?
       WHERE id = ?`,
      [cancelled_at, cancel_reason, id]
    );
    const [[row]] = await db.query('SELECT * FROM installed_customers WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    console.error('installed cancel:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/reactivate', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const id = Number(req.params.id);
    const [[existing]] = await db.query('SELECT * FROM installed_customers WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'ไม่พบข้อมูลลูกค้า' });

    await db.query(
      `UPDATE installed_customers
       SET status = 'active', cancelled_at = NULL, cancel_reason = NULL
       WHERE id = ?`,
      [id]
    );
    const [[row]] = await db.query('SELECT * FROM installed_customers WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    console.error('installed reactivate:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const db = await getDb();
    const id = Number(req.params.id);
    const [result] = await db.query('DELETE FROM installed_customers WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบข้อมูลลูกค้า' });
    res.json({ success: true });
  } catch (err) {
    console.error('installed delete:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
