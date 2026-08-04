import * as XLSX from 'xlsx';

const THAI_MONTHS = [
  ['มกราคม', 'มค', 1], ['กุมภาพันธ์', 'กพ', 2], ['มีนาคม', 'มีค', 3],
  ['เมษายน', 'เมย', 4], ['พฤษภาคม', 'พค', 5], ['มิถุนายน', 'มิย', 6],
  ['กรกฎาคม', 'กค', 7], ['สิงหาคม', 'สค', 8], ['กันยายน', 'กย', 9],
  ['ตุลาคม', 'ตค', 10], ['พฤศจิกายน', 'พย', 11], ['ธันวาคม', 'ธค', 12],
];

const ENGLISH_MONTHS = [
  ['january', 'jan', 1], ['february', 'feb', 2], ['march', 'mar', 3],
  ['april', 'apr', 4], ['may', 'may', 5], ['june', 'jun', 6],
  ['july', 'jul', 7], ['august', 'aug', 8], ['september', 'sep', 9],
  ['october', 'oct', 10], ['november', 'nov', 11], ['december', 'dec', 12],
];

export function normalizeQcHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s._/\\()-]+/g, '')
    .replace(/[^a-z0-9ก-๙]/gu, '');
}

function cellAt(sheet, row, column) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: column })];
}

function cellDisplay(sheet, row, column) {
  const cell = cellAt(sheet, row, column);
  if (!cell) return '';
  return cell.w != null && cell.w !== '' ? cell.w : (cell.v ?? '');
}

function cellValue(sheet, row, column) {
  return cellAt(sheet, row, column)?.v ?? '';
}

function normalizeYear(year) {
  const value = Number(year);
  if (!Number.isFinite(value)) return null;
  if (value > 2400) return value - 543;
  if (value < 100) return value >= 50 ? value + 1957 : value + 2000;
  return value;
}

