import { useState, useEffect } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { NoSnEquipmentModal } from './JobActionModals';

export default function CompleteMaJobModal({ isOpen, onClose, job, onSuccess }) {
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
  const [noSnItems, setNoSnItems] = useState([]);
  const [selectedNoSnItems, setSelectedNoSnItems] = useState({});
  const [showNoSnModal, setShowNoSnModal] = useState(false);
  const [bagLoading, setBagLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const visitDate = job?.plan_arrival_date
    ? String(job.plan_arrival_date).slice(0, 10)
    : '';
  const nonNumber = job?.non_number || job?.access_no || job?.display_non || '';
  const areaName = job?.area_name || job?.area_provider || '';

  useEffect(() => {
    if (!isOpen || !job) return;
    setSrt('');
    setSpt('');
    setFailCause('');
    setFixMethod('');
    setOldSn('');
    setNewSn('');
    setCableUsed('');
    setRemark('');
    setImages([]);
    imagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setImagePreviews([]);
    setSelectedNoSnItems({});
    setShowNoSnModal(false);

    setBagLoading(true);
    api.get('/inventory/my-bag')
      .then((res) => {
        const all = res.data || [];
        setNoSnItems(all.filter((item) => item.has_sn === 0 || item.has_sn === false || !item.sn));
      })
      .catch(() => setNoSnItems([]))
      .finally(() => setBagLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, job]);

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 40);
    setImages(files);
    imagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setImagePreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!images.length) {
      return Swal.fire({ icon: 'warning', title: 'กรุณาอัปโหลดรูปจบงาน', text: 'บังคับอย่างน้อย 1 รูป (สูงสุด 40)', confirmButtonColor: '#1F2937' });
    }
    if (!srt.trim() || !spt.trim() || !failCause.trim() || !fixMethod.trim()) {
      return Swal.fire({
        icon: 'warning',
        title: 'กรอกข้อมูลไม่ครบ',
        text: 'กรุณากรอก SRT, SPT, สาเหตุเสีย และวิธีแก้ไข',
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

      await Swal.fire({
        icon: 'success',
        title: 'ปิดงาน MA สำเร็จ',
        text: 'บันทึกลงข้อมูลลูกค้าเรียบร้อย',
        timer: 1800,
        showConfirmButton: false,
      });
      onSuccess?.();
      onClose?.();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'บันทึกไม่สำเร็จ',
        text: err.response?.data?.error || err.message || 'เกิดข้อผิดพลาด',
        confirmButtonColor: '#1F2937',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !job) return null;

  const inputCls =
    'w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#1F2937] outline-none focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20';
  const readOnlyCls =
    'w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] text-sm text-[#6B7280] cursor-not-allowed';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#1F2937]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-[#E5E7EB] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="h-1 bg-[#A3E635]" />
        <div className="px-5 py-4 border-b border-[#F3F4F6] bg-[#F9FAFB] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-black text-[#1F2937] flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#1F2937] text-[#A3E635] flex items-center justify-center text-sm">🔧</span>
              ปิดงาน MA
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5 font-medium">
              {job.customer || 'ลูกค้า'} · NON {nonNumber || '-'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl bg-white border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#1F2937]">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Auto-filled */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB]">
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">วันที่เข้างาน</label>
              <input readOnly value={visitDate || '-'} className={readOnlyCls} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">NON</label>
              <input readOnly value={nonNumber || '-'} className={readOnlyCls} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">พื้นที่</label>
              <input readOnly value={areaName || '-'} className={readOnlyCls} />
            </div>
          </div>

          {/* Manual fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">SRT <span className="text-red-500">*</span></label>
              <input value={srt} onChange={(e) => setSrt(e.target.value)} className={inputCls} placeholder="กรอก SRT" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">SPT <span className="text-red-500">*</span></label>
              <input value={spt} onChange={(e) => setSpt(e.target.value)} className={inputCls} placeholder="กรอก SPT" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">สาเหตุเสีย <span className="text-red-500">*</span></label>
              <textarea value={failCause} onChange={(e) => setFailCause(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="ระบุสาเหตุที่เสีย" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">วิธีแก้ไข <span className="text-red-500">*</span></label>
              <textarea value={fixMethod} onChange={(e) => setFixMethod(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="ระบุวิธีแก้ไข" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">SN เก่า (ถ้ามี)</label>
              <input value={oldSn} onChange={(e) => setOldSn(e.target.value)} className={inputCls} placeholder="SN เก่า" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">SN ชุดใหม่ (ถ้ามี)</label>
              <input value={newSn} onChange={(e) => setNewSn(e.target.value)} className={inputCls} placeholder="SN ใหม่" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">ระยะสายที่ใช้ในงาน</label>
              <input value={cableUsed} onChange={(e) => setCableUsed(e.target.value)} className={inputCls} placeholder="ตัวอักษรหรือตัวเลขได้ เช่น 50M / ใช้สายเดิม" />
            </div>
          </div>

          {/* Equipment from bag */}
          <div className="p-4 rounded-2xl border border-[#E5E7EB] bg-white space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-[#1F2937]">อุปกรณ์ที่ใช้</h3>
                <p className="text-[11px] text-[#9CA3AF]">ดึงจากกระเป๋าช่าง — ติ๊กเลือกและใส่จำนวน</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNoSnModal(true)}
                disabled={bagLoading}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1F2937] text-[#A3E635] text-xs font-bold active:scale-95"
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
                  <span key={item.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#A3E635]/15 border border-[#A3E635]/40 rounded-lg text-xs font-semibold text-[#1F2937]">
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
              <p className="text-xs text-[#9CA3AF]">{bagLoading ? 'กำลังโหลดกระเป๋า...' : 'ยังไม่ได้เลือกอุปกรณ์ (ไม่บังคับ)'}</p>
            )}
          </div>

          {/* Photos required */}
          <div className="p-4 rounded-2xl border border-[#E5E7EB] space-y-2">
            <label className="block text-sm font-black text-[#1F2937]">
              รูปจบงาน <span className="text-red-500">*</span>
              <span className="text-[11px] font-medium text-[#9CA3AF] ml-2">สูงสุด 40 รูป</span>
            </label>
            <div className="relative">
              <input type="file" multiple accept="image/*" onChange={handleImagesChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <div className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all ${
                images.length ? 'border-[#A3E635] bg-[#A3E635]/5' : 'border-[#E5E7EB] bg-[#F9FAFB]'
              }`}>
                <span className="text-3xl mb-1">🖼️</span>
                <span className="text-sm font-bold text-[#1F2937]">คลิกเพื่ออัปโหลดรูป</span>
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
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </form>

        <div className="shrink-0 p-4 border-t border-[#F3F4F6] bg-white flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#E5E7EB] font-bold text-[#6B7280]">
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="flex-1 py-3 rounded-xl font-black text-[#1F2937] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
          >
            {loading ? <span className="w-5 h-5 border-2 border-[#1F2937]/30 border-t-[#1F2937] rounded-full animate-spin" /> : '✅ ยืนยันปิดงาน'}
          </button>
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
