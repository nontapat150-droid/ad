import { useState, useEffect, useRef } from 'react';
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

  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        <div className="px-6 py-5 bg-[#1F2937] border-b border-[#374151] flex justify-between items-center shrink-0">
          <h2 className="text-lg font-black text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#374151] flex items-center justify-center shadow-inner">
              <svg className="w-4 h-4 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            เพิ่มข้อมูลลงเวลาย้อนหลัง
          </h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#374151]">✕</button>
        </div>

        {/* Stepper Header */}
        <div className="px-8 py-6 bg-white border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-6 right-6 top-5 h-1 rounded-full bg-[#E5E7EB] z-0" />
            <div className={`absolute left-6 top-5 h-1 rounded-full bg-[#A3E635] z-0 transition-all duration-500 ease-out`} style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }} />
            
            {[
              { num: 1, label: 'เข้างาน' },
              { num: 2, label: 'ออกงาน' },
              { num: 3, label: 'ยืนยัน' }
            ].map(s => {
              const isActive = step >= s.num;
              return (
                <div key={s.num} className="relative z-10 flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 border-2 ${
                    isActive 
                      ? 'bg-[#1F2937] border-[#1F2937] text-[#A3E635] shadow-lg shadow-[#1F2937]/20 scale-110' 
                      : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'
                  }`}>
                    {s.num}
                  </div>
                  <span className={`text-xs font-bold ${isActive ? 'text-[#1F2937]' : 'text-[#9CA3AF]'}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#F9FAFB]">
          
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div>
                <label className="block text-sm font-bold text-[#1F2937] mb-2">พนักงาน *</label>
                {/* Custom Premium Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <div 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`w-full bg-white border ${isDropdownOpen ? 'border-[#A3E635] ring-2 ring-[#A3E635]/50' : 'border-[#E5E7EB] hover:border-[#A3E635]/50'} rounded-2xl px-4 py-3.5 cursor-pointer flex items-center justify-between shadow-sm transition-all duration-300`}
                  >
                    <span className={`text-sm font-bold ${formData.user_id ? 'text-[#1F2937]' : 'text-[#9CA3AF]'}`}>
                      {formData.user_id ? usersList.find(u => u.id.toString() === formData.user_id)?.full_name : '-- เลือกพนักงาน --'}
                    </span>
                    <svg className={`w-5 h-5 text-[#9CA3AF] transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-[#1F2937]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  
                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] py-2 max-h-60 overflow-y-auto animate-[slideDown_0.2s_ease-out]">
                      <div 
                        onClick={() => {
                          setFormData(prev => ({ ...prev, user_id: '' }));
                          setIsDropdownOpen(false);
                        }}
                        className={`px-4 py-3 cursor-pointer text-sm font-bold transition-colors ${!formData.user_id ? 'bg-[#F9FAFB] text-[#1F2937]' : 'text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#1F2937]'}`}
                      >
                        -- เลือกพนักงาน --
                      </div>
                      {usersList.map(u => (
                        <div 
                          key={u.id}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, user_id: u.id.toString() }));
                            setIsDropdownOpen(false);
                          }}
                          className={`px-4 py-3 cursor-pointer text-sm font-bold flex items-center justify-between transition-colors ${formData.user_id === u.id.toString() ? 'bg-[#F9FAFB] text-[#A3E635]' : 'text-[#1F2937] hover:bg-[#F9FAFB]'}`}
                        >
                          {u.full_name}
                          {formData.user_id === u.id.toString() && (
                            <svg className="w-5 h-5 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1F2937] mb-2">วันและเวลาเข้างาน *</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden focus-within:ring-2 focus-within:ring-[#A3E635]/50 focus-within:border-[#A3E635] transition-all">
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
                    />
                  </div>

                  {/* Late Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer shrink-0 bg-white border border-[#E5E7EB] px-4 py-3.5 rounded-2xl shadow-sm hover:bg-[#F9FAFB] transition-colors">
                    <input 
                      type="checkbox" 
                      name="is_late" 
                      checked={formData.is_late} 
                      onChange={handleChange} 
                      className="w-5 h-5 accent-red-500 rounded border-[#E5E7EB]"
                    />
                    <span className="text-sm font-bold text-red-500">มาร์คว่ามาสาย</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1F2937] mb-2">รูปภาพเข้างาน (ถ้ามี)</label>
                <div className="border-2 border-dashed border-[#E5E7EB] bg-white rounded-2xl p-4 text-center hover:bg-[#F9FAFB] hover:border-[#1F2937]/30 transition-all relative overflow-hidden group">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleImageChange(e, 'checkin')} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  {checkinImg ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={URL.createObjectURL(checkinImg)} className="h-24 rounded-lg object-contain shadow-sm group-hover:scale-105 transition-transform duration-300" />
                      <span className="text-xs text-[#1F2937] font-bold">เปลี่ยนรูปภาพ</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <span className="text-2xl">📸</span>
                      </div>
                      <span className="text-sm font-bold text-[#4B5563]">คลิกเพื่ออัปโหลดรูป</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="bg-[#1F2937] p-5 rounded-2xl flex items-center gap-4 shadow-inner">
                <div className="w-10 h-10 rounded-full bg-[#374151] flex items-center justify-center shrink-0">
                  <span className="text-xl">🔒</span>
                </div>
                <div>
                  <p className="text-[#A3E635] font-black text-sm mb-0.5">วันที่เลิกงานถูกล็อก</p>
                  <p className="text-[#9CA3AF] text-xs">ตรงกับวันที่เข้างาน ({toThaiDate(formData.checkin_date)}) กรุณาเลือกเฉพาะเวลา</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1F2937] mb-2">เวลาออกงาน (ถ้ามี)</label>
                <div className="relative w-full group bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden focus-within:ring-2 focus-within:ring-[#A3E635]/50 focus-within:border-[#A3E635] transition-all">
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
                <label className="block text-sm font-bold text-[#1F2937] mb-2">รูปภาพออกงาน (ถ้ามี)</label>
                <div className="border-2 border-dashed border-[#E5E7EB] bg-white rounded-2xl p-4 text-center hover:bg-[#F9FAFB] hover:border-[#1F2937]/30 transition-all relative overflow-hidden group">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleImageChange(e, 'checkout')} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  {checkoutImg ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={URL.createObjectURL(checkoutImg)} className="h-24 rounded-lg object-contain shadow-sm group-hover:scale-105 transition-transform duration-300" />
                      <span className="text-xs text-[#1F2937] font-bold">เปลี่ยนรูปภาพ</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <span className="text-2xl">📸</span>
                      </div>
                      <span className="text-sm font-bold text-[#4B5563]">คลิกเพื่ออัปโหลดรูป</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
              <h3 className="font-black text-[#1F2937] text-xl text-center mb-6">ตรวจสอบข้อมูลก่อนบันทึก</h3>
              
              <div className="bg-white border border-[#E5E7EB] rounded-3xl p-6 space-y-5 shadow-sm">
                <div className="flex items-center gap-4 pb-5 border-b border-[#F3F4F6]">
                  <div className="w-12 h-12 bg-[#1F2937] text-[#A3E635] rounded-xl flex items-center justify-center font-bold text-xl shadow-inner">👤</div>
                  <div>
                    <p className="text-xs font-bold text-[#9CA3AF] mb-0.5">พนักงาน</p>
                    <p className="font-black text-lg text-[#1F2937]">{selectedUser?.full_name || '-'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-[#F9FAFB] p-4 rounded-2xl border border-[#E5E7EB]">
                    <p className="text-xs font-bold text-[#9CA3AF] mb-2">เวลาเข้างาน</p>
                    <p className="font-black text-base text-[#1F2937]">✅ {toThaiDateTime(formData.checkin_date, formData.checkin_time)}</p>
                    {formData.is_late && <span className="inline-block mt-2 text-[10px] font-black text-white bg-red-500 px-2.5 py-1 rounded-lg">มาสาย</span>}
                    {checkinImg && <p className="text-xs font-bold text-[#4B5563] mt-2 flex items-center gap-1"><span className="text-sm">📸</span> มีรูปภาพแนบ</p>}
                  </div>
                  <div className="bg-[#F9FAFB] p-4 rounded-2xl border border-[#E5E7EB]">
                    <p className="text-xs font-bold text-[#9CA3AF] mb-2">เวลาออกงาน</p>
                    {formData.checkout_time ? (
                      <>
                        <p className="font-black text-base text-[#1F2937]">🏁 {toThaiDateTime(formData.checkin_date, formData.checkout_time)}</p>
                        {checkoutImg && <p className="text-xs font-bold text-[#4B5563] mt-2 flex items-center gap-1"><span className="text-sm">📸</span> มีรูปภาพแนบ</p>}
                      </>
                    ) : (
                      <p className="font-black text-sm text-[#9CA3AF] italic">- ไม่ระบุ -</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-[#E5E7EB] bg-white flex gap-3 justify-between shrink-0">
          {step === 1 ? (
            <button type="button" onClick={onClose} className="px-6 py-3.5 rounded-2xl font-bold text-[#4B5563] bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors text-sm shadow-sm active:scale-95">
              ยกเลิก
            </button>
          ) : (
            <button type="button" onClick={handleBack} className="px-6 py-3.5 rounded-2xl font-bold text-[#4B5563] bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors text-sm shadow-sm active:scale-95">
              กลับ
            </button>
          )}

          {step < 3 ? (
            <button type="button" onClick={handleNext} className="px-8 py-3.5 rounded-2xl bg-[#1F2937] hover:bg-[#374151] text-white font-bold shadow-lg transition-all active:scale-95 text-sm flex items-center gap-2">
              ถัดไป ➔
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading} className="px-8 py-3.5 rounded-2xl bg-[#A3E635] hover:bg-[#84CC16] text-[#1F2937] font-black shadow-[0_4px_15px_rgba(163,230,53,0.3)] active:scale-95 transition-all text-sm flex items-center gap-2 disabled:opacity-70 disabled:active:scale-100">
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[#1F2937]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  บันทึกข้อมูล
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
