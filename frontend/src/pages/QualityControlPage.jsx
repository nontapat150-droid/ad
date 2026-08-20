import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  FileSpreadsheet,
  LockKeyhole,
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
import { useAuth } from '../context/AuthContext';
import axios from '../api/axios';

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const DEFAULT_QC_SETTINGS = {
  fraud: { enabled: true, threshold_rate: 3, months: 4 },
  churn: { enabled: true, threshold_rate: 1.5, months: 8 },
};
const FOLLOW_UP_STATUS_OPTIONS = [
  ['assigned', 'รอดำเนินการ', 'รอเริ่มติดตามหรือรอมอบหมายผู้รับผิดชอบ'],
  ['in_progress', 'กำลังติดตาม', 'กำลังติดต่อหรือรอคำตอบ'],
  ['completed', 'ชำระแล้ว', 'ยืนยันว่าลูกค้าชำระบิลรอบนี้แล้ว'],
];
const BILL_STATUS_OPTIONS = [
  ['paid', 'จ่ายแล้ว'],
  ['outstanding', 'ยอดค้าง'],
  ['overdue', 'เกินกำหนด'],
  ['reserved', 'สำรองบิล'],
  ['note', 'หมายเหตุ'],
  ['unknown', 'รอตรวจสอบ'],
];
const DEFAULT_BILL_FILTERS = {
  query: '',
  billNumber: '1',
  installFrom: '',
  installTo: '',
  month: 'all',
  status: 'all',
  dueState: 'all',
  amountMin: '',
  amountMax: '',
  amountSource: 'all',
  taskStatus: 'all',
  assignee: 'all',
};

