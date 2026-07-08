import { useState, useEffect } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';

export default function TeamManagementModal({ onClose, refreshParent }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/teams');
      setTeams(res.data);
    } catch (err) {
      console.error(err);
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลทีมได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/users/teams', { team_name: newTeamName.trim() });
      setNewTeamName('');
      fetchTeams();
      refreshParent(); // Refresh the users table behind the modal
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', err.response?.data?.error || 'ไม่สามารถเพิ่มทีมได้', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeam = async (id, name, memberCount) => {
    if (memberCount > 0) {
      Swal.fire('คำเตือน', `ไม่สามารถลบทีม "${name}" ได้ เนื่องจากยังมีสมาชิกอยู่ในทีมจำนวน ${memberCount} คน`, 'warning');
      return;
    }

    const result = await Swal.fire({
      title: 'ยืนยันการลบทีม?',
      html: `คุณต้องการลบทีม <b>${name}</b> ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ใช่, ลบเลย',
      cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    setDeletingId(id);
    try {
      await api.delete(`/users/teams/${id}`);
      fetchTeams();
      refreshParent();
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.error || 'ไม่สามารถลบทีมได้', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditTeam = async (id, currentName) => {
    const { value: newName } = await Swal.fire({
      title: 'แก้ไขชื่อทีม',
      input: 'text',
      inputLabel: 'ชื่อทีมใหม่',
      inputValue: currentName,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      inputValidator: (value) => {
        if (!value.trim()) {
          return 'กรุณากรอกชื่อทีม';
        }
        if (value.trim() === currentName) {
          return 'ชื่อทีมไม่มีการเปลี่ยนแปลง';
        }
      }
    });

    if (newName) {
      try {
        await api.put(`/users/teams/${id}`, { team_name: newName.trim() });
        Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'แก้ไขชื่อทีมเรียบร้อยแล้ว', timer: 1500, showConfirmButton: false });
        fetchTeams();
        refreshParent();
      } catch (err) {
        Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.error || 'ไม่สามารถแก้ไขชื่อทีมได้', 'error');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-2xl flex flex-col bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white overflow-hidden max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200/50 bg-white/50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100 border border-white shadow-sm flex items-center justify-center text-2xl font-bold text-teal-600">
              🏢
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#042C53]">จัดการทีม</h2>
              <p className="text-sm font-bold text-slate-400 mt-0.5">เพิ่ม หรือ ลบทีมในระบบ</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-xl transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Add Team Form */}
        <div className="p-6 bg-slate-50/50 border-b border-slate-200/50 shrink-0">
          <form onSubmit={handleAddTeam} className="flex gap-3">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="กรอกชื่อทีมใหม่ เช่น ทีม กทม. 1"
              className="flex-1 px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={!newTeamName.trim() || submitting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold shadow-md shadow-teal-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {submitting ? 'กำลังเพิ่ม...' : '➕ เพิ่มทีม'}
            </button>
          </form>
        </div>

        {/* Teams List */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-200/50 animate-pulse rounded-2xl" />)}
            </div>
          ) : teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <span className="text-4xl mb-3 opacity-50">🏢</span>
              <p className="font-bold">ยังไม่มีข้อมูลทีมในระบบ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map(team => (
                <div key={team.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg">
                      👥
                    </div>
                    <div>
                      <h3 className="font-bold text-[#042C53] text-base">{team.team_name}</h3>
                      <p className="text-xs font-semibold text-slate-400 mt-0.5">
                        สมาชิกในทีม: <span className="text-teal-600">{team.member_count}</span> คน
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => handleEditTeam(team.id, team.team_name)}
                      className="p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-500 transition-all"
                      title="แก้ไขชื่อทีม"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(team.id, team.team_name, team.member_count)}
                      disabled={deletingId === team.id || team.member_count > 0}
                      className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title={team.member_count > 0 ? "ไม่สามารถลบทีมที่มีสมาชิกได้" : "ลบทีม"}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
