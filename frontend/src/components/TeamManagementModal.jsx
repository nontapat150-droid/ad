import { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';

const TEAM_TYPE_META = {
  office_install: { label: 'ช่างติดตั้ง (สำนักงาน)', short: 'ติดตั้ง', oil: true, roles: ['technician'], tone: 'teal' },
  office_ma: { label: 'ช่าง MA (สำนักงาน)', short: 'MA', oil: true, roles: ['ma_technician'], tone: 'sky' },
  contractor_install: { label: 'รับเหมาติดตั้ง', short: 'รับเหมาติดตั้ง', oil: false, roles: ['contractor_office'], tone: 'amber' },
  contractor_ma: { label: 'รับเหมา MA', short: 'รับเหมา MA', oil: false, roles: ['contractor_ma'], tone: 'violet' },
};

const FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'office', label: 'สำนักงาน' },
  { key: 'contractor', label: 'รับเหมา' },
  { key: 'office_install', label: 'ติดตั้ง' },
  { key: 'office_ma', label: 'MA' },
  { key: 'contractor_install', label: 'รับเหมาติดตั้ง' },
  { key: 'contractor_ma', label: 'รับเหมา MA' },
];

function userRoles(u) {
  if (Array.isArray(u.roles) && u.roles.length) return u.roles;
  if (u.roles_csv) return String(u.roles_csv).split(',');
  return [u.role].filter(Boolean);
}

function userMatchesType(u, teamType) {
  const allowed = TEAM_TYPE_META[teamType]?.roles || [];
  return userRoles(u).some((r) => allowed.includes(r));
}

function toneClasses(tone) {
  const map = {
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
  };
  return map[tone] || map.teal;
}

const emptyForm = () => ({
  id: null,
  team_name: '',
  team_type: 'office_install',
  leader_user_id: '',
  member_ids: [],
  vehicle_plate: '',
  notes: '',
});

