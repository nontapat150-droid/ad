/** Thai labels + navigation helpers for system notifications. */

const TYPE_LABELS = {
  job_assigned: 'งานใหม่',
  ma_job_assigned: 'งาน MA',
  job_unassigned: 'ย้ายงานออก',
  ma_job_unassigned: 'ย้าย MA ออก',
  job_completed: 'ปิดงาน',
  ma_job_completed: 'ปิดงาน MA',
  job_failed: 'งานไม่จบ',
  ma_job_failed: 'งาน MA ไม่จบ',
  job_postponed: 'เลื่อนนัด',
  ma_job_postponed: 'เลื่อน MA',
  job_import: 'Import งาน',
  ma_import: 'Import MA',
  inventory_dispatched: 'เบิกของ',
  inventory_transferred: 'โอนอุปกรณ์',
  leave_requested: 'แจ้งลา',
  user_approved: 'อนุมัติบัญชี',
  user_registered: 'สมัครสมาชิก',
  system: 'ระบบ',
};

export function notificationTypeLabel(type) {
  return TYPE_LABELS[type] || type || 'แจ้งเตือน';
}

export function resolveNotificationPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (!trimmed.startsWith('/')) return null;
  if (trimmed === '/dispatch' || trimmed.startsWith('/dispatch?')) {
    return trimmed.replace(/^\/dispatch/, '/dispatch-dashboard');
  }
  if (trimmed === '/') return '/dashboard';
  return trimmed;
}

export function notificationHasLink(n) {
  return Boolean(resolveNotificationPath(n?.data?.path));
}

export function notificationLinkHint(n) {
  const path = resolveNotificationPath(n?.data?.path);
  if (!path) return null;
  if (path.startsWith('/dispatch-dashboard')) return 'เปิดงาน';
  if (path.startsWith('/bag')) return 'เปิดกระเป๋า';
  if (path.startsWith('/checkin')) return 'เปิดเช็คอิน';
  if (path.startsWith('/users')) return 'เปิดจัดการผู้ใช้';
  if (path.startsWith('/dashboard')) return 'เปิดหน้าหลัก';
  return 'เปิด';
}
