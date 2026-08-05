import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

const TABS = [
  { id: 'list', label: 'รายชื่อลูกค้า' },
  { id: 'packages', label: 'ราคาแพ็กเกจ' },
];

function formatMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '-';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return s;
  return `${day}/${m}/${y}`;
}

const PENDING_PACKAGE_NAME = 'รอระบุชื่อแพ็กเกจ';

function isPackageIncomplete(value) {
  const text = String(value || '').trim();
  return !text
    || text === PENDING_PACKAGE_NAME
    || /^#(?:N\/A|REF!|VALUE!|DIV\/0!|NAME\?|ERROR!)$/i.test(text)
    || /^\d[\d,]*(?:\.\d+)?(?:\s*(?:บาท|THB))?$/i.test(text);
}

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\wก-๙]/gu, '');
}

function mapInstallRows(sheetRows) {
  if (!sheetRows.length) return [];
  const headers = sheetRows[0].map(normalizeHeader);
  const findIdx = (...keys) => headers.findIndex((h) => keys.some((k) => h.includes(k) || h === k));

  const idxNon = findIdx('non_number', 'non', 'access_no', 'access', 'เลขnon', 'nonnumber');
  const idxName = findIdx('customer_name', 'customer', 'name', 'ชื่อ');
  const idxPkg = findIdx('package_name', 'package', 'แพ็กเกจ', 'แพคเกจ');
  const idxDate = findIdx('install_date', 'date', 'วันติดตั้ง', 'installed');
  const idxFee = findIdx('monthly_fee', 'fee', 'price', 'ราคา', 'ค่าใช้จ่าย');

  return sheetRows.slice(1)
    .filter((r) => r && r.some((c) => c != null && String(c).trim() !== ''))
    .map((r) => ({
      non_number: idxNon >= 0 ? String(r[idxNon] ?? '').trim() : '',
      customer_name: idxName >= 0 ? String(r[idxName] ?? '').trim() : '',
      package_name: idxPkg >= 0 ? String(r[idxPkg] ?? '').trim() : '',
      install_date: idxDate >= 0 ? r[idxDate] : '',
      monthly_fee: idxFee >= 0 && r[idxFee] != null && r[idxFee] !== '' ? r[idxFee] : undefined,
    }));
}

function mapCancelRows(sheetRows) {
  if (!sheetRows.length) return [];
  const headers = sheetRows[0].map(normalizeHeader);
  const findIdx = (...keys) => headers.findIndex((h) => keys.some((k) => h.includes(k) || h === k));

  const idxNon = findIdx('non_number', 'non', 'access_no', 'access', 'เลขnon');
  const idxDate = findIdx('cancelled_at', 'cancel_date', 'date', 'วันยกเลิก', 'ยกเลิก');
  const idxReason = findIdx('cancel_reason', 'reason', 'เหตุผล');

  return sheetRows.slice(1)
    .filter((r) => r && r.some((c) => c != null && String(c).trim() !== ''))
    .map((r) => ({
      non_number: idxNon >= 0 ? String(r[idxNon] ?? '').trim() : '',
      cancelled_at: idxDate >= 0 ? r[idxDate] : '',
      cancel_reason: idxReason >= 0 ? String(r[idxReason] ?? '').trim() : '',
    }));
}

const emptyForm = {
  customer_name: '',
  non_number: '',
  package_name: '',
  monthly_fee: '',
  install_date: new Date().toISOString().slice(0, 10),
};

