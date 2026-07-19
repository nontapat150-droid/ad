/** Shared job status labels + badge colors (office + MA) */

export const JOB_STATUS = {
  pending: {
    label: 'รอดำเนินการ',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    text: 'text-amber-600',
    bg: 'bg-amber-100',
    border: 'border-amber-200',
    dot: 'bg-amber-400',
    map: '#f59e0b',
  },
  in_progress: {
    label: 'กำลังดำเนินการ',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    text: 'text-blue-700',
    bg: 'bg-blue-100',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    map: '#3b82f6',
  },
  completed: {
    label: 'สำเร็จ',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    text: 'text-emerald-600',
    bg: 'bg-emerald-100',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    map: '#10b981',
  },
  failed: {
    label: 'ไม่สำเร็จ',
    badge: 'bg-red-100 text-red-700 border-red-200',
    text: 'text-red-600',
    bg: 'bg-red-100',
    border: 'border-red-200',
    dot: 'bg-red-500',
    map: '#ef4444',
  },
  postponed: {
    label: 'เลื่อนนัด',
    badge: 'bg-purple-100 text-purple-700 border-purple-200',
    text: 'text-purple-600',
    bg: 'bg-purple-100',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
    map: '#a855f7',
  },
  overdue: {
    label: 'เลยกำหนด',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    text: 'text-orange-600',
    bg: 'bg-orange-100',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    map: '#f97316',
  },
};

/** Active jobs still on the board (DB never uses assigned/paused — kept for safety) */
export const ACTIVE_JOB_STATUSES = ['pending', 'assigned', 'in_progress', 'paused'];

export function getJobStatusMeta(status) {
  return JOB_STATUS[status] || JOB_STATUS.pending;
}

export function getJobStatusLabel(status) {
  return getJobStatusMeta(status).label;
}

export function getJobStatusBadgeClass(status) {
  return getJobStatusMeta(status).badge;
}

export function getJobStatusDotClass(status) {
  return getJobStatusMeta(status).dot;
}

/** MA complete form quick presets */
export const MA_FAIL_CAUSE_PRESETS = [
  'ONU Offline',
  'สายขาด / สายชำรุด',
  'สัญญาณอ่อน',
  'Playbox มีปัญหา',
  'ลูกค้าแจ้ง Internet ช้า',
  'ไฟตก / ไม่มีไฟ',
];

export const MA_FIX_METHOD_PRESETS = [
  'เปลี่ยน ONU',
  'เชื่อมสายใหม่',
  'รีเซ็ตอุปกรณ์',
  'เปลี่ยน Playbox',
  'เช็ค/ปรับ Splitter',
  'ซ่อมจุดเชื่อมต่อ',
];

export const CABLE_PRESETS = ['ใช้สายเดิม', '20M', '50M', '100M'];

export const INCOMPLETE_REASON_PRESETS = [
  'ลูกค้าไม่อยู่',
  'ลูกค้าขอเลื่อน',
  'สัญญาณไม่พอ',
  'อุปกรณ์ไม่ครบ',
  'เข้าพื้นที่ไม่ได้',
  'รออนุมัติ / รอทีม',
];
