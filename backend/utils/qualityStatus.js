// Keep the service lifecycle separate from the legacy active/cancelled registry flag.
function bangkokToday(now = new Date()) {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dateOnly(value) {
  if (value instanceof Date) return bangkokToday(value);
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text ? text : null;
}

function normalizeServiceStatus(value) {
  const text = String(value || '').trim().toLowerCase();
  if (/^(terminate(?:d)?|disconnect(?:ed)?|cancel(?:led|ed)?)(\b|\s|[-_:])|ยกเลิก|ตัดบริการ/.test(text)) return 'terminate';
  if (/^(suspend(?:ed)?)(\b|\s|[-_:])|ระงับ/.test(text)) return 'suspend';
  if (/^active(?:\b|\s|[-_:])|^เปิดใช้งาน$|^ใช้งานปกติ$/.test(text)) return 'active';
  return 'unknown';
}

function serviceStatus(customer, today = bangkokToday()) {
  const source = normalizeServiceStatus(customer.qc_status);
  const changedAt = dateOnly(customer.status_changed_at);
  const cancelledAt = dateOnly(customer.cancelled_at);
  const newerSource = source !== 'unknown' && changedAt && cancelledAt && changedAt > cancelledAt;
  const status = customer.status === 'cancelled' && !newerSource ? 'terminate'
    : source !== 'unknown' ? source : customer.qc_status ? 'unknown' : 'active';
  const effectiveDate = status === 'terminate'
    ? [cancelledAt, changedAt].filter(Boolean).sort().at(-1) || null : changedAt;
  const installDate = dateOnly(customer.install_date);
  const issue = !effectiveDate ? 'ยังไม่มีวันที่เปลี่ยนสถานะจริง'
    : effectiveDate > today ? 'วันที่เปลี่ยนสถานะอยู่ในอนาคต'
    : installDate && effectiveDate < installDate ? 'วันที่เปลี่ยนสถานะอยู่ก่อนวันติดตั้ง' : null;
  const actualStatus = effectiveDate && (effectiveDate > today || installDate && effectiveDate < installDate) ? 'unknown' : status;
  return {
    service_status: actualStatus,
    recorded_service_status: status,
    service_status_label: { active: 'Active · ใช้งานปกติ', suspend: 'Suspend · ระงับชั่วคราว', terminate: 'Terminate · ยกเลิกบริการ', unknown: 'รอตรวจสอบสถานะ' }[actualStatus],
    service_status_date: effectiveDate,
    service_status_issue: issue,
  };
}

function validateStatusDate(value, installDate, today = bangkokToday()) {
  const date = dateOnly(value);
  if (!date) return 'กรุณาระบุวันที่เปลี่ยนสถานะจริงให้ถูกต้อง';
  if (date < dateOnly(installDate)) return 'วันที่เปลี่ยนสถานะต้องไม่อยู่ก่อนวันติดตั้ง';
  if (date > today) return 'วันที่เปลี่ยนสถานะจริงต้องไม่เป็นวันในอนาคต';
  return null;
}

function resolveImportStatus(row, existing, installDate) {
  const incoming = String(row.qc_status || '').trim();
  const incomingDate = dateOnly(row.status_changed_at);
  const previous = existing ? serviceStatus(existing) : null;
  // A check/observation date is not proof of when a service actually changed.
  if (row.status_changed_at) {
    const error = validateStatusDate(row.status_changed_at, installDate);
    if (error) throw new Error(error);
  }
  if (incoming && existing && previous.service_status_date && (
    !incomingDate || incomingDate < previous.service_status_date
  )) {
    return { qcStatus: existing.qc_status, status: existing.status, statusChangedAt: dateOnly(existing.status_changed_at), cancelledAt: dateOnly(existing.cancelled_at), cancelReason: existing.cancel_reason };
  }
  const qcStatus = incoming || existing?.qc_status || null;
  const normalized = normalizeServiceStatus(qcStatus);
  const changed = incoming && normalized !== previous?.service_status;
  const statusChangedAt = incomingDate || (changed ? null : dateOnly(existing?.status_changed_at));
  const status = normalized === 'terminate' ? 'cancelled'
    : ['active', 'suspend'].includes(normalized) ? 'active' : existing?.status || 'active';
  const cancelledAt = status === 'cancelled' ? statusChangedAt || (!changed ? dateOnly(existing?.cancelled_at) : null) : null;
  return { qcStatus, status, statusChangedAt, cancelledAt, cancelReason: status === 'cancelled' ? qcStatus : null };
}

function qualityOutcome(customer, months, today = bangkokToday()) {
  const state = serviceStatus(customer, today);
  if (state.service_status === 'unknown' || (state.service_status === 'terminate' && state.service_status_issue)) {
    return { is_case: false, cm_status: 'incomplete', cm_reason: state.service_status_issue || 'ยังไม่ยืนยันสถานะลูกค้า' };
  }
  if (state.service_status !== 'terminate') return { is_case: false, cm_status: 'not_case', cm_reason: 'ยังไม่ยกเลิกบริการ' };
  const install = dateOnly(customer.install_date);
  if (!install) return { is_case: false, cm_status: 'incomplete', cm_reason: 'ยังไม่มีวันติดตั้งจริง' };
  const [year, month, day] = install.split('-').map(Number);
  const cutoff = new Date(Date.UTC(year, month - 1 + months, 1));
  cutoff.setUTCDate(Math.min(day, new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate()));
  const isCase = state.service_status_date < cutoff.toISOString().slice(0, 10);
  return { is_case: isCase, cm_status: isCase ? 'case' : 'not_case', cm_reason: isCase ? `ยกเลิกภายใน ${months} เดือนหลังติดตั้ง` : `ยกเลิกหลังพ้นเกณฑ์ ${months} เดือน` };
}

module.exports = { bangkokToday, dateOnly, normalizeServiceStatus, serviceStatus, validateStatusDate, resolveImportStatus, qualityOutcome };
