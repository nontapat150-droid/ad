const { getFraudChurnSettings } = require('./fraudChurnSettings');
const {
  aisDueDayFromInstallDate,
  calculateFirstDueDate,
  billingMonthsFromQcSettings,
  syncAutoBillingSchedule,
} = require('./billingSchedule');

/**
 * Lookup monthly fee from package_prices (case-insensitive trim match).
 */
async function lookupPackageFee(conn, packageName) {
  const name = String(packageName || '').trim();
  if (!name) return 0;
  try {
    const [[row]] = await conn.query(
      `SELECT monthly_fee FROM package_prices
       WHERE is_active = 1 AND LOWER(TRIM(package_name)) = LOWER(?)
       LIMIT 1`,
      [name]
    );
    return row ? Number(row.monthly_fee) || 0 : 0;
  } catch (e) {
    // table may not exist yet
    return 0;
  }
}

async function ensureInstalledSalesColumns(conn) {
  const columns = [
    ['seller_name', 'VARCHAR(100) NULL'],
    ['source_sales_user_id', 'INT NULL'],
    ['source_expansion_id', 'INT NULL'],
  ];
  for (const [column, definition] of columns) {
    const [[row]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'installed_customers' AND COLUMN_NAME = ?`,
      [column]
    );
    if (!Number(row?.cnt)) {
      try {
        await conn.query(`ALTER TABLE installed_customers ADD COLUMN \`${column}\` ${definition}`);
      } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME') throw err;
      }
    }
  }
}

/**
 * Sync completed install job → installed_customers registry (keyed by NON/access_no).
 * Does not overwrite cancellation if already cancelled.
 */
