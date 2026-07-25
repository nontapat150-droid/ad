import { useEffect, useState } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { AppDateField, AppSelectField } from './DispatchFilterFields';

export default function LeaveRequestModal({
  isOpen,
  onClose,
  onSuccess,
  leaveType = 'general',
  isAdmin = false,
  usersList = [],
}) {
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLeaveDate(new Date().toISOString().slice(0, 10));
    setReason('');
    setImage(null);
    setPreview(null);
    setTargetUserId('');
  }, [isOpen]);

  if (!isOpen) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const isBackdated = leaveDate && leaveDate < todayStr;

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImage(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!leaveDate) {
      Swal.fire({ icon: 'warning', title: 'กรุณาเลือกวันที่ลา', confirmButtonColor: '#1F2937' });
      return;
    }
    if (isBackdated && !isAdmin) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่สามารถลาย้อนหลังได้',
        text: 'กรุณาเลือกวันนี้หรือวันข้างหน้า',
        confirmButtonColor: '#1F2937',
      });
      return;
    }
    if (isAdmin && !targetUserId) {
      Swal.fire({ icon: 'warning', title: 'กรุณาเลือกพนักงาน', confirmButtonColor: '#1F2937' });
      return;
    }
    if (!reason.trim() && !image) {
      Swal.fire({ icon: 'warning', title: 'กรุณาระบุสาเหตุหรือแนบรูปภาพ', confirmButtonColor: '#1F2937' });
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('leave_date', leaveDate);
      fd.append('reason', reason.trim());
      fd.append('leave_type', leaveType);
      if (isAdmin && targetUserId) fd.append('user_id', targetUserId);
      if (image) fd.append('image', image);

      const { data } = await api.post('/checkin/leave', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Swal.fire({
        icon: 'success',
        title: data?.message || 'บันทึกการลาสำเร็จ',
        showConfirmButton: false,
        timer: 1800,
      });
      setReason('');
      clearImage();
      setTargetUserId('');
      onSuccess?.();
      onClose();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'ไม่สามารถบันทึกการลาได้',
        text: err.response?.data?.error || 'เกิดข้อผิดพลาด',
        confirmButtonColor: '#1F2937',
      });
    } finally {
      setLoading(false);
    }
  };

  const userOptions = (usersList || [])
    .filter((u) => u.status === 'approved' || !u.status)
    .map((u) => ({ value: String(u.id), label: u.full_name || u.username || `#${u.id}` }));

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#1F2937]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-3xl border border-[#E5E7EB] shadow-2xl overflow-hidden animate-filterDropIn">
        <div className="h-1" style={{ background: 'linear-gradient(90deg,#FB923C,#F97316)' }} />
        <div className="px-6 py-5 border-b border-[#F3F4F6] flex items-center justify-between bg-[#FFF7ED]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-orange-200 flex items-center justify-center text-xl shadow-sm">📝</div>
            <div>
              <h2 className="text-lg font-black text-[#1F2937]">
                {isAdmin ? 'ลงลางาน (แอดมิน)' : 'แจ้งลางาน'}
              </h2>
              <p className="text-xs text-[#9CA3AF] font-medium">
                {isAdmin ? 'เลือกวันได้ทั้งย้อนหลังและล่วงหน้า' : 'เลือกวันที่ลา (ห้ามย้อนหลัง)'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center text-[#9CA3AF] hover:text-[#1F2937] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {isAdmin && (
            <AppSelectField
              label="พนักงานที่ลา *"
              value={targetUserId}
              onChange={setTargetUserId}
              options={userOptions}
              placeholder="เลือกพนักงาน"
              searchable
              allowClear={false}
            />
          )}

          <AppDateField
            label="วันที่ลา"
            value={leaveDate}
            onChange={setLeaveDate}
            min={isAdmin ? undefined : todayStr}
            allowClear={false}
            showToday
          />

          {isAdmin && isBackdated && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700">
              รายการนี้เป็นลาย้อนหลัง ({leaveDate})
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-wide mb-1.5">
              สาเหตุการลา
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="ระบุสาเหตุการลา เช่น ลาป่วย, ลากิจ..."
              className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#1F2937] outline-none focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 resize-none transition-all"
            />
            <p className="text-[10px] text-[#9CA3AF] mt-1.5">กรอกสาเหตุ หรือแนบรูปภาพอย่างใดอย่างหนึ่ง</p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-wide mb-1.5">
              แนบรูปภาพ (ไม่บังคับ)
            </label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={`flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-2xl transition-all ${
                preview ? 'border-orange-400 bg-orange-50/50' : 'border-[#E5E7EB] bg-[#F9FAFB] hover:border-[#A3E635] hover:bg-[#A3E635]/5'
              }`}>
                {preview ? (
                  <div className="relative w-full">
                    <img src={preview} alt="preview" className="max-h-40 mx-auto rounded-xl object-contain" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearImage(); }}
                      className="absolute top-1 right-1 w-7 h-7 bg-red-500 text-white rounded-full text-xs font-bold hover:bg-red-600 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-3xl mb-2">📎</span>
                    <span className="text-sm font-bold text-[#374151]">คลิกเพื่อแนบรูป</span>
                    <span className="text-[10px] text-[#9CA3AF] mt-1">เช่น ใบรับรองแพทย์, หลักฐานการลา</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl border border-[#E5E7EB] text-[#6B7280] font-bold hover:bg-[#F9FAFB] transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-400 to-orange-500 text-white font-black shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (isBackdated && isAdmin ? '📝 บันทึกย้อนหลัง' : '📝 ยืนยันการลา')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
