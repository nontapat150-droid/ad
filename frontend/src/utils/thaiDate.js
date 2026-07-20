/**
 * Thai Buddhist Era date formatting utilities
 * ─────────────────────────────────────────────────────
 * All functions convert Gregorian dates → Thai Buddhist Era (BE = CE + 543)
 * and display month names in Thai.
 *
 * DISPLAY only — data sent to backend remains in Gregorian ISO format.
 */

const THAI_MONTHS_LONG = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.',
  'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.',
  'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const THAI_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const THAI_WEEKDAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

/**
 * Parse a date value safely.
 * Accepts Date object, ISO string, or timestamp.
 */
function parseDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Format: "6 มิถุนายน 2569"
 */
export function thaiDate(value) {
  const d = parseDate(value);
  if (!d) return '-';
  const day = d.getDate();
  const month = THAI_MONTHS_LONG[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

/**
 * Format: "6 มิ.ย. 69" (short)
 */
export function thaiDateShort(value) {
  const d = parseDate(value);
  if (!d) return '-';
  const day = d.getDate();
  const month = THAI_MONTHS_SHORT[d.getMonth()];
  const year = (d.getFullYear() + 543).toString().slice(-2);
  return `${day} ${month} ${year}`;
}

/**
 * Format: "6 มิถุนายน 2569 เวลา 14:30 น."
 */
export function thaiDateTime(value) {
  const d = parseDate(value);
  if (!d) return '-';
  const datePart = thaiDate(d);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} เวลา ${h}:${m} น.`;
}

/**
 * Format: "จันทร์ที่ 6 มิถุนายน 2569"
 */
export function thaiDateWithWeekday(value) {
  const d = parseDate(value);
  if (!d) return '-';
  const weekday = THAI_WEEKDAYS[d.getDay()];
  const day = d.getDate();
  const month = THAI_MONTHS_LONG[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${weekday}ที่ ${day} ${month} ${year}`;
}

/**
 * Format: "6 มิ.ย. 2569 14:30 น." (compact with time)
 */
export function thaiDateTimeShort(value) {
  const d = parseDate(value);
  if (!d) return '-';
  const day = d.getDate();
  const month = THAI_MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear() + 543;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${h}:${m} น.`;
}

const BANGKOK_TZ = 'Asia/Bangkok';

/**
 * Format a Date as HH:MM in Asia/Bangkok.
 */
function bangkokHHMM(date) {
  if (!date || isNaN(date.getTime())) return null;
  const formatted = date.toLocaleTimeString('en-GB', {
    timeZone: BANGKOK_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // en-GB → "12:00" (midnight may be "24:00" in some engines)
  const m = String(formatted).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  if (h === 24) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/**
 * Extract HH:MM from TIME ("12:00:00"), ISO datetime, or Date.
 * - Pure TIME strings are treated as already Thai wall-clock.
 * - Datetimes / Date objects are shown in Asia/Bangkok.
 * Returns null if unparseable.
 */
export function extractHHMM(value) {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return bangkokHHMM(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Pure time: "12:00", "12:00:00", "12:00:00.000" — wall clock as entered (Thai)
  const timeOnly = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (timeOnly) {
    return `${timeOnly[1].padStart(2, '0')}:${timeOnly[2]}`;
  }

  // Has explicit UTC/offset → convert to Bangkok
  if (/Z$/i.test(raw) || /[+-]\d{2}:?\d{2}$/.test(raw)) {
    return bangkokHHMM(parseDate(raw));
  }

  // ISO / SQL datetime without TZ (often MySQL DATETIME intended as Thai wall clock)
  // Prefer parsing then Bangkok format so browser TZ does not shift the clock.
  const d = parseDate(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  if (d) {
    // If string had no TZ, engines treat as local — force interpret as Bangkok wall clock:
    // extract digits when no Z was present (already handled above for Z).
    const fromDateTime = raw.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (fromDateTime) {
      return `${fromDateTime[1].padStart(2, '0')}:${fromDateTime[2]}`;
    }
    return bangkokHHMM(d);
  }

  return null;
}

/**
 * Format time only in Thai style: "14:30 น."
 * Accepts TIME strings, ISO datetimes, or Date objects (Asia/Bangkok).
 */
export function thaiTime(value) {
  const hhmm = extractHHMM(value);
  if (!hhmm) return '-';
  return `${hhmm} น.`;
}

/**
 * Format month + year only: "มิถุนายน 2569"
 */
export function thaiMonthYear(value) {
  const d = parseDate(value);
  if (!d) return '-';
  const month = THAI_MONTHS_LONG[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${month} ${year}`;
}

/**
 * Relative time: "5 นาทีที่แล้ว" / "6 มิถุนายน 2569" if older
 */
export function thaiTimeAgo(value) {
  const d = parseDate(value);
  if (!d) return '-';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)} วินาทีที่แล้ว`;
  if (diff < 3600)  return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  if (diff < 86400 * 3) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
  return thaiDate(d);
}

export default {
  thaiDate,
  thaiDateShort,
  thaiDateTime,
  thaiDateWithWeekday,
  thaiDateTimeShort,
  extractHHMM,
  thaiTime,
  thaiMonthYear,
  thaiTimeAgo,
};
