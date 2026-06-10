import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

export default function ProfileModal({ open, onClose }) {
  const { user, updateUser } = useAuth();
  const [todayCheckin, setTodayCheckin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [passwords, setPasswords] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (open) {
      api.get('/checkin/today')
        .then(res => setTodayCheckin(res.data))
        .catch(err => console.error('Failed to fetch today checkin', err));
    } else {
      setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' });
    }
  }, [open]);

  if (!open) return null;

  const roles = user?.roles || [user?.role || ''];
  const isAdmin = roles.some((r) => ['super_admin', 'admin'].includes(r));
  const teamName = user?.team_name || (user?.team_id ? `ทีม ${user.team_id}` : 'ไม่มีทีม');
  const initials = (user?.full_name || 'T').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return Swal.fire('ข้อมูลไม่ถูกต้อง', 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน', 'error');
    }
    if (passwords.newPassword.length < 6) {
      return Swal.fire('ข้อมูลไม่ถูกต้อง', 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', 'error');
    }

    try {
      setLoading(true);
      await api.put('/auth/change-password', {
        oldPassword: passwords.oldPassword,
        newPassword: passwords.newPassword
      });
      Swal.fire('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว', 'success');
      setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.error || 'ไม่สามารถเปลี่ยนรหัสผ่านได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return Swal.fire('ข้อมูลไม่ถูกต้อง', 'กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น', 'error');
    }

    if (file.size > 5 * 1024 * 1024) {
      return Swal.fire('ข้อมูลไม่ถูกต้อง', 'ขนาดรูปภาพต้องไม่เกิน 5MB', 'error');
    }

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('image', file);

      const res = await api.put('/auth/profile-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      updateUser({ profile_image: res.data.profile_image });
      Swal.fire({
        title: 'สำเร็จ',
        text: 'อัปเดตรูปโปรไฟล์เรียบร้อยแล้ว',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.error || 'ไม่สามารถอัปเดตรูปโปรไฟล์ได้', 'error');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    return new Date(timeStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 bg-gradient-to-br from-[#185FA5] to-[#0C447C] text-white flex items-center gap-4 shrink-0">
          <div 
            onClick={() => !uploadingImage && fileInputRef.current?.click()}
            className="relative w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center font-bold text-2xl border border-white/30 shadow-inner cursor-pointer overflow-hidden group shrink-0"
          >
            {user?.profile_image ? (
              <img 
                src={`/uploads/profiles/${user.profile_image}`} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            ) : (
              initials
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingImage ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageChange} 
            accept="image/jpeg, image/png, image/webp" 
            className="hidden" 
          />
          <div>
            <h2 className="text-xl font-bold">{user?.full_name || 'ไม่ระบุชื่อ'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold bg-white/20 border border-white/30 rounded-md px-2 py-0.5">
                {isAdmin ? 'ผู้ดูแลระบบ' : 'พนักงานช่าง'}
              </span>
              <span className="text-sm opacity-90">{teamName}</span>
            </div>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* ข้อมูลเข้างานวันนี้ */}
          <div className="glass p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <h3 className="text-sm font-bold text-[#042C53] mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-[#E6F1FB] text-[#185FA5] flex items-center justify-center">🕒</span>
              การเข้างานวันนี้
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center">
                <span className="text-xs text-[#378ADD] font-medium mb-1">เวลาเข้างาน</span>
                <span className={`text-lg font-bold ${todayCheckin?.checkin_time ? (todayCheckin.is_late ? 'text-orange-500' : 'text-emerald-500') : 'text-slate-400'}`}>
                  {formatTime(todayCheckin?.checkin_time)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center">
                <span className="text-xs text-[#378ADD] font-medium mb-1">เวลาออกงาน</span>
                <span className={`text-lg font-bold ${todayCheckin?.checkout_time ? 'text-[#185FA5]' : 'text-slate-400'}`}>
                  {formatTime(todayCheckin?.checkout_time)}
                </span>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100 w-full" />

          {/* ฟอร์มแก้ไขรหัสผ่าน */}
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <h3 className="text-sm font-bold text-[#042C53] flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-[#E6F1FB] text-[#185FA5] flex items-center justify-center">🔒</span>
              จัดการรหัสผ่าน
            </h3>
            
            <div>
              <label className="block text-xs font-semibold text-[#042C53] mb-1">ชื่อผู้ใช้ (Username)</label>
              <input 
                type="text" 
                value={user?.username || ''} 
                disabled 
                className="input-field bg-slate-100 text-slate-500 cursor-not-allowed opacity-70"
              />
              <p className="text-[10px] text-[#378ADD] mt-1">ชื่อผู้ใช้ไม่สามารถแก้ไขได้</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#042C53] mb-1">รหัสผ่านเดิม</label>
              <input 
                type="password" 
                value={passwords.oldPassword}
                onChange={e => setPasswords({...passwords, oldPassword: e.target.value})}
                className="input-field"
                placeholder="กรอกรหัสผ่านเดิมของคุณ"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#042C53] mb-1">รหัสผ่านใหม่</label>
              <input 
                type="password" 
                value={passwords.newPassword}
                onChange={e => setPasswords({...passwords, newPassword: e.target.value})}
                className="input-field"
                placeholder="ตั้งรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#042C53] mb-1">ยืนยันรหัสผ่านใหม่</label>
              <input 
                type="password" 
                value={passwords.confirmPassword}
                onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})}
                className="input-field"
                placeholder="กรอกรหัสผ่านใหม่อีกครั้งให้ตรงกัน"
                required
                minLength={6}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading || !passwords.oldPassword || !passwords.newPassword || !passwords.confirmPassword}
              className="btn-primary w-full mt-2"
            >
              {loading ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
