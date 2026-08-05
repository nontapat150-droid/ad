import { useState, useEffect } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { useBranding } from '../context/BrandingContext';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageUtils';
import Layout from '../components/Layout';

const FREQUENT_NO_SN_ROLES = [
  { key: 'technician', label: 'ช่าง Office' },
  { key: 'office_technician', label: 'ช่าง Office' },
  { key: 'contractor_office', label: 'รับเหมาติดตั้ง' },
  { key: 'ma_technician', label: 'ช่าง MA' },
  { key: 'contractor_ma', label: 'รับเหมา MA' },
];

const SETTINGS_NAV = [
  {
    key: 'fraud_churn',
    label: 'Fraud / Churn',
    hint: 'เปิด–ปิด · เกณฑ์ · จำนวนเดือน',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    key: 'frequent',
    label: 'อุปกรณ์ที่ใช้บ่อย',
    hint: 'ไม่มี SN · เริ่ม 1',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    key: 'branding',
    label: 'การแสดงผล',
    hint: 'โลโก้ · แบรนด์',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export default function SystemSettingsPage() {
  const { branding, fetchBranding } = useBranding();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('frequent');
  const [settingsNavOpen, setSettingsNavOpen] = useState(false);

  const [brandingForm, setBrandingForm] = useState({
    website_name: '',
    logoFile: null,
    faviconFile: null,
    firebase_web_config: '',
    admin_phone: '',
    admin_line: '',
  });

  const [noSnProducts, setNoSnProducts] = useState([]);
  const [frequentConfig, setFrequentConfig] = useState({ product_ids: [], roles: [] });
  const [frequentSaving, setFrequentSaving] = useState(false);
  const [frequentLoading, setFrequentLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [qcConfig, setQcConfig] = useState({
    fraud: { enabled: true, threshold_rate: 3, months: 4 },
    churn: { enabled: true, threshold_rate: 1.5, months: 8 },
  });
  const [qcLoading, setQcLoading] = useState(true);
  const [qcSaving, setQcSaving] = useState(false);

  useEffect(() => {
    if (branding) {
      // Branding is hydrated from the shared application context.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBrandingForm((prev) => ({
        ...prev,
        website_name: branding.website_name || '',
        firebase_web_config: branding.firebase_web_config || '',
        admin_phone: branding.admin_phone || '',
        admin_line: branding.admin_line || '',
      }));
    }
  }, [branding]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/inventory/products').catch(() => ({ data: [] })),
      api.get('/settings/frequent-no-sn').catch(() => ({ data: { product_ids: [], roles: [] } })),
    ])
      .then(([prodRes, cfgRes]) => {
        if (cancelled) return;
        const products = (Array.isArray(prodRes.data) ? prodRes.data : [])
          .filter((p) => !Number(p.has_sn))
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'));
        setNoSnProducts(products);
        setFrequentConfig({
          product_ids: Array.isArray(cfgRes.data?.product_ids) ? cfgRes.data.product_ids.map(Number) : [],
          roles: Array.isArray(cfgRes.data?.roles) ? cfgRes.data.roles : [],
        });
      })
      .finally(() => {
        if (!cancelled) setFrequentLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get('/settings/fraud-churn')
      .then((response) => {
        if (!cancelled && response.data?.fraud && response.data?.churn) {
          setQcConfig({ fraud: response.data.fraud, churn: response.data.churn });
        }
      })
      .catch((err) => {
        if (!cancelled) Swal.fire('โหลดการตั้งค่าไม่สำเร็จ', err.response?.data?.error || err.message, 'error');
      })
      .finally(() => {
        if (!cancelled) setQcLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleFileChange = (e, field) => {
    if (e.target.files && e.target.files[0]) {
      setBrandingForm({
        ...brandingForm,
        [field]: e.target.files[0],
      });
    }
  };

  const toggleProduct = (productId) => {
    setFrequentConfig((prev) => {
      const id = Number(productId);
      const has = prev.product_ids.includes(id);
      return {
        ...prev,
        product_ids: has
          ? prev.product_ids.filter((x) => x !== id)
          : [...prev.product_ids, id],
      };
    });
  };

  const toggleRole = (roleKey) => {
    setFrequentConfig((prev) => {
      const has = prev.roles.includes(roleKey);
      return {
        ...prev,
        roles: has ? prev.roles.filter((r) => r !== roleKey) : [...prev.roles, roleKey],
      };
    });
  };

  const handleFrequentSave = async () => {
    try {
      setFrequentSaving(true);
      await api.put('/settings/frequent-no-sn', frequentConfig);
      Swal.fire('บันทึกสำเร็จ', 'ตั้งค่าอุปกรณ์ที่ใช้บ่อยแล้ว — ระบบจะเลือกให้เริ่มต้น 1 ชิ้นตอนจบงาน (ช่างเพิ่มจำนวนได้) ตามบทบาทที่เลือก', 'success');
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.error || err.message, 'error');
    } finally {
      setFrequentSaving(false);
    }
  };

  const updateQcConfig = (type, field, value) => {
    setQcConfig((current) => ({
      ...current,
      [type]: { ...current[type], [field]: value },
    }));
  };

  const handleQcSave = async () => {
    const normalized = {};
    for (const type of ['fraud', 'churn']) {
      const months = Number(qcConfig[type].months);
      const thresholdRate = Number(qcConfig[type].threshold_rate);
      const label = type === 'fraud' ? 'Fraud' : 'Churn';
      if (!Number.isInteger(months) || months < 1 || months > 36) {
        return Swal.fire('ตรวจสอบจำนวนเดือน', `${label} ต้องเป็นเลขจำนวนเต็ม 1–36 เดือน`, 'warning');
      }
      if (!Number.isFinite(thresholdRate) || thresholdRate <= 0 || thresholdRate > 100) {
        return Swal.fire('ตรวจสอบเกณฑ์เปอร์เซ็นต์', `${label} ต้องมากกว่า 0 และไม่เกิน 100%`, 'warning');
      }
      normalized[type] = {
        enabled: Boolean(qcConfig[type].enabled),
        months,
        threshold_rate: thresholdRate,
      };
    }

    try {
      setQcSaving(true);
      const response = await api.put('/settings/fraud-churn', normalized);
      setQcConfig({ fraud: response.data.fraud, churn: response.data.churn });
      Swal.fire({
        icon: 'success',
        title: 'บันทึกการตั้งค่าแล้ว',
        text: 'หน้าควบคุมคุณภาพและไฟล์ Export จะใช้ค่าใหม่ในการคำนวณครั้งถัดไป',
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire('บันทึกไม่สำเร็จ', err.response?.data?.error || err.message, 'error');
    } finally {
      setQcSaving(false);
    }
  };

  const handleBrandingSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('website_name', brandingForm.website_name);
    formData.append('firebase_web_config', brandingForm.firebase_web_config);
    formData.append('admin_phone', brandingForm.admin_phone);
    formData.append('admin_line', brandingForm.admin_line);
    if (brandingForm.logoFile) formData.append('website_logo', brandingForm.logoFile);
    if (brandingForm.faviconFile) formData.append('website_favicon', brandingForm.faviconFile);

    try {
      await api.post('/settings/branding', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchBranding();
      Swal.fire('สำเร็จ', 'บันทึกการแสดงผลเรียบร้อย', 'success');
      setBrandingForm((prev) => ({ ...prev, logoFile: null, faviconFile: null }));
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.message || err.message, 'error');
    }
  };

  const filteredNoSn = productSearch.trim()
    ? noSnProducts.filter((p) => String(p.name || '').toLowerCase().includes(productSearch.trim().toLowerCase()))
    : noSnProducts;

  const activeMeta = SETTINGS_NAV.find((s) => s.key === activeSection) || SETTINGS_NAV[0];

  const selectSection = (key) => {
    setActiveSection(key);
    setSettingsNavOpen(false);
  };

  const settingsNav = (
    <nav className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-slate-200/80">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">เมนูตั้งค่า</p>
        <p className="text-sm font-bold text-slate-800 mt-1">เลือกหมวดที่ต้องการแก้</p>
      </div>
      <div className="flex-1 p-2 space-y-1 overflow-y-auto">
        {SETTINGS_NAV.map((item) => {
          const on = activeSection === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => selectSection(item.key)}
              className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-2xl border transition-all ${
                on
                  ? 'bg-[#185FA5] border-[#185FA5] text-white shadow-lg shadow-[#185FA5]/25'
                  : 'bg-white/70 border-transparent text-slate-700 hover:bg-white hover:border-slate-200'
              }`}
            >
              <span className={`mt-0.5 shrink-0 ${on ? 'text-white' : 'text-[#185FA5]'}`}>{item.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight">{item.label}</span>
                <span className={`block text-[11px] mt-0.5 ${on ? 'text-white/75' : 'text-slate-400'}`}>{item.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-slate-200/80 text-[11px] text-slate-400 font-medium">
        ผู้ใช้: {user?.full_name || user?.username || '-'}
      </div>
    </nav>
  );

  return (
    <Layout activeKey="settings" pageTitle="ตั้งค่าระบบ" manualPage="settings" fullBleed>
      <div className="flex flex-col lg:flex-row gap-0 min-h-[calc(100dvh-4rem)]">
        {/* Desktop settings sidebar — clearly separate from main app sidebar */}
        <aside
          className="hidden lg:flex w-[260px] shrink-0 flex-col border-r border-slate-200 bg-gradient-to-b from-slate-50 to-white"
          style={{ boxShadow: 'inset -1px 0 0 rgba(15,23,42,0.04)' }}
        >
          {settingsNav}
        </aside>

        {/* Mobile settings section switcher */}
        <div className="lg:hidden border-b border-slate-200 bg-white px-4 py-3 sticky top-0 z-10">
          <button
            type="button"
            onClick={() => setSettingsNavOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl border border-slate-200 bg-slate-50"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-[#185FA5] shrink-0">{activeMeta.icon}</span>
              <span className="text-left min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">เมนูตั้งค่า</span>
                <span className="block text-sm font-bold text-slate-800 truncate">{activeMeta.label}</span>
              </span>
            </span>
            <svg className={`w-4 h-4 text-slate-400 transition-transform ${settingsNavOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {settingsNavOpen && (
            <div className="mt-2 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-lg animate-fade-in">
              {SETTINGS_NAV.map((item) => {
                const on = activeSection === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => selectSection(item.key)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 ${
                      on ? 'bg-[#E6F1FB] text-[#185FA5]' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span>
                      <span className="block text-sm font-bold">{item.label}</span>
                      <span className="block text-[11px] text-slate-400">{item.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content panel */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8 bg-[#F3F4F6]/60">
          {activeSection === 'fraud_churn' && (
            <div className="max-w-4xl animate-fade-in space-y-5">
              <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl md:p-8">
                <div className="mb-6 border-b border-slate-200 pb-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-lime-100 text-lg">🛡️</span>
                        ตั้งค่า Fraud / Churn
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        ควบคุมการตรวจแต่ละประเภทแยกกัน และปรับช่วงย้อนหลังกับเกณฑ์เปอร์เซ็นต์ได้โดยไม่ต้องแก้โปรแกรม
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500">
                      รองรับ 1–36 เดือน
                    </span>
                  </div>
                </div>

                {qcLoading ? (
                  <div className="grid min-h-56 place-items-center text-sm font-semibold text-slate-500">กำลังโหลดการตั้งค่า...</div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      {[
                        { type: 'fraud', title: 'Fraud', tone: 'amber', description: 'ตรวจลูกค้าที่ยกเลิกภายในช่วงอายุที่กำหนด' },
                        { type: 'churn', title: 'Churn', tone: 'rose', description: 'ตรวจลูกค้าที่ยกเลิกภายในช่วงติดตามระยะยาว' },
                      ].map(({ type, title, tone, description }) => {
                        const config = qcConfig[type];
                        const enabled = Boolean(config.enabled);
                        const isAmber = tone === 'amber';
                        return (
                          <section key={type} className={`overflow-hidden rounded-2xl border-2 bg-white transition ${enabled ? (isAmber ? 'border-amber-200' : 'border-rose-200') : 'border-slate-200 opacity-75'}`}>
                            <div className={`flex items-center justify-between gap-4 border-b px-5 py-4 ${enabled ? (isAmber ? 'border-amber-100 bg-amber-50' : 'border-rose-100 bg-rose-50') : 'border-slate-100 bg-slate-50'}`}>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-lg font-black text-slate-900">{title}</h3>
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                                    {enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">{description}</p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={enabled}
                                aria-label={`${enabled ? 'ปิด' : 'เปิด'}การตรวจ ${title}`}
                                onClick={() => updateQcConfig(type, 'enabled', !enabled)}
                                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-4 ${enabled ? 'bg-[#78BE20] focus:ring-lime-100' : 'bg-slate-300 focus:ring-slate-100'}`}
                              >
                                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                            </div>

                            <fieldset disabled={!enabled} className="grid gap-4 p-5 sm:grid-cols-2 disabled:opacity-50">
                              <label className="block">
                                <span className="mb-2 block text-xs font-black text-slate-600">จำนวนเดือนที่ตรวจ</span>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="1"
                                    max="36"
                                    step="1"
                                    value={config.months}
                                    onChange={(event) => updateQcConfig(type, 'months', event.target.value)}
                                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-16 text-base font-black text-slate-900 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
                                  />
                                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">เดือน</span>
                                </div>
                              </label>
                              <label className="block">
                                <span className="mb-2 block text-xs font-black text-slate-600">เกณฑ์ที่ยอมรับได้</span>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0.01"
                                    max="100"
                                    step="0.1"
                                    value={config.threshold_rate}
                                    onChange={(event) => updateQcConfig(type, 'threshold_rate', event.target.value)}
                                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-base font-black text-slate-900 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
                                  />
                                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span>
                                </div>
                              </label>
                              <div className="sm:col-span-2 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                                นับรวมเดือนอ้างอิงย้อนหลัง <b>{config.months || 0} เดือน</b> และรับได้ไม่เกิน <b>{config.threshold_rate || 0}%</b> ของลูกค้าในช่วงนั้น
                              </div>
                            </fieldset>
                          </section>
                        );
                      })}
                    </div>

                    {!qcConfig.fraud.enabled && !qcConfig.churn.enabled && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                        ขณะนี้ปิดทั้ง Fraud และ Churn หน้าควบคุมคุณภาพจะไม่สามารถคำนวณได้จนกว่าจะเปิดอย่างน้อยหนึ่งประเภท
                      </div>
                    )}

                    <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-5 text-slate-500">ค่าที่บันทึกจะมีผลกับการคำนวณครั้งถัดไปและช่วงเดือนในไฟล์ Export</p>
                      <button
                        type="button"
                        onClick={handleQcSave}
                        disabled={qcSaving}
                        className="inline-flex h-12 items-center justify-center rounded-xl bg-[#185FA5] px-6 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#124F8A] active:scale-[0.98] disabled:opacity-60"
                      >
                        {qcSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า Fraud / Churn'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'frequent' && (
            <div className="max-w-3xl glass rounded-3xl p-6 md:p-8 shadow-xl border border-white/40 animate-fade-in">
              <div className="mb-6 border-b border-slate-200/50 pb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  ⭐ อุปกรณ์ที่ใช้บ่อย (ไม่มี SN)
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  เลือกสินค้าที่ช่างมักลืม — ระบบจะเลือกให้เริ่มต้น 1 ชิ้นตอนจบงานตามบทบาทที่เลือก (ช่างเพิ่มจำนวนได้ ถอนออกไม่ได้)
                </p>
              </div>

              {frequentLoading ? (
                <p className="text-sm text-slate-500">กำลังโหลด...</p>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">บทบาทที่ให้เลือกอัตโนมัติ</label>
                    <div className="flex flex-wrap gap-2">
                      {FREQUENT_NO_SN_ROLES.map((r) => {
                        const on = frequentConfig.roles.includes(r.key);
                        return (
                          <button
                            key={r.key}
                            type="button"
                            onClick={() => toggleRole(r.key)}
                            className={`px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                              on
                                ? 'border-amber-400 bg-amber-50 text-amber-900'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-amber-200'
                            }`}
                          >
                            {on ? '✓ ' : ''}{r.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                      <label className="block text-sm font-bold text-slate-700">
                        สินค้าไม่มี SN ที่เลือกอัตโนมัติ เริ่ม 1 ({frequentConfig.product_ids.length} รายการ)
                      </label>
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="ค้นหาสินค้า..."
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-500 bg-white max-w-[200px]"
                      />
                    </div>
                    <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
                      {filteredNoSn.length === 0 ? (
                        <p className="p-4 text-sm text-slate-500">ไม่พบสินค้าไม่มี SN</p>
                      ) : (
                        filteredNoSn.map((p) => {
                          const on = frequentConfig.product_ids.includes(Number(p.id));
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleProduct(p.id)}
                              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                                on ? 'bg-amber-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-[10px] font-black ${
                                on ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300'
                              }`}>
                                {on ? '✓' : ''}
                              </span>
                              <span className="text-sm font-semibold text-slate-800">{p.name}</span>
                              <span className="text-[11px] text-slate-400 ml-auto">{p.unit || 'ชิ้น'}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleFrequentSave}
                    disabled={frequentSaving}
                    className="px-6 py-3 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/30 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-60"
                  >
                    {frequentSaving ? 'กำลังบันทึก...' : '💾 บันทึกอุปกรณ์ที่ใช้บ่อย'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeSection === 'branding' && (
            <div className="max-w-3xl glass rounded-3xl p-6 md:p-8 shadow-xl border border-white/40 animate-fade-in">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 border-b border-slate-200/50 pb-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  การแสดงผล (Branding)
                </h2>
              </div>
              <form onSubmit={handleBrandingSubmit} className="space-y-6 max-w-2xl">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อเว็บไซต์ (Website Name)</label>
                  <input
                    type="text"
                    value={brandingForm.website_name}
                    onChange={(e) => setBrandingForm({ ...brandingForm, website_name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-slate-700 bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">เบอร์แอดมิน</label>
                    <input
                      type="text"
                      value={brandingForm.admin_phone}
                      onChange={(e) => setBrandingForm({ ...brandingForm, admin_phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-slate-700 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">LINE แอดมิน</label>
                    <input
                      type="text"
                      value={brandingForm.admin_line}
                      onChange={(e) => setBrandingForm({ ...brandingForm, admin_line: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-slate-700 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">โลโก้เว็บไซต์</label>
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'logoFile')} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
                  {branding?.website_logo && !brandingForm.logoFile && (
                    <div className="mt-2 p-2 bg-white rounded-lg border border-slate-100 inline-block shadow-sm">
                      <img src={getImageUrl(branding.website_logo, 'branding')} alt="Current Logo" className="h-12 object-contain" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Favicon</label>
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'faviconFile')} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
                  {branding?.website_favicon && !brandingForm.faviconFile && (
                    <div className="mt-2 p-2 bg-white rounded-lg border border-slate-100 inline-block shadow-sm">
                      <img src={getImageUrl(branding.website_favicon, 'branding')} alt="Current Favicon" className="h-8 object-contain" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Firebase Web Configuration (JSON)</label>
                  <textarea
                    value={brandingForm.firebase_web_config}
                    onChange={(e) => setBrandingForm({ ...brandingForm, firebase_web_config: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-slate-700 bg-slate-50 font-mono text-sm h-48"
                  />
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <button type="submit" className="px-6 py-3 rounded-xl font-bold text-white bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/30 transition-all active:scale-95 flex items-center gap-2">
                    บันทึกการตั้งค่าการแสดงผล
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
