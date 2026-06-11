import { useState, useEffect } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { DateTimePicker } from './DateTimePicker';
import { format } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────
function toThaiDate(isoString) {
  if (!isoString) return 'ดด/วว/ปปปป';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'ดด/วว/ปปปป';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = (date.getFullYear() + 543).toString();
  return `${day}/${month}/${year}`;
}

function toThaiTime(timeString) {
  if (!timeString) return '--:-- น.';
  return `${timeString} น.`;
}

function toThaiDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '-';
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = (date.getFullYear() + 543).toString();
  return `${day}/${month}/${year} เวลา ${timeStr} น.`;
}

export default function ManualCheckinModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    user_id: '',
    checkin_date: '',
    checkin_time: '',
    is_late: false,
    checkout_time: '', // checkout_date is locked to checkin_date
  });

  const [checkinImg, setCheckinImg] = useState(null);
  const [checkoutImg, setCheckoutImg] = useState(null);

  useEffect(() => {
    api.get('/users').then(res => setUsersList(res.data)).catch(console.error);
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.user_id) return Swal.fire({ icon: 'warning', text: 'กรุณาเลือกพนักงาน' });
      if (!formData.checkin_date || !formData.checkin_time) return Swal.fire({ icon: 'warning', text: 'กรุณาระบุวันและเวลาเข้างาน' });
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!formData.user_id || !formData.checkin_date || !formData.checkin_time) return;

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('user_id', formData.user_id);
      
      // Combine date and time
      const checkinDateTime = `${formData.checkin_date}T${formData.checkin_time}:00`;
      fd.append('checkin_time', checkinDateTime);
      fd.append('is_late', formData.is_late ? 1 : 0);

      if (formData.checkout_time) {
        const checkoutDateTime = `${formData.checkin_date}T${formData.checkout_time}:00`;
        fd.append('checkout_time', checkoutDateTime);
      }

      if (checkinImg) fd.append('checkin_image', checkinImg);
      if (checkoutImg) fd.append('checkout_image', checkoutImg);

      await api.post('/checkin/admin/manual', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', showConfirmButton: false, timer: 1500 });
      onSuccess();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || 'ไม่สามารถบันทึกได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (type === 'checkin') setCheckinImg(file);
      else setCheckoutImg(file);
    }
  };

  const selectedUser = usersList.find(u => u.id.toString() === formData.user_id);

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease-out] flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[#185FA5] text-white flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>📅</span> เพิ่มข้อมูลลงเวลาย้อนหลัง
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10">✕</button>
        </div>

        {/* Stepper Header */}
        <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-6 right-6 top-5 h-0.5 bg-slate-200 z-0" />
            <div className={`absolute left-6 top-5 h-0.5 bg-[#185FA5] z-0 transition-all duration-300`} style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }} />
            
            {[
              { num: 1, label: 'เข้างาน' },
              { num: 2, label: 'ออกงาน' },
              { num: 3, label: 'ยืนยัน' }
            ].map(s => {
              const isActive = step >= s.num;
              const isCurrent = step === s.num;
              return (
                <div key={s.num} className="relative z-10 flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2 ${
                    isActive 
                      ? 'bg-[#185FA5] border-[#185FA5] text-white shadow-md shadow-blue-500/20' 
                      : 'bg-white border-slate-300 text-slate-400'
                  }`}>
                    {s.num}
                  </div>
                  <span className={`text-xs font-bold ${isActive ? 'text-[#185FA5]' : 'text-slate-400'}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-2">พนักงาน *</label>
                <select 
                  name="user_id" 
                  value={formData.user_id} 
                  onChange={handleChange} 
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#185FA5]/30 outline-none text-sm font-bold text-[#042C53]"
                >
                  <option value="">-- เลือกพนักงาน --</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-2">วันและเวลาเข้างาน *</label>
                <div className="flex items-center gap-3">
                  
                  <DateTimePicker 
                    value={formData.checkin_date && formData.checkin_time ? new Date(`${formData.checkin_date}T${formData.checkin_time}`) : null}
                    onChange={(date) => {
                      if (date) {
                        setFormData({
                          ...formData,
                          checkin_date: format(date, 'yyyy-MM-dd'),
                          checkin_time: format(date, 'HH:mm')
                        });
                      } else {
                        setFormData({
                          ...formData,
                          checkin_date: '',
                          checkin_time: ''
                        });
                      }
                    }}
                    placeholder="เลือกวันและเวลาเข้างาน"
                    className="flex-1"
                  />

                  {/* Late Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      name="is_late" 
                      checked={formData.is_late} 
                      onChange={handleChange} 
                      className="w-5 h-5 accent-red-500 rounded border-slate-300"
                    />
                    <span className="text-sm font-bold text-red-500">มาร์คว่ามาสาย</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-2">รูปภาพเข้างาน (ถ้ามี)</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition-colors relative">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleImageChange(e, 'checkin')} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  {checkinImg ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={URL.createObjectURL(checkinImg)} className="h-24 rounded-lg object-contain shadow-sm" />
                      <span className="text-xs text-[#185FA5] font-bold">เปลี่ยนรูปภาพ</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <span className="text-2xl">📸</span>
                      <span className="text-sm font-bold text-[#185FA5]">คลิกเพื่ออัปโหลดรูป</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="bg-[#E6F1FB] p-4 rounded-xl flex items-center gap-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <p className="text-[#185FA5] font-bold text-sm">วันที่เลิกงานถูกล็อก</p>
                  <p className="text-[#378ADD] text-xs">ตรงกับวันที่เข้างาน ({toThaiDate(formData.checkin_date)}) กรุณาเลือกเฉพาะเวลาที่ออกงาน</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-2">เวลาออกงาน (ถ้ามี)</label>
                <div className="relative w-full group">
                  <DateTimePicker 
                    value={formData.checkout_time ? new Date(`${formData.checkin_date || format(new Date(), 'yyyy-MM-dd')}T${formData.checkout_time}`) : null}
                    onChange={(date) => {
                      if (date) {
                        setFormData({
                          ...formData,
                          checkout_time: format(date, 'HH:mm')
                        });
                      } else {
                        setFormData({
                          ...formData,
                          checkout_time: ''
                        });
                      }
                    }}
                    placeholder="เลือกเวลาออกงาน"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-2">รูปภาพออกงาน (ถ้ามี)</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition-colors relative">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleImageChange(e, 'checkout')} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  {checkoutImg ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={URL.createObjectURL(checkoutImg)} className="h-24 rounded-lg object-contain shadow-sm" />
                      <span className="text-xs text-[#185FA5] font-bold">เปลี่ยนรูปภาพ</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <span className="text-2xl">📸</span>
                      <span className="text-sm font-bold text-[#185FA5]">คลิกเพื่ออัปโหลดรูป</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
              <h3 className="font-bold text-[#042C53] text-lg text-center mb-4">ตรวจสอบข้อมูลก่อนบันทึก</h3>
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
                  <div className="w-10 h-10 bg-[#E6F1FB] text-[#185FA5] rounded-full flex items-center justify-center font-bold">👤</div>
                  <div>
                    <p className="text-xs text-slate-500">พนักงาน</p>
                    <p className="font-bold text-[#042C53]">{selectedUser?.full_name || '-'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">เวลาเข้างาน</p>
                    <p className="font-bold text-emerald-600">✅ {toThaiDateTime(formData.checkin_date, formData.checkin_time)}</p>
                    {formData.is_late && <span className="inline-block mt-1 text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">มาสาย</span>}
                    {checkinImg && <p className="text-xs text-slate-400 mt-1">📸 มีรูปภาพแนบ</p>}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">เวลาออกงาน</p>
                    {formData.checkout_time ? (
                      <>
                        <p className="font-bold text-indigo-600">🏁 {toThaiDateTime(formData.checkin_date, formData.checkout_time)}</p>
                        {checkoutImg && <p className="text-xs text-slate-400 mt-1">📸 มีรูปภาพแนบ</p>}
                      </>
                    ) : (
                      <p className="font-bold text-slate-400">- ไม่ระบุ -</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-between shrink-0">
          {step === 1 ? (
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors text-sm">
              ยกเลิก
            </button>
          ) : (
            <button type="button" onClick={handleBack} className="px-6 py-3 rounded-xl font-bold text-[#185FA5] bg-blue-50 hover:bg-blue-100 transition-colors text-sm">
              กลับ
            </button>
          )}

          {step < 3 ? (
            <button type="button" onClick={handleNext} className="px-8 py-3 rounded-xl bg-[#185FA5] hover:bg-[#0C447C] text-white font-bold shadow-md transition-all active:scale-95 text-sm flex items-center gap-2">
              ถัดไป ➔
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading} className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all text-sm flex items-center gap-2">
              {loading ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูล'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
