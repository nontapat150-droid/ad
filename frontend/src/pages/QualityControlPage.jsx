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
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
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
const DEFAULT_QC_SETTINGS = {
  fraud: { enabled: true, threshold_rate: 3, months: 4 },
  churn: { enabled: true, threshold_rate: 1.5, months: 8 },
};

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
  const [qcSettings, setQcSettings] = useState(DEFAULT_QC_SETTINGS);
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
      const nextSettings = response.data?.settings?.fraud && response.data?.settings?.churn
        ? response.data.settings
        : DEFAULT_QC_SETTINGS;
      setAvailableMonths(months);
      setQcSettings(nextSettings);
      setQcType((current) => {
        if (nextSettings[current]?.enabled) return current;
        if (nextSettings.fraud.enabled) return 'fraud';
        if (nextSettings.churn.enabled) return 'churn';
        return current;
      });
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
    if (!qcSettings[qcType]?.enabled) {
      setResult(null);
      return null;
    }
    setLoading(true);
    try {
      const response = await axios.get('/installed-customers/qc', { params: { type: qcType, month } });
      setResult(response.data);
      return response.data;
    } catch (error) {
      setResult(null);
      if (error.response?.data?.settings) setQcSettings(error.response.data.settings);
      Swal.fire('คำนวณไม่สำเร็จ', error.response?.data?.error || error.message, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [month, qcSettings, qcType]);

  const refreshCustomer = useCallback(async (customerId) => {
    const nextResult = await runCalculate();
    if (!nextResult) return null;
    const updated = (nextResult.customers || []).find((item) => Number(item.id) === Number(customerId)) || null;
    setSelectedCustomer(updated);
    return updated;
  }, [runCalculate]);

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

  const activeQcConfig = qcSettings[qcType] || DEFAULT_QC_SETTINGS[qcType];
  const anyQcEnabled = Boolean(qcSettings.fraud?.enabled || qcSettings.churn?.enabled);

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
                    <button type="button" onClick={() => setQcType('fraud')} disabled={!qcSettings.fraud?.enabled} className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:ring-0 dark:disabled:border-slate-800 dark:disabled:bg-slate-950 ${qcType === 'fraud' ? 'border-amber-300 bg-amber-50 text-amber-900 ring-2 ring-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900'}`}>
                      Fraud · {qcSettings.fraud?.enabled ? `${qcSettings.fraud.months} เดือน · เกณฑ์ ${qcSettings.fraud.threshold_rate}%` : 'ปิดใช้งาน'}
                    </button>
                    <button type="button" onClick={() => setQcType('churn')} disabled={!qcSettings.churn?.enabled} className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:ring-0 dark:disabled:border-slate-800 dark:disabled:bg-slate-950 ${qcType === 'churn' ? 'border-rose-300 bg-rose-50 text-rose-900 ring-2 ring-rose-100 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900'}`}>
                      Churn · {qcSettings.churn?.enabled ? `${qcSettings.churn.months} เดือน · เกณฑ์ ${qcSettings.churn.threshold_rate}%` : 'ปิดใช้งาน'}
                    </button>
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {anyQcEnabled
                      ? <>ระบบเลือกเฉพาะเดือนติดตั้งที่มีข้อมูลจริง และนับเดือนที่เลือกเป็นเดือนสุดท้ายของช่วงตรวจสอบ ลูกค้าที่ Terminate/Disconnect ภายในอายุ {activeQcConfig.months} เดือนจะถูกนับเป็นเคส</>
                      : <>ขณะนี้ปิดการตรวจ Fraud และ Churn ทั้งหมด กรุณาเปิดใช้งานจากเมนูตั้งค่าระบบก่อนคำนวณ</>}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-[240px]">
                    <label htmlFor="qc-month" className="mb-1.5 block text-xs font-bold normal-case tracking-normal text-slate-600 dark:text-slate-300">เดือนติดตั้งอ้างอิง</label>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select id="qc-month" value={month} onChange={(event) => setMonth(event.target.value)} disabled={loadingOptions || !availableMonths.length || !anyQcEnabled} className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-8 text-sm font-bold text-slate-800 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                        {!availableMonths.length && <option value="">ยังไม่มีข้อมูลติดตั้ง</option>}
                        {availableMonths.map((item) => <option key={item.value} value={item.value}>{formatMonth(item.value)} · {item.total.toLocaleString('th-TH')} ราย</option>)}
                      </select>
                    </div>
                  </div>
                  <button type="button" onClick={runCalculate} disabled={!month || loading || !activeQcConfig.enabled} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#78BE20] px-5 text-sm font-black text-slate-950 shadow-sm transition hover:bg-[#69AA18] disabled:cursor-not-allowed disabled:opacity-50">
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
          onRefresh={() => refreshCustomer(selectedCustomer.id)}
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

