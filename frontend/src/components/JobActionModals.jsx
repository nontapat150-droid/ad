import { useState, useEffect } from 'react';
import api from '../api/axios';

export function CompleteJobModal({ isOpen, onClose, job, onSuccess }) {
  const [images, setImages] = useState([]);
  const [remark, setRemark] = useState('');
  
  // Base Fields
  const [installDate, setInstallDate] = useState('');
  const [accessNo, setAccessNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [mainPackage, setMainPackage] = useState('');
  
  // Detailed Device Fields
  const [soaDevice, setSoaDevice] = useState('');
  const [snPlaybox, setSnPlaybox] = useState('');
  const [snMesh, setSnMesh] = useState('');
  const [snSim, setSnSim] = useState('');
  const [snIpCamera, setSnIpCamera] = useState('');
  const [splitNo, setSplitNo] = useState('');
  const [portNo, setPortNo] = useState('');
  const [l3Name, setL3Name] = useState('');
  const [cableLength, setCableLength] = useState('');
  const [refId3bb, setRefId3bb] = useState('');
  const [scBlue, setScBlue] = useState('');

  // Entry Fee Fields
  const [entryFeeStatus, setEntryFeeStatus] = useState('none'); // 'none', 'transfer', 'cash'
  const [entryFeeSlip, setEntryFeeSlip] = useState(null);

  const [loading, setLoading] = useState(false);

  // Initialize fields when modal opens
  useEffect(() => {
    if (isOpen && job) {
      setInstallDate(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD
      setAccessNo(job.access_no || '');
      setCustomerName(job.customer || '');
      setMainPackage(job.package || '');
      setImages([]);
      setRemark('');
      
      // Reset detailed fields
      setSoaDevice(''); setSnPlaybox(''); setSnMesh(''); setSnSim(''); setSnIpCamera('');
      setSplitNo(''); setPortNo(''); setL3Name(''); setCableLength(''); setRefId3bb(''); setScBlue('');
      setEntryFeeStatus('none'); setEntryFeeSlip(null);
    }
  }, [isOpen, job]);

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
    if (entryFeeStatus === 'transfer' && !entryFeeSlip) {
      alert('กรุณาแนบรูปสลิปโอนเงินค่าแรกเข้า');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('remark', remark);
      formData.append('installDate', installDate);
      formData.append('accessNo', accessNo);
      formData.append('customerName', customerName);
      formData.append('mainPackage', mainPackage);
      
      const deviceDetails = `อุปกรณ์ปิด SOA: ${soaDevice}
SN Playbox: ${snPlaybox || '-'}
SN Mesh: ${snMesh || '-'}
SN Sim: ${snSim || '-'}
SN IP Camera: ${snIpCamera || '-'}
Splitt: ${splitNo}
ใช้ Port: ${portNo}
ใช้ #L3(ชื่อ): ${l3Name || '-'}
ระยะสายจริง(M): ${cableLength}
Ref ID 3BB: ${refId3bb || '-'}
ตัวต่อscสีฟ้า: ${scBlue || '-'}`;
      formData.append('installDevice', deviceDetails);

      formData.append('entryFeeStatus', entryFeeStatus);
      if (entryFeeStatus === 'transfer' && entryFeeSlip) {
        formData.append('entryFeeSlip', entryFeeSlip);
      }

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

  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl glass border border-white/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 overflow-y-auto">
          <h2 className="text-[#042C53] font-bold text-lg mb-4 flex items-center gap-2 sticky top-0 bg-white/90 p-2 rounded-xl backdrop-blur-sm shadow-sm z-10">
            <span className="text-2xl">✅</span> จบงาน: {job.access_no}
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Base Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white/40 rounded-2xl border border-white/50">
              <h3 className="md:col-span-2 text-sm font-bold text-[#185FA5] mb-1">ข้อมูลพื้นฐาน</h3>
              <div>
                <label className="block text-xs font-semibold text-[#042C53] mb-1">วันที่ติดตั้ง (ห้ามย้อนหลัง)</label>
                <input type="date" required min={new Date().toLocaleDateString('en-CA')} value={installDate} onChange={(e) => setInstallDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass border border-white/60 focus:border-[#378ADD] outline-none text-[#042C53] bg-white/50 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#042C53] mb-1">ปิดเคสงาน (NON)</label>
                <input type="text" readOnly value={accessNo}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none text-gray-500 bg-gray-100 text-sm cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#042C53] mb-1">ชื่อ-นามสกุล ลูกค้า</label>
                <input type="text" required value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass border border-white/60 focus:border-[#378ADD] outline-none text-[#042C53] bg-white/50 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#042C53] mb-1">แพ็กเกจหลัก</label>
                <input type="text" required value={mainPackage} onChange={(e) => setMainPackage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass border border-white/60 focus:border-[#378ADD] outline-none text-[#042C53] bg-white/50 text-sm" />
              </div>
            </div>

            {/* Detailed Device Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white/40 rounded-2xl border border-white/50">
              <h3 className="md:col-span-2 text-sm font-bold text-[#185FA5] mb-1">รายละเอียดอุปกรณ์ติดตั้ง</h3>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">อุปกรณ์ปิด SOA <span className="text-red-500">*</span></label><input type="text" required value={soaDevice} onChange={(e) => setSoaDevice(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">SN Playbox</label><input type="text" value={snPlaybox} onChange={(e) => setSnPlaybox(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">SN Mesh</label><input type="text" value={snMesh} onChange={(e) => setSnMesh(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">SN Sim</label><input type="text" value={snSim} onChange={(e) => setSnSim(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">SN IP Camera</label><input type="text" value={snIpCamera} onChange={(e) => setSnIpCamera(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">Splitt <span className="text-red-500">*</span></label><input type="text" required value={splitNo} onChange={(e) => setSplitNo(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">ใช้ Port <span className="text-red-500">*</span></label><input type="text" required value={portNo} onChange={(e) => setPortNo(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">ใช้ #L3(ชื่อ)</label><input type="text" value={l3Name} onChange={(e) => setL3Name(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">ระยะสายจริง(M) <span className="text-red-500">*</span></label><input type="number" step="0.1" required value={cableLength} onChange={(e) => setCableLength(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">Ref ID 3BB</label><input type="text" value={refId3bb} onChange={(e) => setRefId3bb(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">ตัวต่อ sc สีฟ้า</label><input type="text" value={scBlue} onChange={(e) => setScBlue(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
            </div>

            {/* Entry Fee Section */}
            <div className="p-4 bg-[#A3E635]/10 rounded-2xl border border-[#A3E635]/30">
              <h3 className="text-sm font-bold text-[#4D7C0F] mb-3">ค่าแรกเข้า</h3>
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 text-sm text-[#042C53]">
                  <input type="radio" name="entryFee" value="none" checked={entryFeeStatus === 'none'} onChange={(e) => setEntryFeeStatus(e.target.value)} className="text-[#84CC16] focus:ring-[#84CC16]" />
                  ไม่มี
                </label>
                <label className="flex items-center gap-2 text-sm text-[#042C53]">
                  <input type="radio" name="entryFee" value="transfer" checked={entryFeeStatus === 'transfer'} onChange={(e) => setEntryFeeStatus(e.target.value)} className="text-[#84CC16] focus:ring-[#84CC16]" />
                  มี (แนบสลิปโอนเงิน)
                </label>
                <label className="flex items-center gap-2 text-sm text-[#042C53]">
                  <input type="radio" name="entryFee" value="cash" checked={entryFeeStatus === 'cash'} onChange={(e) => setEntryFeeStatus(e.target.value)} className="text-[#84CC16] focus:ring-[#84CC16]" />
                  มี (รับหน้างาน)
                </label>
              </div>
              {entryFeeStatus === 'transfer' && (
                <div className="animate-fade-in-up">
                  <label className="block text-xs font-semibold text-[#042C53] mb-1">อัปโหลดสลิปโอนเงิน <span className="text-red-500">*</span></label>
                  <input type="file" accept="image/*" onChange={(e) => setEntryFeeSlip(e.target.files[0])} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm bg-white/50" />
                </div>
              )}
            </div>

            {/* Images and Remark */}
            <div className="grid grid-cols-1 gap-3 p-4 bg-white/40 rounded-2xl border border-white/50">
              <div>
                <label className="block text-sm font-semibold text-[#042C53] mb-1">รูปภาพหลักฐานปิดงาน <span className="text-red-500">*</span> (สูงสุด 20 รูป)</label>
                <input type="file" multiple accept="image/*" onChange={(e) => setImages(e.target.files)}
                  className="w-full px-4 py-2 rounded-xl glass border border-white/60 focus:border-[#378ADD] outline-none text-[#042C53] bg-white/50 text-sm" />
                <p className="text-xs text-[#185FA5] mt-1 text-right">{images.length}/20 รูป</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#042C53] mb-1">หมายเหตุ (ถ้ามี)</label>
                <textarea value={remark} onChange={(e) => setRemark(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl glass border border-white/60 focus:border-[#378ADD] outline-none text-[#042C53] bg-white/50 resize-none h-16 text-sm" />
              </div>
            </div>

            <div className="flex gap-3 mt-2 sticky bottom-0 bg-white/90 p-3 -mx-2 -mb-2 rounded-xl backdrop-blur-sm z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-white/50">
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
          <span className="text-2xl">❌</span> ไม่สำเร็จ: {job.access_no}
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
