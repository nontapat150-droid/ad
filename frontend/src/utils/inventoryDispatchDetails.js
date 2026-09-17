const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function formatDispatchDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'ไม่ระบุวันที่';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return 'ไม่ระบุวันที่';
  return `${day} ${months[month - 1]} ${year + 543}`;
}

// An older backend ignores details=1 and returns summary rows. Never render those as dispatches.
export function parseDispatchDetails(data) {
  if (!Array.isArray(data) || data.some(record => !record || record.id == null ||
    !Object.hasOwn(record, 'dispatch_date') || !Object.hasOwn(record, 'dispatch_time') ||
    record.quantity == null || !Number.isFinite(Number(record.quantity)))) {
    throw new Error('เซิร์ฟเวอร์ยังไม่พร้อมแสดงรายละเอียด กรุณารอสักครู่แล้วกดลองใหม่');
  }
  return data.map(record => ({ ...record, quantity: Number(record.quantity) }));
}