const BILL_STATUS_OPTIONS = [
  ['paid', 'จ่ายแล้ว'],
  ['outstanding', 'ยอดค้าง'],
  ['overdue', 'เกินกำหนด'],
  ['reserved', 'สำรองบิล'],
  ['note', 'หมายเหตุ'],
  ['unknown', 'ไม่ระบุสถานะ'],
];

function dateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function aisDueDayPreview(installDate) {
  const day = Number(String(installDate || '').slice(8, 10));
  if (!day) return '';
  if (day <= 3) return 4;
  if (day <= 7) return 8;
  if (day <= 11) return 12;
  if (day <= 15) return 16;
  if (day <= 19) return 20;
  if (day <= 23) return 24;
  if (day <= 27) return 28;
  return 1;
}

function customerFormValues(customer) {
  return {
    customer_name: customer.customer_name || '',
    non_number: customer.non_number || '',
    package_name: customer.package_name || '',
    monthly_fee: customer.monthly_fee ?? '',
    install_date: dateInput(customer.install_date),
    contact_phone: customer.contact_phone || '',
    seller_name: customer.seller_name || '',
    subdistrict: customer.subdistrict || '',
    district: customer.district || '',
    status: customer.status || 'active',
    cancelled_at: dateInput(customer.cancelled_at),
    cancel_reason: customer.cancel_reason || '',
    qc_status: customer.qc_status || '',
    billing_status: customer.billing_status || '',
    status_changed_at: dateInput(customer.status_changed_at),
    ae_remark: customer.ae_remark || '',
    payment_due_day: customer.payment_due_day ?? '',
    payment_due_mode: customer.payment_due_source === 'auto' ? 'auto' : 'manual',
    install_month_label: customer.install_month_label || '',
    tracking_summary: customer.tracking_summary || '',
    bill_check_date: dateInput(customer.bill_check_date),
    expected_terminate_at: dateInput(customer.expected_terminate_at),
  };
}

