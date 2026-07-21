import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { NoSnEquipmentModal } from './JobActionModals';
import { showFriendlyError, PresetChips } from './dashboards/SharedComponents';
import {
  MA_FAIL_CAUSE_PRESETS,
  MA_FIX_METHOD_PRESETS,
  CABLE_PRESETS,
} from '../constants/jobStatus';

const STEPS = [
  { id: 1, label: 'ข้อมูลงาน', short: 'ข้อมูล' },
  { id: 2, label: 'อุปกรณ์', short: 'อุปกรณ์' },
  { id: 3, label: 'รูปและยืนยัน', short: 'รูป' },
];

function draftKey(jobId) {
  return `ma-complete-draft-${jobId}`;
}

function loadDraft(jobId) {
  try {
    const raw = localStorage.getItem(draftKey(jobId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearDraft(jobId) {
  try {
    localStorage.removeItem(draftKey(jobId));
  } catch { /* ignore */ }
}

export default function CompleteMaJobModal({ isOpen, onClose, job, onSuccess }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = (user?.roles || [user?.role || '']).some(r => ['super_admin', 'admin'].includes(r));
  const [step, setStep] = useState(1);
  const [srt, setSrt] = useState('');
  const [spt, setSpt] = useState('');
  const [failCause, setFailCause] = useState('');
  const [fixMethod, setFixMethod] = useState('');
  const [oldSn, setOldSn] = useState('');
  const [newSn, setNewSn] = useState('');
  const [cableUsed, setCableUsed] = useState('');
  const [remark, setRemark] = useState('');
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [snBagItems, setSnBagItems] = useState([]);
  const [selectedSnIds, setSelectedSnIds] = useState([]);
  const [snSearch, setSnSearch] = useState('');
  const [noSnItems, setNoSnItems] = useState([]);
  const [selectedNoSnItems, setSelectedNoSnItems] = useState({});
  const [showNoSnModal, setShowNoSnModal] = useState(false);
  const [bagLoading, setBagLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [fieldHints, setFieldHints] = useState([]);
  const saveTimer = useRef(null);

  const visitDate = job?.plan_arrival_date
    ? String(job.plan_arrival_date).slice(0, 10)
    : '';
  const nonNumber = job?.non_number || job?.access_no || job?.display_non || '';
  const areaName = job?.area_name || job?.area_provider || '';

  const persistDraft = useCallback(() => {
    if (!job?.id) return;
    const payload = {
      srt, spt, failCause, fixMethod, oldSn, newSn, cableUsed, remark,
      selectedSnIds,
      selectedNoSnItems,
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(draftKey(job.id), JSON.stringify(payload));
    } catch { /* quota */ }
  }, [job?.id, srt, spt, failCause, fixMethod, oldSn, newSn, cableUsed, remark, selectedSnIds, selectedNoSnItems]);

  // Debounced auto-save
  useEffect(() => {
    if (!isOpen || !job?.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persistDraft, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [isOpen, job?.id, persistDraft]);

  useEffect(() => {
    if (!isOpen || !job) return;
    setStep(1);
    setFieldHints([]);
    setDraftRestored(false);
    setImages([]);
    imagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setImagePreviews([]);
    setShowNoSnModal(false);
    setSnSearch('');

    const draft = loadDraft(job.id);
    if (draft) {
      setSrt(draft.srt || '');
      setSpt(draft.spt || '');
      setFailCause(draft.failCause || '');
      setFixMethod(draft.fixMethod || '');
      setOldSn(draft.oldSn || '');
      setNewSn(draft.newSn || '');
      setCableUsed(draft.cableUsed || '');
      setRemark(draft.remark || '');
      setSelectedSnIds(Array.isArray(draft.selectedSnIds) ? draft.selectedSnIds : []);
      setSelectedNoSnItems(draft.selectedNoSnItems && typeof draft.selectedNoSnItems === 'object' ? draft.selectedNoSnItems : {});
      setDraftRestored(true);
    } else {
      setSrt('');
      setSpt('');
      setFailCause(job.symptoms || '');
      setFixMethod('');
      setOldSn('');
      setNewSn('');
      setCableUsed('');
      setRemark('');
      setSelectedSnIds([]);
      setSelectedNoSnItems({});
    }

    setBagLoading(true);
    const bagUrl = job.team_id
      ? `/inventory/my-bag?team_id=${job.team_id}`
      : (isAdmin && (job.assigned_user_id || job.field_engineer_id)
        ? `/inventory/my-bag?user_id=${job.assigned_user_id || job.field_engineer_id}`
        : '/inventory/my-bag');
    api.get(bagUrl)
      .then((res) => {
        const all = Array.isArray(res.data) ? res.data : [];
        const isSn = (item) => Number(item.has_sn) === 1 || item.has_sn === true;
        setSnBagItems(all.filter((item) => isSn(item) && item.sn));
        setNoSnItems(all.filter((item) => !isSn(item) || !item.sn));
      })
      .catch(() => { setSnBagItems([]); setNoSnItems([]); })
      .finally(() => setBagLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, job]);

  const toggleSn = (id) => {
    setSelectedSnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 40);
    setImages(files);
    imagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setImagePreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const step1Missing = () => {
    const missing = [];
    if (!srt.trim()) missing.push('SRT');
    if (!spt.trim()) missing.push('SPT');
    if (!failCause.trim()) missing.push('สาเหตุเสีย');
    if (!fixMethod.trim()) missing.push('วิธีแก้ไข');
    return missing;
  };

  const goNext = () => {
    if (step === 1) {
      const missing = step1Missing();
      if (missing.length) {
        setFieldHints(missing);
        return Swal.fire({
          icon: 'warning',
          title: 'ยังกรอกไม่ครบ',
          html: `<p class="text-left">กรุณากรอก:<br/><b>${missing.join(', ')}</b></p>`,
          confirmButtonColor: '#1F2937',
        });
      }
      setFieldHints([]);
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const goBack = () => {
    setFieldHints([]);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const missing = step1Missing();
    if (missing.length) {
      setStep(1);
      setFieldHints(missing);
      return Swal.fire({
        icon: 'warning',
        title: 'ยังกรอกไม่ครบ',
        html: `<p class="text-left">กรุณากรอก:<br/><b>${missing.join(', ')}</b></p>`,
        confirmButtonColor: '#1F2937',
      });
    }
    if (!images.length) {
      setStep(3);
      setFieldHints(['รูปจบงาน']);
      return Swal.fire({
        icon: 'warning',
        title: 'ยังไม่มีรูปจบงาน',
        text: 'บังคับอย่างน้อย 1 รูป (สูงสุด 40) — รูปไม่ถูกเก็บใน draft ต้องเลือกใหม่',
        confirmButtonColor: '#1F2937',
      });
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('srt', srt.trim());
      fd.append('spt', spt.trim());
      fd.append('fail_cause', failCause.trim());
      fd.append('fix_method', fixMethod.trim());
      fd.append('old_sn', oldSn.trim());
      fd.append('new_sn', newSn.trim());
      fd.append('cable_used', cableUsed.trim());
      fd.append('remark', remark.trim());

      const selectedSn = snBagItems.filter((i) => selectedSnIds.includes(i.id));
      fd.append('usedInventory', JSON.stringify(selectedSn.map((i) => ({
        inventory_item_id: i.id,
        sn: i.sn,
        product_name: i.product_name,
        model_name: i.model_name,
      }))));

      const noSnPayload = Object.values(selectedNoSnItems).map((i) => ({
        item_id: i.id,
        quantity: parseInt(i.useQty, 10) || 1,
        product_name: i.product_name,
        model_name: i.model_name,
        unit: i.unit,
      }));
      fd.append('noSnItems', JSON.stringify(noSnPayload));
      images.forEach((img) => fd.append('images', img));

      await api.put(`/dispatch/ma-jobs/${job.id}/complete`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      clearDraft(job.id);
      const result = await Swal.fire({
        icon: 'success',
        title: 'ปิดงาน MA สำเร็จ',
        text: 'บันทึกลงข้อมูลลูกค้าเรียบร้อย',
        showCancelButton: true,
        confirmButtonText: '🎒 ดูกระเป๋าช่าง',
        cancelButtonText: 'ปิด',
        confirmButtonColor: '#65a30d',
        cancelButtonColor: '#6B7280',
      });
      onSuccess?.();
      onClose?.();
      if (result.isConfirmed) {
        const assigneeId = job.assigned_user_id || job.field_engineer_id;
        navigate(isAdmin && assigneeId ? `/bag?user_id=${assigneeId}` : '/bag');
      }
    } catch (err) {
      await showFriendlyError(err, 'เกิดข้อผิดพลาดในการปิดงาน MA');
    } finally {
      setLoading(false);
    }
  };

  const discardDraftAndClose = () => {
    if (job?.id) clearDraft(job.id);
    onClose?.();
  };

  if (!isOpen || !job) return null;

  const inputCls = (name) => {
    const bad = fieldHints.includes(name);
    return `w-full px-3 py-3 min-h-[48px] rounded-xl border text-sm text-[#1F2937] outline-none focus:ring-2 focus:ring-[#A3E635]/20 ${
      bad
        ? 'border-red-400 bg-red-50 focus:border-red-500'
        : 'border-[#E5E7EB] bg-[#F9FAFB] focus:border-[#A3E635]'
    }`;
  };
  const readOnlyCls =
    'w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] text-sm text-[#6B7280] cursor-not-allowed';

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#1F2937]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl border border-[#E5E7EB] shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        <div className="h-1 bg-[#A3E635]" />
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[#F3F4F6] bg-[#F9FAFB] shrink-0">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-[#1F2937] flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#1F2937] text-[#A3E635] flex items-center justify-center text-sm shrink-0">🔧</span>
                ปิดงาน MA
              </h2>
              <p className="text-xs text-[#9CA3AF] mt-0.5 font-medium truncate">
                {job.customer || 'ลูกค้า'} · NON {nonNumber || '-'}
              </p>
            </div>
            <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl bg-white border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#1F2937] shrink-0">
              ✕
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (s.id < step) setStep(s.id);
                  else if (s.id === step + 1) goNext();
                }}
                className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all ${
                  step === s.id
                    ? 'bg-[#A3E635]/25'
                    : step > s.id
                      ? 'bg-[#A3E635]/10'
                      : 'bg-transparent'
                }`}
              >
                <span className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center ${
                  step >= s.id ? 'bg-[#1F2937] text-[#A3E635]' : 'bg-[#E5E7EB] text-[#9CA3AF]'
                }`}>
                  {step > s.id ? '✓' : s.id}
                </span>
                <span className={`text-[10px] font-bold ${step === s.id ? 'text-[#1F2937]' : 'text-[#9CA3AF]'}`}>
                  {s.short}
                </span>
                {i < STEPS.length - 1 && null}
              </button>
            ))}
          </div>

          {draftRestored && (
            <p className="mt-2 text-[11px] font-medium text-[#4D7C0F] bg-[#A3E635]/15 border border-[#A3E635]/30 rounded-lg px-2.5 py-1.5">
              กู้คืนข้อมูลที่ค้างไว้แล้ว (รูปต้องเลือกใหม่)
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {step === 1 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">วันที่เข้างาน</label>
                  <input readOnly value={visitDate || '-'} className={readOnlyCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">NON</label>
                  <input readOnly value={nonNumber || '-'} className={readOnlyCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">ลูกค้า</label>
                  <input readOnly value={job.customer || '-'} className={readOnlyCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">พื้นที่</label>
                  <input readOnly value={areaName || '-'} className={readOnlyCls} />
                </div>
                {job.address && (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">ที่อยู่</label>
                    <input readOnly value={job.address} className={readOnlyCls} />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-orange-700 uppercase mb-1">อาการเสียที่แจ้งมา</label>
                  <div className="w-full px-3 py-2.5 rounded-xl border border-orange-200 bg-orange-50 text-sm font-semibold text-[#1F2937] whitespace-pre-wrap min-h-[44px]">
                    {job.symptoms?.trim() || 'ยังไม่ระบุอาการเสีย'}
                  </div>
                </div>
              </div>

              {fieldHints.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                  ยังขาด: {fieldHints.join(', ')}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">SRT <span className="text-red-500">*</span></label>
                  <input value={srt} onChange={(e) => { setSrt(e.target.value); setFieldHints((h) => h.filter((x) => x !== 'SRT')); }} className={inputCls('SRT')} placeholder="กรอก SRT" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">SPT <span className="text-red-500">*</span></label>
                  <input value={spt} onChange={(e) => { setSpt(e.target.value); setFieldHints((h) => h.filter((x) => x !== 'SPT')); }} className={inputCls('SPT')} placeholder="กรอก SPT" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">สาเหตุเสีย <span className="text-red-500">*</span></label>
                  <PresetChips
                    options={MA_FAIL_CAUSE_PRESETS}
                    value={failCause}
                    onPick={(opt) => {
                      setFailCause(opt);
                      setFieldHints((h) => h.filter((x) => x !== 'สาเหตุเสีย'));
                    }}
                    className="mb-2"
                  />
                  <textarea value={failCause} onChange={(e) => { setFailCause(e.target.value); setFieldHints((h) => h.filter((x) => x !== 'สาเหตุเสีย')); }} rows={2} className={`${inputCls('สาเหตุเสีย')} resize-none min-h-[72px]`} placeholder="แตะตัวเลือกด้านบน หรือพิมพ์เอง" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">วิธีแก้ไข <span className="text-red-500">*</span></label>
                  <PresetChips
                    options={MA_FIX_METHOD_PRESETS}
                    value={fixMethod}
                    onPick={(opt) => {
                      setFixMethod(opt);
                      setFieldHints((h) => h.filter((x) => x !== 'วิธีแก้ไข'));
                    }}
                    className="mb-2"
                  />
                  <textarea value={fixMethod} onChange={(e) => { setFixMethod(e.target.value); setFieldHints((h) => h.filter((x) => x !== 'วิธีแก้ไข')); }} rows={2} className={`${inputCls('วิธีแก้ไข')} resize-none min-h-[72px]`} placeholder="แตะตัวเลือกด้านบน หรือพิมพ์เอง" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">SN เก่า (ถ้ามี)</label>
                  <input value={oldSn} onChange={(e) => setOldSn(e.target.value)} className={inputCls('')} placeholder="SN เก่า" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">SN ชุดใหม่ (ข้อความ ถ้ามี)</label>
                  <input value={newSn} onChange={(e) => setNewSn(e.target.value)} className={inputCls('')} placeholder="หรือเลือกจากกระเป๋าขั้นตอนถัดไป" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">ระยะสายที่ใช้ในงาน</label>
                  <PresetChips
                    options={CABLE_PRESETS}
                    value={cableUsed}
                    onPick={setCableUsed}
                    className="mb-2"
                  />
                  <input value={cableUsed} onChange={(e) => setCableUsed(e.target.value)} className={inputCls('')} placeholder="เช่น 50M / ใช้สายเดิม" />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="p-4 rounded-2xl border border-[#E5E7EB] bg-white space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-[#1F2937]">อุปกรณ์มี SN จากกระเป๋าทีม (ใช้ร่วมกันได้)</h3>
                    <p className="text-[11px] text-[#9CA3AF]">ติ๊กเลือกเพื่อตัดสต๊อก (ไม่บังคับ)</p>
                  </div>
                  {isAdmin && (job.assigned_user_id || job.field_engineer_id) && (
                    <button
                      type="button"
                      onClick={() => navigate(`/bag?user_id=${job.assigned_user_id || job.field_engineer_id}`)}
                      className="shrink-0 min-h-[40px] px-3 py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-xs font-bold"
                    >
                      🎒 ดูกระเป๋า
                    </button>
                  )}
                </div>
                {bagLoading ? (
                  <p className="text-xs text-[#9CA3AF]">กำลังโหลดกระเป๋า...</p>
                ) : snBagItems.length === 0 ? (
                  <p className="text-xs text-[#9CA3AF]">ไม่มีอุปกรณ์มี SN ในกระเป๋า</p>
                ) : (() => {
                  const q = snSearch.trim().toLowerCase();
                  const visibleSnItems = q
                    ? snBagItems.filter((item) =>
                        `${item.product_name || ''} ${item.model_name || ''} ${item.sn || ''}`.toLowerCase().includes(q))
                    : snBagItems;
                  return (
                    <>
                      <div className="relative">
                        <svg className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          value={snSearch}
                          onChange={(e) => setSnSearch(e.target.value)}
                          placeholder="ค้นหา สินค้า / รุ่น / SN..."
                          className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#1F2937] outline-none focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20"
                        />
                        {snSearch && (
                          <button type="button" onClick={() => setSnSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-red-500">
                            ✕
                          </button>
                        )}
                      </div>
                      {visibleSnItems.length === 0 ? (
                        <p className="text-xs text-[#9CA3AF] py-3 text-center">ไม่พบอุปกรณ์ที่ตรงกับคำค้นหา</p>
                      ) : (
                        <ul className="max-h-52 overflow-y-auto divide-y divide-[#F3F4F6] rounded-xl border border-[#E5E7EB]">
                          {visibleSnItems.map((item) => {
                            const checked = selectedSnIds.includes(item.id);
                            const insufficient = (Number(item.quantity) || 0) < 1;
                            return (
                              <li key={item.id}>
                                <label className={`flex items-center gap-3 px-3 py-3 min-h-[52px] transition-colors ${
                                  insufficient
                                    ? 'opacity-50 cursor-not-allowed bg-[#F9FAFB]'
                                    : checked ? 'bg-[#A3E635]/10 cursor-pointer' : 'hover:bg-[#F9FAFB] cursor-pointer'
                                }`}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={insufficient}
                                    onChange={() => !insufficient && toggleSn(item.id)}
                                    className="w-5 h-5 rounded border-[#E5E7EB] text-[#65a30d] focus:ring-[#A3E635] disabled:opacity-40"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-[#1F2937] truncate">{item.product_name} · {item.model_name}</p>
                                    <p className="text-[11px] font-mono text-[#6B7280]">
                                      SN: {item.sn}
                                      {insufficient && <span className="ml-2 text-red-500 font-bold not-italic">จำนวนไม่พอ</span>}
                                    </p>
                                  </div>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  );
                })()}
                {selectedSnIds.length > 0 && (
                  <p className="text-[11px] font-bold text-[#4D7C0F]">เลือกแล้ว {selectedSnIds.length} ชิ้น</p>
                )}
              </div>

              <div className="p-4 rounded-2xl border border-[#E5E7EB] bg-white space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-[#1F2937]">อุปกรณ์ไม่มี SN</h3>
                    <p className="text-[11px] text-[#9CA3AF]">ไม่บังคับ</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNoSnModal(true)}
                    disabled={bagLoading}
                    className="shrink-0 min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1F2937] text-[#A3E635] text-xs font-bold active:scale-95"
                  >
                    🧰 เลือกอุปกรณ์
                    {Object.keys(selectedNoSnItems).length > 0 && (
                      <span className="bg-[#A3E635] text-[#1F2937] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-black">
                        {Object.keys(selectedNoSnItems).length}
                      </span>
                    )}
                  </button>
                </div>
                {Object.keys(selectedNoSnItems).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.values(selectedNoSnItems).map((item) => (
                      <span key={item.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#A3E635]/15 border border-[#A3E635]/40 rounded-lg text-xs font-semibold text-[#1F2937]">
                        {item.product_name} {item.model_name} × {item.useQty} {item.unit || 'ชิ้น'}
                        <button
                          type="button"
                          onClick={() => setSelectedNoSnItems((prev) => {
                            const n = { ...prev };
                            delete n[item.id];
                            return n;
                          })}
                          className="text-[#9CA3AF] hover:text-red-500"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#9CA3AF]">ยังไม่ได้เลือก</p>
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              {fieldHints.includes('รูปจบงาน') && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                  ยังขาด: รูปจบงาน (อย่างน้อย 1 รูป)
                </div>
              )}

              <div className={`p-4 rounded-2xl border space-y-2 ${
                fieldHints.includes('รูปจบงาน') ? 'border-red-300 bg-red-50/40' : 'border-[#E5E7EB]'
              }`}>
                <label className="block text-sm font-black text-[#1F2937]">
                  รูปจบงาน <span className="text-red-500">*</span>
                  <span className="text-[11px] font-medium text-[#9CA3AF] ml-2">สูงสุด 40 รูป</span>
                </label>
                <div className="relative">
                  <input type="file" multiple accept="image/*" onChange={(e) => { handleImagesChange(e); setFieldHints((h) => h.filter((x) => x !== 'รูปจบงาน')); }} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <div className={`flex flex-col items-center justify-center p-8 min-h-[120px] border-2 border-dashed rounded-2xl transition-all ${
                    images.length ? 'border-[#A3E635] bg-[#A3E635]/5' : 'border-[#E5E7EB] bg-[#F9FAFB]'
                  }`}>
                    <span className="text-3xl mb-1">🖼️</span>
                    <span className="text-sm font-bold text-[#1F2937]">แตะเพื่ออัปโหลดรูป</span>
                    <span className="text-xs text-[#9CA3AF] mt-1">{images.length}/40 รูป</span>
                  </div>
                </div>
                {imagePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                    {imagePreviews.map((url, i) => (
                      <img key={i} src={url} alt="" className="h-14 w-14 object-cover rounded-lg border border-[#E5E7EB]" />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">หมายเหตุ (ถ้ามี)</label>
                <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} className={`${inputCls('')} resize-none`} />
              </div>

              <div className="rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] p-4 text-xs text-[#6B7280] space-y-1">
                <p className="font-black text-[#1F2937] text-sm mb-2">สรุปก่อนยืนยัน</p>
                <p>SRT: <b className="text-[#1F2937]">{srt || '-'}</b> · SPT: <b className="text-[#1F2937]">{spt || '-'}</b></p>
                <p>SN จากกระเป๋า: <b className="text-[#1F2937]">{selectedSnIds.length}</b> · ไม่มี SN: <b className="text-[#1F2937]">{Object.keys(selectedNoSnItems).length}</b></p>
                <p>รูป: <b className="text-[#1F2937]">{images.length}</b></p>
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 p-3 sm:p-4 border-t border-[#F3F4F6] bg-white flex flex-col gap-2 safe-area-pb">
          <div className="flex gap-2 sm:gap-3">
            {step > 1 ? (
              <button type="button" onClick={goBack} className="min-h-[48px] flex-1 py-3 rounded-xl border border-[#E5E7EB] font-bold text-[#6B7280]">
                ← ย้อนกลับ
              </button>
            ) : (
              <button type="button" onClick={onClose} className="min-h-[48px] flex-1 py-3 rounded-xl border border-[#E5E7EB] font-bold text-[#6B7280]">
                ปิด
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className="min-h-[48px] flex-1 py-3 rounded-xl font-black text-[#1F2937]"
                style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
              >
                ถัดไป →
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleSubmit}
                className="min-h-[48px] flex-1 py-3 rounded-xl font-black text-[#1F2937] disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
              >
                {loading ? <span className="w-5 h-5 border-2 border-[#1F2937]/30 border-t-[#1F2937] rounded-full animate-spin" /> : '✅ ยืนยันปิดงาน'}
              </button>
            )}
          </div>
          {draftRestored && (
            <button type="button" onClick={discardDraftAndClose} className="text-[11px] text-[#9CA3AF] hover:text-red-500 font-medium py-1">
              ล้าง draft และปิด
            </button>
          )}
        </div>
      </div>

      <NoSnEquipmentModal
        isOpen={showNoSnModal}
        onClose={() => setShowNoSnModal(false)}
        noSnItems={noSnItems}
        selectedNoSnItems={selectedNoSnItems}
        setSelectedNoSnItems={setSelectedNoSnItems}
      />
    </div>
  );
}
