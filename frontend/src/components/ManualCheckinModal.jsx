import { useState } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';

export default function ManualCheckinModal({ usersList, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState('');
  const [checkinTime, setCheckinTime] = useState('');
  const [checkoutTime, setCheckoutTime] = useState('');
  const [checkinImage, setCheckinImage] = useState(null);
  const [checkoutImage, setCheckoutImage] = useState(null);
  const [isLate, setIsLate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (type === 'checkin') setCheckinImage(file);
      else setCheckoutImage(file);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!userId || !checkinTime) {
        return Swal.fire({ icon: 'warning', title: 'กรุณาระบุพนักงานและเวลาเข้างาน', confirmButtonColor: '#185FA5' });
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handlePrev = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('user_id', userId);
      fd.append('checkin_time', checkinTime);
      if (checkoutTime) fd.append('checkout_time', checkoutTime);
      fd.append('is_late', isLate);
      if (checkinImage) fd.append('checkin_image', checkinImage);
      if (checkoutImage) fd.append('checkout_image', checkoutImage);

      await api.post('/checkin/admin/manual', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', showConfirmButton: false, timer: 1500 });
      onSuccess();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || 'เซิร์ฟเวอร์ขัดข้อง' });
    } finally {
      setLoading(false);
    }
  };

  const selectedUser = usersList.find(u => u.id.toString() === userId);

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease-out]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#185FA5] to-[#0C447C] text-white flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="text-xl">📅</span> เพิ่มข้อมูลลงเวลาย้อนหลัง
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10">✕</button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -z-10 -translate-y-1/2 rounded-full overflow-hidden">
              <div className="h-full bg-[#185FA5] transition-all duration-300" style={{ width: `${(step - 1) * 50}%` }} />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${step >= i ? 'bg-[#185FA5] border-[#185FA5] text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                {i}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs font-bold text-slate-500">
            <span className={step >= 1 ? 'text-[#185FA5]' : ''}>เข้างาน</span>
            <span className={step >= 2 ? 'text-[#185FA5]' : ''}>ออกงาน</span>
            <span className={step >= 3 ? 'text-[#185FA5]' : ''}>ยืนยัน</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1.5">พนักงาน *</label>
                <select className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] outline-none text-sm font-bold text-[#042C53] bg-slate-50" value={userId} onChange={e => setUserId(e.target.value)}>
                  <option value="">-- เลือกพนักงาน --</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-[#042C53] mb-1.5">เวลาเข้างาน *</label>
                  <input type="datetime-local" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#185FA5]/30 outline-none text-sm bg-slate-50 text-[#042C53] font-bold" value={checkinTime} onChange={e => setCheckinTime(e.target.value)} />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded text-rose-500 border-slate-300 focus:ring-rose-500" checked={isLate} onChange={e => setIsLate(e.target.checked)} />
                    <span className="text-sm font-bold text-rose-500">มาร์คว่ามาสาย</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1.5">รูปภาพเข้างาน (ถ้ามี)</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors relative">
                  {checkinImage ? (
                    <div className="flex flex-col items-center">
                      <img src={URL.createObjectURL(checkinImage)} alt="preview" className="h-24 object-cover rounded-lg mb-2 shadow-sm" />
                      <p className="text-xs text-emerald-600 font-bold">{checkinImage.name}</p>
                    </div>
                  ) : (
                    <div className="text-slate-400 py-3">
                      <p className="text-3xl mb-1">📸</p>
                      <p className="text-xs font-bold">คลิกเพื่ออัปโหลดรูป</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleImageChange(e, 'checkin')} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1.5">เวลาออกงาน (ไม่บังคับ)</label>
                <input type="datetime-local" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#185FA5]/30 outline-none text-sm bg-slate-50 text-[#042C53] font-bold" value={checkoutTime} onChange={e => setCheckoutTime(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1.5">รูปภาพออกงาน (ถ้ามี)</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors relative">
                  {checkoutImage ? (
                    <div className="flex flex-col items-center">
                      <img src={URL.createObjectURL(checkoutImage)} alt="preview" className="h-24 object-cover rounded-lg mb-2 shadow-sm" />
                      <p className="text-xs text-emerald-600 font-bold">{checkoutImage.name}</p>
                    </div>
                  ) : (
                    <div className="text-slate-400 py-3">
                      <p className="text-3xl mb-1">🏁</p>
                      <p className="text-xs font-bold">คลิกเพื่ออัปโหลดรูปออกงาน</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleImageChange(e, 'checkout')} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              <div className="bg-[#E6F1FB] p-4 rounded-2xl border border-[#185FA5]/20">
                <h3 className="font-bold text-[#185FA5] text-center mb-4">ตรวจสอบความถูกต้อง</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm">
                    <span className="text-xs text-slate-500 font-bold">พนักงาน:</span>
                    <span className="text-sm font-bold text-[#042C53]">{selectedUser?.full_name}</span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm">
                    <span className="text-xs text-slate-500 font-bold">เข้างาน:</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-[#185FA5]">{new Date(checkinTime).toLocaleString('th-TH')}</span>
                      {isLate && <span className="ml-2 text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded font-bold">สาย</span>}
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm">
                    <span className="text-xs text-slate-500 font-bold">ออกงาน:</span>
                    <span className="text-sm font-bold text-indigo-600">
                      {checkoutTime ? new Date(checkoutTime).toLocaleString('th-TH') : '-'}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 pt-2">
                    <div className="flex-1 text-center">
                      <p className="text-xs text-slate-500 font-bold mb-1">รูปเข้างาน</p>
                      {checkinImage ? <img src={URL.createObjectURL(checkinImage)} className="h-16 w-full object-cover rounded-lg border" /> : <div className="h-16 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400 border border-dashed">ไม่มี</div>}
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-xs text-slate-500 font-bold mb-1">รูปออกงาน</p>
                      {checkoutImage ? <img src={URL.createObjectURL(checkoutImage)} className="h-16 w-full object-cover rounded-lg border" /> : <div className="h-16 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400 border border-dashed">ไม่มี</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-between">
          {step > 1 ? (
            <button onClick={handlePrev} className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-white bg-slate-100 transition-colors text-sm">
              ย้อนกลับ
            </button>
          ) : (
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-sm">
              ยกเลิก
            </button>
          )}

          {step < 3 ? (
            <button onClick={handleNext} className="px-6 py-2.5 rounded-xl bg-[#185FA5] hover:bg-[#0C447C] text-white font-bold shadow-md transition-all active:scale-95 text-sm ml-auto">
              ถัดไป ➔
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold shadow-md transition-all active:scale-95 text-sm ml-auto flex items-center gap-2">
              {loading ? 'กำลังบันทึก...' : '💾 ยืนยันบันทึก'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
