import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

export default function UserManagementPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null); // null = not editing, {} = new user, {...} = existing user
  const [deletingId, setDeletingId] = useState(null);

  const [activeTab, setActiveTab] = useState('users');
  const [lateTimes, setLateTimes] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/users/settings/late_time');
      setLateTimes(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, tRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/teams')
      ]);
      setUsers(uRes.data);
      setTeams(tRes.data);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, [fetchData, fetchSettings]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put('/users/settings/late_time', lateTimes);
      alert('บันทึกการตั้งค่าเวลาเรียบร้อย');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('คุณต้องการลบผู้ใช้นี้ใช่หรือไม่?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/users/${id}`);
      alert('ลบผู้ใช้เรียบร้อย');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'เกิดข้อผิดพลาดในการลบผู้ใช้');
    } finally {
      setDeletingId(null);
    }
  };

  const getRoleBadge = (role) => {
    const roles = {
      super_admin: { label: 'ผู้ดูแลระบบ', color: 'bg-purple-100 text-purple-700 border-purple-200' },
      admin: { label: 'แอดมิน', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
      technician: { label: 'ช่างoffice', color: 'bg-[#B5D4F4] text-[#0C447C] border-[#185FA5]/20' },
      ma_technician: { label: 'ช่างMA', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      sales: { label: 'เซล', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    };
    const r = roles[role] || { label: role, color: 'glass text-[#042C53] border-white/50' };
    return <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${r.color}`}>{r.label}</span>;
  };

  const getStatusBadge = (status) => {
    const statuses = {
      approved: { label: 'ใช้งานปกติ', color: 'text-emerald-500 bg-emerald-50 border-emerald-200' },
      pending: { label: 'รออนุมัติ', color: 'text-amber-500 bg-amber-50 border-amber-200' },
      rejected: { label: 'ถูกระงับ', color: 'text-red-500 bg-red-50 border-red-200' },
    };
    const s = statuses[status] || statuses.approved;
    return <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${s.color}`}>{s.label}</span>;
  };

  return (
    <Layout activeKey="users" pageTitle="จัดการผู้ใช้">
      <div className="flex flex-col gap-6 pb-12">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass p-5 rounded-3xl border border-white/50 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-[#042C53] flex items-center gap-2">
              <span className="text-indigo-500">👥</span> ระบบจัดการผู้ใช้
            </h1>
            <p className="text-sm text-[#378ADD] mt-1">เพิ่ม แก้ไข ลบบัญชี และตั้งค่าเวลาเข้างาน</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('users')}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >ผู้ใช้งาน</button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >เวลาเข้างาน</button>
            </div>
            {activeTab === 'users' && (
              <button
                onClick={() => setEditingUser({ username: '', full_name: '', password: '', role: 'technician', extra_roles: [], status: 'approved', team_id: '', allow_late_time: '08:30:00' })}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-transform flex items-center gap-2">
                <span>➕</span> เพิ่มผู้ใช้ใหม่
              </button>
            )}
          </div>
        </div>

        {activeTab === 'users' ? (
        <div className="glass p-5 rounded-3xl border border-white/50 shadow-sm overflow-hidden">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 w-full rounded-2xl" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/50 ">
                    <th className="p-4 text-xs font-bold text-[#378ADD] uppercase tracking-wider rounded-tl-xl">ผู้ใช้งาน</th>
                    <th className="p-4 text-xs font-bold text-[#378ADD] uppercase tracking-wider">บทบาท</th>
                    <th className="p-4 text-xs font-bold text-[#378ADD] uppercase tracking-wider">ทีม</th>
                    <th className="p-4 text-xs font-bold text-[#378ADD] uppercase tracking-wider">สถานะ</th>
                    <th className="p-4 text-xs font-bold text-[#378ADD] uppercase tracking-wider text-right rounded-tr-xl">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-white/30 hover:/80 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full glass flex items-center justify-center font-bold text-[#378ADD] border border-white/50">
                            {u.full_name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-[#042C53]">{u.full_name}</p>
                            <p className="text-xs text-[#378ADD] font-mono">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 flex flex-wrap gap-1 mt-2">{u.roles ? u.roles.map((r, idx) => <span key={idx}>{getRoleBadge(r)}</span>) : getRoleBadge(u.role)}</td>
                      <td className="p-4 text-sm font-semibold text-[#185FA5]">{u.team_name || '-'}</td>
                      <td className="p-4">{getStatusBadge(u.status)}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingUser({ ...u, password: '', extra_roles: u.roles ? u.roles.filter(r => r !== u.role) : [] })}
                            className="p-2 rounded-lg glass hover:bg-[#E6F1FB] text-[#185FA5] transition-colors"
                            title="แก้ไขข้อมูล">
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            disabled={deletingId === u.id || u.id === user.id}
                            className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors disabled:opacity-50"
                            title={u.id === user.id ? "ไม่สามารถลบตัวเองได้" : "ลบผู้ใช้"}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        ) : (
          <div className="glass p-5 rounded-3xl border border-white/50 shadow-sm">
            <h2 className="text-lg font-bold text-[#042C53] mb-4">ตั้งค่าเวลาเข้างานพื้นฐาน (สาย)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1">เวลาเข้างานทั่วไป (Global)</label>
                <ShadcnTimePicker value={lateTimes['late_time']} onChange={(v) => setLateTimes({...lateTimes, 'late_time': v})} placeholder="--:--" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1">เวลาเข้างาน ช่าง office</label>
                <ShadcnTimePicker value={lateTimes['late_time_technician']} onChange={(v) => setLateTimes({...lateTimes, 'late_time_technician': v})} placeholder="--:--" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1">เวลาเข้างาน ช่าง MA</label>
                <ShadcnTimePicker value={lateTimes['late_time_ma_technician']} onChange={(v) => setLateTimes({...lateTimes, 'late_time_ma_technician': v})} placeholder="--:--" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1">เวลาเข้างาน เซล</label>
                <ShadcnTimePicker value={lateTimes['late_time_sales']} onChange={(v) => setLateTimes({...lateTimes, 'late_time_sales': v})} placeholder="--:--" />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={handleSaveSettings} disabled={savingSettings} className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-md shadow-emerald-500/20 active:scale-95 transition-transform">
                {savingSettings ? 'กำลังบันทึก...' : '💾 บันทึกการตั้งค่า'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {editingUser && (
        <UserFormModal
          user={editingUser}
          teams={teams}
          onClose={() => setEditingUser(null)}
          onSuccess={fetchData}
        />
      )}
    </Layout>
  );
}

function UserFormModal({ user, teams, onClose, onSuccess }) {
  const isEdit = !!user.id;
  const [form, setForm] = useState(user);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    console.log('[DEBUG] Submitting form...', form);
    try {
      const payload = { ...form };
      if (payload.team_id === '') payload.team_id = null;

      if (isEdit) {
        if (!payload.password) delete payload.password; // Don't update password if empty
        // ensure extra_roles doesn't include the primary role
        if (payload.extra_roles) payload.extra_roles = payload.extra_roles.filter(r => r !== payload.role);
        console.log('[DEBUG] Updating existing user (PUT)', payload);
        const res = await api.put(`/users/${user.id}`, payload);
        console.log('[DEBUG] PUT response:', res.data);
      } else {
        if (payload.extra_roles) payload.extra_roles = payload.extra_roles.filter(r => r !== payload.role);
        console.log('[DEBUG] Creating new user (POST)', payload);
        const res = await api.post('/users', payload);
        console.log('[DEBUG] POST response:', res.data);
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('[DEBUG] Save error:', err);
      console.error('[DEBUG] Error response data:', err.response?.data);
      alert(`Error: ${err.response?.data?.error || err.response?.data?.message || err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet animate-[slideUp_0.3s_ease-out] relative max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#042C53]">
            {isEdit ? '✏️ แก้ไขข้อมูลผู้ใช้' : '➕ เพิ่มผู้ใช้ใหม่'}
          </h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg  hover:glass border border-white/50 flex items-center justify-center text-[#378ADD] opacity-80">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-[#042C53] mb-1">ชื่อผู้ใช้ (Username)</label>
              <input required name="username" value={form.username} onChange={handleChange} className="input-field" disabled={isEdit && user.username === 'admin'} />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#042C53] mb-1">รหัสผ่าน</label>
              <input type="password" required={!isEdit} name="password" value={form.password || ''} onChange={handleChange} className="input-field" placeholder={isEdit ? '(ปล่อยว่างถ้าไม่เปลี่ยน)' : 'ตั้งรหัสผ่าน'} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#042C53] mb-1">ชื่อ-นามสกุล</label>
            <input required name="full_name" value={form.full_name} onChange={handleChange} className="input-field" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-[#042C53] mb-1">บทบาท (Role)</label>
              <select name="role" value={form.role} onChange={handleChange} className="input-field glass">
                <option value="technician">ช่างoffice</option>
                <option value="ma_technician">ช่างMA</option>
                <option value="admin">แอดมิน</option>
                <option value="super_admin">ผู้ดูแลระบบ</option>
                <option value="sales">เซล</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#042C53] mb-1">สถานะ</label>
              <select name="status" value={form.status} onChange={handleChange} className="input-field glass">
                <option value="approved">ใช้งานปกติ</option>
                <option value="pending">รออนุมัติ</option>
                <option value="rejected">ระงับการใช้งาน</option>
              </select>
            </div>
          </div>

          <div className="bg-white/50 p-4 rounded-xl border border-white/60">
            <label className="block text-sm font-bold text-[#042C53] mb-3">บทบาทเพิ่มเติม (Extra Roles)</label>
            <div className="flex flex-wrap gap-3">
              {['technician', 'ma_technician', 'admin', 'super_admin', 'sales']
                .filter(r => r !== form.role)
                .map(r => {
                  const isChecked = (form.extra_roles || []).includes(r);
                  return (
                    <label 
                      key={r} 
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl cursor-pointer transition-all border ${
                        isChecked 
                          ? 'bg-[#E6F1FB] border-[#185FA5]/40 shadow-sm ring-1 ring-[#185FA5]/20 text-[#042C53]' 
                          : 'bg-white border-white hover:border-[#185FA5]/30 hover:bg-slate-50 shadow-sm text-slate-500'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setForm(prev => {
                            const current = prev.extra_roles || [];
                            return { 
                              ...prev, 
                              extra_roles: checked ? [...current, r] : current.filter(x => x !== r) 
                            };
                          });
                        }}
                        className="hidden"
                      />
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                        isChecked ? 'bg-[#185FA5] border-[#185FA5] scale-110 shadow-md shadow-blue-500/20' : 'bg-slate-100 border-slate-300'
                      }`}>
                        {isChecked && (
                          <svg className="w-3.5 h-3.5 text-white animate-[scaleIn_0.2s_ease-out]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm ${isChecked ? 'font-black text-[#185FA5]' : 'font-semibold'}`}>{
                        r === 'technician' ? 'ช่าง Office' :
                        r === 'ma_technician' ? 'ช่าง MA' :
                        r === 'admin' ? 'แอดมิน' :
                        r === 'super_admin' ? 'ผู้ดูแลระบบ' : 'เซล'
                      }</span>
                    </label>
                  );
                })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-[#042C53] mb-1">ทีม</label>
              <select name="team_id" value={form.team_id || ''} onChange={handleChange} className="input-field glass">
                <option value="">-- ไม่ระบุทีม --</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.team_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#042C53] mb-1">เวลาเข้างาน (เฉพาะบุคคล)</label>
              <ShadcnTimePicker value={form.allow_late_time} onChange={(v) => handleChange({ target: { name: 'allow_late_time', value: v }})} placeholder="ไม่ตั้งค่า (ใช้ตามบทบาท)" />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost h-12">ยกเลิก</button>
            <button type="submit" disabled={loading} className="flex-1 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-transform">
              {loading ? 'กำลังบันทึก...' : '💾 บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ShadcnTimePicker({ value, onChange, placeholder = "เลือกเวลา" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('30');
  
  const hourRef = useRef(null);
  const minRef = useRef(null);

  useEffect(() => {
    if (value) {
      setHour(value.split(':')[0]);
      setMinute(value.split(':')[1]);
    }
  }, [value]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const hEl = document.getElementById(`hour-${hour}`);
        const mEl = document.getElementById(`min-${minute}`);
        if (hEl && hourRef.current) hourRef.current.scrollTop = hEl.offsetTop - hourRef.current.offsetTop - 60;
        if (mEl && minRef.current) minRef.current.scrollTop = mEl.offsetTop - minRef.current.offsetTop - 60;
      }, 50);
    }
  }, [isOpen, hour, minute]);

  const handleSave = () => {
    onChange(`${hour}:${minute}:00`);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className="relative w-full">
      <style>{`.hide-scroll::-webkit-scrollbar { display: none; } .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 bg-white border ${isOpen ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'} rounded-xl shadow-sm text-sm font-bold text-[#042C53] transition-all`}
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {value ? `${hour}:${minute}` : placeholder}
        </div>
        {value && (
          <div onClick={handleClear} className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-2 w-full min-w-[240px] p-4 bg-white border border-slate-200 rounded-2xl shadow-xl animate-[slideDown_0.2s_ease-out]">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="flex-1 max-w-[100px]">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">ชั่วโมง</label>
                <div ref={hourRef} className="h-[160px] overflow-y-auto hide-scroll snap-y snap-mandatory border-y border-slate-100 relative">
                  {Array.from({length: 24}).map((_, i) => {
                    const val = i.toString().padStart(2, '0');
                    const isSelected = hour === val;
                    return (
                      <div 
                        id={`hour-${val}`}
                        key={val} 
                        onClick={() => setHour(val)}
                        className={`py-2 text-center text-lg cursor-pointer snap-center transition-colors ${isSelected ? 'font-black text-indigo-600 bg-indigo-50 rounded-lg' : 'font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                      >
                        {val}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="text-2xl text-slate-300 font-bold mb-4 px-2">:</div>
              <div className="flex-1 max-w-[100px]">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">นาที</label>
                <div ref={minRef} className="h-[160px] overflow-y-auto hide-scroll snap-y snap-mandatory border-y border-slate-100 relative">
                  {Array.from({length: 60}).map((_, i) => {
                    const val = i.toString().padStart(2, '0');
                    const isSelected = minute === val;
                    return (
                      <div 
                        id={`min-${val}`}
                        key={val} 
                        onClick={() => setMinute(val)}
                        className={`py-2 text-center text-lg cursor-pointer snap-center transition-colors ${isSelected ? 'font-black text-indigo-600 bg-indigo-50 rounded-lg' : 'font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                      >
                        {val}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <button type="button" onClick={handleSave} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 active:scale-[0.98] transition-all">
              💾 ยืนยันเวลา
            </button>
          </div>
        </>
      )}
    </div>
  );
}
