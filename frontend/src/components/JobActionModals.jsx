import { useState } from 'react';
import api from '../api/axios';

export function CompleteJobModal({ isOpen, onClose, job, onSuccess }) {
  const [images, setImages] = useState([]);
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !job) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length === 0) {
      alert('กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป (สูงสุด 20 รูป)');
      return;
    }
    if (images.length > 20) {
      alert('อัปโหลดรูปภาพได้สูงสุด 20 รูป');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('remark', remark);
      for (let i = 0; i < images.length; i++) {
        formData.append('images', images[i]);
      }

      await api.put(`/dispatch/jobs/${job.id}/complete`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'เกิดข้อผิดพลาดในการจบงาน');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass border border-white/50 rounded-3xl shadow-2xl p-6 flex flex-col">
        <h2 className="text-[#042C53] font-bold text-lg mb-4 flex items-center gap-2">
          <span className="text-2xl">✅</span> จบงาน: {job.access_no}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#042C53] mb-1">รูปภาพหลักฐาน (บังคับ, สูงสุด 20 รูป)</label>
            <input type="file" multiple accept="image/*" onChange={(e) => setImages(e.target.files)}
              className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] outline-none text-[#042C53] bg-white/50" />
            <p className="text-xs text-[#185FA5] mt-1 text-right">{images.length}/20 รูป</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#042C53] mb-1">หมายเหตุ (ถ้ามี)</label>
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] outline-none text-[#042C53] bg-white/50 resize-none h-20" />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#378ADD]/30 text-[#042C53] font-semibold hover:bg-white/50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all flex justify-center items-center">
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'ยืนยันจบงาน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function IncompleteJobModal({ isOpen, onClose, job, onSuccess }) {
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !job) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!remark.trim()) {
      alert('กรุณากรอกหมายเหตุ');
      return;
    }

    try {
      setLoading(true);
      await api.put(`/dispatch/jobs/${job.id}/incomplete`, { remark });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกงานไม่จบ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass border border-white/50 rounded-3xl shadow-2xl p-6 flex flex-col">
        <h2 className="text-red-700 font-bold text-lg mb-4 flex items-center gap-2">
          <span className="text-2xl">❌</span> ไม่จบงาน: {job.access_no}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-red-800 mb-1">สาเหตุ / หมายเหตุ (บังคับ)</label>
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl glass border border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none text-[#042C53] bg-red-50 resize-none h-28" />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-red-200 text-red-800 font-semibold hover:bg-red-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all flex justify-center items-center">
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PostponeJobModal({ isOpen, onClose, job, onSuccess }) {
  const [newDate, setNewDate] = useState('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !job) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newDate) {
      alert('กรุณาเลือกวันที่ต้องการเลื่อน');
      return;
    }

    try {
      setLoading(true);
      await api.put(`/dispatch/jobs/${job.id}/postpone`, { new_date: newDate, remark });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'เกิดข้อผิดพลาดในการเลื่อนนัด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass border border-white/50 rounded-3xl shadow-2xl p-6 flex flex-col">
        <h2 className="text-purple-800 font-bold text-lg mb-4 flex items-center gap-2">
          <span className="text-2xl">📅</span> เลื่อนนัด: {job.access_no}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-purple-900 mb-1">วันที่ต้องการเลื่อนนัด</label>
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl glass border border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-[#042C53] bg-purple-50" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-purple-900 mb-1">หมายเหตุ (ถ้ามี)</label>
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass border border-purple-300 focus:border-purple-500 outline-none text-[#042C53] bg-purple-50 resize-none h-20" />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-purple-200 text-purple-800 font-semibold hover:bg-purple-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all flex justify-center items-center">
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
