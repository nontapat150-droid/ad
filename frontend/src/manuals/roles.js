/** Role keys used for manuals (normalized) */
export const ROLE_LABELS = {
  super_admin: 'ผู้ดูแลระบบ',
  admin: 'แอดมิน',
  office_tech: 'ช่างติดตั้ง',
  ma_tech: 'ช่าง MA',
  sales: 'เซล',
  guest: 'ทั่วไป',
};

const OFFICE_ROLES = ['technician', 'office_technician', 'contractor_office'];
const MA_ROLES = ['ma_technician', 'contractor_ma'];

/**
 * Resolve which manual role tabs to show for a user.
 * Priority: super_admin > admin > office+ma (both tabs) > ma > office > sales > guest
 */
export function resolveManualRoleTabs(userRoles = []) {
  const roles = Array.isArray(userRoles) ? userRoles.filter(Boolean) : [];
  if (roles.length === 0) return ['guest'];

  if (roles.includes('super_admin')) return ['super_admin'];
  if (roles.includes('admin')) return ['admin'];

  const hasOffice = roles.some((r) => OFFICE_ROLES.includes(r));
  const hasMa = roles.some((r) => MA_ROLES.includes(r));
  const hasSales = roles.includes('sales');

  const tabs = [];
  if (hasOffice) tabs.push('office_tech');
  if (hasMa) tabs.push('ma_tech');
  if (hasSales && tabs.length === 0) tabs.push('sales');
  if (hasSales && tabs.length > 0) tabs.push('sales');

  return tabs.length ? tabs : ['guest'];
}

/** Map Layout activeKey / route aliases → manual pageKey */
export const PAGE_KEY_ALIASES = {
  home: 'dashboard',
  home_ma: 'dashboard',
  jobs: 'dispatch',
  bag: 'techbag',
  entry_fee: 'entry_fee',
  oil: 'oil',
  oil_history: 'oil_history',
  checkin: 'checkin',
  ais_expansion: 'ais_expansion',
  report: 'report',
  customers: 'customers',
  inventory: 'inventory',
  contractor_inventory: 'contractor_inventory',
  users: 'users',
  announcements: 'announcements',
  settings: 'settings',
  ma_performance: 'ma_performance',
  attendance_summary: 'attendance_summary',
  login: 'login',
  dashboard: 'dashboard',
  dispatch: 'dispatch',
  techbag: 'techbag',
};

export function normalizePageKey(pageName) {
  if (!pageName) return 'dashboard';
  return PAGE_KEY_ALIASES[pageName] || pageName;
}

export const PAGE_TITLES = {
  login: 'เข้าสู่ระบบ / ลงทะเบียน',
  dashboard: 'หน้าภาพรวมระบบ',
  dispatch: 'ระบบแจกจ่ายงาน',
  techbag: 'กระเป๋าช่าง',
  checkin: 'ลงเวลาเข้างาน',
  oil: 'เติมน้ำมัน',
  oil_history: 'ประวัติเติมน้ำมันทีม',
  entry_fee: 'ค่าแรกเข้า',
  ais_expansion: 'งานขยาย AIS',
  report: 'แจ้งปัญหา',
  customers: 'ข้อมูลลูกค้า',
  inventory: 'ระบบคลัง',
  contractor_inventory: 'สรุปอุปกรณ์รับเหมา',
  users: 'จัดการผู้ใช้',
  announcements: 'ระบบประกาศ',
  settings: 'ตั้งค่าระบบ',
  ma_performance: 'สรุปผล MA',
  attendance_summary: 'สรุปการเข้างาน',
};