function nextMonth(value) {
  const [year, month] = String(value || '').split('-').map(Number);
  const date = year && month ? new Date(year, month, 1) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function CustomerDetailDrawer({ customer, type, billMonths, onClose, onRefresh }) {
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState(() => customerFormValues(customer));
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [billEditor, setBillEditor] = useState(null);
  const [savingBill, setSavingBill] = useState(false);
  const outcome = rowOutcome(customer, type);
  const billsByMonth = new Map((customer.bills || []).map((bill) => [bill.bill_month, bill]));
  const visibleBillMonths = Array.from(new Set([
    ...billMonths,
    ...(customer.bills || []).map((bill) => bill.bill_month),
  ])).sort();

  const beginCustomerEdit = () => {
    setCustomerForm(customerFormValues(customer));
    setEditingCustomer(true);
  };

  const saveCustomer = async (event) => {
    event.preventDefault();
    setSavingCustomer(true);
    try {
      await axios.put(`/installed-customers/${customer.id}`, {
        ...customerForm,
        monthly_fee: customerForm.monthly_fee === '' ? 0 : Number(customerForm.monthly_fee),
        payment_due_day: customerForm.payment_due_day === '' ? null : Number(customerForm.payment_due_day),
        cancelled_at: customerForm.status === 'cancelled' ? (customerForm.cancelled_at || null) : null,
        cancel_reason: customerForm.status === 'cancelled' ? customerForm.cancel_reason : null,
      });
      setEditingCustomer(false);
      await onRefresh();
      Swal.fire({ icon: 'success', title: 'บันทึกข้อมูลแล้ว', timer: 1400, showConfirmButton: false });
    } catch (error) {
      Swal.fire('บันทึกไม่สำเร็จ', error.response?.data?.error || error.message, 'error');
    } finally {
      setSavingCustomer(false);
    }
  };

  const openBillEditor = (month, bill = null) => {
    setBillEditor({
      originalMonth: bill ? month : null,
      bill_month: month,
      bill_status: bill?.bill_status || 'paid',
      amount: bill?.amount ?? '',
      raw_value: bill?.raw_value || '',
      due_date: dateInput(bill?.due_date),
    });
  };

  const addBill = () => {
    const targetMonth = visibleBillMonths.length
      ? nextMonth(visibleBillMonths.at(-1))
      : String(new Date().toISOString()).slice(0, 7);
    openBillEditor(targetMonth);
  };

  const saveBill = async (event) => {
    event.preventDefault();
    if (!billEditor?.bill_month) return;
    setSavingBill(true);
    try {
      await axios.put(`/installed-customers/${customer.id}/bills/${billEditor.bill_month}`, {
        bill_status: billEditor.bill_status,
        amount: billEditor.amount === '' ? 0 : Number(billEditor.amount),
        raw_value: billEditor.raw_value,
        due_date: billEditor.due_date || null,
      });
      setBillEditor(null);
      await onRefresh();
      Swal.fire({ icon: 'success', title: 'บันทึกบิลแล้ว', timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire('บันทึกบิลไม่สำเร็จ', error.response?.data?.error || error.message, 'error');
    } finally {
      setSavingBill(false);
    }
  };

  const deleteBill = async () => {
    if (!billEditor?.originalMonth) return;
    const confirmed = await Swal.fire({
      icon: 'warning',
      title: `ลบบิล ${formatMonth(billEditor.originalMonth)}?`,
      text: 'ยอดค้างและผลคำนวณจะอัปเดตทันที',
      showCancelButton: true,
      confirmButtonText: 'ลบบิล',
      cancelButtonText: 'ไม่ลบ',
      confirmButtonColor: '#dc2626',
    });
    if (!confirmed.isConfirmed) return;
    setSavingBill(true);
    try {
      await axios.delete(`/installed-customers/${customer.id}/bills/${billEditor.originalMonth}`);
      setBillEditor(null);
      await onRefresh();
    } catch (error) {
      Swal.fire('ลบบิลไม่สำเร็จ', error.response?.data?.error || error.message, 'error');
    } finally {
      setSavingBill(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="customer-detail-title">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" aria-label="ปิดรายละเอียด" />
      <aside className="relative flex h-full w-full max-w-4xl flex-col bg-[#F8FAF7] shadow-2xl dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><OutcomeBadge outcome={outcome} /><span className="text-xs text-slate-500">NON {customer.non_number}</span></div>
            <h2 id="customer-detail-title" className="mt-2 truncate text-xl font-black text-slate-900 dark:text-white">{customer.customer_name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500" title={customer.package_name}>{customer.package_name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!editingCustomer && <button type="button" onClick={beginCustomerEdit} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#78BE20] px-3 text-sm font-black text-slate-950 hover:bg-lime-500"><Pencil className="h-4 w-4" /> แก้ไขข้อมูล</button>}
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950" aria-label="ปิด"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {editingCustomer ? (
            <CustomerEditForm
              form={customerForm}
              setForm={setCustomerForm}
              saving={savingCustomer}
              onSubmit={saveCustomer}
              onCancel={() => setEditingCustomer(false)}
            />
          ) : (
            <>
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
                  ['รอบครบกำหนด', customer.payment_due_day ? `วันที่ ${customer.payment_due_day} ของทุกเดือน` : '-'],
                  ['ครบชำระครั้งแรก', formatDate(customer.first_due_date)],
                  ['ที่มาของรอบบิล', customer.payment_due_source === 'auto' ? 'ระบบคำนวณตามวันติดตั้ง' : 'กำหนดเอง/จากไฟล์'],
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
            </>
          )}

          <DetailSection title={`บิลรายเดือน · ค้าง ${Number(customer.outstanding_bills).toLocaleString('th-TH')} บิล รวม ${formatMoney(customer.outstanding_total)} บาท`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">กดการ์ดเดือนเพื่อแก้ไข หรือเพิ่มเดือนใหม่ได้ทันที</p>
              <button type="button" onClick={addBill} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800 dark:bg-[#78BE20] dark:text-slate-950"><Plus className="h-4 w-4" /> เพิ่มบิลรายเดือน</button>
            </div>
            {billEditor && (
              <BillEditor
                value={billEditor}
                onChange={setBillEditor}
                saving={savingBill}
                onSubmit={saveBill}
                onCancel={() => setBillEditor(null)}
                onDelete={deleteBill}
              />
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visibleBillMonths.map((ym) => <BillCard key={ym} month={ym} bill={billsByMonth.get(ym)} onEdit={() => openBillEditor(ym, billsByMonth.get(ym))} />)}
              {!visibleBillMonths.length && <p className="text-sm text-slate-500">ยังไม่มีข้อมูลบิลรายเดือน กด “เพิ่มบิลรายเดือน” เพื่อเริ่มบันทึก</p>}
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

const fieldClass = 'mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-lime-500 focus:ring-4 focus:ring-lime-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

function CustomerEditForm({ form, setForm, saving, onSubmit, onCancel }) {
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  return (
    <form onSubmit={onSubmit} className="overflow-hidden rounded-2xl border-2 border-lime-300 bg-white shadow-sm dark:border-lime-800 dark:bg-slate-900">
      <div className="border-b border-lime-200 bg-lime-50 px-4 py-3 dark:border-lime-900 dark:bg-lime-950/50">
        <h3 className="font-black text-lime-950 dark:text-lime-200">แก้ไขข้อมูลลูกค้า</h3>
        <p className="mt-0.5 text-xs text-lime-800 dark:text-lime-400">ข้อมูลที่บันทึกจะนำไปคำนวณ Fraud / Churn และใช้ใน Export ครั้งถัดไป</p>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div>
          <EditGroupTitle>ข้อมูลหลัก</EditGroupTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <EditField label="ชื่อลูกค้า" required><input required value={form.customer_name} onChange={update('customer_name')} className={fieldClass} /></EditField>
            <EditField label="Access Number / NON" required><input required value={form.non_number} onChange={update('non_number')} className={fieldClass} /></EditField>
            <EditField label="ชื่อแพ็กเกจ" required className="sm:col-span-2"><input required value={form.package_name} onChange={update('package_name')} className={fieldClass} /></EditField>
            <EditField label="ค่าใช้จ่ายต่อเดือน"><input type="number" min="0" step="0.01" value={form.monthly_fee} onChange={update('monthly_fee')} className={fieldClass} /></EditField>
            <EditField label="วันติดตั้ง" required><input required type="date" value={form.install_date} onChange={update('install_date')} className={fieldClass} /></EditField>
            <EditField label="เบอร์ติดต่อ"><input value={form.contact_phone} onChange={update('contact_phone')} className={fieldClass} /></EditField>
            <EditField label="ผู้ขาย"><input value={form.seller_name} onChange={update('seller_name')} className={fieldClass} /></EditField>
            <EditField label="ตำบล"><input value={form.subdistrict} onChange={update('subdistrict')} className={fieldClass} /></EditField>
            <EditField label="อำเภอ"><input value={form.district} onChange={update('district')} className={fieldClass} /></EditField>
          </div>
        </div>

        <div>
          <EditGroupTitle>สถานะและการติดตาม</EditGroupTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <EditField label="สถานะระบบ"><select value={form.status} onChange={update('status')} className={fieldClass}><option value="active">ใช้งาน</option><option value="cancelled">ยกเลิก</option></select></EditField>
            <EditField label="CM สถานะ"><input value={form.qc_status} onChange={update('qc_status')} placeholder="เช่น Active, Suspend - Debt" className={fieldClass} /></EditField>
            <EditField label="Billing"><input value={form.billing_status} onChange={update('billing_status')} className={fieldClass} /></EditField>
            <EditField label="วันที่เปลี่ยนสถานะ"><input type="date" value={form.status_changed_at} onChange={update('status_changed_at')} className={fieldClass} /></EditField>
            <EditField label="วันที่เช็คยอด"><input type="date" value={form.bill_check_date} onChange={update('bill_check_date')} className={fieldClass} /></EditField>
            <EditField label="คาดการณ์ Terminate"><input type="date" value={form.expected_terminate_at} onChange={update('expected_terminate_at')} className={fieldClass} /></EditField>
            <EditField label="วิธีกำหนดรอบชำระ"><select value={form.payment_due_mode} onChange={update('payment_due_mode')} className={fieldClass}><option value="auto">อัตโนมัติตามวันติดตั้ง AIS</option><option value="manual">กำหนดวันที่เอง</option></select></EditField>
            <EditField label="กำหนดชำระ (วันที่ 1–31)"><input type="number" min="1" max="31" disabled={form.payment_due_mode === 'auto'} value={form.payment_due_mode === 'auto' ? aisDueDayPreview(form.install_date) : form.payment_due_day} onChange={update('payment_due_day')} className={`${fieldClass} disabled:bg-slate-100 disabled:text-slate-400`} /><span className="mt-1 block text-[11px] font-medium text-slate-400">โหมดอัตโนมัติจะคำนวณใหม่เมื่อเปลี่ยนวันติดตั้ง</span></EditField>
            <EditField label="เดือนติดตั้งสำเร็จ"><input value={form.install_month_label} onChange={update('install_month_label')} placeholder="เช่น Aug" className={fieldClass} /></EditField>
            {form.status === 'cancelled' && <EditField label="วันที่ยกเลิก"><input type="date" value={form.cancelled_at} onChange={update('cancelled_at')} className={fieldClass} /></EditField>}
            {form.status === 'cancelled' && <EditField label="เหตุผลยกเลิก"><input value={form.cancel_reason} onChange={update('cancel_reason')} className={fieldClass} /></EditField>}
            <EditField label="สรุปสำรอง/ยกเลิก" className="sm:col-span-2"><textarea rows={2} value={form.tracking_summary} onChange={update('tracking_summary')} className={`${fieldClass} h-auto py-2`} /></EditField>
            <EditField label="ผลการติดตาม / AE Remark" className="sm:col-span-2"><textarea rows={4} value={form.ae_remark} onChange={update('ae_remark')} className={`${fieldClass} h-auto py-2`} /></EditField>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700">ยกเลิก</button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#78BE20] px-4 py-2 text-sm font-black text-slate-950 hover:bg-lime-500 disabled:opacity-50">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลทั้งหมด'}
        </button>
      </div>
    </form>
  );
}

function EditGroupTitle({ children }) {
  return <h4 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">{children}</h4>;
}

function EditField({ label, required = false, className = '', children }) {
  return <label className={`block min-w-0 text-xs font-bold text-slate-600 dark:text-slate-300 ${className}`}>{label}{required && <span className="ml-1 text-rose-500">*</span>}{children}</label>;
}

function BillEditor({ value, onChange, saving, onSubmit, onCancel, onDelete }) {
  const update = (key) => (event) => onChange((current) => ({ ...current, [key]: event.target.value }));
  const updateStatus = (event) => {
    const billStatus = event.target.value;
    onChange((current) => ({
      ...current,
      bill_status: billStatus,
      amount: billStatus === 'paid' ? 0 : current.amount,
      raw_value: billStatus === 'paid' ? 'จ่ายแล้ว' : (current.bill_status === 'paid' ? '' : current.raw_value),
    }));
  };
  const needsAmount = ['outstanding', 'overdue', 'reserved'].includes(value.bill_status);
  return (
    <form onSubmit={onSubmit} className="mb-4 rounded-2xl border-2 border-sky-300 bg-sky-50/60 p-4 dark:border-sky-800 dark:bg-sky-950/30">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div><h4 className="font-black text-sky-950 dark:text-sky-200">{value.originalMonth ? `แก้ไขบิล ${formatMonth(value.originalMonth)}` : 'เพิ่มบิลรายเดือน'}</h4><p className="text-xs text-sky-700 dark:text-sky-400">ยอดค้างรวมจะคำนวณใหม่หลังบันทึก</p></div>
        <button type="button" onClick={onCancel} className="grid h-8 w-8 place-items-center rounded-lg text-sky-700 hover:bg-sky-100" aria-label="ปิดตัวแก้บิล"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <EditField label="เดือนบิล" required><input required type="month" disabled={Boolean(value.originalMonth)} value={value.bill_month} onChange={update('bill_month')} className={`${fieldClass} disabled:bg-slate-100 disabled:text-slate-500`} /></EditField>
        <EditField label="วันครบชำระ"><input type="date" value={value.due_date} onChange={update('due_date')} className={fieldClass} /></EditField>
        <EditField label="สถานะบิล" required><select value={value.bill_status} onChange={updateStatus} className={fieldClass}>{BILL_STATUS_OPTIONS.map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></EditField>
        <EditField label="ยอดเงิน (บาท)"><input type="number" min="0" step="0.01" disabled={!needsAmount} value={value.bill_status === 'paid' ? 0 : value.amount} onChange={update('amount')} className={`${fieldClass} disabled:bg-slate-100 disabled:text-slate-400`} /></EditField>
        <EditField label="ข้อความที่ต้องการแสดง"><input value={value.raw_value} onChange={update('raw_value')} placeholder={value.bill_status === 'paid' ? 'จ่ายแล้ว' : 'เช่น สำรอง 643.07'} className={fieldClass} /></EditField>
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <div>{value.originalMonth && <button type="button" onClick={onDelete} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /> ลบบิลเดือนนี้</button>}</div>
        <div className="flex gap-2"><button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">ยกเลิก</button><button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-700 px-3 py-2 text-xs font-black text-white hover:bg-sky-800 disabled:opacity-50">{saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} บันทึกบิล</button></div>
      </div>
    </form>
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

function BillCard({ month, bill, onEdit }) {
  const tone = !bill
    ? 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950'
    : bill.bill_status === 'paid'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
      : ['outstanding', 'overdue'].includes(bill.bill_status)
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
        : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300';
  const value = !bill ? 'ไม่มีข้อมูล' : bill.bill_status === 'paid' ? 'จ่ายแล้ว' : bill.raw_value || `${formatMoney(bill.amount)} บาท`;
  const sourceLabel = bill?.bill_source === 'auto' ? 'ระบบสร้าง' : bill?.bill_source === 'manual' ? 'แก้ไขเอง' : 'จากไฟล์';
  return (
    <button type="button" onClick={onEdit} className={`group relative min-h-24 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-lime-100 ${tone}`}>
      <Pencil className="absolute right-3 top-3 h-3.5 w-3.5 opacity-0 transition group-hover:opacity-70 group-focus:opacity-70" />
      <p className="pr-6 text-xs font-bold opacity-70">{formatMonth(month)}</p>
      <p className="mt-2 whitespace-normal break-words text-sm font-black leading-5" title={String(value)}>{value}</p>
      {bill && <p className="mt-1 text-[11px] font-semibold opacity-70">ครบชำระ {formatDate(bill.due_date)} · {sourceLabel}</p>}
      {bill?.bill_source === 'auto' && Number(bill.estimated_total) > 0 && <p className="mt-1 text-[11px] opacity-70">ก่อน VAT {formatMoney(bill.estimated_amount)} + VAT {formatMoney(bill.estimated_vat)} บาท</p>}
      <p className="mt-2 text-[11px] font-bold opacity-0 transition group-hover:opacity-60 group-focus:opacity-60">กดเพื่อแก้ไข</p>
    </button>
  );
}
