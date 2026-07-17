import { useState, useEffect } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';

export default function TargetSettingsModal({ isOpen, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ma_target_days: 26,
    ma_target_jobs: 130,
    target_tech_jobs: 50,
    allowed_late_days: 0,
  });

  useEffect(() => {
    if (isOpen) loadSettings();
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings/targets');
      setForm(res.data);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'โหลดไม่สำเร็จ', text: 'ไม่สามารถโหลดการตั้งค่าได้', confirmButtonColor: '#1F2937' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (name, value) => {
    const num = value === '' ? '' : Math.max(0, Number(value));
    setForm((prev) => ({ ...prev, [name]: num }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ma_target_days: Number(form.ma_target_days) || 0,
        ma_target_jobs: Number(form.ma_target_jobs) || 0,
        target_tech_jobs: Number(form.target_tech_jobs) || 0,
        allowed_late_days: Number(form.allowed_late_days) || 0,
      };
      await api.put('/settings/targets', payload);
      Swal.fire({
        icon: 'success',
        title: 'บันทึกสำเร็จ',
        text: 'อัปเดตเงื่อนไขประเมินเรียบร้อย',
        timer: 1500,
        showConfirmButton: false,
      });
      onSaved?.(payload);
      onClose?.();
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: 'ไม่สามารถบันทึกข้อมูลได้', confirmButtonColor: '#1F2937' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputCls =
    'w-full h-12 px-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-lg font-black text-[#1F2937] outline-none focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 text-center';

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#1F2937]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl border border-[#E5E7EB] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="h-1 bg-[#A3E635]" />
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-[#D1D5DB]" />
        </div>

        <div className="px-5 py-4 border-b border-[#F3F4F6] bg-[#F9FAFB] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#1F2937] text-[#A3E635] flex items-center justify-center text-lg shrink-0">⚙️</div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-[#1F2937]">ตั้งค่าเงื่อนไข MA</h3>
              <p className="text-xs text-[#9CA3AF] font-medium truncate">ทำงาน ≥ · มาสาย ≤ · จบงาน ≥</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl bg-white border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#1F2937] shrink-0">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="p-16 flex justify-center">
            <div className="w-10 h-10 border-[3px] border-[#A3E635]/30 border-t-[#A3E635] rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wide text-[#1F2937] bg-[#A3E635] px-2 py-0.5 rounded-lg">ทีม MA</span>
                <p className="text-xs text-[#6B7280] font-medium">เงื่อนไขผ่านประเมินรายเดือน</p>
              </div>

              {/* ทำงาน ≥ */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-black text-[#1F2937]">ทำงาน ≥</p>
                    <p className="text-[11px] text-[#9CA3AF]">วันเช็คอินขั้นต่ำ / เดือน</p>
                  </div>
                  <span className="text-xs font-bold text-[#6B7280] bg-[#F3F4F6] px-2 py-1 rounded-lg">วัน</span>
                </div>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form.ma_target_days}
                  onChange={(e) => handleChange('ma_target_days', e.target.value)}
                  className={inputCls}
                  required
                />
              </div>

              {/* มาสาย ≤ */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-black text-[#1F2937]">มาสาย ≤</p>
                    <p className="text-[11px] text-[#9CA3AF]">อนุโลมวันสายได้ไม่เกิน / เดือน</p>
                  </div>
                  <span className="text-xs font-bold text-[#6B7280] bg-[#F3F4F6] px-2 py-1 rounded-lg">วัน</span>
                </div>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form.allowed_late_days}
                  onChange={(e) => handleChange('allowed_late_days', e.target.value)}
                  className={inputCls}
                  required
                />
                <p className="text-[10px] text-[#9CA3AF] mt-2 leading-relaxed">
                  เช็คอินก่อนหรือตรงเวลาเข้างานแรกของวัน = ไม่สาย
                </p>
              </div>

              {/* จบงาน ≥ */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-black text-[#1F2937]">จบงาน ≥</p>
                    <p className="text-[11px] text-[#9CA3AF]">จำนวนงาน MA ที่ปิดสำเร็จ / เดือน</p>
                  </div>
                  <span className="text-xs font-bold text-[#6B7280] bg-[#F3F4F6] px-2 py-1 rounded-lg">งาน</span>
                </div>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form.ma_target_jobs}
                  onChange={(e) => handleChange('ma_target_jobs', e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
              <p className="text-sm font-black text-[#1F2937] mb-1">ช่างติดตั้ง — เป้าหมายงาน</p>
              <p className="text-[11px] text-[#9CA3AF] mb-3">จำนวนงานติดตั้งเป้าหมาย / เดือน</p>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.target_tech_jobs}
                onChange={(e) => handleChange('target_tech_jobs', e.target.value)}
                className={inputCls}
                required
              />
            </div>

            <div className="flex gap-3 pt-1 sticky bottom-0 bg-white pb-1">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-3.5 rounded-xl border border-[#E5E7EB] text-[#6B7280] font-bold"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3.5 rounded-xl font-black text-[#1F2937] disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
              >
                {saving ? <span className="w-5 h-5 border-2 border-[#1F2937]/30 border-t-[#1F2937] rounded-full animate-spin" /> : '💾 บันทึก'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
