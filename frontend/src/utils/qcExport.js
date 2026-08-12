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
  if (!text || /^#(?:N\/A|REF!|VALUE!|DIV\/0!|NAME\?|ERROR!)$/i.test(text)) return null;
  return text;
}

function exportPackageName(value, monthlyFee) {
  const text = cleanText(value);
  if (!text || text === 'รอระบุชื่อแพ็กเกจ' || /^\d[\d,]*(?:\.\d+)?(?:\s*(?:บาท|THB))?$/i.test(text)) {
    const fee = Number(monthlyFee);
    const priceLabel = Number.isFinite(fee) && fee >= 0 ? `ราคา ${fee.toLocaleString('th-TH')} บาท` : 'ราคา';
    return `รอระบุชื่อแพ็กเกจ (ต้นฉบับมีเฉพาะ${priceLabel})`;
  }
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
  cell.font = { name: 'Angsana New', size: 13, bold: true, color: { argb: 'FF000000' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
  };
}

function styleDataCell(cell, columnNumber) {
  cell.font = { name: 'Angsana New', size: 14, color: { argb: 'FF000000' } };
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
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 2, fitToHeight: 0 },
  });
  worksheet.properties.defaultRowHeight = 19.5;
  worksheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 9, showGridLines: false }];

  const billMonths = pickBillMonths(result);
  const fraudMonths = Math.max(1, Number(result.settings?.fraud?.months) || 4);
  const churnMonths = Math.max(1, Number(result.settings?.churn?.months) || 8);
  const fraudStart = shiftMonth(result.ref_month, -(fraudMonths - 1));
  const churnStart = shiftMonth(result.ref_month, -(churnMonths - 1));
  const today = new Date();
  const updatedLabel = `${EN_MONTHS[today.getMonth()]}'${String(today.getFullYear()).slice(-2)}`;

  worksheet.mergeCells('A1:H1');
  worksheet.getCell('A1').value = `***Up File ${updatedLabel} แล้ว`;
  worksheet.getCell('A1').font = { name: 'Angsana New', size: 13, bold: true, color: { argb: 'FFFF0000' } };
  worksheet.getCell('A6').value = `กลุ่มลูกค้า Fraud : ${monthRangeLabel(fraudStart, result.ref_month)}`;
  worksheet.getCell('A7').value = `กลุ่มลูกค้า Churn : ${monthRangeLabel(churnStart, result.ref_month)}`;
  for (const address of ['A6', 'A7']) worksheet.getCell(address).font = { name: 'Angsana New', size: 13 };

  worksheet.getCell('N8').value = '***ช่องสำคัญห้ามลบ';
  worksheet.getCell('N8').font = { name: 'Angsana New', size: 13, color: { argb: 'FFFF0000' } };
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
    cell.font = { name: 'Angsana New', size: 13, color: { argb: 'FF000000' } };
  }

  [1, 6, 7, 8].forEach((rowNumber) => { worksheet.getRow(rowNumber).height = 18; });
  [2, 3, 4, 5].forEach((rowNumber) => { worksheet.getRow(rowNumber).height = 6; });

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
  headerRow.height = 46;
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

  const widths = [6, 13, 15, 28, 48, 16, 18, 19, 13, 16, 15, 11, 15, 26,
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
      exportPackageName(customer.package_name, customer.monthly_fee),
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
    row.height = 30;

    for (let column = 1; column <= 40; column++) styleDataCell(row.getCell(column), column);
    for (const column of [2, 10, 30, 32, 35, 39]) row.getCell(column).numFmt = 'd/m/yyyy';
    for (let column = 15; column <= 29; column++) row.getCell(column).numFmt = '#,##0.00';
    row.getCell(3).numFmt = '@';
    row.getCell(11).numFmt = '0';
    if (String(row.getCell(5).value || '').startsWith('รอระบุชื่อแพ็กเกจ')) {
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4CC' } };
      row.getCell(5).font = { name: 'Angsana New', size: 14, bold: true, color: { argb: 'FF9A6700' } };
    }
    if (customer.is_case) {
      row.getCell(38).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
      row.getCell(38).font = { name: 'Angsana New', size: 15, bold: true, color: { argb: 'FFBE123C' } };
    } else if (/suspend|debt/i.test(customer.qc_status || '')) {
      row.getCell(38).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    }
  });

  worksheet.autoFilter = { from: 'A9', to: 'AN9' };
  worksheet.pageSetup.printTitlesRow = '9:9';
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

