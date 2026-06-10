import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function OilRecordModal({ onClose, onSuccess, inline = false }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const [techs, setTechs] = useState([]);
  const [selectedTech, setSelectedTech] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      api.get('/users').then(res => {
        setTechs((res.data || []).filter(u => u.roles?.includes('technician') || u.role === 'technician' || u.role === 'ma_technician'));
      }).catch(console.error);
    }
  }, [isAdmin]);

  const activeUser = isAdmin && selectedTech ? selectedTech : user;
  const teamName = activeUser?.team_name || (activeUser?.team_id ? `ทีม ${activeUser.team_id}` : 'ไม่มีทีม');
  const userHasTeam = !!(activeUser?.team_name || activeUser?.team_id);
  
  const [form, setForm] = useState({ 
    tech_id: '',
    license_plate: user?.team_name || '', 
    liters: '', 
    price_per_liter: '', 
    mileage: '', 
    total_price: '' 
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleTechChange = (e) => {
    const tId = e.target.value;
    const tech = techs.find(t => String(t.id) === String(tId));
    setSelectedTech(tech || null);
    
    const techTeamName = tech ? (tech.team_name || (tech.team_id ? `ทีม ${tech.team_id}` : '')) : '';
    setForm(prev => ({
      ...prev,
      tech_id: tId,
      license_plate: techTeamName || prev.license_plate
    }));
  };

  useEffect(() => {
    if (!isAdmin && user) {
      const uTeamName = user.team_name || (user.team_id ? `ทีม ${user.team_id}` : '');
      if (uTeamName) {
        setForm(prev => ({ ...prev, license_plate: uTeamName }));
      }
    }
  }, [isAdmin, user]);



  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length > 5) return alert('อัปโหลดรูปภาพได้สูงสุด 5 รูป');
    
    setLoading(true);
    try {
      const formData = new FormData();
      Object.keys(form).forEach(key => formData.append(key, form[key]));
      images.forEach(img => formData.append('images', img));

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
          total_price: '' 
        });
        setImages([]);
      }
      
      onSuccess();
      if (!inline && onClose) onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
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
        if (l && p) next.total_price = (l * p).toFixed(2);
      }
      return next;
    });
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 5) {
      return alert('อัปโหลดรูปภาพได้สูงสุด 5 รูป');
    }
    setImages(prev => [...prev, ...files]);
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div 
      className={inline ? "w-full max-w-2xl mx-auto py-4 md:py-8 px-4" : "modal-overlay"} 
      onClick={(e) => !inline && e.target === e.currentTarget && onClose && onClose()}
    >
      <div className={`relative ${inline ? 'w-full bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200' : 'modal-sheet animate-[slideUp_0.3s_ease-out] max-h-[90vh] overflow-y-auto'}`}>
        
        {/* Mobile Handle */}
        {!inline && (
        <div className="md:hidden flex justify-center mb-6">
          <div className="w-10 h-1.5 rounded-full bg-[#E6F1FB]" />
        </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20 text-white shrink-0">
              ⛽
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#042C53] mb-0.5">บันทึกการเติมน้ำมัน</h2>
              <p className="text-sm text-[#378ADD]">กรอกข้อมูลให้ครบถ้วนเพื่อเบิกจ่าย</p>
            </div>
          </div>
          {!inline && (
          <button onClick={onClose} className="w-8 h-8 rounded-lg  hover:glass border border-white/50 flex items-center justify-center text-[#378ADD] opacity-80 hover:text-[#185FA5] transition-colors shadow-sm shrink-0">
            ✕
          </button>
          )}
        </div>

        {/* User Info (Read-only for tech, Dropdown for Admin) */}
        {isAdmin ? (
          <div className="mb-6">
            <label className="block text-sm font-bold text-[#042C53] mb-2">เลือกช่างเทคนิค</label>
            <select
              value={form.tech_id}
              onChange={handleTechChange}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53]"
              required
            >
              <option value="">-- กรุณาเลือกช่างเทคนิค --</option>
              {techs.map(t => (
                <option key={t.id} value={t.id}>{t.full_name} {t.team_name ? `(${t.team_name})` : ''}</option>
              ))}
            </select>
            {selectedTech && (
              <p className="text-xs text-[#378ADD] font-medium mt-2">กำลังบันทึกในนาม: {selectedTech.full_name} ({teamName})</p>
            )}
          </div>
        ) : (
          <div className="border border-white/50 rounded-2xl p-4 mb-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm shrink-0">
              {(user?.full_name || 'T')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#042C53] truncate">{user?.full_name}</p>
              <p className="text-xs text-[#378ADD] font-medium truncate">{teamName}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Vehicle Plate */}
          <div className="relative pt-2">
            <label className="floating-label">ทะเบียนรถยนต์ / จักรยานยนต์</label>
            <input
              required
              name="license_plate"
              value={form.license_plate}
              onChange={handleChange}
              disabled={userHasTeam}
              className={`input-field uppercase ${userHasTeam ? 'bg-slate-100 text-slate-500 cursor-not-allowed opacity-80' : ''}`}
              placeholder="เช่น กท 1234 หรือ 1กต 5678"
            />
            {userHasTeam && (
              <p className="text-xs text-brand-600 mt-1 font-medium bg-brand-50 inline-block px-2 py-0.5 rounded">🔒 ผูกกับทีมอัตโนมัติ ไม่สามารถเปลี่ยนได้</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Liters */}
            <div className="relative pt-2">
              <label className="floating-label">จำนวน (ลิตร)</label>
              <input
                required type="number" step="0.01"
                name="liters" value={form.liters} onChange={handleChange}
                className="input-field" placeholder="0.00"
              />
            </div>
            {/* Price per Liter */}
            <div className="relative pt-2">
              <label className="floating-label">ราคา/ลิตร (บาท)</label>
              <input
                required type="number" step="0.01"
                name="price_per_liter" value={form.price_per_liter} onChange={handleChange}
                className="input-field" placeholder="0.00"
              />
            </div>
          </div>

          {/* Mileage */}
          <div className="relative pt-2">
            <label className="floating-label">เลขไมล์ปัจจุบัน (กม.)</label>
            <input
              required type="number"
              name="mileage" value={form.mileage} onChange={handleChange}
              className="input-field font-mono font-bold tracking-wider text-[#185FA5]" placeholder="0"
            />
          </div>

          {/* Total Price */}
          <div className="relative pt-2">
            <label className="floating-label">ราคารวมสุทธิ (บาท)</label>
            <input
              required type="number" step="0.01"
              name="total_price" value={form.total_price} onChange={handleChange}
              className="input-field bg-amber-50 border-amber-200 text-amber-600 font-bold text-lg" placeholder="0.00"
            />
          </div>

          {/* Image Upload */}
          <div className="pt-2 border-t border-white/30">
            <label className="block text-sm font-bold text-[#042C53] mb-2">แนบหลักฐาน (สูงสุด 5 รูป)</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full text-sm text-[#378ADD] file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-600 hover:file:bg-amber-100 transition-colors"
            />
            {images.length > 0 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {images.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/50">
                    <img src={URL.createObjectURL(img)} alt="preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center text-xs hover:bg-red-500 transition-colors">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`pt-6 pb-2 flex ${inline ? 'justify-end' : 'gap-3'}`}>
            {!inline && <button type="button" onClick={onClose} className="flex-1 btn-ghost h-14">ยกเลิก</button>}
            <button type="submit" disabled={loading} className={`${inline ? 'w-full md:w-auto px-12' : 'flex-[1.5]'} h-14 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-transform`}>
              {loading ? 'กำลังบันทึก...' : '⛽ บันทึกข้อมูล'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
