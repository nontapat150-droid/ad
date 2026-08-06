import { useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import {
  exportEntryFeeChecklist,
  parseEntryFeeChecklistSheet,
  readExcelToAoA,
} from '../utils/entryFeeChecklist';

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
  return (
    <div className="inline-flex rounded-xl bg-[#F3F4F6] p-0.5 border border-[#E5E7EB]">
      <button
        type="button"
        onClick={() => onChange(value === true ? null : true)}
        className={`min-w-[52px] px-2.5 py-1.5 rounded-[10px] text-xs font-bold transition-all duration-150 active:scale-[0.97] ${
          value === true
            ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25'
            : 'text-[#6B7280] hover:text-emerald-700 hover:bg-emerald-50'
        }`}
      >
        มี
      </button>
      <button
        type="button"
        onClick={() => onChange(value === false ? null : false)}
        className={`min-w-[52px] px-2.5 py-1.5 rounded-[10px] text-xs font-bold transition-all duration-150 active:scale-[0.97] ${
          value === false
            ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/25'
            : 'text-[#6B7280] hover:text-rose-700 hover:bg-rose-50'
        }`}
      >
        ไม่มี
      </button>
    </div>
  );
}

export default function EntryFeeChecklistPanel() {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [importMeta, setImportMeta] = useState(null);
  const [q, setQ] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const teams = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.teamName) set.add(r.teamName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
  }, [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (teamFilter && row.teamName !== teamFilter) return false;
      if (statusFilter === 'checked' && row.hasData == null) return false;
      if (statusFilter === 'unchecked' && row.hasData != null) return false;
      if (statusFilter === 'has' && row.hasData !== true) return false;
      if (statusFilter === 'missing' && row.hasData !== false) return false;
      if (!query) return true;
      return (
        row.accessNumber.toLowerCase().includes(query) ||
        row.customerName.toLowerCase().includes(query) ||
        row.teamName.toLowerCase().includes(query) ||
        String(row.appointmentDate).toLowerCase().includes(query)
      );
    });
  }, [rows, q, teamFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const has = rows.filter((r) => r.hasData === true).length;
    const missing = rows.filter((r) => r.hasData === false).length;
    const unchecked = total - has - missing;
    return { total, has, missing, unchecked, done: has + missing };
  }, [rows]);

  const setHasData = (id, value) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, hasData: value } : row))
    );
  };

  const markAllFiltered = (value) => {
    const ids = new Set(filtered.map((r) => r.id));
    setRows((prev) =>
      prev.map((row) => (ids.has(row.id) ? { ...row, hasData: value } : row))
    );
  };

  const clearChecksFiltered = () => {
    const ids = new Set(filtered.map((r) => r.id));
    setRows((prev) =>
      prev.map((row) => (ids.has(row.id) ? { ...row, hasData: null } : row))
    );
  };

  const applyImportFile = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const aoa = await readExcelToAoA(file);
      const result = parseEntryFeeChecklistSheet(aoa);
      if (result.error) {
        await Swal.fire('นำเข้าไม่สำเร็จ', result.error, 'error');
        return;
      }
      if (!result.rows.length) {
        await Swal.fire(
          'ไม่พบรายการ',
          `ไม่มีแถวที่ค่าแรกเข้า = 800${result.skipped ? ` (ข้าม ${result.skipped} แถว)` : ''}`,
          'warning'
        );
        return;
      }
      setRows(result.rows);
      setImportMeta({
        fileName: file.name,
        skipped: result.skipped,
        mappedColumns: result.mappedColumns,
      });
      setQ('');
      setTeamFilter('');
      setStatusFilter('');
      await Swal.fire({
        icon: 'success',
        title: 'นำเข้าแล้ว',
        html: `ได้ <b>${result.rows.length}</b> รายการ (ค่าแรกเข้า 800)` +
          (result.skipped ? `<br/>ข้าม ${result.skipped} แถว` : ''),
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      await Swal.fire('ผิดพลาด', err.message || 'อ่านไฟล์ไม่สำเร็จ', 'error');
    } finally {
      setImporting(false);
    }
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
                Import รายการจาก Excel แล้วติ๊กว่า <span className="font-bold text-emerald-700">มี</span> หรือ{' '}
                <span className="font-bold text-rose-600">ไม่มี</span> จากนั้น Export คอลัมน์ต่อท้ายได้ทันที
                — ไม่ผูกกับประวัติในระบบ
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ['1', 'Import Excel'],
                  ['2', 'ติ๊ก มี / ไม่มี'],
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
            {['Appointment Date', 'Access Number', 'Customer Name', 'ค่าแรกเข้า=800', 'ทีมช่าง'].map((tag) => (
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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
              { key: 'has', label: 'มี', value: stats.has, active: statusFilter === 'has', tone: 'hover:border-emerald-400', activeCls: 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' },
              { key: 'missing', label: 'ไม่มี', value: stats.missing, active: statusFilter === 'missing', tone: 'hover:border-rose-300', activeCls: 'border-rose-300 bg-rose-50 ring-2 ring-rose-100' },
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
                {importMeta.skipped > 0 && (
                  <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-100 font-semibold">
                    ข้าม {importMeta.skipped} แถว
                  </span>
                )}
                <span className="text-[#9CA3AF]">
                  {importMeta.mappedColumns?.teamName
                    ? `ทีมช่างจาก “${importMeta.mappedColumns.teamName}”`
                    : 'ไม่พบคอลัมน์ทีมช่าง'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-2">
              <div className="relative xl:col-span-4">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหา Access / ชื่อ / ทีม"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/35 focus:border-[#A3E635] transition-shadow"
                />
              </div>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="xl:col-span-3 px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/35"
              >
                <option value="">ทุกทีมช่าง</option>
                {teams.map((team) => (
                  <option key={team} value={team}>{team}</option>
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
                <option value="has">มี</option>
                <option value="missing">ไม่มี</option>
              </select>
              <div className="xl:col-span-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => markAllFiltered(true)}
                  disabled={!filtered.length}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 active:scale-[0.97] transition-all"
                >
                  ติ๊กมีทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => markAllFiltered(false)}
                  disabled={!filtered.length}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 disabled:opacity-40 active:scale-[0.97] transition-all"
                >
                  ติ๊กไม่มี
                </button>
                <button
                  type="button"
                  onClick={clearChecksFiltered}
                  disabled={!filtered.length}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB] disabled:opacity-40 active:scale-[0.97] transition-all"
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
              <table className="w-full text-sm min-w-[920px]">
                <thead className="bg-[#F9FAFB] text-[#6B7280] text-left sticky top-0 z-10 shadow-[0_1px_0_#E5E7EB]">
                  <tr>
                    <th className="px-3 py-3 font-semibold w-12">#</th>
                    <th className="px-3 py-3 font-semibold">วันนัด</th>
                    <th className="px-3 py-3 font-semibold">Access Number</th>
                    <th className="px-3 py-3 font-semibold">ชื่อลูกค้า</th>
                    <th className="px-3 py-3 font-semibold text-right">ค่าแรกเข้า</th>
                    <th className="px-3 py-3 font-semibold">ทีมช่าง</th>
                    <th className="px-3 py-3 font-semibold text-center min-w-[140px]">ตรวจสถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {!filtered.length ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-16 text-center text-[#9CA3AF]">
                        ไม่พบรายการตามเงื่อนไขกรอง
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, idx) => {
                      const rowTone =
                        row.hasData === true
                          ? 'bg-emerald-50/40'
                          : row.hasData === false
                            ? 'bg-rose-50/40'
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
                            <span className="font-mono font-bold text-[#1F2937] tracking-tight">
                              {row.accessNumber}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-[#1F2937] max-w-[200px] truncate font-medium" title={row.customerName}>
                            {row.customerName || '—'}
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
                          <td className="px-3 py-3 text-center">
                            <StatusToggle
                              value={row.hasData}
                              onChange={(v) => setHasData(row.id, v)}
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
              <span>Export จะต่อคอลัมน์ <b className="text-emerald-700">มี</b> และ <b className="text-rose-600">ไม่มี</b> ด้านหลังตาราง</span>
              <button
                type="button"
                onClick={() => {
                  setRows([]);
                  setImportMeta(null);
                  setQ('');
                  setTeamFilter('');
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
    </div>
  );
}