export function buildBillPaymentsWorkbook({ rows, filters, summary }) {
  if (!rows?.length) throw new Error('ไม่มีรายการบิลตามตัวกรองสำหรับ Export');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BO AIS Quality Control';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('รายการชำระบิล', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 4, showGridLines: false }],
  });
  worksheet.properties.defaultRowHeight = 20;

  worksheet.mergeCells('A1:S1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `รายงานตรวจสอบการชำระบิลที่ ${filters?.billNumber || rows[0]?.bill_number || 1} ตามเลข NON`;
  titleCell.font = { name: 'Aptos', size: 16, bold: true, color: { argb: 'FF172033' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF7D6' } };
  worksheet.getRow(1).height = 28;

  const paymentStateLabels = { all: 'ทุกสถานะ', paid: 'ชำระแล้ว', unpaid: 'ยังไม่ชำระ', not_due: 'ยังไม่ถึงกำหนด', missing: 'ไม่มีข้อมูลบิล' };
  const statusLabel = paymentStateLabels[filters?.status] || 'ทุกสถานะ';
  const sourceLabels = { all: 'ทุกแหล่งยอด', recorded: 'ยอดบันทึกจริง', reference: 'ยอดอ้างอิง/ประมาณ', missing: 'ยังไม่มียอด' };
  worksheet.mergeCells('A2:S2');
  worksheet.getCell('A2').value = [
    `ลำดับ: บิลที่ ${filters?.billNumber || rows[0]?.bill_number || 1}`,
    `เดือนปฏิทิน: ${filters?.month === 'all' ? 'ทุกเดือน' : monthHeader(filters?.month)}`,
    `วันที่ติดตั้ง: ${filters?.installFrom || 'ไม่จำกัด'} ถึง ${filters?.installTo || 'ไม่จำกัด'}`,
    `สถานะการชำระ: ${statusLabel}`,
    `แหล่งยอด: ${sourceLabels[filters?.amountSource] || 'ทุกแหล่งยอด'}`,
    `ช่วงยอด: ${filters?.amountMin || '0'} - ${filters?.amountMax || 'ไม่จำกัด'} บาท`,
    `ผลลัพธ์: ${Number(summary?.uniqueCustomers || rows.length).toLocaleString('th-TH')} ราย`,
  ].join('  |  ');
  worksheet.getCell('A2').font = { name: 'Aptos', size: 10, color: { argb: 'FF475569' } };
  worksheet.getCell('A2').alignment = { vertical: 'middle', wrapText: true };
  worksheet.getRow(2).height = 28;

  worksheet.mergeCells('A3:S3');
  worksheet.getCell('A3').value = `ชำระแล้ว ${Number(summary?.paidCustomers || 0).toLocaleString('th-TH')} ราย / ${Number(summary?.paidAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท · ยังไม่ชำระ ${Number(summary?.unpaidCustomers || 0).toLocaleString('th-TH')} ราย / ${Number(summary?.unpaidAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท · ยังไม่ถึงกำหนด ${Number(summary?.notDueCustomers || 0).toLocaleString('th-TH')} ราย · ไม่มีข้อมูล ${Number(summary?.missingCustomers || 0).toLocaleString('th-TH')} ราย`;
  worksheet.getCell('A3').font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF334155' } };
  worksheet.getCell('A3').alignment = { vertical: 'middle' };

  const headers = ['ลำดับ', 'งวดบิลที่', 'เดือนบิล', 'ชื่อลูกค้า', 'เลข NON', 'วันที่ติดตั้งสำเร็จ', 'ผู้ขาย', 'แพ็กเกจ', 'สถานะการชำระ', 'สถานะบิลละเอียด', 'สถานะกำหนดชำระ', 'ยอด (บาท)', 'ความน่าเชื่อถือของยอด', 'วันครบชำระ', 'ผู้รับผิดชอบ', 'สถานะติดตาม', 'ผู้เปลี่ยนสถานะล่าสุด', 'ที่มาข้อมูลบิล', 'หมายเหตุ/ค่าต้นฉบับ'];
  const headerRow = worksheet.getRow(4);
  headerRow.values = headers;
  headerRow.height = 32;
  headers.forEach((_, index) => styleHeader(headerRow.getCell(index + 1), index < 7 ? 'FFB7DEE8' : 'FFEAF7D6'));

  const widths = [8, 12, 13, 30, 18, 16, 20, 44, 20, 18, 18, 16, 24, 15, 22, 18, 22, 17, 32];
  widths.forEach((width, index) => { worksheet.getColumn(index + 1).width = width; });
  const billSourceLabels = { manual: 'แก้ไขผ่านเว็บ', import: 'นำเข้าจากไฟล์', auto: 'ระบบคำนวณ' };
  const dueStateLabels = { paid: 'ชำระแล้ว', not_due: 'ยังไม่ถึงกำหนด', due_today: 'ครบกำหนดวันนี้', overdue: 'เกินกำหนด', missing: 'ไม่มีข้อมูลบิล' };
  const taskStatusLabels = { unassigned: 'รอดำเนินการ', assigned: 'รอดำเนินการ', in_progress: 'กำลังติดตาม', waiting_customer: 'กำลังติดตาม', completed: 'ชำระแล้ว', unreachable: 'กำลังติดตาม' };

  rows.forEach((item, index) => {
    const row = worksheet.getRow(index + 5);
    row.values = [
      index + 1,
      Number(item.bill_number) || 1,
      item.bill_month ? monthHeader(item.bill_month) : '-',
      cleanText(item.customer_name),
      String(item.non_number || ''),
      toDate(item.install_date),
      cleanText(item.seller_name),
      exportPackageName(item.package_name, item.monthly_fee),
      paymentStateLabels[item.payment_state] || item.payment_state || '-',
      item.status_label || item.bill_status,
      dueStateLabels[item.due_state] || '-',
      Number(item.amount) || 0,
      item.amount_source_label || '-',
      toDate(item.due_date),
      item.follow_up?.assignee_name || '-',
      taskStatusLabels[item.follow_up?.status] || (item.follow_up ? item.follow_up.status : 'ยังไม่มีงาน'),
      item.follow_up?.updated_by_name || item.follow_up?.updated_by_username || '-',
      billSourceLabels[item.bill_source] || item.bill_source || '-',
      cleanText(item.raw_value),
    ];
    row.height = 26;
    for (let column = 1; column <= 19; column++) {
      styleDataCell(row.getCell(column), column);
      row.getCell(column).font = { name: 'Aptos', size: 10, color: { argb: 'FF172033' } };
    }
    row.getCell(5).numFmt = '@';
    row.getCell(6).numFmt = 'd/m/yyyy';
    row.getCell(12).numFmt = '#,##0.00';
    row.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(14).numFmt = 'd/m/yyyy';
    const paymentFill = { paid: 'FFDCFCE7', unpaid: 'FFFEE2E2', not_due: 'FFE0F2FE', missing: 'FFF1F5F9' };
    row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: paymentFill[item.payment_state] || 'FFF1F5F9' } };
    if (item.amount_source === 'recorded') {
      row.getCell(13).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    } else if (item.amount_source === 'reference') {
      row.getCell(13).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    }
    if (item.due_state === 'overdue') {
      row.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    }
  });

  worksheet.autoFilter = { from: 'A4', to: 'S4' };
  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '4:4',
    margins: { left: 0.2, right: 0.2, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 },
  };

  return workbook;
}

export async function exportBillPaymentsWorkbook(args) {
  const workbook = buildBillPaymentsWorkbook(args);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const monthLabel = args?.filters?.month === 'all' ? (args?.refMonth || 'all') : args?.filters?.month;
  saveAs(blob, `รายการชำระ_บิลที่${args?.filters?.billNumber || 1}_${monthLabel}_${args?.filters?.status || 'all'}.xlsx`);
}
