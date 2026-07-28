import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { useBranding } from '../context/BrandingContext';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageUtils';
import ManualModal from '../components/ManualModal';
import ManualHelpButton from '../components/ManualHelpButton';

const FREQUENT_NO_SN_ROLES = [
  { key: 'technician', label: 'ช่างติดตั้ง' },
  { key: 'office_technician', label: 'ช่างออฟฟิศ' },
  { key: 'contractor_office', label: 'รับเหมาติดตั้ง' },
  { key: 'ma_technician', label: 'ช่าง MA' },
  { key: 'contractor_ma', label: 'รับเหมา MA' },
];

export default function SystemSettingsPage() {
  const navigate = useNavigate();
  const { branding, fetchBranding } = useBranding();
  const { user } = useAuth();
  const [showManualModal, setShowManualModal] = useState(false);

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

  useEffect(() => {
    if (branding) {
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
    setFrequentLoading(true);
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

  const handleBrandingSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('website_name', brandingForm.website_name);
      formData.append('admin_phone', brandingForm.admin_phone || '');
      formData.append('admin_line', brandingForm.admin_line || '');

      let configValue = brandingForm.firebase_web_config;
      if (configValue) {
        try {
          const parsed = JSON.parse(configValue);
          configValue = JSON.stringify(parsed, null, 2);
          formData.append('firebase_web_config', configValue);
        } catch {
          return Swal.fire('เกิดข้อผิดพลาด', 'Firebase Config ต้องเป็นรูปแบบ JSON ที่ถูกต้องเท่านั้น', 'error');
        }
      } else {
        formData.append('firebase_web_config', '');
      }

      if (brandingForm.logoFile) formData.append('logo', brandingForm.logoFile);
      if (brandingForm.faviconFile) formData.append('favicon', brandingForm.faviconFile);

      await api.post('/settings/branding', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Swal.fire('บันทึกสำเร็จ', 'อัปเดตการแสดงผลของระบบแล้ว', 'success');
      fetchBranding();
      setBrandingForm((prev) => ({ ...prev, logoFile: null, faviconFile: null }));
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.message || err.message, 'error');
    }
  };

  const filteredNoSn = productSearch.trim()
    ? noSnProducts.filter((p) => String(p.name || '').toLowerCase().includes(productSearch.trim().toLowerCase()))
    : noSnProducts;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto min-h-screen pt-24 animate-fade-in-up">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="bg-white hover:bg-slate-50 text-slate-700 p-3 rounded-2xl shadow-sm border border-slate-200 transition-all hover:shadow-md active:scale-95 flex items-center justify-center"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-black text-slate-800 drop-shadow-sm">ตั้งค่าระบบ</h1>
          <p className="text-slate-500 mt-2 font-medium">จัดการ Branding และอุปกรณ์ที่ใช้บ่อยตอนจบงาน</p>
        </div>
        <ManualHelpButton onClick={() => setShowManualModal(true)} />
      </div>

      <div className="glass rounded-3xl p-6 md:p-8 shadow-xl border border-white/40 mb-8">
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

      <div className="glass rounded-3xl p-6 md:p-8 shadow-xl border border-white/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 border-b border-slate-200/50 pb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
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

      <ManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        userRoles={user?.roles || [user?.role]}
        pageName="settings"
      />
    </div>
  );
}
