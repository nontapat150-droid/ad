import ExcelJS from 'exceljs';
import saveAs from 'file-saver';

const ORIGINAL_BILL_MONTHS = [
  '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
  '2026-06', '2026-07', '2026-08', '2026-09',
];

const EXACT_MONTH_LABELS = {
  '2025-08': ' สค.68',
  '2025-09': ' กย.68',
  '2025-10': ' ตค.68',
  '2025-11': ' พย.68',
  '2025-12': ' ธค.68',
  '2026-01': 'มค.69',
  '2026-02': 'กพ.69',
  '2026-03': 'มี.ค.',
  '2026-04': 'เม.ย.',
  '2026-05': 'พ.ค 69',
  '2026-06': 'Jun-69',
  '2026-07': 'Jul-69',
  '2026-08': 'Aug-69',
  '2026-09': 'Sep-69',
};

const THAI_MONTHS = ['มค.', 'กพ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shiftMonth(ym, delta) {
  const [year, month] = String(ym).split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthRangeLabel(start, end) {
  const label = (ym) => {
    const [year, month] = ym.split('-').map(Number);
    return `${EN_MONTHS[month - 1]} ${year}`;
  };
  return `${label(start)} - ${label(end)}`;
}

function monthHeader(ym) {
  if (EXACT_MONTH_LABELS[ym]) return EXACT_MONTH_LABELS[ym];
  const [year, month] = ym.split('-').map(Number);
  return `${THAI_MONTHS[month - 1]}${String(year + 543).slice(-2)}`;
}

function toDate(value) {
  const iso = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function addDays(date, days) {
  if (!date) return null;
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function remainingDays(dueDate) {
  if (!dueDate) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dueUtc = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return Math.floor((dueUtc - todayUtc) / 86400000) + 1;
}

function billCellValue(bill) {
  if (!bill) return null;
  if (bill.bill_status === 'paid') return 'จ่ายแล้ว';
  if (bill.bill_status === 'reserved' || bill.bill_status === 'note') return bill.raw_value || null;
  if (['outstanding', 'overdue'].includes(bill.bill_status)) {
    return Number(bill.amount) > 0 ? Number(bill.amount) : (bill.raw_value || null);
  }
  return bill.raw_value || (Number(bill.amount) || null);
}

function cleanText(value) {
  const text = String(value ?? '').trim();
  if (!text || /^#(?:N\/A|REF!|VALUE!|DIV\/0!|NAME\?)$/i.test(text)) return null;
  return text;
}

function pickBillMonths(result) {
  const available = Array.from(new Set(result.bill_months || [])).sort();
  if (available.length === 14) return available;
  if (available.length > 14) return available.slice(-14);
  const merged = Array.from(new Set([...ORIGINAL_BILL_MONTHS, ...available])).sort();
  return merged.slice(0, 14);
}

function installMonthLabel(row) {
  if (row.install_month_label) return row.install_month_label;
  const date = toDate(row.install_date);
  return date ? EN_MONTHS[date.getMonth()] : '';
}

function styleHeader(cell, fill) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  cell.font = { name: 'Angsana New', size: 15, bold: true, color: { argb: 'FF000000' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
  };
}

function styleDataCell(cell, columnNumber) {
  cell.font = { name: 'Angsana New', size: 15, color: { argb: 'FF000000' } };
  cell.alignment = {
    vertical: 'middle',
    horizontal: [1, 2, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32].includes(columnNumber)
      ? 'center'
      : 'left',
    wrapText: [5, 14, 34, 35, 36, 37, 38, 39, 40].includes(columnNumber),
  };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  };
}

export function buildQualityWorkbook(result) {
  if (!result?.customers?.length) throw new Error('ไม่มีข้อมูลสำหรับ Export');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BO AIS Quality Control';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const worksheet = workbook.addWorksheet('ติดตาม Fraud&Churn Aug25-26', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 9 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  worksheet.properties.defaultRowHeight = 22;
  worksheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 9, showGridLines: false }];

  const billMonths = pickBillMonths(result);
  const fraudStart = shiftMonth(result.ref_month, -3);
  const churnStart = shiftMonth(result.ref_month, -7);
  const today = new Date();
  const updatedLabel = `${EN_MONTHS[today.getMonth()]}'${String(today.getFullYear()).slice(-2)}`;

  worksheet.mergeCells('A1:H1');
  worksheet.getCell('A1').value = `***Up File ${updatedLabel} แล้ว`;
  worksheet.getCell('A1').font = { name: 'Angsana New', size: 15, bold: true, color: { argb: 'FFFF0000' } };
  worksheet.getCell('A6').value = `กลุ่มลูกค้า Fraud : ${monthRangeLabel(fraudStart, result.ref_month)}`;
  worksheet.getCell('A7').value = `กลุ่มลูกค้า Churn : ${monthRangeLabel(churnStart, result.ref_month)}`;
  for (const address of ['A6', 'A7']) worksheet.getCell(address).font = { name: 'Angsana New', size: 15 };

  worksheet.getCell('N8').value = '***ช่องสำคัญห้ามลบ';
  worksheet.getCell('N8').font = { name: 'Angsana New', size: 15, color: { argb: 'FFFF0000' } };
  worksheet.getCell('AC8').value = 'แอดมิน';
  worksheet.getCell('AD8').value = 'แอดมิน';
  worksheet.getCell('AF8').value = 'ผู้ติดตาม';
  worksheet.getCell('AG8').value = 'ระบบ';
  worksheet.getCell('AH8').value = 'ระบบ';
  worksheet.getCell('AI8').value = 'ระบบ';
  worksheet.getCell('AJ8').value = 'AE';
  worksheet.getCell('AK8').value = 'ระบบ';
  worksheet.getCell('AL8').value = 'ระบบ';
  worksheet.getCell('AM8').value = 'ระบบ';
  worksheet.getCell('AN8').value = 'AE';
  for (let col = 1; col <= 40; col++) {
    const cell = worksheet.getRow(8).getCell(col);
    cell.font = { name: 'Angsana New', size: 15, color: { argb: 'FF000000' } };
  }

  const headers = [
    'No.', 'Register Date', 'Access Number ', 'Customer Name', 'แพคเกจ', 'ตำบล', 'อำเภอ',
    'Customer Contact Phone', 'ขาย', 'วันที่ครบ 128 วัน ', 'ระยะเวลาติดตามคงเหลือ',
    'กำหนดชำระ', 'เดือนที่ติดตั้งสำเร็จ', '1. สรุปสำรองบิล?\n2. Terminate\n3. Disconnect',
    ...billMonths.map(monthHeader),
    'รวมยอด', 'วันที่เช็คยอด', 'จำนวนบิลที่ค้าง', 'คาดการณ์ Terminate',
    'Billing', 'CM สถานะ', 'เดือนที่เปลี่ยนสถานะ', 'AE Remark',
    'Billing', 'CM สถานะ', 'CM เดือนที่เปลี่ยนสถานะ', 'ผลการติดตาม',
  ];
  const headerRow = worksheet.getRow(9);
  headerRow.values = headers;
  headerRow.height = 68;
  headers.forEach((_, index) => {
    const column = index + 1;
    const fill = column <= 13
      ? 'FF00B0F0'
      : column === 14
        ? 'FFED7D31'
        : column <= 28
          ? 'FFF7CAAC'
          : column === 29
            ? 'FFFFFF00'
            : column <= 32
              ? 'FFED7D31'
              : 'FFD9E2F3';
    styleHeader(headerRow.getCell(column), fill);
  });

  const widths = [7, 14, 17, 25, 52, 18, 20, 21, 14, 18, 18, 13, 18, 30,
    ...Array(14).fill(12), 14, 14, 15, 17, 20, 20, 19, 28, 20, 20, 22, 30];
  widths.forEach((width, index) => { worksheet.getColumn(index + 1).width = width; });

  result.customers.forEach((customer, index) => {
    const excelRow = 10 + index;
    const row = worksheet.getRow(excelRow);
    const installDate = toDate(customer.install_date);
    const dueDate = addDays(installDate, 127);
    const billsByMonth = new Map((customer.bills || []).map((bill) => [bill.bill_month, bill]));
    const billValues = billMonths.map((ym) => billCellValue(billsByMonth.get(ym)));
    const outstandingValues = billValues.filter((value) => typeof value === 'number');
    const totalOutstanding = outstandingValues.reduce((sum, value) => sum + value, 0);

    row.values = [
      index + 1,
      installDate,
      String(customer.non_number || ''),
      cleanText(customer.customer_name),
      cleanText(customer.package_name),
      cleanText(customer.subdistrict),
      cleanText(customer.district),
      cleanText(customer.contact_phone),
      cleanText(customer.seller_name),
      null,
      null,
      customer.payment_due_day || null,
      installMonthLabel(customer),
      cleanText(customer.tracking_summary || customer.cancel_reason),
      ...billValues,
      null,
      toDate(customer.bill_check_date),
      null,
      toDate(customer.expected_terminate_at),
      cleanText(customer.billing_status),
      cleanText(customer.qc_status),
      toDate(customer.status_changed_at),
      cleanText(customer.ae_remark),
      cleanText(customer.billing_status),
      cleanText(customer.qc_status),
      toDate(customer.status_changed_at),
      cleanText(customer.ae_remark),
    ];

    row.getCell(10).value = { formula: `B${excelRow}+127`, result: dueDate };
    row.getCell(11).value = { formula: `(J${excelRow}-NOW())+1`, result: remainingDays(dueDate) };
    row.getCell(29).value = { formula: `SUM(O${excelRow}:AB${excelRow})`, result: totalOutstanding };
    row.getCell(31).value = { formula: `COUNT(O${excelRow}:AB${excelRow})`, result: outstandingValues.length };
    row.height = 24;

    for (let column = 1; column <= 40; column++) styleDataCell(row.getCell(column), column);
    for (const column of [2, 10, 30, 32, 35, 39]) row.getCell(column).numFmt = 'd/m/yyyy';
    for (let column = 15; column <= 29; column++) row.getCell(column).numFmt = '#,##0.00';
    row.getCell(3).numFmt = '@';
    row.getCell(11).numFmt = '0';
    if (customer.is_case) {
      row.getCell(38).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
      row.getCell(38).font = { name: 'Angsana New', size: 15, bold: true, color: { argb: 'FFBE123C' } };
    } else if (/suspend|debt/i.test(customer.qc_status || '')) {
      row.getCell(38).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    }
  });

  worksheet.autoFilter = { from: 'A9', to: 'AN9' };
  worksheet.pageSetup.printTitlesRow = '1:9';
  worksheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };

  return workbook;
}

export async function exportQualityWorkbook(result) {
  const workbook = buildQualityWorkbook(result);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const typeLabel = result.type === 'fraud' ? 'Fraud' : 'Churn';
  saveAs(blob, `NEW_ติดตามบิล_${typeLabel}_${result.ref_month}.xlsx`);
}