export default function InstalledCustomersPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState('list');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [packages, setPackages] = useState([]);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showIncompletePackages, setShowIncompletePackages] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [pkgForm, setPkgForm] = useState({ package_name: '', monthly_fee: '' });
  const [editingPkg, setEditingPkg] = useState(null);

  const installFileRef = useRef(null);
  const cancelFileRef = useRef(null);

  const incompletePackageCount = useMemo(
    () => rows.filter((row) => isPackageIncomplete(row.package_name)).length,
    [rows]
  );
  const visibleRows = useMemo(
    () => (showIncompletePackages ? rows.filter((row) => isPackageIncomplete(row.package_name)) : rows),
    [rows, showIncompletePackages]
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (q.trim()) params.q = q.trim();
      if (status) params.status = status;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await axios.get('/installed-customers', { params });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.error || 'โหลดรายชื่อไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  }, [q, status, from, to]);

  const loadPackages = useCallback(async () => {
    try {
      const res = await axios.get('/installed-customers/packages');
      setPackages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadList();
    loadPackages();
  }, [loadList, loadPackages]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      customer_name: row.customer_name || '',
      non_number: row.non_number || '',
      package_name: isPackageIncomplete(row.package_name) ? '' : (row.package_name || ''),
      monthly_fee: row.monthly_fee != null ? String(row.monthly_fee) : '',
      install_date: row.install_date ? String(row.install_date).slice(0, 10) : '',
    });
    setFormOpen(true);
  };

  const onPackageSelect = (name) => {
    const pkg = packages.find((p) => p.package_name === name && p.is_active);
    setForm((f) => ({
      ...f,
      package_name: name,
      monthly_fee: pkg ? String(pkg.monthly_fee) : f.monthly_fee,
    }));
  };

  const saveCustomer = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        customer_name: form.customer_name.trim(),
        non_number: form.non_number.trim(),
        package_name: form.package_name.trim(),
        monthly_fee: form.monthly_fee === '' ? undefined : Number(form.monthly_fee),
        install_date: form.install_date,
      };
      if (editing) {
        await axios.put(`/installed-customers/${editing.id}`, payload);
      } else {
        await axios.post('/installed-customers', payload);
      }
      setFormOpen(false);
      await loadList();
      Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.error || 'บันทึกไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cancelCustomer = async (row) => {
    const { value: formValues } = await Swal.fire({
      title: 'ยกเลิกบริการ',
      html:
        `<p class="text-sm text-left mb-2">NON: <b>${row.non_number}</b> — ${row.customer_name || ''}</p>` +
        `<input id="swal-cancel-date" type="date" class="swal2-input" value="${new Date().toISOString().slice(0, 10)}" />` +
        `<input id="swal-cancel-reason" class="swal2-input" placeholder="เหตุผล (ถ้ามี)" />`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'ยืนยันยกเลิก',
      cancelButtonText: 'ปิด',
      preConfirm: () => ({
        cancelled_at: document.getElementById('swal-cancel-date').value,
        cancel_reason: document.getElementById('swal-cancel-reason').value,
      }),
    });
    if (!formValues?.cancelled_at) return;
    try {
      await axios.post(`/installed-customers/${row.id}/cancel`, formValues);
      await loadList();
      Swal.fire({ icon: 'success', title: 'ยกเลิกแล้ว', timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.error || 'ยกเลิกไม่สำเร็จ', 'error');
    }
  };

  const reactivateCustomer = async (row) => {
    const ok = await Swal.fire({
      title: 'คืนสถานะใช้งาน?',
      text: `NON ${row.non_number}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ปิด',
    });
    if (!ok.isConfirmed) return;
    try {
      await axios.post(`/installed-customers/${row.id}/reactivate`);
      await loadList();
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.error || 'ไม่สำเร็จ', 'error');
    }
  };

  const deleteCustomer = async (row) => {
    const ok = await Swal.fire({
      title: 'ลบรายการ?',
      text: `${row.customer_name} (${row.non_number})`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
    });
    if (!ok.isConfirmed) return;
    try {
      await axios.delete(`/installed-customers/${row.id}`);
      await loadList();
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.error || 'ลบไม่สำเร็จ', 'error');
    }
  };

  const readSheet = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(ev.target.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });

  const importInstalls = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const sheet = await readSheet(file);
      const mapped = mapInstallRows(sheet);
      if (!mapped.length) {
        return Swal.fire('ไม่มีข้อมูล', 'ไม่พบแถวข้อมูลในไฟล์', 'warning');
      }
      const res = await axios.post('/installed-customers/import', { rows: mapped });
      await loadList();
      const { imported = 0, updated = 0, errors = [] } = res.data || {};
      Swal.fire({
        icon: errors.length ? 'warning' : 'success',
        title: 'นำเข้าเสร็จ',
        html: `เพิ่ม ${imported} · อัปเดต ${updated}` +
          (errors.length ? `<br/>ผิดพลาด ${errors.length} แถว` : ''),
      });
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.error || err.message, 'error');
    }
  };

  const importCancels = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const sheet = await readSheet(file);
      const mapped = mapCancelRows(sheet);
      if (!mapped.length) {
        return Swal.fire('ไม่มีข้อมูล', 'ไม่พบแถวข้อมูลในไฟล์', 'warning');
      }
      const res = await axios.post('/installed-customers/import-cancellations', { rows: mapped });
      await loadList();
      const { cancelled = 0, errors = [] } = res.data || {};
      Swal.fire({
        icon: errors.length ? 'warning' : 'success',
        title: 'นำเข้าการยกเลิกเสร็จ',
        html: `ยกเลิก ${cancelled} รายการ` +
          (errors.length ? `<br/>ผิดพลาด ${errors.length} แถว` : ''),
      });
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.error || err.message, 'error');
    }
  };

  const downloadTemplate = (kind) => {
    const headers =
      kind === 'install'
        ? [['non_number', 'customer_name', 'package_name', 'install_date', 'monthly_fee']]
        : [['non_number', 'cancelled_at', 'cancel_reason']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, kind === 'install' ? 'installed_customers_template.xlsx' : 'cancellations_template.xlsx');
  };

  const savePackage = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        package_name: pkgForm.package_name.trim(),
        monthly_fee: Number(pkgForm.monthly_fee),
      };
      if (editingPkg) {
        await axios.put(`/installed-customers/packages/${editingPkg.id}`, {
          ...payload,
          is_active: editingPkg.is_active,
        });
      } else {
        await axios.post('/installed-customers/packages', payload);
      }
      setPkgForm({ package_name: '', monthly_fee: '' });
      setEditingPkg(null);
      await loadPackages();
      Swal.fire({ icon: 'success', title: 'บันทึกแพ็กเกจแล้ว', timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.error || 'บันทึกไม่สำเร็จ', 'error');
    }
  };

  const editPackage = (pkg) => {
    setEditingPkg(pkg);
    setPkgForm({
      package_name: pkg.package_name,
      monthly_fee: String(pkg.monthly_fee),
    });
  };

  const togglePackage = async (pkg) => {
    try {
      await axios.put(`/installed-customers/packages/${pkg.id}`, {
        is_active: !pkg.is_active,
      });
      await loadPackages();
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.error || 'อัปเดตไม่สำเร็จ', 'error');
    }
  };

  const deletePackage = async (pkg) => {
    const ok = await Swal.fire({
      title: 'ลบแพ็กเกจ?',
      text: pkg.package_name,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
    });
    if (!ok.isConfirmed) return;
    try {
      await axios.delete(`/installed-customers/packages/${pkg.id}`);
      await loadPackages();
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.error || 'ลบไม่สำเร็จ', 'error');
    }
  };

  return (
    <div className="flex h-dvh font-sans overflow-hidden bg-[#F3F4F6]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="installed_customers" />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[var(--sidebar-width)] transition-[margin] duration-300 ease-out">
        <header
          className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB] shrink-0"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}
              >
                <svg className="w-4 h-4 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="font-bold text-[#1F2937] text-lg tracking-tight">ลูกค้าติดตั้งสำเร็จ</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-[1600px] mx-auto w-full space-y-4">
            {/* Tabs */}
            <div className="flex gap-2 border-b border-[#E5E7EB]">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                    tab === t.id
                      ? 'border-[#84cc16] text-[#1F2937]'
                      : 'border-transparent text-[#6B7280] hover:text-[#1F2937]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'list' && (
              <>
                {/* Actions */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-3"
                  style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openCreate}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-[#1F2937]"
                      style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)' }}
                    >
                      + เพิ่มลูกค้า
                    </button>
                    <button
                      type="button"
                      onClick={() => installFileRef.current?.click()}
                      className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"
                    >
                      Import ติดตั้ง
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelFileRef.current?.click()}
                      className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"
                    >
                      Import ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadTemplate('install')}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-[#6B7280] hover:text-[#1F2937]"
                    >
                      ดาวน์โหลดเทมเพลตติดตั้ง
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadTemplate('cancel')}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-[#6B7280] hover:text-[#1F2937]"
                    >
                      ดาวน์โหลดเทมเพลตยกเลิก
                    </button>
                    <input ref={installFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importInstalls} />
                    <input ref={cancelFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importCancels} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="ค้นหา ชื่อ / NON / แพ็กเกจ"
                      className="lg:col-span-2 px-3 py-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/40"
                    />
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm"
                    >
                      <option value="">ทุกสถานะ</option>
                      <option value="active">ใช้งาน</option>
                      <option value="cancelled">ยกเลิก</option>
                    </select>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm"
                      title="ติดตั้งตั้งแต่"
                    />
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm"
                      title="ติดตั้งถึง"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={loadList}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-[#1F2937] text-white hover:bg-[#111827]"
                  >
                    ค้นหา
                  </button>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden"
                  style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                  <div className="flex flex-col gap-2 border-b border-[#E5E7EB] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-bold text-[#1F2937]">ข้อมูลลูกค้าติดตั้งสำเร็จ</div>
                      <div className="mt-0.5 text-xs text-[#6B7280]">
                        แสดง {visibleRows.length.toLocaleString('th-TH')} จาก {rows.length.toLocaleString('th-TH')} รายการ
                      </div>
                    </div>
                    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      showIncompletePackages
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]'
                    }`}>
                      <input
                        type="checkbox"
                        checked={showIncompletePackages}
                        onChange={(event) => setShowIncompletePackages(event.target.checked)}
                        className="h-4 w-4 accent-amber-500"
                      />
                      แพ็กเกจไม่ครบ {incompletePackageCount.toLocaleString('th-TH')} รายการ
                    </label>
                  </div>
                  <div className="max-h-[calc(100dvh-310px)] overflow-auto">
                    <table className="w-full min-w-[1220px] table-fixed text-sm">
                      <colgroup>
                        <col className="w-[210px]" />
                        <col className="w-[145px]" />
                        <col className="w-[380px]" />
                        <col className="w-[115px]" />
                        <col className="w-[125px]" />
                        <col className="w-[135px]" />
                        <col className="w-[170px]" />
                      </colgroup>
                      <thead className="sticky top-0 z-10 bg-[#F9FAFB] text-left text-[#6B7280] shadow-[0_1px_0_#E5E7EB]">
                        <tr>
                          <th className="px-3 py-3 font-semibold">ชื่อ</th>
                          <th className="px-3 py-3 font-semibold">NON</th>
                          <th className="px-3 py-3 font-semibold">แพ็กเกจ</th>
                          <th className="px-3 py-3 font-semibold text-right">ค่าใช้จ่าย/ด.</th>
                          <th className="px-3 py-3 font-semibold">วันติดตั้ง</th>
                          <th className="px-3 py-3 font-semibold">สถานะ</th>
                          <th className="px-3 py-3 font-semibold text-right">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-10 text-center text-[#9CA3AF]">กำลังโหลด...</td>
                          </tr>
                        ) : visibleRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-10 text-center text-[#9CA3AF]">
                              {showIncompletePackages ? 'ไม่พบรายการที่แพ็กเกจไม่ครบ' : 'ยังไม่มีข้อมูล'}
                            </td>
                          </tr>
                        ) : (
                          visibleRows.map((row) => {
                            const packageIncomplete = isPackageIncomplete(row.package_name);
                            return (
                            <tr key={row.id} className={`border-t border-[#F3F4F6] align-top hover:bg-[#F9FAFB]/80 ${packageIncomplete ? 'bg-amber-50/35' : ''}`}>
                              <td className="px-3 py-3 font-semibold leading-5 text-[#1F2937] whitespace-normal break-words" title={row.customer_name}>
                                {row.customer_name}
                              </td>
                              <td className="px-3 py-3 font-mono text-[#374151] whitespace-nowrap">{row.non_number}</td>
                              <td className="px-3 py-3 text-[#374151]" title={packageIncomplete ? 'ไฟล์ต้นฉบับไม่มีชื่อแพ็กเกจ กรุณากดระบุแพ็กเกจ' : row.package_name}>
                                {packageIncomplete ? (
                                  <button type="button" onClick={() => openEdit(row)} className="text-left">
                                    <span className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                                      รอระบุชื่อแพ็กเกจ
                                    </span>
                                    <span className="mt-1 block text-xs text-amber-700">ต้นฉบับมีเฉพาะราคา · กดเพื่อระบุชื่อ</span>
                                  </button>
                                ) : (
                                  <div className="whitespace-normal break-words font-medium leading-5">{row.package_name}</div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right font-bold text-[#1F2937] whitespace-nowrap">
                                {formatMoney(row.monthly_fee)}
                                <span className="ml-1 text-[11px] font-medium text-[#9CA3AF]">บาท</span>
                              </td>
                              <td className="px-3 py-3 text-[#4B5563] whitespace-nowrap">{formatDate(row.install_date)}</td>
                              <td className="px-3 py-3">
                                {row.status === 'cancelled' ? (
                                  <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                                    ยกเลิก {formatDate(row.cancelled_at)}
                                  </span>
                                ) : (
                                  <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    ใช้งาน
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-wrap justify-end gap-1.5">
                                  <button type="button" onClick={() => openEdit(row)} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-[#0C447C] hover:bg-blue-100">
                                    แก้ไข
                                  </button>
                                  {row.status === 'cancelled' ? (
                                    <button type="button" onClick={() => reactivateCustomer(row)} className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                                      คืนสถานะ
                                    </button>
                                  ) : (
                                    <button type="button" onClick={() => cancelCustomer(row)} className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100">
                                      ยกเลิก
                                    </button>
                                  )}
                                  <button type="button" onClick={() => deleteCustomer(row)} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100">
                                    ลบ
                                  </button>
                                </div>
                              </td>
                            </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-3 py-2 text-xs text-[#9CA3AF] border-t border-[#F3F4F6]">
                    ทั้งหมด {rows.length.toLocaleString('th-TH')} รายการ
                    {showIncompletePackages ? ` · กำลังแสดงเฉพาะแพ็กเกจไม่ครบ ${visibleRows.length.toLocaleString('th-TH')} รายการ` : ''}
                  </div>
                </div>
              </>
            )}

            {tab === 'packages' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4"
                  style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                  <h2 className="font-bold text-[#1F2937] mb-3">
                    {editingPkg ? 'แก้ไขแพ็กเกจ' : 'เพิ่มแพ็กเกจ'}
                  </h2>
                  <form onSubmit={savePackage} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#6B7280] mb-1">ชื่อแพ็กเกจ</label>
                      <input
                        required
                        value={pkgForm.package_name}
                        onChange={(e) => setPkgForm((f) => ({ ...f, package_name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#6B7280] mb-1">ราคา/เดือน (บาท)</label>
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={pkgForm.monthly_fee}
                        onChange={(e) => setPkgForm((f) => ({ ...f, monthly_fee: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/40"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#1F2937]"
                        style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)' }}
                      >
                        บันทึก
                      </button>
                      {editingPkg && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPkg(null);
                            setPkgForm({ package_name: '', monthly_fee: '' });
                          }}
                          className="px-4 py-2.5 rounded-xl text-sm font-bold border border-[#E5E7EB] text-[#6B7280]"
                        >
                          ยกเลิก
                        </button>
                      )}
                    </div>
                  </form>
                  <p className="text-xs text-[#9CA3AF] mt-3">
                    เมื่อจบงานติดตั้ง ระบบจะ lookup ราคาจากรายการนี้มาใส่ในทะเบียนอัตโนมัติ
                  </p>
                </div>

                <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E7EB] overflow-hidden"
                  style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                  <table className="w-full text-sm">
                    <thead className="bg-[#F9FAFB] text-[#6B7280] text-left">
                      <tr>
                        <th className="px-3 py-3 font-semibold">ชื่อแพ็กเกจ</th>
                        <th className="px-3 py-3 font-semibold text-right">ราคา/เดือน</th>
                        <th className="px-3 py-3 font-semibold">สถานะ</th>
                        <th className="px-3 py-3 font-semibold text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packages.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-[#9CA3AF]">ยังไม่มีแพ็กเกจ</td>
                        </tr>
                      ) : (
                        packages.map((pkg) => (
                          <tr key={pkg.id} className="border-t border-[#F3F4F6]">
                            <td className="px-3 py-2.5 font-semibold text-[#1F2937]">{pkg.package_name}</td>
                            <td className="px-3 py-2.5 text-right">{formatMoney(pkg.monthly_fee)}</td>
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => togglePackage(pkg)}
                                className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                                  pkg.is_active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}
                              >
                                {pkg.is_active ? 'ใช้งาน' : 'ปิด'}
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-right space-x-2">
                              <button type="button" onClick={() => editPackage(pkg)} className="text-xs font-bold text-[#0C447C] hover:underline">
                                แก้ไข
                              </button>
                              <button type="button" onClick={() => deletePackage(pkg)} className="text-xs font-bold text-red-600 hover:underline">
                                ลบ
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create/Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-[#E5E7EB]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
              <h3 className="font-bold text-[#1F2937]">{editing ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้า'}</h3>
              <button type="button" onClick={() => setFormOpen(false)} className="text-[#9CA3AF] hover:text-[#1F2937]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={saveCustomer} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-1">ชื่อลูกค้า</label>
                <input
                  required
                  value={form.customer_name}
                  onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-1">เลข NON</label>
                <input
                  required
                  value={form.non_number}
                  onChange={(e) => setForm((f) => ({ ...f, non_number: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm font-mono outline-none focus:ring-2 focus:ring-[#A3E635]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-1">แพ็กเกจ</label>
                <input
                  list="package-list"
                  required
                  value={form.package_name}
                  onChange={(e) => onPackageSelect(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/40"
                />
                <datalist id="package-list">
                  {packages.filter((p) => p.is_active).map((p) => (
                    <option key={p.id} value={p.package_name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-1">ค่าใช้จ่าย/เดือน</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthly_fee}
                  onChange={(e) => setForm((f) => ({ ...f, monthly_fee: e.target.value }))}
                  placeholder="ปล่อยว่างเพื่อใช้ราคาจาก master"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/40"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B7280] mb-1">วันติดตั้ง</label>
                <input
                  type="date"
                  required
                  value={form.install_date}
                  onChange={(e) => setForm((f) => ({ ...f, install_date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/40"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl text-sm font-bold text-[#1F2937] disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)' }}
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
