import { useState, useEffect } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { getImageUrl } from '../utils/imageUtils';
import { AppDateField, AppSelectField } from './DispatchFilterFields';

export default function EntryFeeEditModal({ record, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    access_no: '',
    customer_name: '',
    network_provider: 'AIS',
    fee_type: 'slip',
    backdate: '',
    target_user_id: '',
    admin_date: ''
  });
  
  const [existingImage, setExistingImage] = useState(null);
  const [newImage, setNewImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    if (record) {
      setFormData({
        access_no: record.access_no || '',
        customer_name: record.customer_name || '',
        network_provider: record.network_provider || 'AIS',
        fee_type: record.fee_type || 'slip',
        backdate: record.backdate ? record.backdate.split('T')[0] : '',
        target_user_id: record.created_by || '',
        admin_date: record.created_at ? record.created_at.split('T')[0] : ''
      });
      setExistingImage(record.image_path !== 'รับหน้างาน' ? record.image_path : null);
    }
    
    api.get('/users').then(res => {
      setUsersList(res.data);
    }).catch(console.error);
  }, [record]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setNewImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fd = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key]) {
          fd.append(key, formData[key]);
        }
      });
      
      if (newImage) {
        fd.append('image', newImage);
      }

      await api.put(`/dispatch/entry-fee/${record.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

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
        text: "คุณแน่ใจหรือไม่ที่จะลบรายการค่าแรกเข้านี้? การกระทำนี้ไม่สามารถย้อนกลับได้",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'ใช่, ลบเลย!',
        cancelButtonText: 'ยกเลิก'
      });

      if (result.isConfirmed) {
        setLoading(true);
        await api.delete(`/dispatch/entry-fee/${record.id}`);
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
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="text-xl">✏️</span> แก้ไขข้อมูลค่าแรกเข้า
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="editEntryFeeForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1.5">รหัสลูกค้า (NON) *</label>
                <input type="text" name="access_no" value={formData.access_no} onChange={handleChange} required className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/30 outline-none text-sm font-bold bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1.5">ชื่อลูกค้า *</label>
                <input type="text" name="customer_name" value={formData.customer_name} onChange={handleChange} required className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/30 outline-none text-sm font-bold bg-slate-50" />
              </div>
              <AppSelectField
                label="ผู้ให้บริการ"
                value={formData.network_provider}
                onChange={(v) => setFormData({ ...formData, network_provider: v })}
                options={[{ value: 'AIS', label: 'AIS' }, { value: '3BB', label: '3BB' }]}
                placeholder="เลือกผู้ให้บริการ"
                allowClear={false}
              />
              <AppSelectField
                label="ประเภทค่าแรกเข้า"
                value={formData.fee_type}
                onChange={(v) => setFormData({ ...formData, fee_type: v })}
                options={[
                  { value: 'slip', label: 'โอนเงิน (สลิป)' },
                  { value: 'cash', label: 'เงินสดหน้างาน' },
                  { value: 'backdate', label: 'ย้อนหลัง' },
                ]}
                placeholder="เลือกประเภท"
                allowClear={false}
              />

              {formData.fee_type === 'backdate' && (
                <AppDateField
                  label="วันที่ย้อนหลัง"
                  value={formData.backdate}
                  onChange={(v) => setFormData({ ...formData, backdate: v })}
                  allowClear={false}
                  showToday={false}
                />
              )}

              <AppSelectField
                label="ผู้บันทึก"
                value={String(formData.target_user_id || '')}
                onChange={(v) => setFormData({ ...formData, target_user_id: v })}
                options={usersList.map((u) => ({ value: String(u.id), label: u.full_name || u.username }))}
                placeholder="ไม่แก้ไข"
                searchable
              />

              <AppDateField
                label="วันที่บันทึก (แก้ไข)"
                value={formData.admin_date}
                onChange={(v) => setFormData({ ...formData, admin_date: v })}
              />
            </div>

            {(formData.fee_type === 'slip' || formData.fee_type === 'backdate') && (
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-sm font-bold text-[#042C53] mb-3">หลักฐาน (รูปภาพสลิป)</label>
                
                {existingImage && !newImage && (
                  <div className="mb-4">
                    {existingImage && existingImage !== 'รับหน้างาน' && (
                      <img src={getImageUrl(existingImage)} className="h-32 object-contain rounded-lg border border-slate-200 bg-slate-50 p-1" />
                    )}
                  </div>
                )}

                <div>
                  <p className="text-xs text-slate-500 mb-2">เปลี่ยนรูปภาพใหม่ (ไม่บังคับ)</p>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                  
                  {newImage && (
                    <div className="mt-3">
                      <img src={URL.createObjectURL(newImage)} className="h-32 object-contain rounded-lg border border-slate-200 bg-slate-50 p-1" />
                    </div>
                  )}
                </div>
              </div>
            )}
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
            <button type="submit" form="editEntryFeeForm" disabled={loading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold shadow-md transition-all active:scale-95 text-sm flex items-center gap-2">
              {loading ? 'กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