export function parseExcelDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // SheetJS represents Excel's date-only cells at local midnight. Shifting to
    // the middle of the day prevents a timezone conversion from moving the date back.
    const safeDate = new Date(value.getTime() + (12 * 60 * 60 * 1000));
    return `${safeDate.getUTCFullYear()}-${String(safeDate.getUTCMonth() + 1).padStart(2, '0')}-${String(safeDate.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const year = normalizeYear(iso[1]);
    return `${year}-${String(Number(iso[2])).padStart(2, '0')}-${String(Number(iso[3])).padStart(2, '0')}`;
  }
  const dmy = text.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!dmy) return null;
  const year = normalizeYear(dmy[3]);
  return `${year}-${String(Number(dmy[2])).padStart(2, '0')}-${String(Number(dmy[1])).padStart(2, '0')}`;
}

function parseMonthHeader(value, previousYm = null) {
  const original = String(value ?? '').trim();
  if (!original) return null;
  const compact = original.toLowerCase().replace(/[\s.]/g, '');
  const monthItem = [...THAI_MONTHS, ...ENGLISH_MONTHS]
    .find(([full, short]) => compact.includes(full) || compact.includes(short));
  if (!monthItem) return null;

  const month = monthItem[2];
  const yearMatches = original.match(/\d{2,4}/g);
  let year = yearMatches?.length ? normalizeYear(yearMatches[yearMatches.length - 1]) : null;
  if (!year && previousYm) {
    const [previousYear, previousMonth] = previousYm.split('-').map(Number);
    year = month < previousMonth ? previousYear + 1 : previousYear;
  }
  if (!year) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function findHeaderRow(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const lastRow = Math.min(range.e.r, 30);
  let best = { row: -1, score: 0 };
  for (let row = range.s.r; row <= lastRow; row++) {
    const headers = [];
    for (let column = range.s.c; column <= range.e.c; column++) {
      headers.push(normalizeQcHeader(cellDisplay(sheet, row, column)));
    }
    let score = 0;
    if (headers.some((h) => h.includes('accessnumber') || h === 'non' || h.includes('เลขnon'))) score += 5;
    if (headers.some((h) => h.includes('customername') || h === 'ชื่อลูกค้า')) score += 3;
    if (headers.some((h) => h.includes('แพคเกจ') || h.includes('แพ็กเกจ') || h.includes('package'))) score += 3;
    if (headers.some((h) => h.includes('registerdate') || h.includes('วันติดตั้ง'))) score += 2;
    if (headers.some((h) => h === 'billing')) score += 1;
    if (score > best.score) best = { row, score };
  }
  return best;
}

export function readQualityWorkbook(data) {
  const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: true });
  const sheets = workbook.SheetNames
    .map((name) => {
      const sheet = workbook.Sheets[name];
      const header = findHeaderRow(sheet);
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
      return {
        name,
        headerRow: header.row,
        headerExcelRow: header.row + 1,
        score: header.score,
        dataRows: Math.max(0, range.e.r - header.row),
      };
    })
    .filter((item) => item.score >= 8)
    .sort((a, b) => b.score - a.score || b.dataRows - a.dataRows);
  return { workbook, sheets };
}

function findHeaderIndex(headers, ...needles) {
  return headers.findIndex((header) => needles.some((needle) => header === needle || header.includes(needle)));
}

function latestValue(sheet, row, indexes) {
  for (let i = indexes.length - 1; i >= 0; i--) {
    const column = indexes[i];
    const value = cellDisplay(sheet, row, column);
    if (value != null && String(value).trim() !== '') return { value: String(value).trim(), column };
  }
  return { value: '', column: -1 };
}

function parsePackageFee(packageName) {
  const text = String(packageName || '');
  const thb = text.match(/([\d,]+(?:\.\d+)?)\s*THB/i);
  if (!thb) return null;
  const value = Number(thb[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function normalizeIdentifier(value, displayValue) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  return String(displayValue ?? value ?? '').trim().replace(/\.0+$/, '');
}

function classifyBill(rawValue, displayValue) {
  const text = String(displayValue ?? rawValue ?? '').trim();
  const lower = text.toLowerCase();
  if (!text) return null;
  if (/จ่ายแล้ว|paid/.test(lower)) return { bill_status: 'paid', amount: 0, raw_value: text };

  const directAmount = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null;
  const embeddedAmount = text.match(/-?[\d,]+(?:\.\d+)?/);
  const parsedAmount = embeddedAmount ? Number(embeddedAmount[0].replace(/,/g, '')) : 0;
  const amount = directAmount ?? (Number.isFinite(parsedAmount) ? Math.max(0, parsedAmount) : 0);

  if (/สำรอง|reserve/.test(lower)) return { bill_status: 'reserved', amount, raw_value: text };
  if (/over\s*due|ค้าง|เกินกำหนด|suspend|debt/.test(lower)) {
    return { bill_status: 'overdue', amount, raw_value: text };
  }
  if (directAmount != null) {
    return { bill_status: directAmount > 0 ? 'outstanding' : 'paid', amount: Math.max(0, directAmount), raw_value: text };
  }
  return { bill_status: 'note', amount, raw_value: text };
}

function dateFromHeader(value) {
  return parseExcelDate(String(value || ''));
}

export function parseQualitySheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error('ไม่พบชีตที่เลือก');
  const headerInfo = findHeaderRow(sheet);
  if (headerInfo.score < 8) throw new Error('ไม่พบหัวตาราง Access Number, Customer Name และแพ็กเกจ');

  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const headerRow = headerInfo.row;
  const headerDisplays = [];
  const headers = [];
  for (let column = range.s.c; column <= range.e.c; column++) {
    const display = cellDisplay(sheet, headerRow, column);
    headerDisplays[column] = String(display ?? '').trim();
    headers[column] = normalizeQcHeader(display);
  }

  const idxNon = findHeaderIndex(headers, 'accessnumber', 'nonnumber', 'เลขnon');
  const idxName = findHeaderIndex(headers, 'customername', 'ชื่อลูกค้า');
  const idxPackage = findHeaderIndex(headers, 'แพคเกจ', 'แพ็กเกจ', 'package');
  const idxRegister = findHeaderIndex(headers, 'registerdate', 'วันติดตั้ง');
  const idxPhone = findHeaderIndex(headers, 'customercontactphone', 'เบอร์ติดต่อ', 'เบอร์โทร');
  const idxSeller = findHeaderIndex(headers, 'ขาย', 'seller', 'เซล');
  const idxSubdistrict = findHeaderIndex(headers, 'ตำบล');
  const idxDistrict = findHeaderIndex(headers, 'อำเภอ');
  const idxFallbackStatus = headers.findIndex((h) => h.includes('terminate') && h.includes('disconnect'));
  const idxCheckDate = findHeaderIndex(headers, 'วันที่เช็คยอด');
  const idxTotal = findHeaderIndex(headers, 'รวมยอด');

  const billingIndexes = headers
    .map((header, index) => (header === 'billing' ? index : -1))
    .filter((index) => index >= 0);
  const statusIndexes = headers
    .map((header, index) => ((header.includes('cmสถานะ') || header.includes('สถานะcm')) ? index : -1))
    .filter((index) => index >= 0);
  const statusDateIndexes = headers
    .map((header, index) => (header.includes('เดือนที่เปลี่ยนสถานะ') ? index : -1))
    .filter((index) => index >= 0);
  const remarkIndexes = headers
    .map((header, index) => ((header.includes('aeremark') || header.includes('ผลการติดตาม')) ? index : -1))
    .filter((index) => index >= 0);

  const monthColumns = [];
  let previousYm = null;
  const monthStart = Math.max(idxFallbackStatus + 1, idxRegister + 1, 0);
  const monthEnd = idxTotal >= 0 ? idxTotal : range.e.c + 1;
  for (let column = monthStart; column < monthEnd; column++) {
    const ym = parseMonthHeader(headerDisplays[column], previousYm);
    if (!ym) continue;
    monthColumns.push({ column, bill_month: ym, label: headerDisplays[column] });
    previousYm = ym;
  }

  const rows = [];
  const warnings = [];
  for (let rowIndex = headerRow + 1; rowIndex <= range.e.r; rowIndex++) {
    const rawNon = idxNon >= 0 ? cellValue(sheet, rowIndex, idxNon) : '';
    const displayNon = idxNon >= 0 ? cellDisplay(sheet, rowIndex, idxNon) : '';
    const nonNumber = normalizeIdentifier(rawNon, displayNon);
    if (!nonNumber || nonNumber.length < 5) continue;

    const customerName = idxName >= 0 ? String(cellDisplay(sheet, rowIndex, idxName)).trim() : '';
    const packageName = idxPackage >= 0 ? String(cellDisplay(sheet, rowIndex, idxPackage)).trim() : '';
    const installDate = idxRegister >= 0 ? parseExcelDate(cellDisplay(sheet, rowIndex, idxRegister)) : null;
    const statusValue = latestValue(sheet, rowIndex, statusIndexes);
    const fallbackStatus = idxFallbackStatus >= 0 ? String(cellDisplay(sheet, rowIndex, idxFallbackStatus)).trim() : '';
    const qcStatus = statusValue.value || fallbackStatus;
    const statusDate = latestValue(sheet, rowIndex, statusDateIndexes);
    const billing = latestValue(sheet, rowIndex, billingIndexes);
    const remark = latestValue(sheet, rowIndex, remarkIndexes);
    const checkDate = idxCheckDate >= 0 ? parseExcelDate(cellDisplay(sheet, rowIndex, idxCheckDate)) : null;
    const observedHeader = statusValue.column >= 0 ? headerDisplays[statusValue.column] : '';
    const statusObservedAt = dateFromHeader(observedHeader)
      || dateFromHeader(remark.column >= 0 ? headerDisplays[remark.column] : '')
      || checkDate;

    const bills = monthColumns
      .map(({ column, bill_month }) => {
        const classified = classifyBill(
          cellValue(sheet, rowIndex, column),
          cellDisplay(sheet, rowIndex, column)
        );
        return classified ? { bill_month, ...classified } : null;
      })
      .filter(Boolean);

    if (!customerName || !packageName || !installDate) {
      warnings.push({
        row: rowIndex + 1,
        non_number: nonNumber,
        message: 'ข้อมูลชื่อ แพ็กเกจ หรือ Register Date ไม่ครบ (อัปเดตได้เฉพาะลูกค้าที่มีในระบบแล้ว)',
      });
    }

    rows.push({
      source_row: rowIndex + 1,
      non_number: nonNumber,
      customer_name: customerName,
      package_name: packageName,
      monthly_fee: parsePackageFee(packageName),
      install_date: installDate,
      contact_phone: idxPhone >= 0 ? String(cellDisplay(sheet, rowIndex, idxPhone)).trim() : '',
      seller_name: idxSeller >= 0 ? String(cellDisplay(sheet, rowIndex, idxSeller)).trim() : '',
      subdistrict: idxSubdistrict >= 0 ? String(cellDisplay(sheet, rowIndex, idxSubdistrict)).trim() : '',
      district: idxDistrict >= 0 ? String(cellDisplay(sheet, rowIndex, idxDistrict)).trim() : '',
      qc_status: qcStatus,
      billing_status: billing.value,
      status_changed_at: statusDate.column >= 0 ? parseExcelDate(cellDisplay(sheet, rowIndex, statusDate.column)) : null,
      status_observed_at: statusObservedAt,
      ae_remark: remark.value,
      bills,
    });
  }

  return {
    sheetName,
    headerRow: headerRow + 1,
    rows,
    warnings,
    monthColumns: monthColumns.map(({ bill_month, label }) => ({ bill_month, label })),
  };
}