function formatDate(value) {
  if (!value) return '-';
  const iso = String(value).slice(0, 10);
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

function todayInBangkok() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function daysBetweenIso(from, to) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
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

function billStatusLabel(status) {
  if (status === 'missing') return 'ไม่มีข้อมูลบิล';
  return BILL_STATUS_OPTIONS.find(([key]) => key === status)?.[1] || status || 'ไม่ระบุ';
}

function monthDistance(startMonth, endMonth) {
  const [startYear, startValue] = String(startMonth || '').slice(0, 7).split('-').map(Number);
  const [endYear, endValue] = String(endMonth || '').slice(0, 7).split('-').map(Number);
  if (!startYear || !startValue || !endYear || !endValue) return null;
  return ((endYear - startYear) * 12) + endValue - startValue;
}

function addMonthsToDate(value, delta) {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const target = new Date(Date.UTC(year, month - 1 + delta, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function dueDateForBill(customer, billNumber) {
  const firstMonth = String(customer.first_due_month || '').match(/^(\d{4})-(\d{2})$/);
  if (!firstMonth) return addMonthsToDate(customer.first_due_date, billNumber - 1);
  const target = new Date(Date.UTC(Number(firstMonth[1]), Number(firstMonth[2]) - 1 + billNumber - 1, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const dueDay = Math.min(Math.max(1, Number(customer.payment_due_day) || 1), lastDay);
  target.setUTCDate(dueDay);
  return target.toISOString().slice(0, 10);
}

function resolvedBillAmount(customer, bill) {
  if (bill.bill_status === 'paid') {
    if (bill.paid_amount != null && bill.paid_amount !== '') {
      return { amount: Number(bill.paid_amount) || 0, source: 'recorded', sourceLabel: 'ยอดชำระจริง' };
    }
    if (Number(bill.estimated_total) > 0) {
      return { amount: Number(bill.estimated_total), source: 'reference', sourceLabel: 'ประมาณจากรอบบิล' };
    }
    if (Number(customer.monthly_fee) > 0) {
      return { amount: Number(customer.monthly_fee), source: 'reference', sourceLabel: 'อ้างอิงราคาแพ็กเกจ' };
    }
    return { amount: 0, source: 'missing', sourceLabel: 'ยังไม่มียอด' };
  }

  if (Number(bill.amount) > 0 || ['outstanding', 'overdue', 'reserved'].includes(bill.bill_status)) {
    return { amount: Number(bill.amount) || 0, source: 'recorded', sourceLabel: 'ยอดที่บันทึก' };
  }
  if (Number(bill.estimated_total) > 0) {
    return { amount: Number(bill.estimated_total), source: 'reference', sourceLabel: 'ประมาณจากรอบบิล' };
  }
  return { amount: 0, source: 'missing', sourceLabel: 'ยังไม่มียอด' };
}

function billDueState(bill) {
  if (bill.bill_status === 'paid') return 'paid';
  if (bill.bill_status === 'overdue') return 'overdue';
  const dueDate = String(bill.due_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return 'missing';
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (dueDate > todayIso) return 'not_due';
  if (dueDate === todayIso) return 'due_today';
  if (bill.bill_status === 'missing') return 'missing';
  return 'overdue';
}

function paymentStateForBill(bill) {
  if (bill.bill_status === 'paid') return 'paid';
  const dueState = billDueState(bill);
  if (dueState === 'not_due') return 'not_due';
  if (bill.bill_status === 'missing' || dueState === 'missing') return 'missing';
  return 'unpaid';
}

function cmPaymentMeta(row) {
  if (!row) return { key: 'missing', label: 'รอตรวจข้อมูลบิล', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' };
  if (row.payment_state === 'paid') return { key: 'paid', label: 'ชำระแล้ว', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' };
  if (row.payment_state === 'not_due') return { key: 'not_due', label: 'ยังไม่ถึงกำหนด', className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' };
  if (row.payment_state === 'missing') return { key: 'missing', label: 'ไม่มีข้อมูลบิล', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' };
  if (row.due_state === 'due_today') return { key: 'unpaid', label: 'ครบกำหนดวันนี้', className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300' };
  return { key: 'unpaid', label: 'ยังไม่ชำระ', className: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' };
}

function customerPaymentMeta(customer) {
  const ledger = buildBillLedger(customer ? [customer] : []);
  if (ledger.some((row) => row.payment_state === 'unpaid')) return cmPaymentMeta({ payment_state: 'unpaid', due_state: 'overdue' });
  if (ledger.some((row) => row.payment_state === 'paid')) return cmPaymentMeta({ payment_state: 'paid', due_state: 'paid' });
  if (ledger.some((row) => row.payment_state === 'not_due')) return cmPaymentMeta({ payment_state: 'not_due', due_state: 'not_due' });
  return cmPaymentMeta(null);
}

function simpleFollowUpStatus(status) {
  if (status === 'unassigned') return 'assigned';
  if (['waiting_customer', 'unreachable'].includes(status)) return 'in_progress';
  return FOLLOW_UP_STATUS_OPTIONS.some(([key]) => key === status) ? status : 'assigned';
}

function buildBillLedger(customers) {
  return (customers || []).flatMap((customer) => [...(customer.bills || [])]
    .sort((a, b) => String(a.due_date || a.bill_month).localeCompare(String(b.due_date || b.bill_month)))
    .map((bill, index) => {
    const amountDetails = resolvedBillAmount(customer, bill);
    const monthIndex = monthDistance(customer.first_due_month || customer.first_due_date, bill.bill_month);
    const billNumber = monthIndex != null ? monthIndex + 1 : index + 1;
    return {
      key: `${customer.id}-${bill.bill_month}`,
      customer,
      customer_id: customer.id,
      customer_name: customer.customer_name || '',
      non_number: customer.non_number || '',
      package_name: customer.package_name || '',
      monthly_fee: Number(customer.monthly_fee) || 0,
      install_date: String(customer.install_date || '').slice(0, 10),
      seller_name: customer.seller_name || '',
      bill_number: billNumber,
      bill_month: bill.bill_month,
      bill_status: bill.bill_status || 'unknown',
      status_label: billStatusLabel(bill.bill_status),
      due_date: bill.due_date,
      raw_value: bill.raw_value || '',
      bill_source: bill.bill_source || 'import',
      paid_amount: bill.paid_amount,
      amount: amountDetails.amount,
      amount_source: amountDetails.source,
      amount_source_label: amountDetails.sourceLabel,
      payment_state: paymentStateForBill(bill),
      due_state: billDueState(bill),
    };
  }));
}

function missingBillRow(customer, billNumber) {
  const dueDate = dueDateForBill(customer, billNumber);
  return {
    key: `${customer.id}-missing-${billNumber}`,
    customer,
    customer_id: customer.id,
    customer_name: customer.customer_name || '',
    non_number: customer.non_number || '',
    package_name: customer.package_name || '',
    monthly_fee: Number(customer.monthly_fee) || 0,
    install_date: String(customer.install_date || '').slice(0, 10),
    seller_name: customer.seller_name || '',
    bill_number: billNumber,
    bill_month: dueDate?.slice(0, 7) || '',
    bill_status: 'missing',
    status_label: 'ไม่มีข้อมูลบิล',
    due_date: dueDate,
    raw_value: '',
    bill_source: '',
    paid_amount: null,
    amount: 0,
    amount_source: 'missing',
    amount_source_label: 'ยังไม่มีข้อมูลยอด',
    payment_state: paymentStateForBill({ bill_status: 'missing', due_date: dueDate }),
    due_state: billDueState({ bill_status: 'missing', due_date: dueDate }),
  };
}

function isSuspended(value) {
  return /(suspend|debt|ระงับ|ค้าง)/i.test(String(value || ''));
}

function rowOutcome(row, type) {
  const subject = type === 'fraud' ? 'Fraud' : 'Churn';
  if (row.cm_status === type || row.is_case) return { key: 'case', label: `เข้าเงื่อนไข ${subject}`, tone: 'danger' };
  if (row.cm_status === 'monitoring') return { key: 'monitoring', label: 'อยู่ระหว่างตรวจ', tone: 'info' };
  if (row.cm_status === 'incomplete') return { key: 'incomplete', label: 'ข้อมูล CM ไม่ครบ', tone: 'warning' };
  return { key: 'normal', label: `ไม่เข้าเงื่อนไข ${subject}`, tone: 'success' };
}

export default function QualityControlPage({ previewMode = 'qc', sidebarActiveKey = 'quality_control' } = {}) {
  const isBillingPreview = previewMode === 'billing';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pageTab, setPageTab] = useState(isBillingPreview ? 'billing' : 'qc');
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
    const billingScope = isBillingPreview || pageTab === 'billing';
    const qcEnabled = Boolean(qcSettings.fraud?.enabled || qcSettings.churn?.enabled);
    if (billingScope) {
      if (!qcEnabled) {
        setResult(null);
        return null;
      }
    } else if (!qcSettings[qcType]?.enabled) {
      setResult(null);
      return null;
    }
    setLoading(true);
    try {
      const response = await axios.get('/installed-customers/qc', {
        params: {
          type: qcType,
          month,
          scope: billingScope ? 'billing' : 'qc',
        },
      });
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
  }, [month, pageTab, qcSettings, qcType, isBillingPreview]);

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
      if (view === 'outstanding' && Number(row.outstanding_bills) <= 0) return false;
      if (!['all', 'outstanding'].includes(view) && outcome.key !== view) return false;
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

  const clearQcFilters = () => {
    setSearch('');
    setView('all');
    setSeller('all');
    setLifecycle('all');
    setSortBy('install_asc');
    setPage(1);
  };

  const viewCounts = useMemo(() => {
    const counts = { all: 0, case: 0, monitoring: 0, incomplete: 0, outstanding: 0, normal: 0 };
    for (const row of result?.customers || []) {
      counts.all += 1;
      counts[rowOutcome(row, qcType).key] += 1;
      if (Number(row.outstanding_bills) > 0) counts.outstanding += 1;
    }
    return counts;
  }, [result, qcType]);
  const qcAdvancedFilterCount = Number(seller !== 'all') + Number(lifecycle !== 'all') + Number(sortBy !== 'install_asc');

  const activeQcConfig = qcSettings[qcType] || DEFAULT_QC_SETTINGS[qcType];
  const anyQcEnabled = Boolean(qcSettings.fraud?.enabled || qcSettings.churn?.enabled);
  const workMode = isBillingPreview || pageTab === 'billing' ? 'billing' : qcType;
  const modeNavItems = [
    { id: 'fraud', label: 'CM Fraud', description: `ตรวจย้อนหลัง ${qcSettings.fraud?.months || 4} เดือน`, icon: ShieldAlert, enabled: qcSettings.fraud?.enabled },
    { id: 'churn', label: 'CM Churn', description: `ตรวจย้อนหลัง ${qcSettings.churn?.months || 8} เดือน`, icon: Users, enabled: qcSettings.churn?.enabled },
  ];
  const selectWorkMode = (mode) => {
    if (isBillingPreview) return;
    if (mode === 'billing') {
      setPageTab('billing');
      setResult(null);
    } else {
      setPageTab('qc');
      setResult(null);
      setQcType(mode);
    }
    setView('all');
    setPage(1);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F4F7F2] font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey={sidebarActiveKey} />

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
              <h1 className="truncate text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                {isBillingPreview ? 'ตรวจชำระบิล (ทดสอบ)' : 'ควบคุมคุณภาพ'}
              </h1>
              <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
                {isBillingPreview
                  ? 'หน้าทดสอบแยกจาก CM Fraud/Churn — ใช้ตรวจบิลตามลำดับหลังติดตั้ง'
                  : 'Fraud / Churn สำหรับตรวจ CM'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setImportOpen(true)} aria-label="นำเข้าข้อมูลควบคุมคุณภาพ" className="inline-flex h-10 items-center gap-2 rounded-xl border border-lime-300 bg-lime-50 px-3 text-sm font-bold text-lime-800 transition hover:bg-lime-100 dark:border-lime-700 dark:bg-lime-950 dark:text-lime-300">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">นำเข้าข้อมูล</span>
            </button>
            {pageTab === 'qc' && !isBillingPreview && (
              <button type="button" onClick={exportWorkbook} aria-label="Export Excel ตามผลตรวจ" disabled={!result?.customers?.length || exporting} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#78BE20] dark:text-slate-950">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">{exporting ? 'กำลัง Export...' : 'Export Excel'}</span>
              </button>
            )}
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1680px] space-y-4 p-3 sm:p-5">
            {isBillingPreview && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <p className="font-black">โหมดทดสอบ</p>
                <p className="mt-1 text-xs leading-5 text-amber-900/90 dark:text-amber-200/90">
                  หน้านี้แยกจากเมนู <b>ควบคุมคุณภาพ</b> หลัก เพื่อทดลองใช้งานก่อนนำไปใช้จริง
                  {' '}·{' '}
                  <a href="/quality-control" className="font-bold underline underline-offset-2">กลับหน้า CM Fraud/Churn</a>
                </p>
              </div>
            )}

            {!isBillingPreview && (
            <nav className="grid gap-2 sm:grid-cols-2" aria-label="เลือกงานควบคุมคุณภาพ">
              {modeNavItems.map((item) => {
                const Icon = item.icon;
                const active = workMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectWorkMode(item.id)}
                    disabled={!item.enabled}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-[72px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-4 focus:ring-lime-100 disabled:cursor-not-allowed disabled:opacity-45 ${
                      active
                        ? 'border-lime-500 bg-lime-50 text-slate-950 shadow-sm dark:border-lime-700 dark:bg-lime-950/60 dark:text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-lime-300 hover:bg-lime-50/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? 'bg-[#78BE20] text-slate-950' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0"><span className="block text-sm font-black">{item.label}</span><span className="mt-0.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">{item.enabled ? item.description : 'ปิดใช้งานในการตั้งค่า'}</span></span>
                  </button>
                );
              })}
            </nav>
            )}

            {pageTab === 'qc' && <WorkflowGuide mode={workMode} />}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-500">ขอบเขตที่กำลังตรวจ</p>
                  <h2 className="mt-1 text-base font-black text-slate-900 dark:text-white">{(isBillingPreview || pageTab === 'billing') ? 'การชำระเงินตามรอบบิล' : `CM ${qcType === 'fraud' ? 'Fraud' : 'Churn'}`}</h2>
                  <p className="mt-1 text-xs text-slate-500">{(isBillingPreview || pageTab === 'billing')
                    ? `เฉพาะลูกค้าที่ติดตั้งในเดือนที่เลือก · แสดงบิลสูงสุด ${result?.billing_months || Math.max(qcSettings.fraud?.months || 4, qcSettings.churn?.months || 8)} งวด`
                    : `กลุ่มติดตั้งย้อนหลัง ${activeQcConfig.months} เดือน · ตัดสินจากการยกเลิกภายใน ${result?.case_window_months || qcSettings.fraud?.months || 4} เดือน`}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-[230px]">
                    <label htmlFor="qc-month" className="mb-1 block text-xs font-bold normal-case tracking-normal text-slate-500">เดือนที่ติดตั้งสำเร็จ</label>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select id="qc-month" value={month} onChange={(event) => setMonth(event.target.value)} disabled={loadingOptions || !availableMonths.length || ((isBillingPreview || pageTab === 'billing') ? !anyQcEnabled : !activeQcConfig.enabled)} className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-8 text-sm font-bold text-slate-800 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                        {!availableMonths.length && <option value="">ยังไม่มีข้อมูลติดตั้ง</option>}
                        {availableMonths.map((item) => <option key={item.value} value={item.value}>{formatMonth(item.value)} · {item.total.toLocaleString('th-TH')} ราย</option>)}
                      </select>
                    </div>
                  </div>
                  <button type="button" onClick={runCalculate} disabled={!month || loading || ((isBillingPreview || pageTab === 'billing') ? !anyQcEnabled : !activeQcConfig.enabled)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#78BE20] px-4 text-sm font-black text-slate-950 shadow-sm transition hover:bg-[#69AA18] disabled:cursor-not-allowed disabled:opacity-50">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    โหลดข้อมูลล่าสุด
                  </button>
                </div>
              </div>
              {result && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  <span><b>{(isBillingPreview || pageTab === 'billing') ? 'เดือนติดตั้งที่เลือก:' : 'ช่วงติดตั้ง:'}</b> {(isBillingPreview || pageTab === 'billing') ? formatMonth(result.cohort_end_month) : `${formatMonth(result.cohort_start_month)} – ${formatMonth(result.cohort_end_month)}`}</span>
                  <span><b>ข้อมูลทั้งหมด:</b> {Number(result.total_installs).toLocaleString('th-TH')} ราย</span>
                  <span className="text-slate-400">{(isBillingPreview || pageTab === 'billing') ? 'การชำระเงินอ้างอิงจากบิลจริงของลูกค้ากลุ่มนี้' : `CM คำนวณใหม่ ณ ${formatDate(result.as_of_date)} จากสถานะและวันที่จริง · ไม่ใช้สถานะ Excel เป็นผลสรุป`}</span>
                </div>
              )}
            </section>

            {loading && !result ? <LoadingState /> : result ? (
              (isBillingPreview || pageTab === 'billing') ? (
                <BillPaymentExplorer result={result} onViewCustomer={setSelectedCustomer} onRefresh={runCalculate} />
              ) : (
              <>
                <section className="grid gap-3 sm:grid-cols-3">
                  <MetricCard icon={Users} label={`CM ${qcType === 'fraud' ? 'Fraud' : 'Churn'}`} value={`${result.rate}%`} note={`${Number(result.cases).toLocaleString('th-TH')} จาก ${Number(result.total_installs).toLocaleString('th-TH')} ราย · เกณฑ์ ${result.threshold_rate}%`} tone={Number(result.over_limit) > 0 ? 'danger' : 'success'} />
                  <MetricCard icon={XCircle} label={`ลูกค้าเข้าเกณฑ์ ${qcType === 'fraud' ? 'Fraud' : 'Churn'}`} value={`${Number(result.cases).toLocaleString('th-TH')} ราย`} note={Number(result.over_limit) > 0 ? `เกินจำนวนที่ยอมรับ ${Number(result.over_limit).toLocaleString('th-TH')} ราย` : 'จำนวนยังอยู่ในเกณฑ์'} tone={Number(result.over_limit) > 0 ? 'danger' : 'success'} />
                  <MetricCard icon={CircleDollarSign} label="การชำระที่ต้องติดตาม" value={`${Number(result.outstanding_customers).toLocaleString('th-TH')} ราย`} note={`${Number(result.outstanding_bills).toLocaleString('th-TH')} บิล · ยอดค้าง ${formatMoney(result.outstanding_total)} บาท`} tone="warning" />
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div><h2 className="text-base font-bold text-slate-900 dark:text-white">ผลตรวจ CM {qcType === 'fraud' ? 'Fraud' : 'Churn'}</h2><p className="mt-0.5 text-xs text-slate-500">แยกผล CM ออกจากสถานะการชำระอย่างชัดเจน · {filteredRows.length.toLocaleString('th-TH')} รายการ</p></div>
                      <div className="w-full lg:max-w-md">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ, NON หรือแพ็กเกจ" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100 dark:border-slate-700 dark:bg-slate-950" />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                      {[
                        ['all', 'ทั้งหมด'],
                        ['case', `เข้า ${qcType === 'fraud' ? 'Fraud' : 'Churn'}`],
                        ['monitoring', 'อยู่ระหว่างตรวจ'],
                        ['normal', `ไม่เข้าเงื่อนไข ${qcType === 'fraud' ? 'Fraud' : 'Churn'}`],
                        ...(viewCounts.incomplete > 0 ? [['incomplete', 'ข้อมูลไม่ครบ']] : []),
                        ['outstanding', 'มียอดค้าง'],
                      ].map(([key, label]) => (
                        <button key={key} type="button" onClick={() => setView(key)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition ${view === key ? 'border-lime-400 bg-lime-100 text-lime-900 dark:border-lime-700 dark:bg-lime-950 dark:text-lime-200' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>
                          {label} <span className="ml-1 opacity-70">{viewCounts[key].toLocaleString('th-TH')}</span>
                        </button>
                      ))}
                    </div>
                    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/50">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300">ตัวกรองเพิ่มเติม{qcAdvancedFilterCount > 0 ? ` (${qcAdvancedFilterCount})` : ''}</summary>
                      <div className="grid gap-2 border-t border-slate-200 p-3 sm:grid-cols-3 dark:border-slate-800">
                        <select value={seller} onChange={(event) => setSeller(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"><option value="all">ผู้ขายทั้งหมด</option>{sellers.map((name) => <option key={name} value={name}>{name}</option>)}</select>
                        <select value={lifecycle} onChange={(event) => setLifecycle(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"><option value="all">สถานะระบบทั้งหมด</option><option value="active">ยังใช้งาน</option><option value="cancelled">ยกเลิกแล้ว</option></select>
                        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"><option value="install_asc">วันติดตั้ง: เก่าไปใหม่</option><option value="outstanding_desc">ยอดค้างมากสุด</option><option value="name_asc">ชื่อลูกค้า ก–ฮ</option><option value="status">สถานะ CM</option></select>
                      </div>
                    </details>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1120px] text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-bold text-slate-600 shadow-[0_1px_0_#e2e8f0] dark:bg-slate-950 dark:text-slate-300">
                        <tr>
                          <th className="w-16 px-4 py-3 text-center">ลำดับ</th>
                          <th className="min-w-[250px] px-4 py-3">ลูกค้า / NON</th>
                          <th className="min-w-[250px] px-4 py-3">แพ็กเกจ</th>
                          <th className="min-w-[190px] px-4 py-3">วันที่ติดตั้ง</th>
                          <th className="min-w-[170px] px-4 py-3">CM {qcType === 'fraud' ? 'Fraud' : 'Churn'}</th>
                          <th className="min-w-[210px] px-4 py-3">การชำระเงิน</th>
                          <th className="sticky right-0 z-20 w-28 border-l border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-slate-800 dark:bg-slate-950">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row, index) => {
                          const outcome = rowOutcome(row, qcType);
                          const cmPayment = customerPaymentMeta(row);
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
                                <div className="mt-1 truncate text-[11px] text-slate-400">ผู้ขาย: {row.seller_name || '-'}</div>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                                <div><b>ติดตั้ง:</b> {formatDate(row.install_date)}</div>
                                <div className="mt-1"><b>ครบกำหนด:</b> {formatDate(row.tracking_due_at)} <span className={Number(row.tracking_days_remaining) < 0 ? 'font-bold text-rose-600' : 'font-bold text-emerald-700'}>({Number(row.tracking_days_remaining) >= 0 ? 'เหลือ' : 'เกิน'} {Math.abs(Number(row.tracking_days_remaining))} วัน)</span></div>
                              </td>
                              <td className="px-4 py-3">
                                <OutcomeBadge outcome={outcome} />
                                <div className="mt-1.5 text-[11px] font-semibold text-slate-500">{row.cm_reason || 'คำนวณจากสถานะและวันที่จริง'}</div>
                                <div className="mt-1 text-[11px] text-slate-400">ข้อมูล CM ต้นทาง: {row.qc_status || 'ไม่มีข้อมูล'}</div>
                              </td>
                              <td className="px-4 py-3">
                                <CmPaymentStatusBadge state={cmPayment} />
                                <div className={`mt-1.5 font-black ${Number(row.outstanding_total) > 0 ? 'text-amber-700' : 'text-slate-500'}`}>{Number(row.outstanding_total) > 0 ? `ค้าง ${formatMoney(row.outstanding_total)} บาท` : 'ไม่มียอดค้าง'}</div>
                                <div className="mt-1 text-xs text-slate-500">{Number(row.outstanding_bills).toLocaleString('th-TH')} บิลที่ต้องติดตาม</div>
                              </td>
                              <td className="sticky right-0 z-10 border-l border-slate-100 bg-white px-4 py-3 text-center transition group-hover:bg-lime-50 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-lime-950">
                                <button type="button" onClick={() => setSelectedCustomer(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-lime-400 hover:bg-lime-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                                  <Eye className="h-3.5 w-3.5" /> เปิดข้อมูล
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!pageRows.length && <EmptyTable hasSearch={Boolean(search || seller !== 'all' || lifecycle !== 'all' || view !== 'all')} onClear={clearQcFilters} />}
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
              )
            ) : (
              <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
                <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-300" />
                <h2 className="mt-4 font-bold text-slate-700 dark:text-slate-200">ยังไม่มีข้อมูลสำหรับตรวจสอบ</h2>
                <p className="mt-1 text-sm text-slate-500">นำเข้าไฟล์ต้นฉบับก่อน ระบบจะคำนวณ CM Fraud / Churn และรอบบิลให้อัตโนมัติ</p>
                <button type="button" onClick={() => setImportOpen(true)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#78BE20] px-4 text-sm font-black text-slate-950"><Upload className="h-4 w-4" /> นำเข้าข้อมูลเริ่มต้น</button>
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
          caseWindowMonths={result?.case_window_months || qcSettings.fraud?.months || 4}
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

function WorkflowGuide({ mode }) {
  const isBilling = mode === 'billing';
  const subject = mode === 'fraud' ? 'Fraud' : 'Churn';
  const steps = isBilling
    ? ['เลือกงวดบิลที่ต้องการตรวจ', 'เลือก ชำระแล้ว หรือ ยังไม่ชำระ', 'เริ่มติดตามหรือยืนยันยอดชำระ']
    : ['เลือกเดือนที่ติดตั้งสำเร็จ', `ตรวจผล CM ${subject}`, 'เปิดข้อมูลลูกค้าที่ต้องดำเนินการ'];
  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/30" aria-labelledby="workflow-guide-title">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="shrink-0 lg:w-48">
          <p id="workflow-guide-title" className="text-xs font-black text-sky-900 dark:text-sky-200">เริ่มใช้งาน 3 ขั้นตอน</p>
          <p className="mt-0.5 text-[11px] text-sky-700 dark:text-sky-300">{isBilling ? 'ดูสถานะจากบิลจริง' : 'CM และการชำระเป็นคนละสถานะ'}</p>
        </div>
        <ol className="grid flex-1 gap-2 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className="flex min-h-11 items-center gap-2 rounded-xl border border-sky-100 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-sky-900 dark:bg-slate-900 dark:text-slate-200">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-700 text-[11px] font-black text-white">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function BillPaymentExplorer({ result, onViewCustomer, onRefresh }) {
  const { user: currentUser } = useAuth();
  const [filters, setFilters] = useState(DEFAULT_BILL_FILTERS);
  const [billPage, setBillPage] = useState(1);
  const [billPageSize, setBillPageSize] = useState(25);
  const [exportingBills, setExportingBills] = useState(false);
  const [followUpEditor, setFollowUpEditor] = useState(null);
  const [followUpUsers, setFollowUpUsers] = useState([]);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const ledger = useMemo(() => buildBillLedger(result?.customers), [result]);
  const followUpsByCustomerBill = useMemo(() => new Map((result?.follow_ups || []).map((task) => [
    `${task.installed_customer_id}-${task.bill_month || `number-${task.bill_number}`}`,
    task,
  ])), [result]);

  useEffect(() => {
    let active = true;
    axios.get('/users').then((response) => {
      if (!active) return;
      const allowedRoles = new Set(['super_admin', 'admin']);
      const rows = (response.data || []).filter((user) => (
        user.status === 'approved'
        && (user.roles || [user.role]).some((role) => allowedRoles.has(role))
      ));
      setFollowUpUsers(rows.sort((a, b) => String(a.full_name || a.username).localeCompare(String(b.full_name || b.username), 'th')));
    }).catch(() => {
      if (active) setFollowUpUsers([]);
    });
    return () => { active = false; };
  }, []);
  const maxBillNumber = useMemo(() => Math.max(
    1,
    Number(result?.billing_months) || 1,
    ...ledger.map((row) => Number(row.bill_number) || 1)
  ), [ledger, result]);
  const selectedBillNumber = Math.min(maxBillNumber, Math.max(1, Number(filters.billNumber) || 1));
  const selectedBills = useMemo(() => {
    const byCustomerAndNumber = new Map(ledger.map((row) => [`${row.customer_id}-${row.bill_number}`, row]));
    return (result?.customers || []).map((customer) => {
      const row = byCustomerAndNumber.get(`${customer.id}-${selectedBillNumber}`)
        || missingBillRow(customer, selectedBillNumber);
      return {
        ...row,
        follow_up: followUpsByCustomerBill.get(`${customer.id}-${row.bill_month}`)
          || followUpsByCustomerBill.get(`${customer.id}-number-${selectedBillNumber}`)
          || null,
      };
    });
  }, [followUpsByCustomerBill, ledger, result, selectedBillNumber]);
  const matchedBills = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const minimum = filters.amountMin === '' ? null : Number(filters.amountMin);
    const maximum = filters.amountMax === '' ? null : Number(filters.amountMax);
    return selectedBills.filter((row) => {
      if (filters.installFrom && row.install_date < filters.installFrom) return false;
      if (filters.installTo && row.install_date > filters.installTo) return false;
      if (filters.month !== 'all' && row.bill_month !== filters.month) return false;
      if (filters.amountSource === 'recorded' && row.amount_source !== 'recorded') return false;
      if (filters.amountSource === 'reference' && row.amount_source !== 'reference') return false;
      if (filters.amountSource === 'missing' && row.amount_source !== 'missing') return false;
      if (filters.taskStatus === 'none' && row.follow_up) return false;
      if (filters.taskStatus === 'pending' && !['unassigned', 'assigned'].includes(row.follow_up?.status)) return false;
      if (filters.taskStatus === 'in_progress' && !['in_progress', 'waiting_customer', 'unreachable'].includes(row.follow_up?.status)) return false;
      if (filters.taskStatus === 'completed' && row.follow_up?.status !== 'completed') return false;
      if (filters.assignee !== 'all' && String(row.follow_up?.assigned_to || '') !== filters.assignee) return false;
      if (minimum != null && Number.isFinite(minimum) && row.amount < minimum) return false;
      if (maximum != null && Number.isFinite(maximum) && row.amount > maximum) return false;
      if (!query) return true;
      return [row.customer_name, row.non_number, row.package_name, row.seller_name, row.raw_value]
        .some((value) => String(value || '').toLowerCase().includes(query));
    }).sort((a, b) => String(b.bill_month).localeCompare(String(a.bill_month))
      || String(a.customer_name).localeCompare(String(b.customer_name), 'th'));
  }, [filters, selectedBills]);

  const paymentCounts = useMemo(() => ({
    all: matchedBills.length,
    paid: matchedBills.filter((row) => row.payment_state === 'paid').length,
    unpaid: matchedBills.filter((row) => row.payment_state === 'unpaid').length,
    not_due: matchedBills.filter((row) => row.payment_state === 'not_due').length,
    missing: matchedBills.filter((row) => row.payment_state === 'missing').length,
  }), [matchedBills]);

  const paymentOverview = useMemo(() => {
    const paidRows = matchedBills.filter((row) => row.payment_state === 'paid');
    const unpaidRows = matchedBills.filter((row) => row.payment_state === 'unpaid');
    return {
      paidAmount: paidRows.reduce((sum, row) => sum + row.amount, 0),
      unpaidAmount: unpaidRows.reduce((sum, row) => sum + row.amount, 0),
      missingCustomers: matchedBills.filter((row) => row.payment_state === 'missing').length,
    };
  }, [matchedBills]);

  const paymentFilteredBills = useMemo(() => (
    filters.status === 'all'
      ? matchedBills
      : matchedBills.filter((row) => row.payment_state === filters.status)
  ), [filters.status, matchedBills]);

  const dueCounts = useMemo(() => {
    const unpaidRows = matchedBills.filter((row) => row.payment_state === 'unpaid');
    return {
      all: unpaidRows.length,
      due_today: unpaidRows.filter((row) => row.due_state === 'due_today').length,
      overdue: unpaidRows.filter((row) => row.due_state === 'overdue').length,
    };
  }, [matchedBills]);

  const filteredBills = useMemo(() => (
    filters.dueState === 'all'
      ? paymentFilteredBills
      : paymentFilteredBills.filter((row) => row.due_state === filters.dueState)
  ), [filters.dueState, paymentFilteredBills]);

  const summary = useMemo(() => {
    const uniqueCustomers = new Set(filteredBills.map((row) => row.customer_id)).size;
    const totalAmount = filteredBills.reduce((sum, row) => sum + row.amount, 0);
    const recordedAmount = filteredBills
      .filter((row) => row.amount_source === 'recorded')
      .reduce((sum, row) => sum + row.amount, 0);
    const referenceAmount = filteredBills
      .filter((row) => row.amount_source === 'reference')
      .reduce((sum, row) => sum + row.amount, 0);
    const paidRows = filteredBills.filter((row) => row.payment_state === 'paid');
    const unpaidRows = filteredBills.filter((row) => row.payment_state === 'unpaid');
    return {
      uniqueCustomers,
      totalAmount,
      recordedAmount,
      referenceAmount,
      paidCustomers: paidRows.length,
      unpaidCustomers: unpaidRows.length,
      notDueCustomers: filteredBills.filter((row) => row.payment_state === 'not_due').length,
      paidAmount: paidRows.reduce((sum, row) => sum + row.amount, 0),
      unpaidAmount: unpaidRows.reduce((sum, row) => sum + row.amount, 0),
      missingCustomers: filteredBills.filter((row) => row.payment_state === 'missing').length,
    };
  }, [filteredBills]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / billPageSize));
  const currentPage = Math.min(billPage, totalPages);
  const pageRows = filteredBills.slice((currentPage - 1) * billPageSize, currentPage * billPageSize);
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => value !== DEFAULT_BILL_FILTERS[key]);
  const advancedFilterCount = ['installFrom', 'installTo', 'taskStatus', 'assignee']
    .filter((key) => filters[key] !== DEFAULT_BILL_FILTERS[key]).length;
  const scopeLabel = filters.dueState !== 'all'
    ? ({ due_today: 'ครบกำหนดวันนี้', overdue: 'เกินกำหนด' }[filters.dueState] || 'ตามกำหนดชำระ')
    : filters.status === 'paid'
      ? 'เฉพาะชำระแล้ว'
      : filters.status === 'unpaid'
        ? 'เฉพาะยังไม่ชำระ'
        : filters.status === 'not_due'
          ? 'เฉพาะยังไม่ถึงกำหนด'
          : filters.status === 'missing'
            ? 'เฉพาะไม่มีข้อมูลบิล'
        : 'ทุกสถานะ';

  const updateFilter = (key) => (event) => {
    setFilters((current) => ({
      ...current,
      [key]: event.target.value,
      ...(key === 'billNumber' ? { month: 'all', dueState: 'all' } : {}),
    }));
    setBillPage(1);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_BILL_FILTERS);
    setBillPage(1);
  };

  const openFollowUpEditor = (row) => {
    const task = row.follow_up;
    setFollowUpEditor({
      row,
      assigned_to: task?.assigned_to ?? '',
      status: simpleFollowUpStatus(task?.status),
      original_status: simpleFollowUpStatus(task?.status),
      paid_amount: row.paid_amount ?? row.amount ?? row.monthly_fee ?? '',
      priority: task?.priority || (row.due_state === 'overdue' ? 'high' : 'normal'),
      due_date: dateInput(task?.due_date || row.due_date),
      next_follow_up_at: dateTimeInput(task?.next_follow_up_at),
      contact_result: task?.contact_result || '',
      note: task?.note || '',
    });
  };

  const saveFollowUp = async (event) => {
    event.preventDefault();
    if (!followUpEditor?.row?.bill_month) {
      Swal.fire('ยังสร้างงานไม่ได้', 'ลูกค้ารายนี้ไม่มีเดือนบิลสำหรับงวดที่เลือก กรุณาตรวจสอบวันครบชำระก่อน', 'warning');
      return;
    }
    if (followUpEditor.status === 'completed') {
      const paidAmount = Number(followUpEditor.paid_amount);
      if (!Number.isFinite(paidAmount) || paidAmount < 0) {
        Swal.fire('กรุณาระบุยอดชำระ', 'ยอดชำระจริงต้องเป็นตัวเลขตั้งแต่ 0 บาทขึ้นไป', 'warning');
        return;
      }
      if (followUpEditor.original_status !== 'completed') {
        const confirmation = await Swal.fire({
          icon: 'question',
          title: 'ยืนยันว่าชำระแล้ว?',
          text: `ระบบจะเปลี่ยนบิลที่ ${followUpEditor.row.bill_number} เป็นชำระแล้ว และบันทึกผู้ดำเนินการเป็น ${currentUser?.full_name || currentUser?.username || 'ผู้ใช้ปัจจุบัน'}`,
          showCancelButton: true,
          confirmButtonText: 'ยืนยันการชำระ',
          cancelButtonText: 'กลับไปตรวจสอบ',
          confirmButtonColor: '#65a30d',
        });
        if (!confirmation.isConfirmed) return;
      }
    }
    setSavingFollowUp(true);
    try {
      await axios.post('/installed-customers/qc-follow-ups', {
        installed_customer_id: followUpEditor.row.customer_id,
        task_type: 'billing',
        bill_month: followUpEditor.row.bill_month,
        bill_number: followUpEditor.row.bill_number,
        assigned_to: followUpEditor.assigned_to || null,
        status: followUpEditor.status,
        paid_amount: followUpEditor.status === 'completed' ? Number(followUpEditor.paid_amount) : null,
        priority: followUpEditor.priority,
        due_date: followUpEditor.due_date || null,
        next_follow_up_at: followUpEditor.next_follow_up_at || null,
        contact_result: followUpEditor.contact_result,
        note: followUpEditor.note,
      });
      setFollowUpEditor(null);
      await onRefresh();
      Swal.fire({ icon: 'success', title: followUpEditor.status === 'completed' ? 'บันทึกว่าชำระแล้ว' : 'บันทึกสถานะติดตามแล้ว', text: followUpEditor.status === 'completed' ? 'บิลรอบนี้และสถานะการชำระถูกอัปเดตแล้ว' : 'ผู้รับผิดชอบและผลการติดตามถูกบันทึกแล้ว', timer: 1800, showConfirmButton: false });
    } catch (error) {
      Swal.fire('บันทึกสถานะไม่สำเร็จ', error.response?.data?.error || error.message, 'error');
    } finally {
      setSavingFollowUp(false);
    }
  };

  const exportFilteredBills = async () => {
    if (!filteredBills.length || exportingBills) return;
    setExportingBills(true);
    try {
      const { exportBillPaymentsWorkbook } = await import('../utils/qcExport');
      await exportBillPaymentsWorkbook({
        rows: filteredBills,
        filters: { ...filters, billNumber: String(selectedBillNumber) },
        summary,
        refMonth: result?.ref_month,
      });
      Swal.fire({
        icon: 'success',
        title: 'Export รายการบิลแล้ว',
        text: `บิลที่ ${selectedBillNumber} จำนวน ${summary.uniqueCustomers.toLocaleString('th-TH')} ราย`,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire('Export รายการบิลไม่สำเร็จ', error.message, 'error');
    } finally {
      setExportingBills(false);
    }
  };

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><WalletCards className="h-4.5 w-4.5" /></div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">ตรวจบิลทีละรอบ</h2>
                <p className="mt-0.5 text-xs text-slate-500">เลือกเลขบิลด้านล่าง แล้วกดสถานะที่ต้องการดูได้ทันที</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={clearFilters} disabled={!hasActiveFilters} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"><X className="h-3.5 w-3.5" /> ล้างตัวกรอง</button>
            <button type="button" onClick={exportFilteredBills} disabled={!filteredBills.length || exportingBills} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#78BE20] dark:text-slate-950"><Download className="h-3.5 w-3.5" /> {exportingBills ? 'กำลัง Export...' : 'Export ตามตัวกรอง'}</button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-lime-300 bg-lime-50 p-3 dark:border-lime-900 dark:bg-lime-950/30 sm:flex-row sm:items-center">
          <span className="shrink-0 text-sm font-black text-lime-950 dark:text-lime-200">1. เลือกรอบบิล</span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0" role="group" aria-label="เลือกลำดับบิล">
            {Array.from({ length: maxBillNumber }, (_, index) => index + 1).map((number) => (
              <button key={number} type="button" onClick={() => { setFilters((current) => ({ ...current, billNumber: String(number), month: 'all', dueState: 'all' })); setBillPage(1); }} aria-pressed={selectedBillNumber === number} className={`h-9 min-w-16 rounded-lg border px-3 text-xs font-black transition focus:outline-none focus:ring-4 focus:ring-lime-100 ${selectedBillNumber === number ? 'border-lime-500 bg-[#78BE20] text-slate-950 shadow-sm' : 'border-lime-200 bg-white text-lime-900 hover:border-lime-400 dark:border-lime-800 dark:bg-slate-950 dark:text-lime-300'}`}>บิล {number}</button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <label className="relative">
            <span className="sr-only">ค้นหาลูกค้า</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={filters.query} onChange={updateFilter('query')} placeholder="ค้นหาชื่อลูกค้า, NON หรือแพ็กเกจ" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100 dark:border-slate-700 dark:bg-slate-950" />
          </label>
        </div>

        <details className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/50">
          <summary className="cursor-pointer px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300">ตัวเลือกเพิ่มเติม{advancedFilterCount > 0 ? ` · ใช้อยู่ ${advancedFilterCount}` : ' · วันที่ติดตั้งและผู้รับผิดชอบ'}</summary>
          <div className="grid gap-2 border-t border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
            <label className="relative"><span className="pointer-events-none absolute left-3 top-1.5 text-[10px] font-bold text-slate-400">ติดตั้งตั้งแต่</span><input type="date" value={filters.installFrom} max={filters.installTo || undefined} onChange={updateFilter('installFrom')} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pt-3 text-xs font-bold dark:border-slate-700 dark:bg-slate-950" aria-label="ติดตั้งสำเร็จตั้งแต่วันที่" /></label>
            <label className="relative"><span className="pointer-events-none absolute left-3 top-1.5 text-[10px] font-bold text-slate-400">ติดตั้งถึง</span><input type="date" value={filters.installTo} min={filters.installFrom || undefined} onChange={updateFilter('installTo')} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pt-3 text-xs font-bold dark:border-slate-700 dark:bg-slate-950" aria-label="ติดตั้งสำเร็จถึงวันที่" /></label>
            <select value={filters.taskStatus} onChange={updateFilter('taskStatus')} aria-label="กรองสถานะงานติดตาม" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"><option value="all">งานติดตามทุกสถานะ</option><option value="none">ยังไม่มีงานติดตาม</option><option value="pending">รอดำเนินการ</option><option value="in_progress">กำลังติดตาม</option><option value="completed">ชำระแล้ว</option></select>
            <select value={filters.assignee} onChange={updateFilter('assignee')} aria-label="กรองผู้รับผิดชอบ" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"><option value="all">ผู้รับผิดชอบทั้งหมด</option>{followUpUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.username}</option>)}</select>
          </div>
        </details>

        <p className="mt-4 text-sm font-black text-slate-700 dark:text-slate-200">2. เลือกสถานะการชำระ</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3" role="group" aria-label="กรองสถานะการชำระตามรอบบิล">
          {[
            ['all', 'ลูกค้าทั้งหมด', 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'],
            ['unpaid', 'ยังไม่ชำระ', 'border-rose-400 bg-rose-100 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200'],
            ['paid', 'ชำระแล้ว', 'border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'],
          ].map(([key, label, activeClass]) => (
            <button key={key} type="button" onClick={() => { setFilters((current) => ({ ...current, status: key, dueState: 'all' })); setBillPage(1); }} aria-pressed={filters.status === key} className={`flex min-h-12 items-center justify-between rounded-xl border px-4 text-left text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-lime-100 ${filters.status === key ? activeClass : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'}`}>
              <span>{label}</span><span className="text-lg">{paymentCounts[key].toLocaleString('th-TH')}</span>
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="กรองสถานะข้อมูลบิลเพิ่มเติม">
          {[
            ['not_due', 'ยังไม่ถึงกำหนด', 'border-sky-400 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200'],
            ['missing', 'ข้อมูลบิลไม่ครบ', 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200'],
          ].map(([key, label, activeClass]) => (
            <button key={key} type="button" onClick={() => { setFilters((current) => ({ ...current, status: key, dueState: 'all' })); setBillPage(1); }} aria-pressed={filters.status === key} className={`min-h-10 rounded-xl border px-3 text-xs font-black transition focus:outline-none focus:ring-4 focus:ring-lime-100 ${filters.status === key ? activeClass : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'}`}>{label} <span className="ml-1 opacity-70">{paymentCounts[key].toLocaleString('th-TH')}</span></button>
          ))}
        </div>

        {filters.status === 'unpaid' && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="กรองตามกำหนดชำระ">
            {[
              ['all', 'ทุกกลุ่มติดตาม'],
              ['due_today', 'ครบกำหนดวันนี้'],
              ['overdue', 'เกินกำหนด'],
            ].map(([key, label]) => (
              <button key={key} type="button" onClick={() => { setFilters((current) => ({ ...current, dueState: key })); setBillPage(1); }} aria-pressed={filters.dueState === key} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition ${filters.dueState === key ? 'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'}`}>{label} <span className="ml-1 opacity-70">{dueCounts[key].toLocaleString('th-TH')}</span></button>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <span><b>กำลังแสดง:</b> บิลที่ {selectedBillNumber} · {scopeLabel}</span>
          <span><b>{summary.uniqueCustomers.toLocaleString('th-TH')}</b> ราย</span>
          <span><b>ยอดในรายการ:</b> {formatMoney(summary.totalAmount)} บาท</span>
          {paymentOverview.missingCustomers > 0 && <span className="font-bold text-amber-700 dark:text-amber-300">ข้อมูลบิลไม่ครบ {paymentOverview.missingCustomers.toLocaleString('th-TH')} ราย</span>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
            <tr>
              <th className="min-w-[300px] px-4 py-3">ลูกค้า</th>
              <th className="min-w-[190px] px-4 py-3">บิลรอบนี้</th>
              <th className="min-w-[190px] px-4 py-3">การชำระเงิน</th>
              <th className="min-w-[230px] px-4 py-3">การติดตาม</th>
              <th className="w-40 px-4 py-3 text-center">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.key} className="border-t border-slate-100 transition hover:bg-lime-50/40 dark:border-slate-800 dark:hover:bg-lime-950/20">
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-900 dark:text-white">{row.customer_name || '-'}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500"><span className="font-mono font-bold">NON {row.non_number || '-'}</span><span>·</span><span>ติดตั้ง {formatDate(row.install_date)}</span></div>
                  <div className="mt-1 max-w-[360px] truncate text-xs font-semibold text-slate-600 dark:text-slate-300" title={row.package_name}>{row.package_name || 'ยังไม่ระบุแพ็กเกจ'} · {formatMoney(row.monthly_fee)} บาท/เดือน</div>
                </td>
                <td className="px-4 py-3"><div className="font-black text-slate-900 dark:text-white">บิลที่ {row.bill_number}</div><div className="mt-0.5 text-xs font-semibold text-slate-500">{formatMonth(row.bill_month)} · ครบกำหนด {formatDate(row.due_date)}</div><div className="mt-1.5"><DueStateBadge state={row.due_state} /></div></td>
                <td className="px-4 py-3"><div className="flex flex-wrap items-center gap-2"><CmPaymentStatusBadge row={row} /><span className="font-black text-slate-900 dark:text-white">{formatMoney(row.amount)} บาท</span></div><div className="mt-1 text-[11px] text-slate-400">{row.amount_source_label}</div></td>
                <td className="px-4 py-3">
                  {row.follow_up ? <><TaskStatusBadge status={row.follow_up.status} /><div className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200">{row.follow_up.assignee_name || 'ยังไม่มอบหมายผู้รับผิดชอบ'}</div><button type="button" onClick={() => openFollowUpEditor(row)} className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-black text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">อัปเดตการติดตาม</button></> : row.payment_state === 'unpaid' ? <button type="button" onClick={() => openFollowUpEditor(row)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-black text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"><Plus className="h-3.5 w-3.5" /> เริ่มติดตาม</button> : <span className="text-xs font-semibold text-slate-400">ไม่ต้องติดตามในตอนนี้</span>}
                </td>
                <td className="px-4 py-3 text-center"><button type="button" onClick={() => onViewCustomer({ ...row.customer, selected_bill_context: row })} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800 dark:bg-[#78BE20] dark:text-slate-950"><Eye className="h-3.5 w-3.5" /> ดูรายละเอียด</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pageRows.length && <div className="px-4 py-12 text-center"><p className="text-sm font-bold text-slate-600 dark:text-slate-300">ไม่พบลูกค้าในบิลที่ {selectedBillNumber} ตามตัวกรองที่เลือก</p><p className="mt-1 text-xs text-slate-400">ลองล้างตัวกรอง หรือเลือกงวดบิลอื่น</p><button type="button" onClick={clearFilters} disabled={!hasActiveFilters} className="mt-3 min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">ล้างตัวกรองทั้งหมด</button></div>}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2"><span>แสดง</span><select value={billPageSize} onChange={(event) => { setBillPageSize(Number(event.target.value)); setBillPage(1); }} className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900">{[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select><span>จาก {filteredBills.length.toLocaleString('th-TH')} ราย</span></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => setBillPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900" aria-label="หน้าบิลก่อนหน้า"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-24 text-center font-bold">หน้า {currentPage} / {totalPages}</span><button type="button" onClick={() => setBillPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900" aria-label="หน้าบิลถัดไป"><ChevronRight className="h-4 w-4" /></button></div>
      </div>
      </section>
      {followUpEditor && <FollowUpTaskModal value={followUpEditor} onChange={setFollowUpEditor} users={followUpUsers} currentUser={currentUser} saving={savingFollowUp} onSubmit={saveFollowUp} onClose={() => setFollowUpEditor(null)} />}
    </>
  );
}

function CmPaymentStatusBadge({ row, state: providedState }) {
  const state = providedState || cmPaymentMeta(row);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${state.className}`}>{state.label}</span>;
}

function DueStateBadge({ state }) {
  const states = {
    paid: ['ชำระแล้ว', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'],
    not_due: ['ยังไม่ถึงกำหนด', 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'],
    due_today: ['ครบกำหนดวันนี้', 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'],
    overdue: ['เกินกำหนด', 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300'],
    missing: ['ไม่มีข้อมูลบิล', 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'],
  };
  const [label, className] = states[state] || states.missing;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${className}`}>{label}</span>;
}

function TaskStatusBadge({ status }) {
  const simpleStatus = simpleFollowUpStatus(status);
  const states = {
    assigned: ['รอดำเนินการ', 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'],
    in_progress: ['กำลังติดตาม', 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'],
    completed: ['ชำระแล้ว', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'],
  };
  const [label, className] = states[simpleStatus];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${className}`}>{label}</span>;
}

function FollowUpTaskModal({ value, onChange, users, currentUser, saving, onSubmit, onClose }) {
  const update = (key) => (event) => onChange((current) => ({ ...current, [key]: event.target.value }));
  const currentUserName = currentUser?.full_name || currentUser?.username || 'ไม่พบชื่อผู้ใช้งาน';
  const updateAssignee = (event) => {
    const assignedTo = event.target.value;
    onChange((current) => ({
      ...current,
      assigned_to: assignedTo,
      status: assignedTo && current.status === 'unassigned' ? 'assigned' : current.status,
    }));
  };
  const updateStatus = (status) => onChange((current) => ({
    ...current,
    status,
    assigned_to: current.assigned_to || ((status === 'in_progress' || status === 'completed') ? String(currentUser?.id || '') : ''),
  }));
  const row = value.row;
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="follow-up-title">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" aria-label="ปิดหน้ามอบหมายงาน" />
      <form onSubmit={onSubmit} className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div><h3 id="follow-up-title" className="font-black text-slate-900 dark:text-white">อัปเดตการติดตามบิลที่ {row.bill_number}</h3><p className="mt-1 text-xs text-slate-500">{row.customer_name} · NON {row.non_number} · {formatMonth(row.bill_month)}</p></div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="ปิด"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-black text-slate-600 dark:text-slate-300">สถานะงาน</p>
            <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="เลือกสถานะงานติดตาม">
              {FOLLOW_UP_STATUS_OPTIONS.map(([status, label, description]) => (
                <button key={status} type="button" onClick={() => updateStatus(status)} aria-pressed={value.status === status} className={`min-h-16 rounded-xl border px-3 py-2 text-left transition ${value.status === status ? 'border-lime-500 bg-lime-50 ring-2 ring-lime-100 dark:border-lime-700 dark:bg-lime-950/50' : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950'}`}><span className="block text-sm font-black text-slate-900 dark:text-white">{label}</span><span className="mt-0.5 block text-[11px] text-slate-500">{description}</span></button>
              ))}
            </div>
          </div>
          <EditField label="ผู้รับผิดชอบ"><select value={value.assigned_to} onChange={updateAssignee} className={fieldClass}><option value="">ยังไม่มอบหมาย</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.username}</option>)}</select></EditField>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"><div className="flex items-center gap-2 text-xs font-black text-slate-600 dark:text-slate-300"><LockKeyhole className="h-4 w-4 text-lime-600" /> ผู้บันทึกสถานะครั้งนี้</div><p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{currentUserName}</p><p className="mt-0.5 text-[11px] text-slate-500">ล็อกจากบัญชีที่เข้าสู่ระบบ เปลี่ยนชื่อไม่ได้</p></div>
          {value.status === 'completed' && <EditField label="ยอดชำระจริง (บาท)" className="sm:col-span-2"><input required type="number" min="0" step="0.01" value={value.paid_amount} onChange={update('paid_amount')} className={fieldClass} /><span className="mt-1 block text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">เมื่อบันทึก สถานะการชำระและบิลรอบนี้จะเปลี่ยนเป็น “ชำระแล้ว” โดยไม่เปลี่ยนผล CM Fraud / Churn</span></EditField>}
          <EditField label="ผลการติดต่อ" className="sm:col-span-2"><input value={value.contact_result} onChange={update('contact_result')} placeholder="เช่น รับสาย / ขอเลื่อน / ติดต่อไม่ได้" className={fieldClass} /></EditField>
          <EditField label="รายละเอียดการติดตาม" className="sm:col-span-2"><textarea rows={4} value={value.note} onChange={update('note')} placeholder="บันทึกสิ่งที่ต้องดำเนินการหรือผลการพูดคุย" className={`${fieldClass} h-auto py-2`} /></EditField>
          <details className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-950/50">
            <summary className="cursor-pointer px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300">ตัวเลือกเพิ่มเติม: ความสำคัญและวันติดตาม</summary>
            <div className="grid gap-3 border-t border-slate-200 p-3 sm:grid-cols-3 dark:border-slate-700">
              <EditField label="ความสำคัญ"><select value={value.priority} onChange={update('priority')} className={fieldClass}><option value="low">ต่ำ</option><option value="normal">ปกติ</option><option value="high">สูง</option><option value="urgent">เร่งด่วน</option></select></EditField>
              <EditField label="กำหนดดำเนินการ"><input type="date" value={value.due_date} onChange={update('due_date')} className={fieldClass} /></EditField>
              <EditField label="นัดติดตามครั้งถัดไป"><input type="datetime-local" value={value.next_follow_up_at} onChange={update('next_follow_up_at')} className={fieldClass} /></EditField>
            </div>
          </details>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900"><button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">ยกเลิก</button><button type="submit" disabled={saving || !currentUser?.id} title={!currentUser?.id ? 'กรุณาเข้าสู่ระบบใหม่ก่อนบันทึก' : undefined} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#78BE20] px-4 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} บันทึกสถานะ</button></div>
      </form>
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

function EmptyTable({ hasSearch, onClear }) {
  return (
    <div className="py-16 text-center text-slate-500">
      <Search className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-3 font-bold">{hasSearch ? 'ไม่พบข้อมูลตามตัวกรอง' : 'ไม่มีลูกค้าในช่วงเดือนนี้'}</p>
      <p className="mt-1 text-xs">{hasSearch ? 'ลองล้างคำค้นหาหรือเปลี่ยนตัวกรอง' : 'เลือกเดือนติดตั้งอื่นเพื่อตรวจสอบ'}</p>
      {hasSearch && <button type="button" onClick={onClear} className="mt-3 min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">ล้างตัวกรองทั้งหมด</button>}
    </div>
  );
}

function dateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function dateTimeInput(value) {
  if (!value) return '';
  const text = String(value).replace(' ', 'T');
  return text.slice(0, 16);
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
    change_reason: '',
  };
}

function nextMonth(value) {
  const [year, month] = String(value || '').split('-').map(Number);
  const date = year && month ? new Date(year, month, 1) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMonthsClamped(value, months) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const targetFirst = new Date(Date.UTC(year, month - 1 + Number(months || 0), 1));
  const lastDay = new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0)).getUTCDate();
  targetFirst.setUTCDate(Math.min(day, lastDay));
  return targetFirst.toISOString().slice(0, 10);
}

function cmOutcomeFromForm(form, type, caseWindowMonths) {
  const subject = type === 'fraud' ? 'Fraud' : 'Churn';
  const safeMonths = Math.max(1, Number(caseWindowMonths) || 4);
  const today = todayInBangkok();
  const cutoff = addMonthsClamped(form.install_date, safeMonths);
  if (form.status !== 'cancelled') {
    if (cutoff && today < cutoff) {
      return { key: 'monitoring', label: 'อยู่ระหว่างตรวจ', tone: 'info', reason: `ยังใช้งาน ณ ${formatDate(today)} · เหลือ ${daysBetweenIso(today, cutoff)} วันถึงวันสรุปผล` };
    }
    return { key: 'normal', label: `ไม่เข้าเงื่อนไข ${subject}`, tone: 'success', reason: `ครบช่วงตรวจแล้วและยังใช้งาน ณ ${formatDate(today)}` };
  }
  if (!form.install_date || !form.cancelled_at) {
    return { key: 'incomplete', label: 'ข้อมูลยังไม่ครบ', tone: 'warning', reason: 'ต้องมีวันติดตั้งและวันที่ยกเลิกก่อนคำนวณ CM' };
  }
  if (form.cancelled_at < form.install_date) {
    return { key: 'incomplete', label: 'วันที่ไม่ถูกต้อง', tone: 'warning', reason: 'วันที่ยกเลิกต้องไม่อยู่ก่อนวันติดตั้ง' };
  }
  if (form.cancelled_at > today) {
    return { key: 'incomplete', label: 'วันที่ยังมาไม่ถึง', tone: 'warning', reason: 'วันที่ยกเลิกจริงต้องไม่เกินวันปัจจุบัน' };
  }
  if (form.cancelled_at < cutoff) {
    return { key: 'case', label: `เข้าเงื่อนไข ${subject}`, tone: 'danger', reason: `ยกเลิกจริงภายใน ${safeMonths} เดือนหลังติดตั้ง` };
  }
  return { key: 'normal', label: `ไม่เข้าเงื่อนไข ${subject}`, tone: 'success', reason: `ยกเลิกหลังพ้นเกณฑ์ ${safeMonths} เดือน` };
}

function CustomerDetailDrawer({ customer, type, caseWindowMonths, billMonths, onClose, onRefresh }) {
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [detailTab, setDetailTab] = useState(customer.selected_bill_context ? 'bills' : 'overview');
  const [customerForm, setCustomerForm] = useState(() => customerFormValues(customer));
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [billEditor, setBillEditor] = useState(null);
  const [savingBill, setSavingBill] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditVersion, setAuditVersion] = useState(0);
  const outcome = rowOutcome(customer, type);
  const billsByMonth = new Map((customer.bills || []).map((bill) => [bill.bill_month, bill]));
  const visibleBillMonths = Array.from(new Set([
    ...billMonths,
    ...(customer.bills || []).map((bill) => bill.bill_month),
  ])).sort();

  useEffect(() => {
    let active = true;
    axios.get(`/installed-customers/${customer.id}/qc-history`).then((response) => {
      if (active) setAuditLogs(response.data || []);
    }).catch(() => {
      if (active) setAuditLogs([]);
    }).finally(() => {
      if (active) setLoadingAudit(false);
    });
    return () => { active = false; };
  }, [auditVersion, customer.id]);

  const beginCustomerEdit = () => {
    setCustomerForm(customerFormValues(customer));
    setDetailTab('overview');
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
      setLoadingAudit(true);
      setAuditVersion((value) => value + 1);
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
      paid_amount: bill?.paid_amount ?? '',
      raw_value: bill?.raw_value || '',
      due_date: dateInput(bill?.due_date),
      change_reason: '',
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
        paid_amount: billEditor.paid_amount === '' ? null : Number(billEditor.paid_amount),
        raw_value: billEditor.raw_value,
        due_date: billEditor.due_date || null,
        change_reason: billEditor.change_reason,
      });
      setBillEditor(null);
      await onRefresh();
      setLoadingAudit(true);
      setAuditVersion((value) => value + 1);
      Swal.fire({ icon: 'success', title: 'บันทึกบิลแล้ว', timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire('บันทึกบิลไม่สำเร็จ', error.response?.data?.error || error.message, 'error');
    } finally {
      setSavingBill(false);
    }
  };

  const deleteBill = async () => {
    if (!billEditor?.originalMonth) return;
    if (!String(billEditor.change_reason || '').trim()) {
      Swal.fire('กรุณาระบุเหตุผล', 'ต้องระบุเหตุผลก่อนลบบิลเพื่อบันทึกประวัติการแก้ไข', 'warning');
      return;
    }
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
      await axios.delete(`/installed-customers/${customer.id}/bills/${billEditor.originalMonth}`, { data: { change_reason: billEditor.change_reason } });
      setBillEditor(null);
      await onRefresh();
      setLoadingAudit(true);
      setAuditVersion((value) => value + 1);
    } catch (error) {
      Swal.fire('ลบบิลไม่สำเร็จ', error.response?.data?.error || error.message, 'error');
    } finally {
      setSavingBill(false);
    }
  };

  const selectedBillContext = customer.selected_bill_context || null;
  const displayedCmPayment = selectedBillContext
    ? cmPaymentMeta(selectedBillContext)
    : customerPaymentMeta(customer);

  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="customer-detail-title">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" aria-label="ปิดรายละเอียด" />
      <aside className="relative flex h-full w-full max-w-4xl flex-col bg-[#F8FAF7] shadow-2xl dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black text-slate-500">CM {type === 'fraud' ? 'Fraud' : 'Churn'}</span><OutcomeBadge outcome={outcome} /><span className="text-xs text-slate-500">NON {customer.non_number}</span></div>
            <h2 id="customer-detail-title" className="mt-2 truncate text-xl font-black text-slate-900 dark:text-white">{customer.customer_name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500" title={customer.package_name}>{customer.package_name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!editingCustomer && <button type="button" onClick={beginCustomerEdit} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#78BE20] px-3 text-sm font-black text-slate-950 hover:bg-lime-500"><Pencil className="h-4 w-4" /> แก้ไขข้อมูล</button>}
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950" aria-label="ปิด"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {!editingCustomer && (
          <nav className="flex gap-1 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900 sm:px-6" aria-label="รายละเอียดลูกค้า">
            {[
              ['overview', 'ข้อมูลลูกค้า'],
              ['bills', `บิลทุกรอบ (${visibleBillMonths.length})`],
              ['history', 'ประวัติการแก้ไข'],
            ].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setDetailTab(key)} aria-pressed={detailTab === key} className={`min-h-10 rounded-lg px-3 text-sm font-black transition ${detailTab === key ? 'bg-[#78BE20] text-slate-950' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{label}</button>
            ))}
          </nav>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {editingCustomer ? (
            <CustomerEditForm
              form={customerForm}
              setForm={setCustomerForm}
              type={type}
              caseWindowMonths={caseWindowMonths}
              saving={savingCustomer}
              onSubmit={saveCustomer}
              onCancel={() => setEditingCustomer(false)}
            />
          ) : detailTab === 'overview' ? (
            <>
              <DetailSection title="CM และการชำระเงิน">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoPanel label={`CM ${type === 'fraud' ? 'Fraud' : 'Churn'}`}><OutcomeBadge outcome={outcome} /><p className="mt-1 text-[11px] font-semibold text-slate-500">{customer.cm_reason || `คำนวณจากข้อมูลจริงภายใน ${caseWindowMonths} เดือน`}</p></InfoPanel>
                  <InfoPanel label={selectedBillContext ? `การชำระเงิน · บิลที่ ${selectedBillContext.bill_number}` : 'การชำระเงินล่าสุด'}><CmPaymentStatusBadge state={displayedCmPayment} />{selectedBillContext && <p className="mt-1 text-[11px] text-slate-500">ครบกำหนด {formatDate(selectedBillContext.due_date)} · ยอด {formatMoney(selectedBillContext.amount)} บาท</p>}</InfoPanel>
                  <InfoPanel label="ข้อมูล CM จาก Excel (ใช้อ้างอิง)"><StatusBadge value={customer.qc_status || customer.status} /></InfoPanel>
                  <InfoPanel label="ข้อมูล Billing จากไฟล์ต้นทาง"><p className="text-sm font-bold text-slate-800 dark:text-slate-100">{customer.billing_status || '-'}</p></InfoPanel>
                  <InfoPanel label="เดือนที่เปลี่ยนสถานะ"><p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatDate(customer.status_changed_at)}</p></InfoPanel>
                  <InfoPanel label="วันที่เช็คยอด"><p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatDate(customer.bill_check_date)}</p></InfoPanel>
                </div>
                <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-bold text-slate-500">ผลการติดตาม / AE Remark</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{customer.ae_remark || '-'}</p></div>
              </DetailSection>

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
                  ['วันที่ยกเลิก', formatDate(customer.cancelled_at)],
                ]} />
                <details className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-950">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300">ข้อมูลกำหนดเพิ่มเติม</summary>
                  <div className="border-t border-slate-200 p-3 dark:border-slate-800"><DetailGrid items={[
                    ['ที่มาของรอบบิล', customer.payment_due_source === 'auto' ? 'ระบบคำนวณตามวันติดตั้ง' : 'กำหนดเอง/จากไฟล์'],
                    ['เดือนติดตั้งสำเร็จ', customer.install_month_label || formatMonth(String(customer.install_date).slice(0, 7))],
                    ['สรุปสำรอง/ยกเลิก', customer.tracking_summary || customer.cancel_reason],
                    ['คาดการณ์ Terminate', formatDate(customer.expected_terminate_at)],
                  ]} /></div>
                </details>
              </DetailSection>

              <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <summary className="cursor-pointer px-4 py-3 text-sm font-black text-slate-600 dark:text-slate-300">ข้อมูลจากไฟล์ต้นทาง</summary>
                <div className="border-t border-slate-200 p-4 dark:border-slate-800"><DetailGrid items={[
                  ['ชีตต้นฉบับ', customer.source_sheet],
                  ['แถวต้นฉบับ', customer.source_row_number],
                  ['นำเข้าล่าสุด', formatDate(customer.last_imported_at)],
                  ['สถานะระบบ', customer.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'ยังใช้งาน'],
                ]} /></div>
              </details>
            </>
          ) : null}

          {!editingCustomer && detailTab === 'bills' && <DetailSection title={`บิลรายเดือน · ค้าง ${Number(customer.outstanding_bills).toLocaleString('th-TH')} บิล รวม ${formatMoney(customer.outstanding_total)} บาท`}>
            {selectedBillContext && (
              <div className="mb-4 rounded-2xl border-2 border-lime-400 bg-lime-50 p-4 dark:border-lime-800 dark:bg-lime-950/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black text-lime-800 dark:text-lime-300">บิลที่เปิดมาจากหน้ารายการ</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-lg font-black text-slate-950 dark:text-white">บิลที่ {selectedBillContext.bill_number} · {formatMonth(selectedBillContext.bill_month)}</span><CmPaymentStatusBadge row={selectedBillContext} /></div>
                    <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">ยอด {formatMoney(selectedBillContext.amount)} บาท · ครบกำหนด {formatDate(selectedBillContext.due_date)}</p>
                  </div>
                  <button type="button" onClick={() => openBillEditor(selectedBillContext.bill_month, billsByMonth.get(selectedBillContext.bill_month))} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#78BE20] px-4 text-sm font-black text-slate-950 hover:bg-lime-500"><Pencil className="h-4 w-4" /> แก้ไขบิลรอบนี้</button>
                </div>
              </div>
            )}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">บิลทุกรอบเรียงตามเดือน กดรอบที่ต้องการเพื่อแก้ไข</p>
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
              {visibleBillMonths.map((ym) => <BillCard key={ym} month={ym} bill={billsByMonth.get(ym)} selected={selectedBillContext?.bill_month === ym} onEdit={() => openBillEditor(ym, billsByMonth.get(ym))} />)}
              {!visibleBillMonths.length && <p className="text-sm text-slate-500">ยังไม่มีข้อมูลบิลรายเดือน กด “เพิ่มบิลรายเดือน” เพื่อเริ่มบันทึก</p>}
            </div>
          </DetailSection>}

          {!editingCustomer && detailTab === 'history' && <DetailSection title="ประวัติการแก้ไขและติดตาม">
            {loadingAudit ? <div className="flex items-center gap-2 py-4 text-sm font-semibold text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" /> กำลังโหลดประวัติ...</div> : auditLogs.length ? <div className="space-y-2">{auditLogs.map((log) => <AuditLogItem key={log.id} log={log} />)}</div> : <p className="py-3 text-sm text-slate-500">ยังไม่มีประวัติการแก้ไขผ่านระบบ</p>}
          </DetailSection>}
        </div>
      </aside>
    </div>
  );
}

const fieldClass = 'mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-lime-500 focus:ring-4 focus:ring-lime-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

function CustomerEditForm({ form, setForm, type, caseWindowMonths, saving, onSubmit, onCancel }) {
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const cmPreview = cmOutcomeFromForm(form, type, caseWindowMonths);
  return (
    <form onSubmit={onSubmit} className="overflow-hidden rounded-2xl border-2 border-lime-300 bg-white shadow-sm dark:border-lime-800 dark:bg-slate-900">
      <div className="border-b border-lime-200 bg-lime-50 px-4 py-3 dark:border-lime-900 dark:bg-lime-950/50">
        <h3 className="font-black text-lime-950 dark:text-lime-200">แก้ไขข้อมูลลูกค้า</h3>
        <p className="mt-0.5 text-xs text-lime-800 dark:text-lime-400">ข้อมูลที่บันทึกจะนำไปคำนวณ Fraud / Churn และใช้ใน Export ครั้งถัดไป</p>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className={`rounded-xl border p-3 ${cmPreview.tone === 'danger' ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30' : cmPreview.tone === 'warning' ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' : cmPreview.tone === 'info' ? 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'}`}>
          <p className="text-xs font-black text-slate-500">ผล CM หลังบันทึก</p>
          <div className="mt-1 flex flex-wrap items-center gap-2"><OutcomeBadge outcome={cmPreview} /><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{cmPreview.reason}</span></div>
          <p className="mt-1 text-[11px] text-slate-500">ผลนี้คำนวณอัตโนมัติจากสถานะระบบ วันติดตั้ง และวันที่ยกเลิก ไม่ได้อิงข้อความ CM จากไฟล์ต้นทาง</p>
        </div>
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
            <EditField label="ข้อมูล CM จาก Excel (ใช้อ้างอิง)"><input value={form.qc_status} onChange={update('qc_status')} placeholder="เช่น Active, Suspend - Debt" className={fieldClass} /><span className="mt-1 block text-[11px] font-medium text-slate-400">ช่องนี้ไม่ใช่ผล CM สุดท้าย ระบบจะคำนวณผลจริงตามวันที่ปัจจุบัน</span></EditField>
            <EditField label="Billing จากไฟล์ต้นทาง"><input value={form.billing_status} onChange={update('billing_status')} className={fieldClass} /></EditField>
            <EditField label="วันที่เปลี่ยนสถานะ"><input type="date" value={form.status_changed_at} onChange={update('status_changed_at')} className={fieldClass} /></EditField>
            <EditField label="วันที่เช็คยอด"><input type="date" value={form.bill_check_date} onChange={update('bill_check_date')} className={fieldClass} /></EditField>
            <EditField label="คาดการณ์ Terminate"><input type="date" value={form.expected_terminate_at} onChange={update('expected_terminate_at')} className={fieldClass} /></EditField>
            <EditField label="วิธีกำหนดรอบชำระ"><select value={form.payment_due_mode} onChange={update('payment_due_mode')} className={fieldClass}><option value="auto">อัตโนมัติตามวันติดตั้ง AIS</option><option value="manual">กำหนดวันที่เอง</option></select></EditField>
            <EditField label="กำหนดชำระ (วันที่ 1–31)"><input type="number" min="1" max="31" disabled={form.payment_due_mode === 'auto'} value={form.payment_due_mode === 'auto' ? aisDueDayPreview(form.install_date) : form.payment_due_day} onChange={update('payment_due_day')} className={`${fieldClass} disabled:bg-slate-100 disabled:text-slate-400`} /><span className="mt-1 block text-[11px] font-medium text-slate-400">โหมดอัตโนมัติจะคำนวณใหม่เมื่อเปลี่ยนวันติดตั้ง</span></EditField>
            <EditField label="เดือนติดตั้งสำเร็จ"><input value={form.install_month_label} onChange={update('install_month_label')} placeholder="เช่น Aug" className={fieldClass} /></EditField>
            {form.status === 'cancelled' && <EditField label="วันที่ยกเลิกจริง" required><input required type="date" min={form.install_date || undefined} max={todayInBangkok()} value={form.cancelled_at} onChange={update('cancelled_at')} className={fieldClass} /><span className="mt-1 block text-[11px] font-medium text-slate-400">หากยังไม่ยกเลิกจริง ให้ใช้ช่อง “คาดการณ์ Terminate” แทน</span></EditField>}
            {form.status === 'cancelled' && <EditField label="เหตุผลยกเลิก"><input value={form.cancel_reason} onChange={update('cancel_reason')} className={fieldClass} /></EditField>}
            <EditField label="สรุปสำรอง/ยกเลิก" className="sm:col-span-2"><textarea rows={2} value={form.tracking_summary} onChange={update('tracking_summary')} className={`${fieldClass} h-auto py-2`} /></EditField>
            <EditField label="ผลการติดตาม / AE Remark" className="sm:col-span-2"><textarea rows={4} value={form.ae_remark} onChange={update('ae_remark')} className={`${fieldClass} h-auto py-2`} /></EditField>
            <EditField label="เหตุผลการแก้ไขครั้งนี้" required className="sm:col-span-2"><input required value={form.change_reason} onChange={update('change_reason')} placeholder="เช่น อัปเดตจากการตรวจสอบกับลูกค้า" className={fieldClass} /></EditField>
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
        <EditField label={value.bill_status === 'paid' ? 'ยอดชำระจริง (บาท)' : 'ยอดเงิน (บาท)'}>
          {value.bill_status === 'paid'
            ? <><input type="number" min="0" step="0.01" value={value.paid_amount} onChange={update('paid_amount')} placeholder="กรอกเมื่อทราบยอดจริง" className={fieldClass} /><span className="mt-1 block text-[11px] font-medium text-slate-400">เว้นว่างได้ ระบบจะแสดงยอดประมาณพร้อมป้ายกำกับ</span></>
            : <input type="number" min="0" step="0.01" disabled={!needsAmount} value={value.amount} onChange={update('amount')} className={`${fieldClass} disabled:bg-slate-100 disabled:text-slate-400`} />}
        </EditField>
        <EditField label="ข้อความที่ต้องการแสดง"><input value={value.raw_value} onChange={update('raw_value')} placeholder={value.bill_status === 'paid' ? 'จ่ายแล้ว' : 'เช่น สำรอง 643.07'} className={fieldClass} /></EditField>
      </div>
      <div className="mt-3"><EditField label="เหตุผลการแก้ไขบิล" required><input required value={value.change_reason} onChange={update('change_reason')} placeholder="เช่น ตรวจสอบยอดจากเอกสาร Billing แล้ว" className={fieldClass} /></EditField></div>
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

function AuditLogItem({ log }) {
  const actionLabels = {
    customer_updated: 'แก้ไขข้อมูลลูกค้า',
    bill_created: 'เพิ่มบิล',
    bill_updated: 'แก้ไขบิล',
    bill_deleted: 'ลบบิล',
    follow_up_created: 'สร้างงานติดตาม',
    follow_up_updated: 'อัปเดตงานติดตาม',
    follow_up_auto_completed: 'ระบบเปลี่ยนเป็นชำระแล้วอัตโนมัติ',
    bill_marked_paid_from_follow_up: 'ยืนยันชำระจากงานติดตาม',
  };
  const oldValue = log.old_value || {};
  const newValue = log.new_value || {};
  let detail = log.bill_month ? formatMonth(log.bill_month) : '';
  if (log.entity_type === 'bill') {
    const oldStatus = oldValue.bill_status ? billStatusLabel(oldValue.bill_status) : null;
    const newStatus = newValue.bill_status ? billStatusLabel(newValue.bill_status) : null;
    if (oldStatus || newStatus) detail = `${detail}${detail ? ' · ' : ''}${oldStatus || 'ไม่มีข้อมูล'} → ${newStatus || 'ลบข้อมูล'}`;
  } else if (log.entity_type === 'follow_up_task') {
    const status = newValue.status ? ({ unassigned: 'รอดำเนินการ', assigned: 'รอดำเนินการ', in_progress: 'กำลังติดตาม', waiting_customer: 'กำลังติดตาม', completed: 'ชำระแล้ว', unreachable: 'กำลังติดตาม' }[newValue.status] || newValue.status) : '';
    detail = [detail, status, newValue.assignee_name].filter(Boolean).join(' · ');
  } else if (log.entity_type === 'customer' && oldValue.qc_status !== newValue.qc_status) {
    detail = `CM: ${oldValue.qc_status || '-'} → ${newValue.qc_status || '-'}`;
  }
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black text-slate-800 dark:text-slate-100">{actionLabels[log.action] || log.action}</p>{detail && <p className="mt-0.5 text-xs font-semibold text-slate-500">{detail}</p>}</div><time className="text-[11px] font-semibold text-slate-400">{formatDateTime(log.created_at)}</time></div>
      <p className="mt-2 text-xs text-slate-500">โดย {log.actor_name || log.actor_username || 'ระบบ'}{log.reason ? ` · ${log.reason}` : ''}</p>
    </div>
  );
}

function BillCard({ month, bill, selected = false, onEdit }) {
  const tone = !bill
    ? 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950'
    : bill.bill_status === 'paid'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
      : ['outstanding', 'overdue'].includes(bill.bill_status)
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
        : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300';
  const value = !bill
    ? 'ไม่มีข้อมูล'
    : bill.bill_status === 'paid'
      ? (bill.paid_amount != null ? `จ่ายแล้ว ${formatMoney(bill.paid_amount)} บาท` : 'จ่ายแล้ว · ยังไม่ระบุยอดจริง')
      : bill.raw_value || `${formatMoney(bill.amount)} บาท`;
  const sourceLabel = bill?.bill_source === 'auto' ? 'ระบบสร้าง' : bill?.bill_source === 'manual' ? 'แก้ไขเอง' : 'จากไฟล์';
  return (
    <button type="button" onClick={onEdit} aria-current={selected ? 'true' : undefined} className={`group relative min-h-24 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-lime-100 ${tone} ${selected ? 'ring-2 ring-lime-500 ring-offset-2 dark:ring-offset-slate-900' : ''}`}>
      <Pencil className="absolute right-3 top-3 h-3.5 w-3.5 opacity-0 transition group-hover:opacity-70 group-focus:opacity-70" />
      <p className="pr-6 text-xs font-bold opacity-70">{formatMonth(month)}{selected ? ' · รอบที่เลือก' : ''}</p>
      <p className="mt-2 whitespace-normal break-words text-sm font-black leading-5" title={String(value)}>{value}</p>
      {bill && <p className="mt-1 text-[11px] font-semibold opacity-70">ครบชำระ {formatDate(bill.due_date)} · {sourceLabel}</p>}
      {bill?.bill_source === 'auto' && Number(bill.estimated_total) > 0 && <p className="mt-1 text-[11px] opacity-70">ก่อน VAT {formatMoney(bill.estimated_amount)} + VAT {formatMoney(bill.estimated_vat)} บาท</p>}
      <p className="mt-2 text-[11px] font-bold opacity-0 transition group-hover:opacity-60 group-focus:opacity-60">กดเพื่อแก้ไข</p>
    </button>
  );
}