export default function TeamManagementModal({ onClose, refreshParent }) {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(null); // null = list mode
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [memberQuery, setMemberQuery] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [teamsRes, usersRes] = await Promise.all([
        api.get('/users/teams'),
        api.get('/users'),
      ]);
      setTeams(Array.isArray(teamsRes.data) ? teamsRes.data : []);
      setUsers(
        (Array.isArray(usersRes.data) ? usersRes.data : []).filter(
          (u) => u.status === 'approved' || !u.status
        )
      );
    } catch (err) {
      console.error(err);
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลทีมได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      const type = t.team_type || 'office_install';
      if (filter === 'all') return true;
      if (filter === 'office') return type.startsWith('office_');
      if (filter === 'contractor') return type.startsWith('contractor_');
      return type === filter;
    });
  }, [teams, filter]);

  const eligibleUsers = useMemo(() => {
    if (!form) return [];
    return users.filter((u) => userMatchesType(u, form.team_type));
  }, [users, form]);

  const memberCandidates = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    return eligibleUsers.filter((u) => {
      if (!q) return true;
      return (
        String(u.full_name || '').toLowerCase().includes(q) ||
        String(u.username || '').toLowerCase().includes(q)
      );
    });
  }, [eligibleUsers, memberQuery]);

  const openCreate = () => {
    setMemberQuery('');
    setForm(emptyForm());
  };

  const openEdit = (team) => {
    setMemberQuery('');
    setForm({
      id: team.id,
      team_name: team.team_name || '',
      team_type: team.team_type || 'office_install',
      leader_user_id: team.leader_user_id ? String(team.leader_user_id) : '',
      member_ids: Array.isArray(team.member_ids)
        ? team.member_ids.map(String)
        : (team.members || []).map((m) => String(m.id)),
      vehicle_plate: team.vehicle_plate || '',
      notes: team.notes || '',
    });
  };

  const toggleMember = (userId) => {
    const id = String(userId);
    setForm((prev) => {
      const has = prev.member_ids.includes(id);
      let member_ids = has
        ? prev.member_ids.filter((x) => x !== id)
        : [...prev.member_ids, id];
      // Keep leader in members
      if (prev.leader_user_id && !member_ids.includes(String(prev.leader_user_id))) {
        member_ids = [...member_ids, String(prev.leader_user_id)];
      }
      return { ...prev, member_ids };
    });
  };

  const setLeader = (userId) => {
    const id = userId ? String(userId) : '';
    setForm((prev) => {
      const member_ids = [...prev.member_ids];
      if (id && !member_ids.includes(id)) member_ids.push(id);
      return { ...prev, leader_user_id: id, member_ids };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form?.team_name?.trim()) {
      Swal.fire('แจ้งเตือน', 'กรุณากรอกชื่อทีม', 'warning');
      return;
    }
    if (!form.leader_user_id) {
      Swal.fire('แจ้งเตือน', 'กรุณาเลือกหัวหน้าทีม (Import จับจาก Username ของหัวหน้า)', 'warning');
      return;
    }

    setSubmitting(true);
    const payload = {
      team_name: form.team_name.trim(),
      team_type: form.team_type,
      leader_user_id: Number(form.leader_user_id),
      member_ids: form.member_ids.map(Number),
      vehicle_plate: form.vehicle_plate?.trim() || null,
      notes: form.notes?.trim() || null,
    };

    try {
      let res;
      if (form.id) {
        res = await api.put(`/users/teams/${form.id}`, payload);
      } else {
        res = await api.post('/users/teams', payload);
      }
      const synced = res?.data?.jobs_synced;
      const syncText =
        synced && (synced.office || synced.ma)
          ? ` · อัปเดตงานเปิดแล้ว (ติดตั้ง ${synced.office || 0} / MA ${synced.ma || 0})`
          : '';
      Swal.fire({
        icon: 'success',
        title: 'บันทึกแล้ว',
        text: `ทีมและหัวหน้าถูกบันทึกแล้ว${syncText} — งานจะตามหัวหน้าทีม · กระเป๋าแชร์ตามสมาชิก`,
        timer: 2200,
        showConfirmButton: false,
      });
      setForm(null);
      await fetchAll();
      refreshParent?.();
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', err.response?.data?.error || 'บันทึกไม่สำเร็จ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeam = async (team) => {
    if (Number(team.member_count) > 0) {
      Swal.fire(
        'คำเตือน',
        `ไม่สามารถลบทีม "${team.team_name}" ได้ เพราะยังมีสมาชิก ${team.member_count} คน`,
        'warning'
      );
      return;
    }
    const result = await Swal.fire({
      title: 'ยืนยันการลบทีม?',
      html: `ลบทีม <b>${team.team_name}</b> ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'ลบเลย',
      cancelButtonText: 'ยกเลิก',
    });
    if (!result.isConfirmed) return;

    setDeletingId(team.id);
    try {
      await api.delete(`/users/teams/${team.id}`);
      await fetchAll();
      refreshParent?.();
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.error || 'ลบไม่สำเร็จ', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const meta = form ? TEAM_TYPE_META[form.team_type] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl flex flex-col bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200/50 bg-white/60 flex justify-between items-start gap-3 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100 border border-white shadow-sm flex items-center justify-center text-2xl shrink-0">
              🏢
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-black text-[#042C53] truncate">
                {form ? (form.id ? 'แก้ไขทีม' : 'สร้างทีมใหม่') : 'จัดการทีมช่าง'}
              </h2>
              <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
                สำนักงานนับน้ำมัน · รับเหมาไม่นับ · แชร์กระเป๋าตามทีม · Import จับ Username หัวหน้าเท่านั้น
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-xl transition-colors shrink-0"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {form ? (
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* Type picker */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">ประเภททีม</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(TEAM_TYPE_META).map(([key, m]) => {
                  const active = form.team_type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          team_type: key,
                          leader_user_id: '',
                          member_ids: [],
                        }))
                      }
                      className={`text-left px-4 py-3 rounded-2xl border-2 transition-all ${
                        active
                          ? 'border-teal-500 bg-teal-50 shadow-sm'
                          : 'border-slate-100 bg-white hover:border-slate-200'
                      }`}
                    >
                      <div className="font-bold text-sm text-[#042C53]">{m.label}</div>
                      <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        {m.oil ? 'นับค่าน้ำมัน' : 'ไม่นับค่าน้ำมัน'} · แชร์กระเป๋าในทีม
                      </div>
                    </button>
                  );
                })}
              </div>
              {meta && (
                <div
                  className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${toneClasses(
                    meta.tone
                  )}`}
                >
                  {meta.oil ? '⛽ นับน้ำมัน' : '🚫 ไม่นับน้ำมัน'}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อทีม *</label>
                <input
                  type="text"
                  value={form.team_name}
                  onChange={(e) => setForm((p) => ({ ...p, team_name: e.target.value }))}
                  placeholder={meta?.oil ? 'เช่น ทีม กข-1234 / ทะเบียนรถ' : 'เช่น ทีม สมชาย'}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">ทะเบียนรถ (ถ้ามี)</label>
                <input
                  type="text"
                  value={form.vehicle_plate}
                  onChange={(e) => setForm((p) => ({ ...p, vehicle_plate: e.target.value }))}
                  placeholder="กข-1234"
                  className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                หัวหน้าทีม * <span className="text-slate-400 font-semibold">(Import จับจาก Username)</span>
              </label>
              <select
                value={form.leader_user_id}
                onChange={(e) => setLeader(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              >
                <option value="">— เลือกหัวหน้าทีม —</option>
                {eligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} — {u.full_name}
                    {u.team_id && Number(u.team_id) !== Number(form.id) ? ' (อยู่ทีมอื่น)' : ''}
                  </option>
                ))}
              </select>
              {eligibleUsers.length === 0 && (
                <p className="text-xs text-amber-600 font-semibold mt-1">
                  ยังไม่มีผู้ใช้บทบาทที่ตรงประเภทนี้
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                สมาชิกในทีม <span className="text-slate-400 font-semibold">(แชร์กระเป๋าช่าง)</span>
              </label>
              <input
                type="text"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="ค้นหาชื่อสมาชิก..."
                className="w-full px-4 py-2.5 mb-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
              <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-100 divide-y divide-slate-50 bg-slate-50/40">
                {memberCandidates.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400 font-semibold text-center">ไม่พบรายชื่อ</div>
                ) : (
                  memberCandidates.map((u) => {
                    const checked = form.member_ids.includes(String(u.id));
                    const isLeader = String(form.leader_user_id) === String(u.id);
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-white cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isLeader}
                          onChange={() => toggleMember(u.id)}
                          className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-sm font-bold text-slate-700 flex-1">{u.full_name}</span>
                        {isLeader && (
                          <span className="text-[10px] font-black uppercase tracking-wide text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                            หัวหน้า
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1.5">
                เลือกแล้ว {form.member_ids.length} คน · สมาชิกทีมเดียวกันแชร์กระเป๋าร่วมกัน · งานเปิดจะตามหัวหน้าทีมอัตโนมัติ
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">หมายเหตุ</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="เช่น โซนลาดพร้าว"
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
            </div>

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-[1.4] py-3 rounded-xl font-black text-white bg-gradient-to-r from-teal-500 to-emerald-600 shadow-md shadow-teal-500/20 disabled:opacity-50"
              >
                {submitting ? 'กำลังบันทึก...' : 'บันทึกทีม'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="px-5 sm:px-6 pt-4 pb-3 shrink-0 flex flex-wrap items-center gap-2 border-b border-slate-100">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    filter === f.key
                      ? 'bg-[#042C53] text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <button
                type="button"
                onClick={openCreate}
                className="ml-auto px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-sm font-bold shadow-md shadow-teal-500/20"
              >
                + สร้างทีม
              </button>
            </div>

            <div className="flex-1 p-5 sm:p-6 overflow-y-auto bg-slate-50/30">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-slate-200/50 animate-pulse rounded-2xl" />
                  ))}
                </div>
              ) : filteredTeams.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                  <span className="text-4xl mb-3 opacity-50">🏢</span>
                  <p className="font-bold">ยังไม่มีทีมในหมวดนี้</p>
                  <button
                    type="button"
                    onClick={openCreate}
                    className="mt-3 text-sm font-bold text-teal-600 hover:underline"
                  >
                    สร้างทีมแรก
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredTeams.map((team) => {
                    const m = TEAM_TYPE_META[team.team_type] || TEAM_TYPE_META.office_install;
                    return (
                      <div
                        key={team.id}
                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-black text-[#042C53] text-base truncate">
                              {team.team_name}
                            </h3>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${toneClasses(
                                  m.tone
                                )}`}
                              >
                                {m.short}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  Number(team.counts_for_oil) === 1
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-slate-50 text-slate-500 border-slate-100'
                                }`}
                              >
                                {Number(team.counts_for_oil) === 1 ? 'นับน้ำมัน' : 'ไม่นับน้ำมัน'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEdit(team)}
                              className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-500"
                              title="แก้ไข"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTeam(team)}
                              disabled={deletingId === team.id || Number(team.member_count) > 0}
                              className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 disabled:opacity-40"
                              title="ลบ"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 text-xs font-semibold text-slate-500 space-y-1.5">
                          <p>
                            ⭐ หัวหน้า:{' '}
                            <span className="text-[#042C53] font-bold">
                              {team.leader_username || team.leader_name ? (
                                <>
                                  @{team.leader_username || '-'}
                                  {team.leader_name ? (
                                    <span className="text-slate-500 font-semibold"> ({team.leader_name})</span>
                                  ) : null}
                                </>
                              ) : (
                                <span className="text-amber-600 font-semibold">ยังไม่ตั้ง — Import จะจับไม่ได้</span>
                              )}
                            </span>
                          </p>
                          <div>
                            <p className="mb-1">
                              👥 สมาชิกในทีม ({team.member_count || 0})
                              {team.vehicle_plate ? ` · ทะเบียน ${team.vehicle_plate}` : ''}
                            </p>
                            {(team.members || []).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {(team.members || []).map((mem) => {
                                  const isLeader = Number(mem.id) === Number(team.leader_user_id);
                                  return (
                                    <span
                                      key={mem.id}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                        isLeader
                                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                                          : 'bg-slate-50 text-slate-600 border-slate-100'
                                      }`}
                                    >
                                      {isLeader ? `★ ${mem.full_name}` : mem.full_name}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400">ยังไม่มีสมาชิก</p>
                            )}
                          </div>
                          <p className="text-[10px] text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-2 py-1.5 leading-relaxed">
                            🎒 แชร์กระเป๋าตามคนในทีมนี้ — สมาชิกเห็นของร่วมกันอัตโนมัติ
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
