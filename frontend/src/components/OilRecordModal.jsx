import { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { DateTimePicker } from './DateTimePicker';
import { format } from 'date-fns';
import { AppSelectField } from './DispatchFilterFields';
import { buildLicensePlateOptions } from '../utils/oilPlates';

const TECH_ROLE_LABELS = {
  sales: 'เซล',
  technician: 'ช่าง Office',
  ma_technician: 'ช่าง MA',
  office_technician: 'ช่าง Office',
  contractor_office: 'รับเหมาติดตั้ง',
  contractor_ma: 'รับเหมา MA',
};

function techOptionLabel(t) {
  const roleText = TECH_ROLE_LABELS[t.role] || t.role || 'พนักงาน';
  return `${t.full_name}${t.team_name ? ` (ทีม: ${t.team_name})` : ''} [${roleText}]`;
}

export default function OilRecordModal({ onClose, onSuccess, inline = false }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const [techs, setTechs] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTech, setSelectedTech] = useState(null);

  useEffect(() => {
    api.get('/users/teams').then((res) => setTeams(res.data || [])).catch(console.error);

    if (isAdmin) {
      api.get('/users').then(res => {
        setTechs((res.data || []).filter(u => 
          u.roles?.includes('technician') || 
          u.role === 'technician' || 
          u.role === 'ma_technician' || 
          u.role === 'contractor_office' ||
          u.role === 'contractor_ma' ||
          u.roles?.includes('contractor_office') ||
          u.roles?.includes('contractor_ma') ||
          u.roles?.includes('sales') || 
          u.role === 'sales'
        ));
      }).catch(console.error);
    }
  }, [isAdmin]);

  const activeUser = isAdmin && selectedTech ? selectedTech : user;
  const teamName = activeUser?.team_name || (activeUser?.team_id ? `ทีม ${activeUser.team_id}` : 'ไม่มีทีม');
  const userHasTeam = !!(activeUser?.team_name || activeUser?.team_id);
  
  const getLocalDatetimeString = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const [form, setForm] = useState({ 
    tech_id: '',
    license_plate: '', 
    liters: '', 
    price_per_liter: '', 
    mileage: '', 
    total_price: '',
    date_recorded: getLocalDatetimeString()
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFillOnBehalf, setIsFillOnBehalf] = useState(false);
  const [fillerId, setFillerId] = useState('');
  const [isTripMileage, setIsTripMileage] = useState(false);

  const plateOptions = useMemo(
    () => buildLicensePlateOptions(teams, form.license_plate),
    [teams, form.license_plate]
  );

  const handleTechChange = (tId) => {
    const tech = techs.find(t => String(t.id) === String(tId));
    setSelectedTech(tech || null);
    setForm(prev => ({
      ...prev,
      tech_id: tId,
      license_plate: tech?.team_name || tech?.vehicle_plate || prev.license_plate,
    }));
  };

  useEffect(() => {
    if (activeUser) {
      const autoPlate = activeUser.team_name || (activeUser.team_id ? `ทีม ${activeUser.team_id}` : activeUser.full_name);
      setForm(prev => ({ ...prev, license_plate: autoPlate }));
    }
  }, [activeUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!String(form.license_plate || '').trim()) {
      return Swal.fire({ icon: 'warning', title: 'เลือกทะเบียนรถ', text: 'กรุณาเลือกทะเบียนรถจากรายการในระบบ' });
    }
    if (images.length > 5) return Swal.fire({ icon: 'warning', text: 'อัปโหลดรูปภาพได้สูงสุด 5 รูป' });
    
    setLoading(true);
    try {
      const formData = new FormData();
      Object.keys(form).forEach(key => {
        formData.append(key, form[key]);
      });
      images.forEach(img => formData.append('images', img));

      if (isAdmin && isFillOnBehalf && fillerId) {
        const fillerTech = techs.find(t => String(t.id) === String(fillerId));
        if (fillerTech) {
          formData.append('filler_name', fillerTech.full_name);
        }
      }

      if (isAdmin && isTripMileage) {
        formData.append('is_trip', 'true');
      }

      await api.post('/oil/records', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Reset form if inline
      if (inline) {
        setForm({ 
          tech_id: form.tech_id,
          license_plate: form.license_plate, 
          liters: '', 
          price_per_liter: '', 
          mileage: '', 
          total_price: '',
          date_recorded: getLocalDatetimeString()
        });
        setImages([]);
      }
      
      onSuccess();
      if (!inline && onClose) onClose();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: err.response?.data?.error || err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'liters' || name === 'price_per_liter') {
        const l = parseFloat(next.liters || 0);
        const p = parseFloat(next.price_per_liter || 0);
        if (l && p) next.total_price = Math.round(l * p).toString();
      }
      return next;
    });
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 5) {
      return Swal.fire({ icon: 'warning', text: 'อัปโหลดรูปภาพได้สูงสุด 5 รูป' });
    }
    setImages(prev => [...prev, ...files]);
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div 
      className={inline ? "w-full max-w-2xl mx-auto py-4 md:py-8 px-4" : "fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F2937]/80 backdrop-blur-sm"} 
      onClick={(e) => !inline && e.target === e.currentTarget && onClose && onClose()}
    >
      <div className={`relative ${inline ? 'w-full bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[#E5E7EB]' : 'w-full max-w-2xl bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-[#E5E7EB] animate-[slideUp_0.3s_ease-out] max-h-[90vh] overflow-y-auto'}`}>
        
        {/* Mobile Handle */}
        {!inline && (
          <div className="md:hidden flex justify-center mb-6">
            <div className="w-12 h-1.5 rounded-full bg-[#E5E7EB]" />
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#1F2937] flex items-center justify-center shadow-inner shrink-0">
              <svg className="w-6 h-6 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <div>
              <h2 className="text-xl font-black text-[#1F2937] tracking-tight">บันทึกการเติมน้ำมัน</h2>
              <p className="text-sm font-medium text-[#6B7280]">กรอกข้อมูลให้ครบถ้วนเพื่อเบิกจ่าย</p>
            </div>
          </div>
          {!inline && (
            <button onClick={onClose} className="w-10 h-10 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center text-[#9CA3AF] hover:text-[#1F2937] hover:bg-[#F3F4F6] transition-colors shadow-sm shrink-0 active:scale-95">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* User Info (Read-only for tech, Dropdown for Admin) */}
        {isAdmin ? (
          <div className="mb-6 p-5 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB]">
            <AppSelectField
              label="เลือกช่างเทคนิค"
              value={String(form.tech_id || '')}
              onChange={handleTechChange}
              options={techs.map((t) => ({ value: String(t.id), label: techOptionLabel(t) }))}
              placeholder="กรุณาเลือกช่างเทคนิค"
              searchable
              searchAlways
              allowClear={false}
            />
            {selectedTech && (
              <div className="mt-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-xs text-[#6B7280] font-medium">
                  กำลังบันทึกในนาม: <span className="font-bold text-[#1F2937]">{selectedTech.full_name}</span> ({teamName}) - 
                  {' '}{{ sales: 'เซล', technician: 'ช่าง Office', ma_technician: 'ช่าง MA', office_technician: 'ช่าง Office', contractor_office: 'รับเหมาติดตั้ง', contractor_ma: 'รับเหมา MA', admin: 'แอดมิน', super_admin: 'ผู้ดูแลระบบสูงสุด' }[selectedTech.role] || selectedTech.role || 'พนักงาน'}
                </p>
              </div>
            )}

            {/* Checkbox for Filling on Behalf */}
            {selectedTech && String(selectedTech.id) !== String(user?.id) && (
              <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                <label className="flex items-center gap-3 cursor-pointer group mb-3">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="peer appearance-none w-5 h-5 border-2 border-[#D1D5DB] rounded bg-white checked:bg-[#A3E635] checked:border-[#A3E635] transition-all"
                      checked={isFillOnBehalf}
                      onChange={(e) => {
                        setIsFillOnBehalf(e.target.checked);
                        if (!e.target.checked) setFillerId('');
                        else setFillerId(user?.id); // Default to current admin
                      }}
                    />
                    <svg className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-[#4B5563] group-hover:text-[#1F2937] transition-colors">
                    มีผู้ขับรถไปเติมน้ำมันแทนช่างคนนี้
                  </span>
                </label>

                {isFillOnBehalf && (
                  <div className="ml-8 mt-2">
                    <AppSelectField
                      label="เลือกผู้ไปเติมน้ำมันแทน"
                      value={String(fillerId || '')}
                      onChange={setFillerId}
                      options={techs.map((t) => ({ value: String(t.id), label: techOptionLabel(t) }))}
                      placeholder="กรุณาเลือกผู้ไปเติมแทน"
                      searchable
                      searchAlways
                      allowClear={false}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="border border-[#E5E7EB] rounded-2xl p-4 mb-8 flex items-center gap-4 bg-[#F9FAFB] shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-[#A3E635]/20 text-[#65a30d] flex items-center justify-center font-bold text-lg shrink-0 border border-[#A3E635]/30">
              {(user?.full_name || 'T')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-[#1F2937] truncate">{user?.full_name}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs font-black bg-[#E0F2FE] text-[#0369A1] px-2.5 py-0.5 rounded-lg truncate max-w-[120px] border border-[#BAE6FD] shadow-sm">{teamName}</span>
                <span className="text-xs font-medium text-[#4B5563] bg-white px-2.5 py-0.5 rounded-lg border border-[#E5E7EB] truncate shadow-sm">
                  {{
                    sales: 'เซล',
                    technician: 'ช่าง Office',
                    ma_technician: 'ช่าง MA',
                    office_technician: 'ช่าง Office',
                    contractor_office: 'รับเหมาติดตั้ง',
                    contractor_ma: 'รับเหมา MA',
                    admin: 'แอดมิน',
                    super_admin: 'ผู้ดูแลระบบสูงสุด',
                  }[user?.role] || user?.role || 'พนักงาน'}
                </span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vehicle Plate */}
          <AppSelectField
            label="ทะเบียนรถยนต์ / จักรยานยนต์"
            value={String(form.license_plate || '')}
            onChange={(v) => setForm((prev) => ({ ...prev, license_plate: v }))}
            options={plateOptions}
            placeholder="เลือกทะเบียนรถในระบบ"
            searchable
            searchAlways
            searchPlaceholder="ค้นหาทะเบียน / ชื่อทีม..."
            allowClear={false}
          />

          <div className="grid grid-cols-2 gap-5">
            {/* Date Time */}
            <div className="col-span-2 group relative z-50">
              <label className="block text-sm font-bold text-[#1F2937] mb-2">วันที่และเวลาเติมน้ำมัน</label>
              <DateTimePicker
                value={form.date_recorded}
                onChange={(newDate) => {
                  handleChange({
                    target: {
                      name: 'date_recorded',
                      value: newDate ? format(newDate, "yyyy-MM-dd'T'HH:mm") : ''
                    }
                  });
                }}
              />
            </div>

            {/* Liters */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-2">จำนวน (ลิตร)</label>
              <input
                required type="number" step="0.01"
                name="liters" value={form.liters} onChange={handleChange}
                className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] outline-none transition-all focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 font-medium text-[#1F2937] bg-white" 
                placeholder="0.00"
              />
            </div>
            {/* Price per Liter */}
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-2">ราคา/ลิตร (บาท)</label>
              <input
                required type="number" step="0.01"
                name="price_per_liter" value={form.price_per_liter} onChange={handleChange}
                className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] outline-none transition-all focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 font-medium text-[#1F2937] bg-white" 
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Mileage */}
          <div className={`p-4 rounded-xl border ${isTripMileage ? 'border-red-400 bg-red-50' : 'border-[#E5E7EB] bg-white'} transition-colors`}>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-[#1F2937]">เลขไมล์ปัจจุบัน (กม.)</label>
              {isAdmin && (
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="peer appearance-none w-4 h-4 border-2 border-red-300 rounded bg-white checked:bg-red-500 checked:border-red-500 transition-all"
                      checked={isTripMileage}
                      onChange={(e) => setIsTripMileage(e.target.checked)}
                    />
                    <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className={`text-xs font-bold ${isTripMileage ? 'text-red-600' : 'text-gray-500 group-hover:text-red-500'} transition-colors`}>
                    กรณีไมล์ทริป
                  </span>
                </label>
              )}
            </div>
            {isTripMileage && (
              <p className="text-xs text-red-500 font-bold mb-2">
                * เลขไมล์นี้จะไม่ถูกนำไปคำนวณอัตราสิ้นเปลือง แต่จะแสดงในประวัติ
              </p>
            )}
            <input
              required type="number"
              name="mileage" value={form.mileage} onChange={handleChange}
              className={`w-full px-4 py-3.5 rounded-xl border ${isTripMileage ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20 text-red-600' : 'border-[#E5E7EB] focus:border-[#A3E635] focus:ring-[#A3E635]/20 text-[#1F2937]'} outline-none transition-all focus:ring-2 font-mono font-bold tracking-wider bg-white`} 
              placeholder="0"
            />
          </div>

          {/* Total Price */}
          <div>
            <label className="block text-sm font-bold text-[#1F2937] mb-2">ราคารวมสุทธิ (บาท)</label>
            <input
              required type="number" step="1"
              name="total_price" value={form.total_price} onChange={handleChange}
              className="w-full px-4 py-4 rounded-xl border-2 border-[#1F2937] outline-none transition-all focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 font-black text-xl text-[#A3E635] bg-[#1F2937] placeholder-slate-500 shadow-inner" 
              placeholder="0"
            />
          </div>

          {/* Image Upload */}
          <div className="pt-4 border-t border-[#F3F4F6]">
            <label className="block text-sm font-bold text-[#1F2937] mb-3">แนบหลักฐาน (สูงสุด 5 รูป)</label>
            <div className="relative group">
              <div className="flex items-center justify-center w-full px-4 py-6 transition-all bg-[#F9FAFB] border-2 border-[#E5E7EB] border-dashed rounded-2xl group-hover:bg-white group-hover:border-[#A3E635] cursor-pointer">
                <div className="flex flex-col items-center space-y-2 text-center">
                  <svg className="w-8 h-8 text-[#9CA3AF] group-hover:text-[#A3E635] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-bold text-[#4B5563]">คลิกหรือลากไฟล์มาวางที่นี่</span>
                  <span className="text-xs font-medium text-[#9CA3AF]">รองรับ PNG, JPG, GIF</span>
                </div>
                <input 
                  type="file" 
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                />
              </div>
            </div>
            
            {images.length > 0 && (
              <div className="flex gap-3 mt-4 overflow-x-auto pb-2 px-1">
                {images.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-[#E5E7EB] shadow-sm group">
                    <img src={URL.createObjectURL(img)} alt="preview" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/90 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-colors backdrop-blur-sm opacity-0 group-hover:opacity-100 shadow-sm border border-white/20">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`pt-6 flex ${inline ? 'justify-end' : 'gap-4'}`}>
            {!inline && (
              <button 
                type="button" 
                onClick={onClose} 
                className="flex-1 py-4 rounded-2xl font-bold text-[#4B5563] bg-white border-2 border-[#E5E7EB] hover:bg-[#F9FAFB] hover:text-[#1F2937] transition-all active:scale-95 shadow-sm"
              >
                ยกเลิก
              </button>
            )}
            <button 
              type="submit" 
              disabled={loading} 
              className={`${inline ? 'w-full px-12' : 'flex-[1.5]'} py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(163,230,53,0.3)] active:scale-[0.98] ${loading ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-[#A3E635] text-[#1F2937] hover:bg-[#84CC16]'}`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-[#1F2937]/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  บันทึกข้อมูล
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
