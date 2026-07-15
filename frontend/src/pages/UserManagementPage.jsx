import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import TeamManagementModal from '../components/TeamManagementModal';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';

export default function UserManagementPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null); 
  const [deletingId, setDeletingId] = useState(null);

  const [activeTab, setActiveTab] = useState('users');
  const [isTeamModalOpen, setTeamModalOpen] = useState(false);
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
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' });
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
      Swal.fire({ icon: 'success', title: 'บันทึกการตั้งค่าเวลาเรียบร้อย', showConfirmButton: false, timer: 1500 });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบผู้ใช้?',
      text: 'คุณต้องการลบผู้ใช้นี้ออกจากระบบใช่หรือไม่?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9CA3AF',
      cancelButtonText: 'ยกเลิก',
      confirmButtonText: 'ใช่, ลบเลย'
    });

    if (!result.isConfirmed) return;

    setDeletingId(id);
    try {
      await api.delete(`/users/${id}`);
      Swal.fire({ icon: 'success', title: 'ลบผู้ใช้เรียบร้อยแล้ว', showConfirmButton: false, timer: 1500 });
      fetchData();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการลบผู้ใช้' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddTeam = () => {
    setTeamModalOpen(true);
  };

  const getRoleBadge = (role) => {
    const roles = {
      super_admin: { label: 'ผู้ดูแลระบบ', color: 'bg-purple-50 text-purple-600 border-purple-200' },
      admin: { label: 'แอดมิน', color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
      technician: { label: 'ช่างติดตั้ง', color: 'bg-blue-50 text-blue-600 border-blue-200' },
      ma_technician: { label: 'ช่าง MA', color: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
      contractor_office: { label: 'รับเหมาติดตั้ง', color: 'bg-sky-50 text-sky-600 border-sky-200' },
      contractor_ma: { label: 'รับเหมา MA', color: 'bg-teal-50 text-teal-600 border-teal-200' },
      sales: { label: 'เซล', color: 'bg-amber-50 text-amber-600 border-amber-200' },
    };
    const r = roles[role] || { label: role, color: 'bg-slate-100 text-slate-600 border-slate-200' };
    return <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${r.color}`}>{r.label}</span>;
  };

  const getStatusBadge = (status) => {
    const statuses = {
      approved: { label: 'ใช้งานปกติ', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
      pending: { label: 'รออนุมัติ', color: 'text-amber-600 bg-amber-50 border-amber-200' },
      rejected: { label: 'ถูกระงับ', color: 'text-red-600 bg-red-50 border-red-200' },
    };
    const s = statuses[status] || statuses.approved;
    return <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${s.color}`}>{s.label}</span>;
  };

  return (
    <div className="flex h-screen bg-[#F9FAFB] text-[#1F2937] font-sans overflow-hidden selection:bg-[#A3E635] selection:text-[#1F2937]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="users" />

      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 md:ml-[280px]">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-[#E5E7EB] flex-shrink-0 z-10">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(true)} className="md:hidden w-11 h-11 flex items-center justify-center rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] text-[#1F2937] hover:bg-[#F3F4F6] transition-colors active:scale-95">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-black text-[#1F2937] tracking-tight">ระบบจัดการผู้ใช้</h1>
                <p className="text-sm font-medium text-[#9CA3AF] hidden sm:block">เพิ่ม แก้ไข ลบบัญชี และตั้งค่าเวลาเข้างาน</p>
              </div>
            </div>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 sm:p-2 rounded-2xl border border-[#E5E7EB] shadow-sm">
              <div className="flex bg-[#F3F4F6] p-1.5 rounded-xl w-full sm:w-auto">
                <button 
                  onClick={() => setActiveTab('users')}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white shadow-sm text-[#1F2937]' : 'text-[#6B7280] hover:text-[#4B5563]'}`}
                >ผู้ใช้งาน</button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-white shadow-sm text-[#1F2937]' : 'text-[#6B7280] hover:text-[#4B5563]'}`}
                >เวลาเข้างาน</button>
              </div>

              {activeTab === 'users' && (
                <div className="flex gap-3 w-full sm:w-auto px-2 pb-2 sm:p-0 sm:pr-2">
                  <button
                    onClick={handleAddTeam}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold transition-all border-2 border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB] active:scale-95 shadow-sm flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    จัดการทีม
                  </button>
                  <button
                    onClick={() => setEditingUser({ username: '', full_name: '', password: '', role: 'technician', extra_roles: [], status: 'approved', team_id: '', allow_late_time: '08:30:00' })}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-black transition-all flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(163,230,53,0.3)] active:scale-95 bg-[#A3E635] text-[#1F2937] hover:bg-[#84CC16]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    <span className="hidden sm:inline">เพิ่มผู้ใช้ใหม่</span>
                  </button>
                </div>
              )}
            </div>

            {/* Content Area */}
            {activeTab === 'users' ? (
              <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden animate-[slideUp_0.3s_ease-out]">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <svg className="animate-spin h-10 w-10 text-[#A3E635]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="text-sm font-bold text-[#9CA3AF]">กำลังโหลดข้อมูล...</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                          <th className="p-5 text-xs font-black text-[#6B7280] uppercase tracking-wider">ผู้ใช้งาน</th>
                          <th className="p-5 text-xs font-black text-[#6B7280] uppercase tracking-wider">บทบาท</th>
                          <th className="p-5 text-xs font-black text-[#6B7280] uppercase tracking-wider">ทีม</th>
                          <th className="p-5 text-xs font-black text-[#6B7280] uppercase tracking-wider">สถานะ</th>
                          <th className="p-5 text-xs font-black text-[#6B7280] uppercase tracking-wider text-right">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-[#F9FAFB] transition-colors group">
                            <td className="p-5">
                              <div className="flex items-center gap-4">
                                <div className="relative shrink-0">
                                  <div className="w-12 h-12 rounded-2xl bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center font-black text-lg text-[#1F2937] overflow-hidden group-hover:bg-white group-hover:border-[#A3E635] transition-all shadow-sm relative">
                                    <span className="absolute inset-0 flex items-center justify-center">{u.full_name[0]}</span>
                                    {u.profile_image && (
                                      <img src={`/uploads/profiles/${u.profile_image.split('/').pop()}`}
                                        className="w-full h-full object-cover absolute inset-0 z-10 bg-white" alt={u.full_name}
                                        onError={(e) => { e.target.style.display = 'none'; }} />
                                    )}
                                  </div>
                                  <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-[2.5px] border-white shadow-sm z-20 ${u.is_online ? 'bg-[#A3E635]' : 'bg-[#D1D5DB]'}`} title={u.is_online ? 'กำลังใช้งาน' : 'ออฟไลน์'} />
                                </div>
                                <div>
                                  <p className="font-bold text-[#1F2937] text-base">{u.full_name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs font-medium text-[#6B7280] bg-[#E5E7EB]/50 inline-block px-2 py-0.5 rounded-md">@{u.username}</p>
                                    <p className={`text-[10px] ${u.is_online ? 'text-[#65a30d] font-bold' : 'text-[#9CA3AF] font-medium'}`}>
                                      {u.is_online ? '● กำลังใช้งาน' : '○ ออฟไลน์'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-5">
                              <div className="flex flex-wrap gap-2 items-center min-h-[3rem]">
                                {u.roles ? u.roles.map((r, idx) => <span key={idx}>{getRoleBadge(r)}</span>) : getRoleBadge(u.role)}
                              </div>
                            </td>
                            <td className="p-5">
                              {u.team_name ? (
                                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1F2937] px-3 py-1.5 bg-[#F3F4F6] rounded-xl border border-[#E5E7EB]">
                                  🏢 {u.team_name}
                                </span>
                              ) : (
                                <span className="text-sm font-medium text-[#9CA3AF]">-</span>
                              )}
                            </td>
                            <td className="p-5">{getStatusBadge(u.status)}</td>
                            <td className="p-5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingUser({ ...u, password: '', extra_roles: u.roles ? u.roles.filter(r => r !== u.role) : [] })}
                                  className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors shadow-sm border border-blue-100"
                                  title="แก้ไขข้อมูล">
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button
                                  onClick={() => handleDelete(u.id)}
                                  disabled={deletingId === u.id || u.id === user.id}
                                  className="w-10 h-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors disabled:opacity-50 shadow-sm border border-red-100"
                                  title={u.id === user.id ? "ไม่สามารถลบตัวเองได้" : "ลบผู้ใช้"}>
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
              <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6 sm:p-8 animate-[slideUp_0.3s_ease-out]">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[#E5E7EB]">
                  <div className="w-12 h-12 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center shadow-inner">
                    <svg className="w-6 h-6 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-[#1F2937]">ตั้งค่าเวลาเข้างานพื้นฐาน (สาย)</h2>
                    <p className="text-sm font-medium text-[#6B7280]">กำหนดเวลาสายสำหรับแต่ละบทบาท</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-[#F9FAFB] p-5 rounded-2xl border border-[#E5E7EB]">
                    <label className="block text-sm font-bold text-[#1F2937] mb-3">ทั่วไป (Global)</label>
                    <ShadcnTimePicker value={lateTimes['late_time']} onChange={(v) => setLateTimes({...lateTimes, 'late_time': v})} placeholder="--:--" />
                  </div>
                  <div className="bg-[#F9FAFB] p-5 rounded-2xl border border-[#E5E7EB]">
                    <label className="block text-sm font-bold text-[#1F2937] mb-3">ช่างติดตั้ง</label>
                    <ShadcnTimePicker value={lateTimes['late_time_technician']} onChange={(v) => setLateTimes({...lateTimes, 'late_time_technician': v})} placeholder="--:--" />
                  </div>
                  <div className="bg-[#F9FAFB] p-5 rounded-2xl border border-[#E5E7EB]">
                    <label className="block text-sm font-bold text-[#1F2937] mb-3">ช่าง MA</label>
                    <ShadcnTimePicker value={lateTimes['late_time_ma_technician']} onChange={(v) => setLateTimes({...lateTimes, 'late_time_ma_technician': v})} placeholder="--:--" />
                  </div>
                  <div className="bg-[#F9FAFB] p-5 rounded-2xl border border-[#E5E7EB]">
                    <label className="block text-sm font-bold text-[#1F2937] mb-3">เซล (Sales)</label>
                    <ShadcnTimePicker value={lateTimes['late_time_sales']} onChange={(v) => setLateTimes({...lateTimes, 'late_time_sales': v})} placeholder="--:--" />
                  </div>
                </div>
                
                <div className="flex justify-end pt-6 border-t border-[#E5E7EB]">
                  <button 
                    onClick={handleSaveSettings} 
                    disabled={savingSettings} 
                    className={`px-8 py-3.5 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(163,230,53,0.3)] active:scale-[0.98] ${savingSettings ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-[#A3E635] text-[#1F2937] hover:bg-[#84CC16]'}`}
                  >
                    {savingSettings ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-[#1F2937]/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        กำลังบันทึก...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        บันทึกการตั้งค่า
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      {editingUser && (
        <UserFormModal
          user={editingUser}
          teams={teams}
          onClose={() => setEditingUser(null)}
          onSuccess={fetchData}
        />
      )}
      {isTeamModalOpen && (
        <TeamManagementModal 
          onClose={() => setTeamModalOpen(false)} 
          refreshParent={fetchData} 
        />
      )}
    </div>
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
    try {
      const payload = { ...form };
      if (payload.team_id === '') payload.team_id = null;

      if (isEdit) {
        if (!payload.password) delete payload.password;
        if (payload.extra_roles) payload.extra_roles = payload.extra_roles.filter(r => r !== payload.role);
        await api.put(`/users/${user.id}`, payload);
      } else {
        if (payload.extra_roles) payload.extra_roles = payload.extra_roles.filter(r => r !== payload.role);
        await api.post('/users', payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || err.message || 'ไม่สามารถบันทึกข้อมูลได้' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F2937]/80 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl bg-white rounded-3xl p-6 md:p-8 shadow-2xl border border-[#E5E7EB] animate-[slideUp_0.3s_ease-out] max-h-[90vh] overflow-y-auto">
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#1F2937] flex items-center justify-center shadow-inner shrink-0">
              <svg className="w-6 h-6 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <div>
              <h2 className="text-xl font-black text-[#1F2937] tracking-tight">
                {isEdit ? 'แก้ไขข้อมูลผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
              </h2>
              <p className="text-sm font-medium text-[#6B7280]">กรอกข้อมูลผู้ใช้งานและกำหนดสิทธิ์</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center text-[#9CA3AF] hover:text-[#1F2937] hover:bg-[#F3F4F6] transition-colors shadow-sm shrink-0 active:scale-95">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-2">ชื่อผู้ใช้ (Username) <span className="text-red-500">*</span></label>
              <input 
                required name="username" value={form.username} onChange={handleChange} 
                disabled={isEdit && user.username === 'admin'}
                className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] outline-none transition-all focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 font-medium text-[#1F2937] bg-white disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]" 
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-2">รหัสผ่าน {isEdit ? '' : <span className="text-red-500">*</span>}</label>
              <input 
                type="password" required={!isEdit} name="password" value={form.password || ''} onChange={handleChange} 
                placeholder={isEdit ? '(ปล่อยว่างถ้าไม่เปลี่ยน)' : 'ตั้งรหัสผ่าน'}
                className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] outline-none transition-all focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 font-medium text-[#1F2937] bg-white" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#1F2937] mb-2">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
            <input 
              required name="full_name" value={form.full_name} onChange={handleChange} 
              className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] outline-none transition-all focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 font-medium text-[#1F2937] bg-white" 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-2">บทบาทหลัก (Role)</label>
              <select name="role" value={form.role} onChange={handleChange} className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] outline-none transition-all focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 font-bold text-[#1F2937] bg-[#F9FAFB] hover:bg-white appearance-none">
                <option value="technician">ช่างติดตั้ง</option>
                <option value="ma_technician">ช่าง MA</option>
                <option value="contractor_office">รับเหมาติดตั้ง</option>
                <option value="contractor_ma">รับเหมา MA</option>
                <option value="admin">แอดมิน</option>
                <option value="super_admin">ผู้ดูแลระบบสูงสุด</option>
                <option value="sales">เซล</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-2">สถานะ</label>
              <select name="status" value={form.status} onChange={handleChange} className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] outline-none transition-all focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 font-bold text-[#1F2937] bg-[#F9FAFB] hover:bg-white appearance-none">
                <option value="approved">ใช้งานปกติ</option>
                <option value="pending">รออนุมัติ</option>
                <option value="rejected">ระงับการใช้งาน</option>
              </select>
            </div>
          </div>

          <div className="bg-[#F9FAFB] p-5 rounded-2xl border border-[#E5E7EB]">
            <label className="block text-sm font-bold text-[#1F2937] mb-3">บทบาทเพิ่มเติม (Extra Roles)</label>
            <div className="flex flex-wrap gap-3">
              {['technician', 'ma_technician', 'contractor_office', 'contractor_ma', 'admin', 'super_admin', 'sales']
                .filter(r => r !== form.role)
                .map(r => {
                  const isChecked = (form.extra_roles || []).includes(r);
                  return (
                    <label 
                      key={r} 
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl cursor-pointer transition-all border ${
                        isChecked 
                          ? 'bg-white border-[#A3E635] shadow-sm ring-1 ring-[#A3E635]/50' 
                          : 'bg-white border-[#E5E7EB] hover:border-[#1F2937]/30 shadow-sm'
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
                        isChecked ? 'bg-[#A3E635] border-[#A3E635] shadow-sm' : 'bg-[#F3F4F6] border-[#E5E7EB]'
                      }`}>
                        {isChecked && (
                          <svg className="w-3.5 h-3.5 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm ${isChecked ? 'font-black text-[#1F2937]' : 'font-bold text-[#4B5563]'}`}>{
                        r === 'technician' ? 'ช่างติดตั้ง' :
                        r === 'ma_technician' ? 'ช่าง MA' :
                        r === 'contractor_office' ? 'รับเหมาติดตั้ง' :
                        r === 'contractor_ma' ? 'รับเหมา MA' :
                        r === 'admin' ? 'แอดมิน' :
                        r === 'super_admin' ? 'ผู้ดูแลระบบ' : 'เซล'
                      }</span>
                    </label>
                  );
                })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-2">ทีมสังกัด</label>
              <select name="team_id" value={form.team_id || ''} onChange={handleChange} className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] outline-none transition-all focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 font-bold text-[#1F2937] bg-[#F9FAFB] hover:bg-white appearance-none">
                <option value="">-- ไม่ระบุทีม --</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.team_name}</option>
                ))}
              </select>
            </div>
            <div className="relative z-40">
              <label className="block text-sm font-bold text-[#1F2937] mb-2">เวลาเข้างาน (เฉพาะบุคคล)</label>
              <ShadcnTimePicker value={form.allow_late_time} onChange={(v) => handleChange({ target: { name: 'allow_late_time', value: v }})} placeholder="ไม่ตั้งค่า (ใช้ตามบทบาท)" />
            </div>
          </div>

          <div className="pt-6 flex gap-4 border-t border-[#F3F4F6]">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-4 rounded-2xl font-bold text-[#4B5563] bg-white border-2 border-[#E5E7EB] hover:bg-[#F9FAFB] hover:text-[#1F2937] transition-all active:scale-95 shadow-sm"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className={`flex-[1.5] py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(163,230,53,0.3)] active:scale-[0.98] ${loading ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-[#A3E635] text-[#1F2937] hover:bg-[#84CC16]'}`}
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
        className={`w-full flex items-center justify-between px-4 py-3.5 bg-white border ${isOpen ? 'border-[#A3E635] ring-4 ring-[#A3E635]/20' : 'border-[#E5E7EB] hover:border-[#D1D5DB]'} rounded-xl shadow-sm text-sm font-bold text-[#1F2937] transition-all`}
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {value ? `${hour}:${minute}` : <span className="text-[#9CA3AF]">{placeholder}</span>}
        </div>
        {value && (
          <div onClick={handleClear} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#4B5563] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-2 w-full min-w-[240px] p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl animate-[slideDown_0.2s_ease-out]">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="flex-1 max-w-[100px]">
                <label className="block text-xs font-black text-[#9CA3AF] uppercase tracking-wider mb-2 text-center">ชั่วโมง</label>
                <div ref={hourRef} className="h-[160px] overflow-y-auto hide-scroll snap-y snap-mandatory border-y border-[#F3F4F6] relative">
                  {Array.from({length: 24}).map((_, i) => {
                    const val = i.toString().padStart(2, '0');
                    const isSelected = hour === val;
                    return (
                      <div 
                        id={`hour-${val}`}
                        key={val} 
                        onClick={() => setHour(val)}
                        className={`py-2 text-center text-lg cursor-pointer snap-center transition-colors ${isSelected ? 'font-black text-[#1F2937] bg-[#A3E635] rounded-xl shadow-sm' : 'font-bold text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F9FAFB] rounded-xl'}`}
                      >
                        {val}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="text-2xl text-[#D1D5DB] font-black mb-4 px-2">:</div>
              <div className="flex-1 max-w-[100px]">
                <label className="block text-xs font-black text-[#9CA3AF] uppercase tracking-wider mb-2 text-center">นาที</label>
                <div ref={minRef} className="h-[160px] overflow-y-auto hide-scroll snap-y snap-mandatory border-y border-[#F3F4F6] relative">
                  {Array.from({length: 60}).map((_, i) => {
                    const val = i.toString().padStart(2, '0');
                    const isSelected = minute === val;
                    return (
                      <div 
                        id={`min-${val}`}
                        key={val} 
                        onClick={() => setMinute(val)}
                        className={`py-2 text-center text-lg cursor-pointer snap-center transition-colors ${isSelected ? 'font-black text-[#1F2937] bg-[#A3E635] rounded-xl shadow-sm' : 'font-bold text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F9FAFB] rounded-xl'}`}
                      >
                        {val}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <button type="button" onClick={handleSave} className="w-full py-3.5 bg-[#1F2937] hover:bg-black text-[#A3E635] rounded-xl text-sm font-black shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              ยืนยันเวลา
            </button>
          </div>
        </>
      )}
    </div>
  );
}
