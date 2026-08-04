const express = require('express');
const pool = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const { lookupPackageFee } = require('../utils/customerSync');

const router = express.Router();
const ADMIN_ROLES = ['super_admin', 'admin'];

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
      raw_value VARCHAR(255) DEFAULT NULL,
      imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_customer_bill_month (installed_customer_id, bill_month),
      KEY idx_bill_month_status (bill_month, bill_status),
      CONSTRAINT fk_customer_bills_customer
        FOREIGN KEY (installed_customer_id) REFERENCES installed_customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

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
}

let tablesReady = false;
async function getDb() {
  if (!tablesReady) {
    await ensureTables(pool);
    tablesReady = true;
  }
  return pool;
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

    const monthsBack = type === 'fraud' ? 4 : 8;
    // นับรวมเดือนอ้างอิง: Fraud = เดือนอ้างอิง + 3 เดือนก่อนหน้า,
    // Churn = เดือนอ้างอิง + 7 เดือนก่อนหน้า
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

    const thresholdRate = type === 'fraud' ? 3 : 1.5;
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

    const [detail] = await db.query(
      `SELECT c.id, c.customer_name, c.non_number, c.package_name, c.monthly_fee,
              c.install_date, c.status, c.cancelled_at, c.cancel_reason,
              c.qc_status, c.billing_status, c.status_changed_at, c.ae_remark,
              COALESCE(b.outstanding_total, 0) AS outstanding_total,
              COALESCE(b.outstanding_bills, 0) AS outstanding_bills
       FROM installed_customers c
       LEFT JOIN (
         SELECT installed_customer_id,
                SUM(CASE WHEN bill_status IN ('outstanding', 'overdue') THEN amount ELSE 0 END) AS outstanding_total,
                SUM(CASE WHEN bill_status IN ('outstanding', 'overdue') THEN 1 ELSE 0 END) AS outstanding_bills
         FROM installed_customer_bills
         WHERE bill_month BETWEEN ? AND ?
         GROUP BY installed_customer_id
       ) b ON b.installed_customer_id = c.id
       WHERE c.install_date BETWEEN ? AND ?
         AND c.status = 'cancelled'
         AND c.cancelled_at IS NOT NULL
         AND c.cancelled_at >= c.install_date
         AND c.cancelled_at < DATE_ADD(c.install_date, INTERVAL ? MONTH)
       ORDER BY c.cancelled_at ASC, c.non_number ASC`,
      [cohortStartMonth, month, start, end, monthsBack]
    );

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
      allowed_cases: allowedCases,
      over_limit: Math.max(0, cases - allowedCases),
      outstanding_total: Number(billSummary?.outstanding_total) || 0,
      outstanding_bills: Number(billSummary?.outstanding_bills) || 0,
      detail,
    });
  } catch (err) {
    console.error('qc:', err);
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
        const packageName = String(row.package_name || '').trim() || existing?.package_name || '';
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
               status_changed_at = ?, ae_remark = ?, source_sheet = ?,
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
                status_changed_at, ae_remark, source_sheet, last_imported_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            fields
          );
          customerId = result.insertId;
          rowAction = 'inserted';
        }

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
               raw_value = VALUES(raw_value), imported_at = CURRENT_TIMESTAMP`,
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
      const package_name = String(row.package_name || row.package || '').trim();
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
        monthly_fee = await lookupPackageFee(db, package_name);
      }

      try {
        const [result] = await db.query(
          `INSERT INTO installed_customers
             (customer_name, non_number, package_name, monthly_fee, install_date, status)
           VALUES (?, ?, ?, ?, ?, 'active')
           ON DUPLICATE KEY UPDATE
             customer_name = IF(status = 'cancelled', customer_name, VALUES(customer_name)),
             package_name  = IF(status = 'cancelled', package_name, VALUES(package_name)),
             monthly_fee   = IF(status = 'cancelled', monthly_fee, VALUES(monthly_fee)),
             install_date  = IF(status = 'cancelled', install_date, VALUES(install_date)),
             updated_at    = CURRENT_TIMESTAMP`,
          [customer_name, non_number, package_name, monthly_fee, install_date]
        );
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

    const [result] = await db.query(
      `INSERT INTO installed_customers
         (customer_name, non_number, package_name, monthly_fee, install_date, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [customer_name, non_number, package_name, monthly_fee, install_date]
    );
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

    let monthly_fee = req.body.monthly_fee != null && req.body.monthly_fee !== ''
      ? parseFloat(req.body.monthly_fee)
      : Number(existing.monthly_fee);

    if (!customer_name) return res.status(400).json({ error: 'กรุณาระบุชื่อลูกค้า' });
    if (!non_number) return res.status(400).json({ error: 'กรุณาระบุเลข NON' });
    if (!package_name) return res.status(400).json({ error: 'กรุณาระบุแพ็กเกจ' });
    if (!install_date) return res.status(400).json({ error: 'กรุณาระบุวันติดตั้ง' });
    if (Number.isNaN(monthly_fee) || monthly_fee < 0) monthly_fee = 0;

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
       SET customer_name = ?, non_number = ?, package_name = ?, monthly_fee = ?, install_date = ?
       WHERE id = ?`,
      [customer_name, non_number, package_name, monthly_fee, install_date, id]
    );
    const [[row]] = await db.query('SELECT * FROM installed_customers WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'เลข NON นี้มีในทะเบียนแล้ว' });
    }
    console.error('installed update:', err);
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
