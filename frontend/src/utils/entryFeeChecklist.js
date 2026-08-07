import * as XLSX from 'xlsx';

export const CHECK_STATUS = Object.freeze({
  HAS: 'has',
  MISSING: 'missing',
  ONSITE: 'onsite',
});

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[_-]+/g, ' ');
}

function headerScore(header, keys) {
  const h = normalizeHeader(header);
  if (!h) return -1;
  for (const key of keys) {
    const k = normalizeHeader(key);
    if (h === k) return 100;
    if (h.includes(k) || k.includes(h)) return 80;
  }
  return -1;
}

function findColumnIndex(headers, keys) {
  let best = -1;
  let bestScore = -1;
  headers.forEach((header, idx) => {
    const score = headerScore(header, keys);
    if (score > bestScore) {
      bestScore = score;
      best = idx;
    }
  });
  return bestScore >= 0 ? best : -1;
}

function parseFeeNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatCellDate(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(value));
    const y = epoch.getUTCFullYear();
    const m = String(epoch.getUTCMonth() + 1).padStart(2, '0');
    const d = String(epoch.getUTCDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
}

const COLUMN_ALIASES = {
  appointmentDate: ['appointment date', 'appointment', 'วันนัด', 'วันที่นัด', 'วันที่นัดหมาย', 'plan date', 'plan arrival'],
  accessNumber: ['access number', 'access no', 'access_no', 'access', 'เลข access', 'accessnumber'],
  customerName: ['customer name', 'customer', 'name', 'ชื่อลูกค้า', 'ชื่อ'],
  entryFee: ['ค่าแรกเข้า', 'entry fee', 'entryfee', 'fee', 'ค่าเข้า'],
  teamName: ['ทีมช่าง', 'ทีม', 'team', 'ช่าง', 'technician team', 'tech team'],
  areaName: ['พื้นที่', 'area', 'area name', 'เขต', 'โซน', 'zone', 'province', 'จังหวัด', 'อำเภอ', 'ตำบล'],
};

/**
 * Parse Excel workbook binary / array buffer into checklist rows.
 * Keeps only rows where entry fee === 800.
 */
export function parseEntryFeeChecklistSheet(sheetRows) {
  if (!Array.isArray(sheetRows) || sheetRows.length < 2) {
    return { rows: [], skipped: 0, mappedColumns: null, error: 'ไม่พบหัวคอลัมน์หรือข้อมูลในไฟล์' };
  }

  const headers = sheetRows[0].map((h) => String(h ?? ''));
  const idxAppointment = findColumnIndex(headers, COLUMN_ALIASES.appointmentDate);
  const idxAccess = findColumnIndex(headers, COLUMN_ALIASES.accessNumber);
  const idxCustomer = findColumnIndex(headers, COLUMN_ALIASES.customerName);
  const idxFee = findColumnIndex(headers, COLUMN_ALIASES.entryFee);
  const idxTeam = findColumnIndex(headers, COLUMN_ALIASES.teamName);
  const idxArea = findColumnIndex(headers, COLUMN_ALIASES.areaName);

  if (idxAccess < 0 || idxFee < 0) {
    return {
      rows: [],
      skipped: 0,
      mappedColumns: { idxAppointment, idxAccess, idxCustomer, idxFee, idxTeam, idxArea, headers },
      error: 'ไม่พบคอลัมน์ Access Number หรือ ค่าแรกเข้า ในไฟล์',
    };
  }

  const rows = [];
  let skipped = 0;

  for (let i = 1; i < sheetRows.length; i++) {
    const raw = sheetRows[i] || [];
    if (!raw.some((c) => c != null && String(c).trim() !== '')) continue;

    const fee = parseFeeNumber(raw[idxFee]);
    if (fee !== 800) {
      skipped++;
      continue;
    }

    const accessNumber = String(raw[idxAccess] ?? '').trim();
    if (!accessNumber) {
      skipped++;
      continue;
    }

    rows.push({
      id: `${i}-${accessNumber}`,
      sourceRow: i + 1,
      appointmentDate: idxAppointment >= 0 ? formatCellDate(raw[idxAppointment]) : '',
      accessNumber,
      customerName: idxCustomer >= 0 ? String(raw[idxCustomer] ?? '').trim() : '',
      entryFee: 800,
      teamName: idxTeam >= 0 ? String(raw[idxTeam] ?? '').trim() : '',
      areaName: idxArea >= 0 ? String(raw[idxArea] ?? '').trim() : '',
      // null | 'has' | 'missing' | 'onsite'
      checkStatus: null,
    });
  }

  return {
    rows,
    skipped,
    mappedColumns: {
      appointmentDate: idxAppointment >= 0 ? headers[idxAppointment] : null,
      accessNumber: headers[idxAccess],
      customerName: idxCustomer >= 0 ? headers[idxCustomer] : null,
      entryFee: headers[idxFee],
      teamName: idxTeam >= 0 ? headers[idxTeam] : null,
      areaName: idxArea >= 0 ? headers[idxArea] : null,
    },
    error: null,
  };
}

/**
 * Read Excel file into workbook meta + sheet helpers.
 * Returns sheet names so the UI can let users pick a tab after upload.
 */
export async function readExcelWorkbook(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNames = Array.isArray(wb.SheetNames) ? wb.SheetNames.filter(Boolean) : [];
  return {
    fileName: file.name || 'workbook.xlsx',
    sheetNames,
    getSheetRows(sheetName) {
      const name = sheetName || sheetNames[0];
      if (!name || !wb.Sheets[name]) {
        throw new Error('ไม่พบแท็บที่เลือกในไฟล์');
      }
      return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true });
    },
  };
}

/** @deprecated Prefer readExcelWorkbook + sheet picker */
export async function readExcelToAoA(file, sheetName) {
  const workbook = await readExcelWorkbook(file);
  return workbook.getSheetRows(sheetName);
}

/**
 * Export checklist rows with trailing columns: มี | ไม่มี | หน้างาน
 */
export function exportEntryFeeChecklist(rows, filename) {
  const data = (rows || []).map((row) => ({
    'Appointment Date': row.appointmentDate || '',
    'Access Number': row.accessNumber || '',
    'Customer Name': row.customerName || '',
    'ค่าแรกเข้า': row.entryFee ?? 800,
    'ทีมช่าง': row.teamName || '',
    'พื้นที่': row.areaName || '',
    มี: row.checkStatus === CHECK_STATUS.HAS ? '✓' : '',
    ไม่มี: row.checkStatus === CHECK_STATUS.MISSING ? '✓' : '',
    หน้างาน: row.checkStatus === CHECK_STATUS.ONSITE ? '✓' : '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ตรวจค่าแรกเข้า');
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, filename || `entry_fee_checklist_${stamp}.xlsx`);
}
