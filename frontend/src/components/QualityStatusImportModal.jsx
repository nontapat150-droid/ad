import { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import axios from '../api/axios';
import { parseQualitySheet, readQualityWorkbook } from '../utils/qcImport';

const isCancelledStatus = (value) => /(terminate|disconnect|cancel|ยกเลิก|ตัดบริการ)/i.test(String(value || ''));

export default function QualityStatusImportModal({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [workbookData, setWorkbookData] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [parsed, setParsed] = useState(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const summary = useMemo(() => {
    const rows = parsed?.rows || [];
    return {
      total: rows.length,
      cancelled: rows.filter((row) => isCancelledStatus(row.qc_status)).length,
      statusRows: rows.filter((row) => row.qc_status || row.billing_status).length,
      bills: rows.reduce((sum, row) => sum + (row.bills?.length || 0), 0),
    };
  }, [parsed]);

  if (!open) return null;

  const resetAndClose = () => {
    if (importing) return;
    setFile(null);
    setWorkbookData(null);
    setSelectedSheet('');
    setParsed(null);
    setProgress(0);
    onClose();
  };

  const selectSheet = (name, data = workbookData) => {
    try {
      setSelectedSheet(name);
      setParsed(parseQualitySheet(data.workbook, name));
    } catch (error) {
      setParsed(null);
      Swal.fire('อ่านชีตไม่สำเร็จ', error.message, 'error');
    }
  };

  const handleFile = async (event) => {
    const nextFile = event.target.files?.[0];
    event.target.value = '';
    if (!nextFile) return;
    if (!/\.(xlsx|xls)$/i.test(nextFile.name)) {
      return Swal.fire('ชนิดไฟล์ไม่ถูกต้อง', 'รองรับไฟล์ .xlsx และ .xls เท่านั้น', 'warning');
    }

    setReading(true);
    setParsed(null);
    try {
      const data = await nextFile.arrayBuffer();
      const result = readQualityWorkbook(data);
      if (!result.sheets.length) {
        throw new Error('ไม่พบชีตที่มีหัวข้อ Access Number, Customer Name และแพ็กเกจ');
      }
      setFile(nextFile);
      setWorkbookData(result);
      selectSheet(result.sheets[0].name, result);
    } catch (error) {
      setFile(null);
      setWorkbookData(null);
      setSelectedSheet('');
      Swal.fire('อ่านไฟล์ไม่สำเร็จ', error.message, 'error');
    } finally {
      setReading(false);
    }
  };

  const confirmImport = async () => {
    if (!file || !parsed?.rows?.length) return;
    const confirmation = await Swal.fire({
      icon: 'question',
      title: 'ยืนยันอัปเดตสถานะ',
      html: `ระบบจะอัปเดตลูกค้า <b>${summary.total.toLocaleString('th-TH')}</b> รายการจากชีต <b>${selectedSheet}</b><br/><span style="color:#6b7280;font-size:13px">รายการเดิมจะจับคู่ด้วย Access Number / NON</span>`,
      showCancelButton: true,
      confirmButtonText: 'ยืนยันนำเข้า',
      cancelButtonText: 'กลับไปตรวจสอบ',
      confirmButtonColor: '#65a30d',
    });
    if (!confirmation.isConfirmed) return;

    setImporting(true);
    setProgress(0);
    try {
      const batchSize = 250;
      const result = { inserted: 0, updated: 0, bill_rows: 0, errors: [] };
      for (let offset = 0; offset < parsed.rows.length; offset += batchSize) {
        const response = await axios.post('/installed-customers/import-quality-status', {
          source_file: file.name,
          source_sheet: selectedSheet,
          rows: parsed.rows.slice(offset, offset + batchSize),
        });
        const batch = response.data || {};
        result.inserted += Number(batch.inserted || 0);
        result.updated += Number(batch.updated || 0);
        result.bill_rows += Number(batch.bill_rows || 0);
        result.errors.push(...(batch.errors || []));
        setProgress(Math.min(100, Math.round(((offset + batchSize) / parsed.rows.length) * 100)));
      }
      await Swal.fire({
        icon: result.errors?.length ? 'warning' : 'success',
        title: 'นำเข้าเสร็จแล้ว',
        html: `เพิ่มลูกค้าใหม่ <b>${result.inserted || 0}</b> · อัปเดต <b>${result.updated || 0}</b><br/>อัปเดตบิล <b>${result.bill_rows || 0}</b> รายการ${result.errors?.length ? `<br/><span style="color:#b45309">ข้าม ${result.errors.length} แถวที่มีปัญหา</span>` : ''}`,
        confirmButtonColor: '#65a30d',
      });
      onImported?.(result);
      resetAndClose();
    } catch (error) {
      Swal.fire('นำเข้าไม่สำเร็จ', error.response?.data?.error || error.message, 'error');
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="quality-import-title">
      <button type="button" aria-label="ปิดหน้าต่างนำเข้า" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={resetAndClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/50 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4 sm:px-6">
          <div>
            <h2 id="quality-import-title" className="text-lg font-bold text-[#1F2937]">นำเข้าอัปเดตสถานะ Fraud / Churn</h2>
            <p className="mt-1 text-xs text-[#6B7280]">ระบบจะค้นหาหัวตารางและจับคู่ลูกค้าด้วย Access Number โดยอัตโนมัติ</p>
          </div>
          <button type="button" onClick={resetAndClose} className="rounded-xl p-2 text-[#6B7280] hover:bg-[#F3F4F6]" aria-label="ปิด">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto bg-[#F8FAFC] p-5 sm:p-6">
          <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-white p-6 text-center transition hover:border-[#84cc16] hover:bg-lime-50/30 focus-within:border-[#84cc16]">
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="sr-only" disabled={reading || importing} />
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-lime-100 text-lime-700">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4m0 0L7 9m5-5l5 5M5 14v5h14v-5" /></svg>
            </div>
            <p className="font-bold text-[#1F2937]">{reading ? 'กำลังอ่านไฟล์...' : file ? file.name : 'เลือกไฟล์ติดตาม Fraud / Churn'}</p>
            <p className="mt-1 text-xs text-[#94A3B8]">รองรับ .xlsx และ .xls · ไฟล์ต้นฉบับไม่ถูกแก้ไข</p>
          </label>

          {workbookData && (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
              <label htmlFor="quality-sheet" className="mb-1.5 block text-xs font-bold text-[#475569]">ชีตข้อมูลที่ต้องการนำเข้า</label>
              <select id="quality-sheet" value={selectedSheet} onChange={(event) => selectSheet(event.target.value)} className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm font-semibold text-[#1F2937] outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100">
                {workbookData.sheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>{sheet.name} · หัวตารางแถว {sheet.headerExcelRow} · ประมาณ {sheet.dataRows.toLocaleString('th-TH')} แถว</option>
                ))}
              </select>
            </div>
          )}

          {parsed && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryCard label="ลูกค้าที่อ่านได้" value={summary.total} />
                <SummaryCard label="มีสถานะ CM/Billing" value={summary.statusRows} />
                <SummaryCard label="Terminate/Disconnect" value={summary.cancelled} tone="danger" />
                <SummaryCard label="ข้อมูลบิลรายเดือน" value={summary.bills} />
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] bg-white">
                <div className="flex flex-col gap-2 border-b border-[#E2E8F0] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#1F2937]">ตัวอย่างก่อนอัปเดต</h3>
                    <p className="text-xs text-[#64748B]">อ่านหัวตารางจากแถว {parsed.headerRow} · พบบิล {parsed.monthColumns.length} เดือน</p>
                  </div>
                  {parsed.warnings.length > 0 && <span className="w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">มีคำเตือน {parsed.warnings.length} แถว</span>}
                </div>
                <div className="max-h-[340px] overflow-auto">
                  <table className="w-full min-w-[900px] text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-[#F8FAFC] text-[#64748B] shadow-sm">
                      <tr>
                        <th className="px-3 py-3 font-bold">แถว</th>
                        <th className="px-3 py-3 font-bold">Access Number</th>
                        <th className="px-3 py-3 font-bold">ลูกค้า / แพ็กเกจ</th>
                        <th className="px-3 py-3 font-bold">CM สถานะ</th>
                        <th className="px-3 py-3 font-bold">Billing</th>
                        <th className="px-3 py-3 font-bold">บิลที่พบ</th>
                        <th className="px-3 py-3 font-bold">ผลการติดตาม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 30).map((row) => (
                        <tr key={`${row.source_row}-${row.non_number}`} className="border-t border-[#F1F5F9] align-top hover:bg-[#FAFAFA]">
                          <td className="px-3 py-2.5 text-[#94A3B8]">{row.source_row}</td>
                          <td className="px-3 py-2.5 font-mono font-bold text-[#1F2937]">{row.non_number}</td>
                          <td className="max-w-[280px] px-3 py-2.5"><div className="font-bold text-[#334155]">{row.customer_name || 'ไม่พบชื่อ'}</div><div className="mt-0.5 truncate text-[#94A3B8]" title={row.package_name}>{row.package_name || 'ไม่พบแพ็กเกจ'}</div></td>
                          <td className="px-3 py-2.5"><StatusBadge value={row.qc_status} /></td>
                          <td className="px-3 py-2.5 text-[#475569]">{row.billing_status || '-'}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-[#475569]">{row.bills.length}</td>
                          <td className="max-w-[260px] px-3 py-2.5 text-[#64748B]"><span className="line-clamp-2" title={row.ae_remark}>{row.ae_remark || '-'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsed.rows.length > 30 && <div className="border-t border-[#E2E8F0] px-4 py-2 text-center text-xs text-[#94A3B8]">แสดง 30 รายการแรกจากทั้งหมด {parsed.rows.length.toLocaleString('th-TH')} รายการ</div>}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#E5E7EB] bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={resetAndClose} disabled={importing} className="rounded-xl border border-[#E2E8F0] px-5 py-2.5 text-sm font-bold text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-50">ยกเลิก</button>
          <button type="button" onClick={confirmImport} disabled={importing || !parsed?.rows?.length} className="rounded-xl bg-gradient-to-br from-[#A3E635] to-[#84cc16] px-6 py-2.5 text-sm font-bold text-[#1F2937] shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
            {importing ? `กำลังอัปเดต ${progress}%` : `ยืนยันนำเข้า ${summary.total.toLocaleString('th-TH')} รายการ`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  return <div className={`rounded-xl border p-3.5 ${tone === 'danger' ? 'border-rose-200 bg-rose-50' : 'border-[#E2E8F0] bg-white'}`}><p className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">{label}</p><p className={`mt-1 text-xl font-black ${tone === 'danger' ? 'text-rose-700' : 'text-[#1F2937]'}`}>{Number(value || 0).toLocaleString('th-TH')}</p></div>;
}

function StatusBadge({ value }) {
  if (!value) return <span className="text-[#94A3B8]">-</span>;
  const danger = isCancelledStatus(value);
  const warning = /(suspend|debt|overdue|ค้าง)/i.test(value);
  const className = danger ? 'bg-rose-100 text-rose-800' : warning ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
  return <span className={`inline-flex max-w-[180px] rounded-full px-2.5 py-1 font-bold ${className}`} title={value}>{value}</span>;
}
