import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  FileSpreadsheet,
  Menu,
  RefreshCw,
  Search,
  ShieldAlert,
  Upload,
  Users,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';
import Swal from 'sweetalert2';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';
import QualityStatusImportModal from '../components/QualityStatusImportModal';
import axios from '../api/axios';

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function formatDate(value) {
  if (!value) return '-';
  const iso = String(value).slice(0, 10);
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

function formatMonth(value) {
  if (!value) return '-';
  const [year, month] = String(value).split('-').map(Number);
  if (!year || !month) return value;
  return `${THAI_MONTHS[month - 1]} ${year + 543}`;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function isSuspended(value) {
  return /(suspend|debt|ระงับ|ค้าง)/i.test(String(value || ''));
}

function rowOutcome(row, type) {
  if (row.is_case) return { key: 'case', label: type === 'fraud' ? 'Fraud' : 'Churn', tone: 'danger' };
  if (isSuspended(row.qc_status)) return { key: 'suspended', label: 'เฝ้าระวัง', tone: 'warning' };
  if (Number(row.outstanding_bills) > 0) return { key: 'outstanding', label: 'ติดตามบิล', tone: 'info' };
  return { key: 'normal', label: 'ผ่านเงื่อนไข', tone: 'success' };
}

export default function QualityControlPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [qcType, setQcType] = useState('fraud');
  const [month, setMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('all');
  const [seller, setSeller] = useState('all');
  const [lifecycle, setLifecycle] = useState('all');
  const [sortBy, setSortBy] = useState('install_asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const loadOptions = useCallback(async (preserveMonth = true) => {
    setLoadingOptions(true);
    try {
      const response = await axios.get('/installed-customers/qc-options');
      const months = response.data?.months || [];
      setAvailableMonths(months);
      setMonth((current) => {
        if (preserveMonth && months.some((item) => item.value === current)) return current;
        return response.data?.latest_month || '';
      });
    } catch (error) {
      Swal.fire('โหลดเดือนข้อมูลไม่สำเร็จ', error.response?.data?.error || error.message, 'error');
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    // Initial API hydration is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOptions(false);
  }, [loadOptions]);

  const runCalculate = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    try {
      const response = await axios.get('/installed-customers/qc', { params: { type: qcType, month } });
      setResult(response.data);
    } catch (error) {
      setResult(null);
      Swal.fire('คำนวณไม่สำเร็จ', error.response?.data?.error || error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [month, qcType]);

  useEffect(() => {
    // Recalculate when the user changes the QC scope.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runCalculate();
  }, [runCalculate]);

  const sellers = useMemo(() => Array.from(new Set(
    (result?.customers || []).map((row) => row.seller_name).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'th')), [result]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = (result?.customers || []).filter((row) => {
      const outcome = rowOutcome(row, qcType);
      if (view !== 'all' && outcome.key !== view) return false;
      if (seller !== 'all' && row.seller_name !== seller) return false;
      if (lifecycle !== 'all' && row.status !== lifecycle) return false;
      if (!query) return true;
      return [row.customer_name, row.non_number, row.package_name, row.seller_name, row.district, row.qc_status]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
    return rows.sort((a, b) => {
      if (sortBy === 'outstanding_desc') return Number(b.outstanding_total) - Number(a.outstanding_total);
      if (sortBy === 'name_asc') return String(a.customer_name).localeCompare(String(b.customer_name), 'th');
      if (sortBy === 'status') return rowOutcome(a, qcType).key.localeCompare(rowOutcome(b, qcType).key);
      return String(a.install_date).localeCompare(String(b.install_date)) || String(a.non_number).localeCompare(String(b.non_number));
    });
  }, [result, search, view, seller, lifecycle, sortBy, qcType]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportWorkbook = async () => {
    if (!result?.customers?.length || exporting) return;
    setExporting(true);
    try {
      const { exportQualityWorkbook } = await import('../utils/qcExport');
      await exportQualityWorkbook(result);
      Swal.fire({
        icon: 'success',
        title: 'สร้างไฟล์เรียบร้อย',
        text: `Export ลูกค้าทั้งหมด ${result.customers.length.toLocaleString('th-TH')} รายการ ตามรูปแบบไฟล์ต้นฉบับแล้ว`,
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire('Export ไม่สำเร็จ', error.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const viewCounts = useMemo(() => {
    const counts = { all: 0, case: 0, outstanding: 0, suspended: 0, normal: 0 };
    for (const row of result?.customers || []) {
      counts.all += 1;
      counts[rowOutcome(row, qcType).key] += 1;
    }
    return counts;
  }, [result, qcType]);

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F4F7F2] font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="quality_control" />

      <div className="flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ease-out md:ml-[var(--sidebar-width)]">
        <header className="z-30 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 md:hidden" aria-label="เปิดเมนู">
              <Menu className="h-5 w-5" />
            </button>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#78BE20] text-slate-950 shadow-sm">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 dark:text-white sm:text-lg">ควบคุมคุณภาพ Fraud / Churn</h1>
              <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">ตรวจลูกค้าทั้งหมด สถานะ CM และบิลรายเดือนจากข้อมูลนำเข้าล่าสุด</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setImportOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-lime-300 bg-lime-50 px-3 text-sm font-bold text-lime-800 transition hover:bg-lime-100 dark:border-lime-700 dark:bg-lime-950 dark:text-lime-300">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">นำเข้าข้อมูล</span>
            </button>
            <button type="button" onClick={exportWorkbook} disabled={!result?.customers?.length || exporting} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#78BE20] dark:text-slate-950">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{exporting ? 'กำลัง Export...' : 'Export Excel'}</span>
            </button>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1680px] space-y-5 p-4 sm:p-6">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-6">
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setQcType('fraud')} className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition ${qcType === 'fraud' ? 'border-amber-300 bg-amber-50 text-amber-900 ring-2 ring-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900'}`}>
                      Fraud · 4 เดือน · เกณฑ์ 3%
                    </button>
                    <button type="button" onClick={() => setQcType('churn')} className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition ${qcType === 'churn' ? 'border-rose-300 bg-rose-50 text-rose-900 ring-2 ring-rose-100 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900'}`}>
                      Churn · 8 เดือน · เกณฑ์ 1.5%
                    </button>
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    ระบบเลือกเฉพาะเดือนติดตั้งที่มีข้อมูลจริง และนับเดือนที่เลือกเป็นเดือนสุดท้ายของช่วงตรวจสอบ ลูกค้าที่ Terminate/Disconnect ภายในอายุ {qcType === 'fraud' ? '4' : '8'} เดือนจะถูกนับเป็นเคส
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-[240px]">
                    <label htmlFor="qc-month" className="mb-1.5 block text-xs font-bold normal-case tracking-normal text-slate-600 dark:text-slate-300">เดือนติดตั้งอ้างอิง</label>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select id="qc-month" value={month} onChange={(event) => setMonth(event.target.value)} disabled={loadingOptions || !availableMonths.length} className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-8 text-sm font-bold text-slate-800 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                        {!availableMonths.length && <option value="">ยังไม่มีข้อมูลติดตั้ง</option>}
                        {availableMonths.map((item) => <option key={item.value} value={item.value}>{formatMonth(item.value)} · {item.total.toLocaleString('th-TH')} ราย</option>)}
                      </select>
                    </div>
                  </div>
                  <button type="button" onClick={runCalculate} disabled={!month || loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#78BE20] px-5 text-sm font-black text-slate-950 shadow-sm transition hover:bg-[#69AA18] disabled:opacity-50">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    อัปเดตผล
                  </button>
                </div>
              </div>
              {result && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 lg:px-6">
                  <span><b>ช่วงติดตั้ง:</b> {formatMonth(result.cohort_start_month)} – {formatMonth(result.cohort_end_month)}</span>
                  <span><b>ช่วงบิล:</b> {formatMonth(result.bill_months?.[0])} – {formatMonth(result.bill_months?.at(-1))}</span>
                  <span><b>ข้อมูลทั้งหมด:</b> {Number(result.total_installs).toLocaleString('th-TH')} ราย</span>
                </div>
              )}
            </section>

            {loading && !result ? <LoadingState /> : result ? (
              <>
                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <MetricCard icon={Users} label="ลูกค้าในช่วง" value={result.total_installs} note={`${formatMonth(result.cohort_start_month)} – ${formatMonth(result.cohort_end_month)}`} />
                  <MetricCard icon={XCircle} label={`เคส ${qcType === 'fraud' ? 'Fraud' : 'Churn'}`} value={result.cases} note={`อัตรา ${result.rate}% / เกณฑ์ ${result.threshold_rate}%`} tone={Number(result.cases) > 0 ? 'danger' : 'success'} />
                  <MetricCard icon={CheckCircle2} label="จำนวนที่รับได้" value={result.allowed_cases} note={Number(result.over_limit) > 0 ? `เกินเกณฑ์ ${result.over_limit} ราย` : 'ยังไม่เกินเกณฑ์'} tone={Number(result.over_limit) > 0 ? 'warning' : 'success'} />
                  <MetricCard icon={WalletCards} label="ลูกค้ามีบิลค้าง" value={result.outstanding_customers} note={`${Number(result.outstanding_bills).toLocaleString('th-TH')} บิลในช่วงตรวจ`} tone="warning" />
                  <MetricCard icon={CircleDollarSign} label="ยอดค้างรวม" value={`${formatMoney(result.outstanding_total)} ฿`} note={`ระงับ/หนี้ ${Number(result.suspended_customers).toLocaleString('th-TH')} ราย`} tone="info" />
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">รายการตรวจสอบทั้งหมด</h2>
                        <p className="mt-1 text-xs text-slate-500">กด “ดูข้อมูล” เพื่อเช็กข้อมูลลูกค้าและบิลทุกเดือนแบบเดียวกับไฟล์ต้นฉบับ</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:items-center">
                        <div className="relative min-w-[280px] sm:col-span-2 xl:col-span-1">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ, NON, แพ็กเกจ, ผู้ขาย..." className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100 dark:border-slate-700 dark:bg-slate-950" />
                        </div>
                        <select value={seller} onChange={(event) => setSeller(event.target.value)} className="h-10 min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950">
                          <option value="all">ผู้ขายทั้งหมด</option>
                          {sellers.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <select value={lifecycle} onChange={(event) => setLifecycle(event.target.value)} className="h-10 min-w-[145px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950">
                          <option value="all">สถานะทั้งหมด</option>
                          <option value="active">ยังใช้งาน</option>
                          <option value="cancelled">ยกเลิกแล้ว</option>
                        </select>
                        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="h-10 min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950">
                          <option value="install_asc">เรียงตามวันติดตั้ง</option>
                          <option value="outstanding_desc">ยอดค้างมากสุด</option>
                          <option value="name_asc">เรียงตามชื่อลูกค้า</option>
                          <option value="status">เรียงตามผลตรวจ</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                      {[
                        ['all', 'ทั้งหมด'],
                        ['case', qcType === 'fraud' ? 'เคส Fraud' : 'เคส Churn'],
                        ['outstanding', 'ติดตามบิล'],
                        ['suspended', 'เฝ้าระวัง'],
                        ['normal', 'ผ่านเงื่อนไข'],
                      ].map(([key, label]) => (
                        <button key={key} type="button" onClick={() => setView(key)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition ${view === key ? 'border-lime-400 bg-lime-100 text-lime-900 dark:border-lime-700 dark:bg-lime-950 dark:text-lime-200' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>
                          {label} <span className="ml-1 opacity-70">{viewCounts[key].toLocaleString('th-TH')}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1480px] text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-bold text-slate-600 shadow-[0_1px_0_#e2e8f0] dark:bg-slate-950 dark:text-slate-300">
                        <tr>
                          <th className="w-16 px-4 py-3 text-center">ลำดับ</th>
                          <th className="min-w-[240px] px-4 py-3">ลูกค้า / NON</th>
                          <th className="min-w-[260px] px-4 py-3">แพ็กเกจ / ค่าใช้จ่าย</th>
                          <th className="min-w-[170px] px-4 py-3">วันติดตั้ง / ครบ 128 วัน</th>
                          <th className="min-w-[170px] px-4 py-3">ผู้ขาย / พื้นที่</th>
                          <th className="min-w-[210px] px-4 py-3">CM / Billing</th>
                          <th className="min-w-[160px] px-4 py-3 text-right">บิลค้าง</th>
                          <th className="min-w-[150px] px-4 py-3">ผลตรวจ</th>
                          <th className="sticky right-0 z-20 w-28 border-l border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-slate-800 dark:bg-slate-950">ข้อมูลทั้งหมด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row, index) => {
                          const outcome = rowOutcome(row, qcType);
                          return (
                            <tr key={row.id} className="group border-t border-slate-100 align-middle transition hover:bg-lime-50/40 dark:border-slate-800 dark:hover:bg-lime-950/20">
                              <td className="px-4 py-3 text-center text-xs text-slate-400">{(currentPage - 1) * pageSize + index + 1}</td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-900 dark:text-white">{row.customer_name || '-'}</div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><span className="font-mono font-bold text-slate-700 dark:text-slate-300">{row.non_number}</span><span>·</span><span>{row.contact_phone || 'ไม่มีเบอร์ติดต่อ'}</span></div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="max-w-[330px] truncate font-semibold text-slate-700 dark:text-slate-200" title={row.package_name}>{row.package_name || '-'}</div>
                                <div className="mt-1 text-xs font-bold text-slate-500">{formatMoney(row.monthly_fee)} บาท/เดือน</div>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                                <div><b>ติดตั้ง:</b> {formatDate(row.install_date)}</div>
                                <div className="mt-1"><b>ครบกำหนด:</b> {formatDate(row.tracking_due_at)} <span className={Number(row.tracking_days_remaining) < 0 ? 'font-bold text-rose-600' : 'font-bold text-emerald-700'}>({Number(row.tracking_days_remaining) >= 0 ? 'เหลือ' : 'เกิน'} {Math.abs(Number(row.tracking_days_remaining))} วัน)</span></div>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                                <div className="font-bold text-slate-700 dark:text-slate-200">{row.seller_name || '-'}</div>
                                <div className="mt-1">{[row.subdistrict, row.district].filter(Boolean).join(' / ') || '-'}</div>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge value={row.qc_status || row.status} />
                                <div className="mt-1.5 max-w-[230px] truncate text-xs text-slate-500" title={row.billing_status}>{row.billing_status || 'ไม่มีสถานะ Billing'}</div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className={`font-black ${Number(row.outstanding_total) > 0 ? 'text-amber-700' : 'text-slate-500'}`}>{formatMoney(row.outstanding_total)} บาท</div>
                                <div className="mt-1 text-xs text-slate-500">{Number(row.outstanding_bills).toLocaleString('th-TH')} บิล · มีข้อมูล {Number(row.bill_rows).toLocaleString('th-TH')} เดือน</div>
                              </td>
                              <td className="px-4 py-3"><OutcomeBadge outcome={outcome} /></td>
                              <td className="sticky right-0 z-10 border-l border-slate-100 bg-white px-4 py-3 text-center transition group-hover:bg-lime-50 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-lime-950">
                                <button type="button" onClick={() => setSelectedCustomer(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-lime-400 hover:bg-lime-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                                  <Eye className="h-3.5 w-3.5" /> ดูข้อมูล
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!pageRows.length && <EmptyTable hasSearch={Boolean(search || seller !== 'all' || lifecycle !== 'all' || view !== 'all')} />}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span>แสดง</span>
                      <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900">
                        {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                      <span>จาก {filteredRows.length.toLocaleString('th-TH')} รายการ</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900" aria-label="หน้าก่อนหน้า"><ChevronLeft className="h-4 w-4" /></button>
                      <span className="min-w-24 text-center font-bold">หน้า {currentPage} / {totalPages}</span>
                      <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900" aria-label="หน้าถัดไป"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
                <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-300" />
                <h2 className="mt-4 font-bold text-slate-700 dark:text-slate-200">ยังไม่มีข้อมูลสำหรับตรวจสอบ</h2>
                <p className="mt-1 text-sm text-slate-500">นำเข้าไฟล์ต้นฉบับก่อน แล้วระบบจะแสดงเดือนที่มีข้อมูลให้อัตโนมัติ</p>
              </section>
            )}
          </div>
        </main>
      </div>

      <QualityStatusImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={async () => {
          setImportOpen(false);
          await loadOptions(false);
          await runCalculate();
        }}
      />

      {selectedCustomer && (
        <CustomerDetailDrawer
          customer={selectedCustomer}
          type={qcType}
          billMonths={result?.bill_months || []}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, note, tone = 'default' }) {
  const tones = {
    default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    danger: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    info: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 truncate text-2xl font-black text-slate-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString('th-TH') : value}</p></div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      </div>
      <p className="mt-3 truncate text-xs text-slate-500" title={note}>{note}</p>
    </div>
  );
}

function StatusBadge({ value }) {
  if (!value) return <span className="text-xs text-slate-400">-</span>;
  const className = /(terminate|disconnect|cancel|ยกเลิก|ตัดบริการ)/i.test(value)
    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
    : isSuspended(value)
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
  return <span className={`inline-flex max-w-[210px] truncate rounded-full px-2.5 py-1 text-xs font-bold ${className}`} title={value}>{value}</span>;
}

function OutcomeBadge({ outcome }) {
  const classes = {
    danger: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300',
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
    info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${classes[outcome.tone]}`}>{outcome.label}</span>;
}

function LoadingState() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="m-4 h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" /><div className="mx-4 h-8 w-20 rounded bg-slate-100 dark:bg-slate-800" /></div>)}
    </div>
  );
}

function EmptyTable({ hasSearch }) {
  return (
    <div className="py-16 text-center text-slate-500">
      <Search className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 font-bold">{hasSearch ? 'ไม่พบข้อมูลตามตัวกรอง' : 'ไม่มีลูกค้าในช่วงเดือนนี้'}</p>
      <p className="mt-1 text-xs">{hasSearch ? 'ลองล้างคำค้นหาหรือเปลี่ยนตัวกรอง' : 'เลือกเดือนติดตั้งอื่นเพื่อตรวจสอบ'}</p>
    </div>
  );
}

function CustomerDetailDrawer({ customer, type, billMonths, onClose }) {
  const outcome = rowOutcome(customer, type);
  const billsByMonth = new Map((customer.bills || []).map((bill) => [bill.bill_month, bill]));
  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="customer-detail-title">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" aria-label="ปิดรายละเอียด" />
      <aside className="relative flex h-full w-full max-w-3xl flex-col bg-[#F8FAF7] shadow-2xl dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><OutcomeBadge outcome={outcome} /><span className="text-xs text-slate-500">NON {customer.non_number}</span></div>
            <h2 id="customer-detail-title" className="mt-2 truncate text-xl font-black text-slate-900 dark:text-white">{customer.customer_name}</h2>
            <p className="mt-1 truncate text-sm text-slate-500" title={customer.package_name}>{customer.package_name}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950" aria-label="ปิด"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <DetailSection title="ข้อมูลลูกค้า">
            <DetailGrid items={[
              ['Access Number / NON', customer.non_number],
              ['เบอร์ติดต่อ', customer.contact_phone],
              ['ค่าใช้จ่ายต่อเดือน', `${formatMoney(customer.monthly_fee)} บาท`],
              ['ผู้ขาย', customer.seller_name],
              ['ตำบล', customer.subdistrict],
              ['อำเภอ', customer.district],
            ]} />
          </DetailSection>

          <DetailSection title="ระยะเวลาติดตาม 128 วัน">
            <DetailGrid items={[
              ['วันติดตั้ง', formatDate(customer.install_date)],
              ['วันที่ครบ 128 วัน', formatDate(customer.tracking_due_at)],
              ['ระยะเวลาคงเหลือ', `${Number(customer.tracking_days_remaining) >= 0 ? 'เหลือ' : 'เกิน'} ${Math.abs(Number(customer.tracking_days_remaining))} วัน`],
              ['กำหนดชำระ', customer.payment_due_day ? `วันที่ ${customer.payment_due_day}` : '-'],
              ['เดือนติดตั้งสำเร็จ', customer.install_month_label || formatMonth(String(customer.install_date).slice(0, 7))],
              ['สรุปสำรอง/ยกเลิก', customer.tracking_summary || customer.cancel_reason],
              ['วันที่ยกเลิก', formatDate(customer.cancelled_at)],
              ['คาดการณ์ Terminate', formatDate(customer.expected_terminate_at)],
            ]} />
          </DetailSection>

          <DetailSection title="สถานะติดตามล่าสุด">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoPanel label="CM สถานะ"><StatusBadge value={customer.qc_status || customer.status} /></InfoPanel>
              <InfoPanel label="Billing"><p className="text-sm font-bold text-slate-800 dark:text-slate-100">{customer.billing_status || '-'}</p></InfoPanel>
              <InfoPanel label="เดือนที่เปลี่ยนสถานะ"><p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatDate(customer.status_changed_at)}</p></InfoPanel>
              <InfoPanel label="วันที่เช็คยอด"><p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatDate(customer.bill_check_date)}</p></InfoPanel>
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-bold text-slate-500">ผลการติดตาม / AE Remark</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{customer.ae_remark || '-'}</p></div>
          </DetailSection>

          <DetailSection title={`บิลรายเดือน · ค้าง ${Number(customer.outstanding_bills).toLocaleString('th-TH')} บิล รวม ${formatMoney(customer.outstanding_total)} บาท`}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {billMonths.map((ym) => <BillCard key={ym} month={ym} bill={billsByMonth.get(ym)} />)}
              {!billMonths.length && <p className="text-sm text-slate-500">ยังไม่มีข้อมูลบิลรายเดือน</p>}
            </div>
          </DetailSection>

          <DetailSection title="ที่มาของข้อมูล">
            <DetailGrid items={[
              ['ชีตต้นฉบับ', customer.source_sheet],
              ['แถวต้นฉบับ', customer.source_row_number],
              ['นำเข้าล่าสุด', formatDate(customer.last_imported_at)],
              ['สถานะระบบ', customer.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'ยังใช้งาน'],
            ]} />
          </DetailSection>
        </div>
      </aside>
    </div>
  );
}

function DetailSection({ title, children }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="mb-3 text-sm font-black text-slate-900 dark:text-white">{title}</h3>{children}</section>;
}

function DetailGrid({ items }) {
  return <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">{items.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{value || '-'}</dd></div>)}</dl>;
}

function InfoPanel({ label, children }) {
  return <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="mb-1 text-xs font-bold text-slate-500">{label}</p>{children}</div>;
}

function BillCard({ month, bill }) {
  const tone = !bill
    ? 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950'
    : bill.bill_status === 'paid'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
      : ['outstanding', 'overdue'].includes(bill.bill_status)
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
        : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300';
  const value = !bill ? 'ไม่มีข้อมูล' : bill.bill_status === 'paid' ? 'จ่ายแล้ว' : bill.raw_value || `${formatMoney(bill.amount)} บาท`;
  return <div className={`rounded-xl border p-3 ${tone}`}><p className="text-xs font-bold opacity-70">{formatMonth(month)}</p><p className="mt-1 truncate text-sm font-black" title={String(value)}>{value}</p></div>;
}
