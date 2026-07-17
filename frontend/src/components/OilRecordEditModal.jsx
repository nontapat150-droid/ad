import { useState, useEffect } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { getImageUrl } from '../utils/imageUtils';
import ImageWithFallback from './common/ImageWithFallback';
import { useAuth } from '../context/AuthContext';
import { DateTimePicker } from './DateTimePicker';
import { format } from 'date-fns';
import { AppSelectField } from './DispatchFilterFields';

export default function OilRecordEditModal({ record, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    date_recorded: '',
    tech_id: '',
    license_plate: '',
    mileage: '',
    liters: '',
    total_price: '',
  });
  
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [isTripMileage, setIsTripMileage] = useState(false);

  useEffect(() => {
    if (record) {
      // Ensure local datetime format YYYY-MM-DDTHH:mm
      const localDate = new Date(record.date_recorded);
      const tzOffset = localDate.getTimezoneOffset() * 60000;
      const localISOTime = new Date(localDate.getTime() - tzOffset).toISOString().slice(0, 16);

      setFormData({
        date_recorded: localISOTime,
        tech_id: record.tech_id || '',
        license_plate: record.license_plate || '',
        mileage: record.mileage || '',
        liters: record.liters || '',
        total_price: record.total_price || '',
      });
      setExistingImages(record.images || []);
      setIsTripMileage(record.is_trip === 1 || record.is_trip === true || record.is_trip === 'true');
    }
    
    // Fetch users for the dropdown
    api.get('/users').then(res => {
      setUsersList(res.data);
    }).catch(console.error);
  }, [record]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Auto-update license plate when tech changes
      if (name === 'tech_id') {
        const selectedUser = usersList.find(u => u.id.toString() === value);
        if (selectedUser && selectedUser.team_name) {
          newData.license_plate = selectedUser.team_name;
        }
      }
      
      return newData;
    });
  };

  const handleRemoveExistingImage = (img) => {
    setExistingImages(existingImages.filter(i => i !== img));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setNewImages([...newImages, ...files]);
  };

  const handleRemoveNewImage = (index) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fd = new FormData();
      Object.keys(formData).forEach(key => {
        fd.append(key, formData[key]);
      });
      
      // existing images that are kept
      fd.append('existing_images', JSON.stringify(existingImages));
      
      newImages.forEach(file => {
        fd.append('images', file);
      });

      if (isAdmin) {
        fd.append('is_trip', isTripMileage ? 'true' : 'false');
      }

      await api.put(`/oil/records/${record.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Recalculate
      await api.post('/oil/recalculate');

      Swal.fire({ icon: 'success', title: 'อัปเดตข้อมูลสำเร็จ', showConfirmButton: false, timer: 1500 });
      onSuccess();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || 'ไม่สามารถบันทึกได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const result = await Swal.fire({
        title: 'ยืนยันการลบ?',
        text: "คุณแน่ใจหรือไม่ที่จะลบรายการเติมน้ำมันนี้? การกระทำนี้ไม่สามารถย้อนกลับได้",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'ใช่, ลบเลย!',
        cancelButtonText: 'ยกเลิก'
      });

      if (result.isConfirmed) {
        setLoading(true);
        await api.delete(`/oil/records/${record.id}`);
        await api.post('/oil/recalculate');
        Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', showConfirmButton: false, timer: 1500 });
        onSuccess();
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || 'ไม่สามารถลบได้' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease-out] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#185FA5] to-[#0C447C] text-white flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="text-xl">✏️</span> แก้ไขข้อมูลการเติมน้ำมัน
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="editOilForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1.5">วันที่/เวลา *</label>
                <DateTimePicker
                  value={formData.date_recorded ? new Date(formData.date_recorded) : null}
                  onChange={(d) => setFormData({
                    ...formData,
                    date_recorded: d ? format(d, "yyyy-MM-dd'T'HH:mm") : '',
                  })}
                  placeholder="เลือกวันและเวลา"
                />
              </div>
              <AppSelectField
                label="ช่างผู้เบิก"
                value={String(formData.tech_id || '')}
                onChange={(v) => setFormData({ ...formData, tech_id: v })}
                options={usersList.map((u) => ({ value: String(u.id), label: u.full_name }))}
                placeholder="เลือกช่าง"
                searchable
                allowClear={false}
              />
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1.5">ทะเบียนรถ *</label>
                <input type="text" name="license_plate" value={formData.license_plate} onChange={handleChange} required className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#185FA5]/30 outline-none text-sm font-bold text-[#042C53] bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1.5">เลขไมล์ *</label>
                <input type="number" name="mileage" value={formData.mileage} onChange={handleChange} required className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#185FA5]/30 outline-none text-sm font-bold text-[#042C53] bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1.5">จำนวนลิตร *</label>
                <input type="number" step="0.01" name="liters" value={formData.liters} onChange={handleChange} required className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#185FA5]/30 outline-none text-sm font-bold text-[#042C53] bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1.5">ยอดรวม (บาท) *</label>
                <input type="number" step="0.01" name="total_price" value={formData.total_price} onChange={handleChange} required className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#185FA5]/30 outline-none text-sm font-bold text-[#042C53] bg-slate-50" />
              </div>
            </div>

            {isAdmin && (
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="relative flex items-center pt-0.5">
                    <input 
                      type="checkbox" 
                      checked={isTripMileage}
                      onChange={(e) => setIsTripMileage(e.target.checked)}
                      className="w-5 h-5 text-[#185FA5] border-gray-300 rounded focus:ring-[#185FA5] transition-all cursor-pointer"
                    />
                  </div>
                  <div>
                    <span className="font-bold text-[#1F2937] block">บันทึกเป็นไมล์ทริป (Trip Mileage)</span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      * เลขไมล์นี้จะไม่ถูกนำไปคำนวณอัตราสิ้นเปลือง แต่จะแสดงในประวัติ
                    </span>
                  </div>
                </label>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 mt-4">
              <label className="block text-sm font-bold text-[#042C53] mb-3">หลักฐาน รูปภาพ</label>
              
              {/* Existing Images */}
              {existingImages.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">รูปภาพเดิม</p>
                  <div className="flex gap-2 flex-wrap">
                    {existingImages.map((img, i) => (
                      <div key={i} className="relative group">
                        <ImageWithFallback img={img} defaultFolder="oil_receipts" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                        <button type="button" onClick={() => handleRemoveExistingImage(img)} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md hover:scale-110 transition-transform">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Images */}
              <div>
                <p className="text-xs text-slate-500 mb-2">เพิ่มรูปภาพใหม่</p>
                <input type="file" multiple accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                
                {newImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-3">
                    {newImages.map((file, i) => (
                      <div key={i} className="relative group">
                        <img src={URL.createObjectURL(file)} className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                        <button type="button" onClick={() => handleRemoveNewImage(i)} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md hover:scale-110 transition-transform">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-between shrink-0">
          <button type="button" onClick={handleDelete} disabled={loading} className="px-5 py-2.5 rounded-xl font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors text-sm flex items-center gap-1">
            🗑️ ลบรายการ
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-sm">
              ยกเลิก
            </button>
            <button type="submit" form="editOilForm" disabled={loading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold shadow-md transition-all active:scale-95 text-sm flex items-center gap-2">
              {loading ? 'กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
