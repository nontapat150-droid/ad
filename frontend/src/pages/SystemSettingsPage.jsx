import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { useBranding } from '../context/BrandingContext';
import { getImageUrl } from '../utils/imageUtils';

export default function SystemSettingsPage() {
  const navigate = useNavigate();
  const { branding, fetchBranding } = useBranding();

  const [brandingForm, setBrandingForm] = useState({
    website_name: '',
    logoFile: null,
    faviconFile: null
  });

  useEffect(() => {
    if (branding) {
      setBrandingForm(prev => ({
        ...prev,
        website_name: branding.website_name || ''
      }));
    }
  }, [branding]);

  const handleFileChange = (e, field) => {
    if (e.target.files && e.target.files[0]) {
      setBrandingForm({
        ...brandingForm,
        [field]: e.target.files[0]
      });
    }
  };

  const handleBrandingSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('website_name', brandingForm.website_name);
      if (brandingForm.logoFile) {
        formData.append('logo', brandingForm.logoFile);
      }
      if (brandingForm.faviconFile) {
        formData.append('favicon', brandingForm.faviconFile);
      }

      await api.post('/branding', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      Swal.fire('บันทึกสำเร็จ', 'อัปเดตการแสดงผลของระบบแล้ว', 'success');
      fetchBranding();
      
      setBrandingForm(prev => ({
        ...prev,
        logoFile: null,
        faviconFile: null
      }));
      
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.message || err.message, 'error');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto min-h-screen pt-24 animate-fade-in-up">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="bg-white hover:bg-slate-50 text-slate-700 p-3 rounded-2xl shadow-sm border border-slate-200 transition-all hover:shadow-md active:scale-95 flex items-center justify-center"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
        </button>
        <div>
          <h1 className="text-3xl font-black text-slate-800 drop-shadow-sm">ตั้งค่าระบบ</h1>
          <p className="text-slate-500 mt-2 font-medium">จัดการตั้งค่าการแสดงผล (Branding)</p>
        </div>
      </div>

      <div className="glass rounded-3xl p-6 md:p-8 shadow-xl border border-white/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 border-b border-slate-200/50 pb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            การแสดงผล (Branding)
          </h2>
        </div>
        <form onSubmit={handleBrandingSubmit} className="space-y-6 max-w-2xl">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อเว็บไซต์ (Website Name)</label>
            <input 
              type="text" 
              value={brandingForm.website_name}
              onChange={(e) => setBrandingForm({ ...brandingForm, website_name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-slate-700 bg-slate-50"
              placeholder="เช่น Bount ระบบจัดการงาน"
            />
            <p className="text-xs text-slate-500 mt-1">ชื่อนี้จะแสดงบนหัวเว็บและชื่อหน้าต่างเบราว์เซอร์</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">โลโก้หลัก (Main Logo)</label>
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => handleFileChange(e, 'logoFile')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
            />
            <p className="text-xs text-slate-500 mt-1">โลโก้นี้จะนำไปแสดงที่ Sidebar, หน้า Check-in และหน้า Login</p>
            {branding?.website_logo && !brandingForm.logoFile && (
              <div className="mt-2 p-2 bg-white rounded-lg border border-slate-100 inline-block shadow-sm">
                <img src={getImageUrl(branding.website_logo, 'branding')} alt="Current Logo" className="h-12 object-contain" />
              </div>
            )}
            {brandingForm.logoFile && (
              <div className="mt-2 text-sm text-brand-600 font-medium">ไฟล์ที่เลือก: {brandingForm.logoFile.name}</div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">ไอคอนแท็บเบราว์เซอร์ (Favicon)</label>
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => handleFileChange(e, 'faviconFile')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
            />
            <p className="text-xs text-slate-500 mt-1">โลโก้ขนาดเล็กสำหรับแสดงบนแท็บของเบราว์เซอร์ แนะนำให้เป็นรูปจัตุรัส</p>
            {branding?.website_favicon && !brandingForm.faviconFile && (
              <div className="mt-2 p-2 bg-white rounded-lg border border-slate-100 inline-block shadow-sm">
                <img src={getImageUrl(branding.website_favicon, 'branding')} alt="Current Favicon" className="h-8 object-contain" />
              </div>
            )}
            {brandingForm.faviconFile && (
              <div className="mt-2 text-sm text-brand-600 font-medium">ไฟล์ที่เลือก: {brandingForm.faviconFile.name}</div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <button type="submit" className="px-6 py-3 rounded-xl font-bold text-white bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/30 transition-all active:scale-95 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
              บันทึกการตั้งค่าการแสดงผล
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
