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
    allowed_late_days: 0
  });

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings/targets');
      setForm(res.data);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'ไม่สามารถโหลดการตั้งค่าได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: Number(e.target.value) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/targets', form);
      Swal.fire({
        icon: 'success',
        title: 'บันทึกสำเร็จ',
        text: 'อัปเดตเป้าหมายระบบเรียบร้อยแล้ว',
        timer: 1500,
        showConfirmButton: false
      });
      onSaved(form);
      onClose();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-[scaleIn_0.2s_ease-out]">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 text-xl">
            ⚙️
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">ตั้งค่าเป้าหมายระบบ</h3>
            <p className="text-slate-500 text-sm">กำหนดเป้าหมายเริ่มต้นสำหรับทีมงาน</p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            <div className="p-4 bg-slate-50 rounded-2xl space-y-4 border border-slate-100">
              <h4 className="font-bold text-slate-700 flex items-center gap-2">
                <span className="text-lg">🛠️</span> ทีม MA
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">วันทำงานขั้นต่ำ (วัน/เดือน)</label>
                  <input type="number" name="ma_target_days" value={form.ma_target_days} onChange={handleChange} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all" required min="0" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">จำนวนงานเป้าหมาย (งาน/เดือน)</label>
                  <input type="number" name="ma_target_jobs" value={form.ma_target_jobs} onChange={handleChange} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all" required min="0" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">อนุโลมมาสาย (วัน/เดือน)</label>
                  <input type="number" name="allowed_late_days" value={form.allowed_late_days} onChange={handleChange} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all" required min="0" />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl space-y-4 border border-slate-100">
              <h4 className="font-bold text-slate-700 flex items-center gap-2">
                <span className="text-lg">🔧</span> ช่างทั่วไป
              </h4>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">จำนวนงานเป้าหมาย (งาน/เดือน)</label>
                <input type="number" name="target_tech_jobs" value={form.target_tech_jobs} onChange={handleChange} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all" required min="0" />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} disabled={saving} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-bold transition-colors">
                ยกเลิก
              </button>
              <button type="submit" disabled={saving} className="flex-1 px-4 py-3 bg-brand-500 text-white hover:bg-brand-600 rounded-xl font-bold shadow-md shadow-brand-500/30 transition-all flex justify-center items-center gap-2">
                {saving ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div> บันทึก...</>
                ) : (
                  '💾 บันทึกการตั้งค่า'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
