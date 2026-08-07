import { useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import {
  CHECK_STATUS,
  exportEntryFeeChecklist,
  parseEntryFeeChecklistSheet,
  readExcelWorkbook,
} from '../utils/entryFeeChecklist';

async function copyText(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function ProgressRing({ value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#E5E7EB" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#84cc16"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 280ms ease-out' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-[#1F2937]">
        {pct}%
      </span>
    </div>
  );
}

function StatusToggle({ value, onChange }) {
  const options = [
    { key: CHECK_STATUS.HAS, label: 'มี', active: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25', idle: 'text-[#6B7280] hover:text-emerald-700 hover:bg-emerald-50' },
    { key: CHECK_STATUS.MISSING, label: 'ไม่มี', active: 'bg-rose-500 text-white shadow-sm shadow-rose-500/25', idle: 'text-[#6B7280] hover:text-rose-700 hover:bg-rose-50' },
    { key: CHECK_STATUS.ONSITE, label: 'หน้างาน', active: 'bg-sky-500 text-white shadow-sm shadow-sky-500/25', idle: 'text-[#6B7280] hover:text-sky-700 hover:bg-sky-50' },
  ];
  return (
    <div className="inline-flex rounded-xl bg-[#F3F4F6] p-0.5 border border-[#E5E7EB]">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(value === opt.key ? null : opt.key)}
          className={`min-w-[54px] px-2 py-1.5 rounded-[10px] text-[11px] font-bold transition-all duration-150 active:scale-[0.97] ${
            value === opt.key ? opt.active : opt.idle
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function EntryFeeChecklistPanel() {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [importMeta, setImportMeta] = useState(null);
  const [q, setQ] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const copiedTimerRef = useRef(null);
  const [sheetPicker, setSheetPicker] = useState(null); // { fileName, sheetNames, getSheetRows, selected }
  const [confirmingSheet, setConfirmingSheet] = useState(false);

  const copyAccessNumber = async (row) => {
    const ok = await copyText(row.accessNumber);
    if (!ok) {
      Swal.fire('คัดลอกไม่สำเร็จ', 'เบราว์เซอร์ไม่อนุญาตให้คัดลอก', 'warning');
      return;
    }
    setCopiedId(`access:${row.id}`);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedId(null), 1400);
  };

  const copyCustomerName = async (row) => {
    const ok = await copyText(row.customerName);
    if (!ok) {
      Swal.fire('คัดลอกไม่สำเร็จ', row.customerName ? 'เบราว์เซอร์ไม่อนุญาตให้คัดลอก' : 'ไม่มีชื่อลูกค้า', 'warning');
      return;
    }
    setCopiedId(`name:${row.id}`);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedId(null), 1400);
  };

  const teams = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.teamName) set.add(r.teamName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
  }, [rows]);

  const areas = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.areaName) set.add(r.areaName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
  }, [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (teamFilter && row.teamName !== teamFilter) return false;
      if (areaFilter && row.areaName !== areaFilter) return false;
      if (statusFilter === 'checked' && row.checkStatus == null) return false;
      if (statusFilter === 'unchecked' && row.checkStatus != null) return false;
      if (statusFilter === CHECK_STATUS.HAS && row.checkStatus !== CHECK_STATUS.HAS) return false;
      if (statusFilter === CHECK_STATUS.MISSING && row.checkStatus !== CHECK_STATUS.MISSING) return false;
      if (statusFilter === CHECK_STATUS.ONSITE && row.checkStatus !== CHECK_STATUS.ONSITE) return false;
      if (!query) return true;
      return (
        row.accessNumber.toLowerCase().includes(query) ||
        row.customerName.toLowerCase().includes(query) ||
        row.teamName.toLowerCase().includes(query) ||
        String(row.areaName || '').toLowerCase().includes(query) ||
        String(row.appointmentDate).toLowerCase().includes(query)
      );
    });
  }, [rows, q, teamFilter, areaFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const has = rows.filter((r) => r.checkStatus === CHECK_STATUS.HAS).length;
    const missing = rows.filter((r) => r.checkStatus === CHECK_STATUS.MISSING).length;
    const onsite = rows.filter((r) => r.checkStatus === CHECK_STATUS.ONSITE).length;
    const unchecked = total - has - missing - onsite;
    return { total, has, missing, onsite, unchecked, done: has + missing + onsite };
  }, [rows]);

  const setCheckStatus = (id, value) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, checkStatus: value } : row))
    );
  };

  const markAllFiltered = (value) => {
    const ids = new Set(filtered.map((r) => r.id));
    setRows((prev) =>
      prev.map((row) => (ids.has(row.id) ? { ...row, checkStatus: value } : row))
    );
  };

  const clearChecksFiltered = () => {
    const ids = new Set(filtered.map((r) => r.id));
    setRows((prev) =>
      prev.map((row) => (ids.has(row.id) ? { ...row, checkStatus: null } : row))
    );
  };

  const importFromSheet = async (workbook, sheetName) => {
    setConfirmingSheet(true);
    try {
      const aoa = workbook.getSheetRows(sheetName);
      const result = parseEntryFeeChecklistSheet(aoa);
      if (result.error) {
        await Swal.fire('นำเข้าไม่สำเร็จ', result.error, 'error');
        return false;
      }
      if (!result.rows.length) {
        await Swal.fire(
          'ไม่พบรายการ',
          `แท็บ “${sheetName}” ไม่มีแถวที่ค่าแรกเข้า = 800${result.skipped ? ` (ข้าม ${result.skipped} แถว)` : ''}`,
          'warning'
        );
        return false;
      }
      setRows(result.rows);
      setImportMeta({
        fileName: workbook.fileName,
        sheetName,
        skipped: result.skipped,
        mappedColumns: result.mappedColumns,
      });
      setQ('');
      setTeamFilter('');
      setAreaFilter('');
      setStatusFilter('');
      setSheetPicker(null);
      await Swal.fire({
        icon: 'success',
        title: 'นำเข้าแล้ว',
        html: `แท็บ <b>${sheetName}</b><br/>ได้ <b>${result.rows.length}</b> รายการ (ค่าแรกเข้า 800)` +
          (result.skipped ? `<br/>ข้าม ${result.skipped} แถว` : ''),
        timer: 2000,
        showConfirmButton: false,
      });
      return true;
    } catch (err) {
      await Swal.fire('ผิดพลาด', err.message || 'อ่านแท็บไม่สำเร็จ', 'error');
      return false;
    } finally {
      setConfirmingSheet(false);
    }
  };

  const applyImportFile = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const workbook = await readExcelWorkbook(file);
      if (!workbook.sheetNames.length) {
        await Swal.fire('นำเข้าไม่สำเร็จ', 'ไม่พบแท็บในไฟล์ Excel', 'error');
        return;
      }

      // Always let the user pick a tab after upload.
      setSheetPicker({
        fileName: workbook.fileName,
        sheetNames: workbook.sheetNames,
        getSheetRows: workbook.getSheetRows,
        selected: workbook.sheetNames[0],
        workbook,
      });
    } catch (err) {
      await Swal.fire('ผิดพลาด', err.message || 'อ่านไฟล์ไม่สำเร็จ', 'error');
    } finally {
      setImporting(false);
    }
  };

  const confirmSheetImport = async () => {
    if (!sheetPicker?.workbook || !sheetPicker.selected) return;
    await importFromSheet(sheetPicker.workbook, sheetPicker.selected);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    await applyImportFile(file);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      Swal.fire('ไฟล์ไม่รองรับ', 'กรุณาใช้ไฟล์ .xlsx หรือ .xls', 'warning');
      return;
    }
    await applyImportFile(file);
  };

  const handleExport = () => {
    if (!rows.length) {
      Swal.fire('ยังไม่มีข้อมูล', 'กรุณานำเข้าไฟล์ก่อน', 'warning');
      return;
    }
    exportEntryFeeChecklist(filtered.length === rows.length ? rows : filtered);
  };

  const handleExportAll = () => {
    if (!rows.length) {
      Swal.fire('ยังไม่มีข้อมูล', 'กรุณานำเข้าไฟล์ก่อน', 'warning');
      return;
    }
    exportEntryFeeChecklist(rows);
  };

  const clickStat = (key) => {
    setStatusFilter((prev) => (prev === key ? '' : key));
  };

  return (
    <div className="space-y-5" style={{ animation: 'fadeInUp 0.3s ease-out forwards' }}>
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white"
        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 0% 0%, rgba(163,230,53,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 0%, rgba(132,204,22,0.10), transparent 50%)',
          }}
        />
        <div className="relative p-5 md:p-7">
          <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#1F2937] text-[#A3E635] text-[10px] font-bold tracking-wide mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635] animate-pulse" />
                ค่าแรกเข้า 800 · ตรวจด้วยมือ
              </div>
              <h2 className="text-xl md:text-2xl font-black text-[#1F2937] tracking-tight">
                ตรวจรายการ / กรองข้อมูล
              </h2>
              <p className="text-sm text-[#6B7280] mt-2 leading-relaxed max-w-xl">
                Import รายการจาก Excel แล้วติ๊กว่า{' '}
                <span className="font-bold text-emerald-700">มี</span> /{' '}
                <span className="font-bold text-rose-600">ไม่มี</span> /{' '}
                <span className="font-bold text-sky-600">หน้างาน</span> จากนั้น Export คอลัมน์ต่อท้ายได้ทันที
                — ไม่ผูกกับประวัติในระบบ
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ['1', 'Import Excel'],
                  ['2', 'ติ๊ก มี / ไม่มี / หน้างาน'],
                  ['3', 'Export ผลตรวจ'],
                ].map(([n, label], i) => (
                  <div
                    key={n}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-[#E5E7EB] text-xs font-semibold text-[#374151]"
                  >
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#A3E635] to-[#84cc16] text-[#1F2937] flex items-center justify-center text-[10px] font-black">
                      {n}
                    </span>
                    {label}
                    {i < 2 && <span className="text-[#D1D5DB] ml-0.5 hidden sm:inline">→</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end shrink-0">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-[#1F2937] disabled:opacity-60 shadow-md shadow-lime-500/20 active:scale-[0.98] transition-transform"
                style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7 9m5-5l5 5M5 14v5h14v-5" />
                </svg>
                {importing ? 'กำลังอ่านไฟล์...' : 'Import Excel'}
              </button>
              <button
                type="button"
                onClick={handleExportAll}
                disabled={!rows.length}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-[#1F2937] text-white hover:bg-[#111827] disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                </svg>
                Export ทั้งหมด
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={!rows.length}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-white border border-[#E5E7EB] text-[#374151] hover:border-[#A3E635] hover:bg-[#F9FAFB] disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                Export ตามกรอง
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            </div>
          </div>
        </div>
      </div>

      {/* Empty dropzone */}
      {!rows.length && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !importing && fileRef.current?.click()}
          className={`cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-200 p-10 md:p-14 text-center ${
            dragOver
              ? 'border-[#84cc16] bg-lime-50 scale-[1.01]'
              : 'border-[#D1D5DB] bg-white hover:border-[#A3E635] hover:bg-[#FAFFE8]'
          }`}
          style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#A3E635]/30 to-[#84cc16]/20 border border-[#A3E635]/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="font-bold text-[#1F2937] text-lg">ลากไฟล์ Excel มาวางที่นี่</p>
          <p className="text-sm text-[#6B7280] mt-2">หรือคลิกเพื่อเลือกไฟล์ · รองรับ .xlsx / .xls</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2 text-[11px] font-semibold text-[#9CA3AF]">
            {['Appointment Date', 'Access Number', 'Customer Name', 'ค่าแรกเข้า=800', 'ทีมช่าง', 'พื้นที่'].map((tag) => (
              <span key={tag} className="px-2.5 py-1 rounded-lg bg-[#F3F4F6] border border-[#E5E7EB] text-[#6B7280]">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Stats + progress */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div
              className="col-span-2 lg:col-span-1 rounded-2xl border border-[#E5E7EB] bg-white p-4 flex items-center gap-3"
              style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
            >
              <ProgressRing value={stats.done} max={stats.total} />
              <div>
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">ความคืบหน้า</p>
                <p className="text-sm font-black text-[#1F2937] mt-0.5">
                  {stats.done}/{stats.total} ติ๊กแล้ว
                </p>
              </div>
            </div>

            {[
              { key: '', label: 'ทั้งหมด', value: stats.total, active: statusFilter === '', tone: 'hover:border-[#A3E635]' },
              { key: CHECK_STATUS.HAS, label: 'มี', value: stats.has, active: statusFilter === CHECK_STATUS.HAS, tone: 'hover:border-emerald-400', activeCls: 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' },
              { key: CHECK_STATUS.MISSING, label: 'ไม่มี', value: stats.missing, active: statusFilter === CHECK_STATUS.MISSING, tone: 'hover:border-rose-300', activeCls: 'border-rose-300 bg-rose-50 ring-2 ring-rose-100' },
              { key: CHECK_STATUS.ONSITE, label: 'หน้างาน', value: stats.onsite, active: statusFilter === CHECK_STATUS.ONSITE, tone: 'hover:border-sky-300', activeCls: 'border-sky-300 bg-sky-50 ring-2 ring-sky-100' },
              { key: 'unchecked', label: 'ยังไม่ติ๊ก', value: stats.unchecked, active: statusFilter === 'unchecked', tone: 'hover:border-amber-300', activeCls: 'border-amber-300 bg-amber-50 ring-2 ring-amber-100' },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => clickStat(item.key)}
                className={`text-left rounded-2xl border bg-white p-4 transition-all duration-150 active:scale-[0.98] ${
                  item.active && item.key !== ''
                    ? item.activeCls
                    : item.active
                      ? 'border-[#A3E635] bg-[#FAFFE8] ring-2 ring-[#A3E635]/20'
                      : `border-[#E5E7EB] ${item.tone}`
                }`}
                style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
              >
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">{item.label}</p>
                <p className="text-2xl font-black text-[#1F2937] mt-1 tabular-nums">{item.value}</p>
              </button>
            ))}
          </div>

          {/* Filters toolbar */}
          <div
            className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-3"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
          >
            {importMeta && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F3F4F6] text-[#4B5563] font-semibold max-w-full truncate">
                  <svg className="w-3.5 h-3.5 text-[#84cc16] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {importMeta.fileName}
                </span>
                {importMeta.sheetName && (
                  <span className="px-2.5 py-1 rounded-lg bg-lime-50 text-[#3f6212] border border-lime-200 font-semibold">
                    แท็บ: {importMeta.sheetName}
                  </span>
                )}
                {importMeta.skipped > 0 && (
                  <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-100 font-semibold">
                    ข้าม {importMeta.skipped} แถว
                  </span>
                )}
                <span className="text-[#9CA3AF]">
                  {importMeta.mappedColumns?.teamName
                    ? `ทีมช่างจาก “${importMeta.mappedColumns.teamName}”`
                    : 'ไม่พบคอลัมน์ทีมช่าง'}
                  {' · '}
                  {importMeta.mappedColumns?.areaName
                    ? `พื้นที่จาก “${importMeta.mappedColumns.areaName}”`
                    : 'ไม่พบคอลัมน์พื้นที่'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-2">
              <div className="relative xl:col-span-3">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหา Access / ชื่อ / ทีม / พื้นที่"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/35 focus:border-[#A3E635] transition-shadow"
                />
              </div>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="xl:col-span-2 px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/35"
              >
                <option value="">ทุกทีมช่าง</option>
                {teams.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="xl:col-span-2 px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/35"
              >
                <option value="">ทุกพื้นที่</option>
                {areas.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="xl:col-span-2 px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/35"
              >
                <option value="">ทุกสถานะ</option>
                <option value="unchecked">ยังไม่ติ๊ก</option>
                <option value="checked">ติ๊กแล้ว</option>
                <option value={CHECK_STATUS.HAS}>มี</option>
                <option value={CHECK_STATUS.MISSING}>ไม่มี</option>
                <option value={CHECK_STATUS.ONSITE}>หน้างาน</option>
              </select>
              <div className="xl:col-span-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => markAllFiltered(CHECK_STATUS.HAS)}
                  disabled={!filtered.length}
                  className="flex-1 px-2 py-2 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 active:scale-[0.97] transition-all"
                >
                  มีทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => markAllFiltered(CHECK_STATUS.MISSING)}
                  disabled={!filtered.length}
                  className="flex-1 px-2 py-2 rounded-xl text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 disabled:opacity-40 active:scale-[0.97] transition-all"
                >
                  ไม่มี
                </button>
                <button
                  type="button"
                  onClick={() => markAllFiltered(CHECK_STATUS.ONSITE)}
                  disabled={!filtered.length}
                  className="flex-1 px-2 py-2 rounded-xl text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 disabled:opacity-40 active:scale-[0.97] transition-all"
                >
                  หน้างาน
                </button>
                <button
                  type="button"
                  onClick={clearChecksFiltered}
                  disabled={!filtered.length}
                  className="px-2 py-2 rounded-xl text-[11px] font-bold bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB] disabled:opacity-40 active:scale-[0.97] transition-all"
                >
                  ล้าง
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div
            className="rounded-3xl border border-[#E5E7EB] bg-white overflow-hidden"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}
          >
            <div className="px-4 py-3 border-b border-[#F3F4F6] flex items-center justify-between gap-2 bg-gradient-to-r from-white to-[#FAFFE8]/50">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-[#A3E635] to-[#65a30d]" />
                <h3 className="text-sm font-bold text-[#1F2937]">รายการตรวจ</h3>
              </div>
              <span className="text-xs font-semibold text-[#9CA3AF]">
                แสดง {filtered.length.toLocaleString('th-TH')} / {rows.length.toLocaleString('th-TH')}
              </span>
            </div>

            <div className="overflow-x-auto max-h-[min(62vh,720px)] overflow-y-auto">
              <table className="w-full text-sm min-w-[1020px]">
                <thead className="bg-[#F9FAFB] text-[#6B7280] text-left sticky top-0 z-10 shadow-[0_1px_0_#E5E7EB]">
                  <tr>
                    <th className="px-3 py-3 font-semibold w-12">#</th>
                    <th className="px-3 py-3 font-semibold">วันนัด</th>
                    <th className="px-3 py-3 font-semibold">Access Number</th>
                    <th className="px-3 py-3 font-semibold">ชื่อลูกค้า</th>
                    <th className="px-3 py-3 font-semibold text-right">ค่าแรกเข้า</th>
                    <th className="px-3 py-3 font-semibold">ทีมช่าง</th>
                    <th className="px-3 py-3 font-semibold">พื้นที่</th>
                    <th className="px-3 py-3 font-semibold text-center min-w-[190px]">ตรวจสถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {!filtered.length ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-16 text-center text-[#9CA3AF]">
                        ไม่พบรายการตามเงื่อนไขกรอง
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, idx) => {
                      const rowTone =
                        row.checkStatus === CHECK_STATUS.HAS
                          ? 'bg-emerald-50/40'
                          : row.checkStatus === CHECK_STATUS.MISSING
                            ? 'bg-rose-50/40'
                            : row.checkStatus === CHECK_STATUS.ONSITE
                              ? 'bg-sky-50/40'
                              : 'bg-white';
                      return (
                        <tr
                          key={row.id}
                          className={`border-t border-[#F3F4F6] transition-colors duration-150 hover:bg-[#F9FAFB] ${rowTone}`}
                        >
                          <td className="px-3 py-3 text-[#9CA3AF] tabular-nums">{idx + 1}</td>
                          <td className="px-3 py-3 text-[#4B5563] whitespace-nowrap">
                            {row.appointmentDate || '—'}
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => copyAccessNumber(row)}
                              title="คลิกเพื่อคัดลอก Access Number"
                              className={`group inline-flex items-center gap-1.5 max-w-full rounded-xl px-2.5 py-1.5 font-mono font-bold tracking-tight transition-all duration-150 active:scale-[0.97] border ${
                                copiedId === `access:${row.id}`
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-[#F9FAFB] text-[#1F2937] border-[#E5E7EB] hover:border-[#A3E635] hover:bg-[#FAFFE8]'
                              }`}
                            >
                              <span className="truncate">{row.accessNumber}</span>
                              {copiedId === `access:${row.id}` ? (
                                <span className="shrink-0 text-[10px] font-black text-emerald-600">คัดลอกแล้ว</span>
                              ) : (
                                <svg className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF] group-hover:text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-3 max-w-[220px]">
                            {row.customerName ? (
                              <button
                                type="button"
                                onClick={() => copyCustomerName(row)}
                                title="คลิกเพื่อคัดลอกชื่อลูกค้า"
                                className={`group inline-flex items-center gap-1.5 max-w-full rounded-xl px-2.5 py-1.5 font-medium transition-all duration-150 active:scale-[0.97] border ${
                                  copiedId === `name:${row.id}`
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-[#F9FAFB] text-[#1F2937] border-[#E5E7EB] hover:border-[#A3E635] hover:bg-[#FAFFE8]'
                                }`}
                              >
                                <span className="truncate">{row.customerName}</span>
                                {copiedId === `name:${row.id}` ? (
                                  <span className="shrink-0 text-[10px] font-black text-emerald-600">คัดลอกแล้ว</span>
                                ) : (
                                  <svg className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF] group-hover:text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            ) : (
                              <span className="text-[#D1D5DB]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-bold bg-[#1F2937] text-[#A3E635]">
                              {row.entryFee}
                            </span>
                          </td>
                          <td className="px-3 py-3 max-w-[160px]">
                            {row.teamName ? (
                              <span className="inline-flex max-w-full truncate px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]" title={row.teamName}>
                                {row.teamName}
                              </span>
                            ) : (
                              <span className="text-[#D1D5DB]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 max-w-[140px]">
                            {row.areaName ? (
                              <span className="inline-flex max-w-full truncate px-2 py-0.5 rounded-lg text-xs font-semibold bg-lime-50 text-[#3f6212] border border-lime-200" title={row.areaName}>
                                {row.areaName}
                              </span>
                            ) : (
                              <span className="text-[#D1D5DB]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <StatusToggle
                              value={row.checkStatus}
                              onChange={(v) => setCheckStatus(row.id, v)}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 text-xs text-[#9CA3AF] border-t border-[#F3F4F6] flex flex-wrap items-center justify-between gap-2 bg-[#F9FAFB]/60">
              <span>Export จะต่อคอลัมน์ <b className="text-emerald-700">มี</b> / <b className="text-rose-600">ไม่มี</b> / <b className="text-sky-600">หน้างาน</b> ด้านหลังตาราง</span>
              <button
                type="button"
                onClick={() => {
                  setRows([]);
                  setImportMeta(null);
                  setQ('');
                  setTeamFilter('');
                  setAreaFilter('');
                  setStatusFilter('');
                }}
                className="font-semibold text-[#9CA3AF] hover:text-rose-600 transition-colors"
              >
                ล้างรายการทั้งหมด
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sheet picker after upload */}
      {sheetPicker && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-[#1F2937]/55 backdrop-blur-[2px]">
          <div
            className="w-full max-w-md rounded-3xl bg-white border border-[#E5E7EB] shadow-2xl overflow-hidden"
            style={{ animation: 'fadeInUp 0.22s ease-out forwards' }}
          >
            <div className="px-5 py-4 border-b border-[#F3F4F6] bg-gradient-to-r from-white to-[#FAFFE8]/70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">เลือกแท็บ Excel</p>
                  <h3 className="font-black text-[#1F2937] mt-0.5">จะนำเข้าจากแท็บไหน?</h3>
                  <p className="text-xs text-[#6B7280] mt-1 truncate max-w-[280px]" title={sheetPicker.fileName}>
                    {sheetPicker.fileName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !confirmingSheet && setSheetPicker(null)}
                  className="p-2 rounded-xl text-[#9CA3AF] hover:text-[#1F2937] hover:bg-[#F3F4F6] transition-colors"
                  disabled={confirmingSheet}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 max-h-[50vh] overflow-y-auto space-y-2">
              {sheetPicker.sheetNames.map((name) => {
                const active = sheetPicker.selected === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSheetPicker((prev) => prev ? { ...prev, selected: name } : prev)}
                    className={`w-full text-left px-4 py-3 rounded-2xl border transition-all duration-150 active:scale-[0.99] ${
                      active
                        ? 'border-[#84cc16] bg-[#FAFFE8] ring-2 ring-[#A3E635]/25'
                        : 'border-[#E5E7EB] bg-white hover:border-[#A3E635] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          active
                            ? 'bg-gradient-to-br from-[#A3E635] to-[#84cc16] text-[#1F2937]'
                            : 'bg-[#F3F4F6] text-[#6B7280]'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h6l2 2h10v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[#1F2937] truncate">{name}</p>
                        <p className="text-[11px] text-[#9CA3AF]">{active ? 'เลือกอยู่' : 'แตะเพื่อเลือก'}</p>
                      </div>
                      {active && (
                        <span className="text-[10px] font-black text-[#65a30d] shrink-0">เลือกแล้ว</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="px-4 py-4 border-t border-[#F3F4F6] flex gap-2">
              <button
                type="button"
                onClick={() => setSheetPicker(null)}
                disabled={confirmingSheet}
                className="flex-1 py-3 rounded-2xl text-sm font-bold border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmSheetImport}
                disabled={confirmingSheet || !sheetPicker.selected}
                className="flex-[1.4] py-3 rounded-2xl text-sm font-bold text-[#1F2937] disabled:opacity-60 active:scale-[0.98] transition-transform"
                style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)' }}
              >
                {confirmingSheet ? 'กำลังนำเข้า...' : `นำเข้าแท็บ “${sheetPicker.selected}”`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
