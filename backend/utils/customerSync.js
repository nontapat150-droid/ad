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

module.exports = { syncCustomerFromJob, syncMaCustomerFromJob };