async function syncInstalledFromJob(conn, jobId) {
  const [[job]] = await conn.query('SELECT * FROM jobs WHERE id = ? LIMIT 1', [jobId]);
  if (!job || job.status !== 'completed') return;

  await ensureInstalledSalesColumns(conn);

  const nonNumber = String(job.access_no || job.non_number || '').trim();
  if (!nonNumber) return;

  const packageName = String(job.package || '').trim() || '-';
  const monthlyFee = await lookupPackageFee(conn, packageName);
  let sellerName = String(job.source_sales_name || '').trim() || null;
  if (!sellerName && job.source_sales_user_id) {
    const [[salesUser]] = await conn.query('SELECT full_name FROM users WHERE id = ? LIMIT 1', [job.source_sales_user_id]);
    sellerName = salesUser?.full_name || null;
  }
  const installDateSrc = job.completed_at || job.finish_time || new Date();
  let installDate;
  if (typeof installDateSrc === 'string' && /^\d{4}-\d{2}-\d{2}/.test(installDateSrc)) {
    installDate = installDateSrc.slice(0, 10);
  } else {
    const d = installDateSrc instanceof Date ? installDateSrc : new Date(installDateSrc);
    if (Number.isNaN(d.getTime())) {
      const now = new Date();
      installDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    } else {
      installDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }

  try {
    await conn.query(
      `INSERT INTO installed_customers (
         customer_name, non_number, package_name, monthly_fee,
         install_date, job_id, status, seller_name,
         source_sales_user_id, source_expansion_id
       ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         customer_name = IF(status = 'cancelled', customer_name, VALUES(customer_name)),
         package_name  = IF(status = 'cancelled', package_name, VALUES(package_name)),
         monthly_fee   = IF(status = 'cancelled', monthly_fee,
           IF(VALUES(monthly_fee) > 0, VALUES(monthly_fee), monthly_fee)),
         install_date  = IF(status = 'cancelled', install_date, COALESCE(install_date, VALUES(install_date))),
         job_id        = COALESCE(VALUES(job_id), job_id),
         seller_name   = IF(status = 'cancelled', seller_name, COALESCE(VALUES(seller_name), seller_name)),
         source_sales_user_id = COALESCE(VALUES(source_sales_user_id), source_sales_user_id),
         source_expansion_id = COALESCE(VALUES(source_expansion_id), source_expansion_id),
         updated_at    = CURRENT_TIMESTAMP`,
      [
        job.customer || nonNumber,
        nonNumber,
        packageName,
        monthlyFee,
        installDate,
        job.id,
        sellerName,
        job.source_sales_user_id || null,
        job.source_expansion_id || null,
      ]
    );
    const [[installedCustomer]] = await conn.query(
      `SELECT id, install_date, monthly_fee, payment_due_day, payment_due_source
       FROM installed_customers WHERE non_number = ? LIMIT 1`,
      [nonNumber]
    );
    if (installedCustomer) {
      const storedInstallDate = installedCustomer.install_date instanceof Date
        ? installedCustomer.install_date.toISOString().slice(0, 10)
        : String(installedCustomer.install_date).slice(0, 10);
      const dueDay = installedCustomer.payment_due_source !== 'manual'
        ? aisDueDayFromInstallDate(storedInstallDate)
        : Number(installedCustomer.payment_due_day);
      const firstDueDate = calculateFirstDueDate(storedInstallDate, dueDay);
      await conn.query(
        `UPDATE installed_customers
         SET payment_due_day = ?, first_due_date = ?,
             payment_due_source = IF(payment_due_source = 'manual', 'manual', 'auto')
         WHERE id = ?`,
        [dueDay, firstDueDate, installedCustomer.id]
      );
      let months = 8;
      try {
        months = billingMonthsFromQcSettings(await getFraudChurnSettings(conn));
      } catch { /* keep default */ }
      await syncAutoBillingSchedule(conn, installedCustomer.id, {
        installDate: storedInstallDate,
        monthlyFee: Number(installedCustomer.monthly_fee) || monthlyFee,
        months,
        dueDay,
        vatRate: 7,
      });
    }
  } catch (e) {
    if (e.message && (e.message.includes("doesn't exist") || e.code === 'ER_BAD_FIELD_ERROR')) {
      console.warn('installed_customers sync skipped (run migrate-fix):', e.message);
      return;
    }
    throw e;
  }
}

/**
 * Sync jobs row → customers master (keyed by access_no)
 */
async function syncCustomerFromJob(conn, jobId) {
  const [[job]] = await conn.query('SELECT * FROM jobs WHERE id = ? LIMIT 1', [jobId]);
  if (!job || !job.access_no) return;

  // Check for latest entry fee for this access_no
  let entryFeeStatus = null;
  let entryFeeDate = null;
  try {
    const [[latestFee]] = await conn.query(
      'SELECT fee_type, created_at FROM entry_fees WHERE access_no = ? ORDER BY id DESC LIMIT 1',
      [job.access_no]
    );
    if (latestFee) {
      entryFeeStatus = latestFee.fee_type;
      entryFeeDate = latestFee.created_at;
    }
  } catch (e) { /* entry_fees table might not have fee_type column yet */ }

  await conn.query(
    `INSERT INTO customers (
      access_no, customer_name, phone, address, province, area_code, area_name,
      lat, lng, map_link, package, product, order_no, customer_order_no,
      task_type, task_order, product_owner, order_type, service_note, sla_status, region,
      latest_job_id, latest_job_status, install_device, last_completed_at, completed_by,
      entry_fee_status, entry_fee_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      customer_name = VALUES(customer_name),
      phone = VALUES(phone),
      address = VALUES(address),
      province = VALUES(province),
      area_code = VALUES(area_code),
      area_name = VALUES(area_name),
      lat = VALUES(lat),
      lng = VALUES(lng),
      map_link = VALUES(map_link),
      package = VALUES(package),
      product = VALUES(product),
      order_no = VALUES(order_no),
      customer_order_no = VALUES(customer_order_no),
      task_type = VALUES(task_type),
      task_order = VALUES(task_order),
      product_owner = VALUES(product_owner),
      order_type = VALUES(order_type),
      service_note = VALUES(service_note),
      sla_status = VALUES(sla_status),
      region = VALUES(region),
      latest_job_id = VALUES(latest_job_id),
      latest_job_status = VALUES(latest_job_status),
      install_device = COALESCE(VALUES(install_device), install_device),
      last_completed_at = COALESCE(VALUES(last_completed_at), last_completed_at),
      completed_by = COALESCE(VALUES(completed_by), completed_by),
      entry_fee_status = COALESCE(VALUES(entry_fee_status), entry_fee_status),
      entry_fee_date = COALESCE(VALUES(entry_fee_date), entry_fee_date),
      updated_at = CURRENT_TIMESTAMP`,
    [
      job.access_no,
      job.customer || null,
      job.phone || null,
      job.address || null,
      job.province || null,
      job.area_code || null,
      job.area_name || null,
      job.lat || null,
      job.lng || null,
      job.map_link || null,
      job.package || null,
      job.product || null,
      job.order_no || null,
      job.customer_order_no || null,
      job.task_type || null,
      job.task_order || null,
      job.product_owner || null,
      job.order_type || null,
      job.service_note || null,
      job.sla_status || null,
      job.region || null,
      job.id,
      job.status || null,
      job.install_device || null,
      job.status === 'completed' ? (job.completed_at || job.finish_time || new Date()) : null,
      job.completed_by || null,
      entryFeeStatus,
      entryFeeDate,
    ]
  );
}

/**
 * Sync ma_jobs → ma_customers (keyed by non_number) + history
 */
async function syncMaCustomerFromJob(conn, maJobId, { action = 'imported', techId = null } = {}) {
  const [[job]] = await conn.query('SELECT * FROM ma_jobs WHERE id = ? LIMIT 1', [maJobId]);
  if (!job) return null;

  const nonNumber = job.non_number || job.access_no;
  if (!nonNumber) return null;

  await conn.query(
    `INSERT INTO ma_customers (non_number, customer_name, phone, address)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       customer_name = COALESCE(VALUES(customer_name), customer_name),
       phone = COALESCE(VALUES(phone), phone),
       address = COALESCE(VALUES(address), address),
       updated_at = CURRENT_TIMESTAMP`,
    [nonNumber, job.customer || null, job.phone || null, job.address || null]
  );

  const [[customer]] = await conn.query(
    'SELECT id FROM ma_customers WHERE non_number = ? LIMIT 1',
    [nonNumber]
  );
  if (!customer) return null;

  const historyRemarkParts = [];
  if (job.srt) historyRemarkParts.push(`SRT:${job.srt}`);
  if (job.spt) historyRemarkParts.push(`SPT:${job.spt}`);
  if (job.fail_cause) historyRemarkParts.push(`สาเหตุ:${job.fail_cause}`);
  if (job.fix_method) historyRemarkParts.push(`แก้ไข:${job.fix_method}`);
  if (job.used_equipment) historyRemarkParts.push(`อุปกรณ์:${job.used_equipment}`);
  if (job.old_sn) historyRemarkParts.push(`SNเก่า:${job.old_sn}`);
  if (job.new_sn) historyRemarkParts.push(`SNใหม่:${job.new_sn}`);
  if (job.cable_used) historyRemarkParts.push(`สาย:${job.cable_used}`);
  if (job.remark) historyRemarkParts.push(job.remark);

  await conn.query(
    `INSERT INTO ma_customer_history
       (customer_id, ma_job_id, non_number, action, symptoms, area_provider, remark, tech_id, team_id, action_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customer.id,
      maJobId,
      nonNumber,
      action,
      job.symptoms || null,
      job.area_name || job.area_provider || null,
      historyRemarkParts.join(' | ') || job.remark || null,
      techId || job.completed_by || null,
      job.team_id || null,
      job.plan_arrival_date || (job.completed_at ? new Date(job.completed_at) : new Date()),
    ]
  );

  return customer.id;
}

module.exports = {
  syncCustomerFromJob,
  syncMaCustomerFromJob,
  syncInstalledFromJob,
  lookupPackageFee,
};
