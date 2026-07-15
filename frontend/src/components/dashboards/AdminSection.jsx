import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { StatCard, ShortcutBtn } from './SharedComponents';

const ROLE_CONFIG = {
  super_admin:   { label: 'ผู้ดูแลระบบ',  bg: 'bg-[#1F2937]',     text: 'text-white'        },
  admin:         { label: 'แอดมิน',      bg: 'bg-[#A3E635]',     text: 'text-[#1F2937]'    },
  ma_technician: { label: 'ช่าง MA',      bg: 'bg-violet-100',    text: 'text-violet-700'   },
  technician:    { label: 'ช่างติดตั้ง',  bg: 'bg-sky-100',       text: 'text-sky-700'      },
  sales:         { label: 'เซล',        bg: 'bg-pink-100',      text: 'text-pink-700'     },
  user:          { label: 'พนักงาน',     bg: 'bg-slate-100',     text: 'text-slate-600'    },
};

const TEAM_COLORS = [
  { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500',    border: 'border-blue-200' },
  { bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500',  border: 'border-violet-200' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   border: 'border-amber-200' },
  { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500',    border: 'border-rose-200' },
  { bg: 'bg-cyan-100',    text: 'text-cyan-700',    dot: 'bg-cyan-500',    border: 'border-cyan-200' },
  { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500',  border: 'border-orange-200' },
  { bg: 'bg-pink-100',    text: 'text-pink-700',    dot: 'bg-pink-500',    border: 'border-pink-200' },
];

function getRoleStyle(role) {
  return ROLE_CONFIG[role] || { label: role || 'พนักงาน', bg: 'bg-gray-100', text: 'text-gray-600' };
}

function RoleBadge({ role }) {
  const s = getRoleStyle(role);
  return (
    <span className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-md ${s.bg} ${s.text} shadow-sm border border-black/5`}>
      {s.label}
    </span>
  );
}

function timeOffline(dateStr) {
  if (!dateStr) return 'ไม่เคยเข้าใช้งาน';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return `ออฟไลน์ไปแล้ว ${Math.floor(diff)} วินาที`;
  if (diff < 3600)  return `ออฟไลน์ไปแล้ว ${Math.floor(diff / 60)} นาที`;
  if (diff < 86400) return `ออฟไลน์ไปแล้ว ${Math.floor(diff / 3600)} ชั่วโมง`;
  return `ออฟไลน์ไปแล้ว ${Math.floor(diff / 86400)} วัน`;
}

export default function AdminSection() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stats/admin-dashboard')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const onlineGroups = data?.onlineStatus?.reduce((acc, curr) => {
    if (!acc[curr.team_name]) acc[curr.team_name] = [];
    acc[curr.team_name].push(curr);
    return acc;
  }, {}) || {};

  const teamColorMap = {};
  let colorIdx = 0;
  if (data?.onlineStatus) {
    data.onlineStatus.forEach(u => {
      const key = u.team_name || '__none__';
      if (!teamColorMap[key]) {
        teamColorMap[key] = TEAM_COLORS[colorIdx % TEAM_COLORS.length];
        colorIdx++;
      }
    });
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-36 rounded-2xl bg-[#F3F4F6]" />)}
      </div>
      <div className="h-40 rounded-2xl bg-[#F3F4F6]" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* Section Title */}
      <div className="flex items-center gap-3 pb-3 border-b border-[#E5E7EB]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center shadow-md shadow-lime-500/20">
          <span className="text-[#1F2937] text-sm">👑</span>
        </div>
        <h2 className="text-[#1F2937] font-extrabold text-lg">แดชบอร์ดแอดมิน</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Stats + Shortcuts */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Stats */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#374151] to-[#1F2937] flex items-center justify-center shadow-md">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-[#1F2937] font-bold text-base">ยอดสรุปงานวันนี้</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatCard title="สินค้าในคลังทั้งหมด"
                value={Number(data?.summary?.totalInventory || 0).toLocaleString()}
                suffix="ชิ้น" gradient="from-[#374151] to-[#1F2937]" icon="📦" shadow="shadow-slate-500/20" />
              <StatCard title="งานยังไม่มอบหมาย"
                value={data?.summary?.unassignedToday || 0}
                suffix="งาน" gradient="from-rose-500 to-pink-600" icon="⚠️" shadow="shadow-rose-500/20"
                urgent={data?.summary?.unassignedToday > 0} />
              <StatCard title="งานติดตั้ง วันนี้"
                value={data?.summary?.officeAssignedToday || 0}
                suffix="งาน" gradient="from-[#374151] to-[#1F2937]" icon="🏢" shadow="shadow-slate-500/20" />
              <StatCard title="งาน MA วันนี้"
                value={data?.summary?.maAssignedToday || 0}
                suffix="งาน" gradient="from-emerald-500 to-teal-500" icon="🛠️" shadow="shadow-emerald-500/20" />
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center shadow-md shadow-lime-500/20">
                <svg className="w-3.5 h-3.5 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-[#1F2937] font-bold text-base">ทางลัดด่วน</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ShortcutBtn icon="📦" label="จัดการคลังสินค้า" sublabel="รับ-จ่ายสินค้า"
                onClick={() => navigate('/inventory')} gradient="from-[#374151] to-[#1F2937]" shadow="shadow-slate-500/25" />
              <ShortcutBtn icon="🛠️" label="จ่ายงาน MA" sublabel="มอบหมายงานช่าง"
                onClick={() => navigate('/jobs?tab=ma')} gradient="from-[#65a30d] to-[#A3E635]" shadow="shadow-lime-500/25" />
              <ShortcutBtn icon="🏢" label="จ่ายงานติดตั้ง" sublabel="มอบหมายงานออฟฟิศ"
                onClick={() => navigate('/jobs?tab=office')} gradient="from-emerald-500 to-teal-500" shadow="shadow-emerald-500/25" />
            </div>
          </div>
        </div>

        {/* Right: Announcements */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] h-full"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-sm shadow-md shadow-amber-500/20">
                📢
              </div>
              <h3 className="text-[#1F2937] font-bold text-base">ประกาศล่าสุด</h3>
            </div>
            {!data?.announcements || data.announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 bg-[#F3F4F6] rounded-2xl flex items-center justify-center text-3xl mb-3">🔔</div>
                <p className="text-[#9CA3AF] text-sm font-medium">ไม่มีประกาศในขณะนี้</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.announcements.map(ann => (
                  <div key={ann.id}
                    className="p-4 rounded-2xl bg-amber-50 border border-amber-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-start gap-2">
                      <span className="text-lg shrink-0">📋</span>
                      <div className="min-w-0">
                        <h4 className="font-bold text-amber-900 text-sm truncate">{ann.title}</h4>
                        <p className="text-xs text-amber-700 mt-1 line-clamp-3 whitespace-pre-wrap">{ann.content}</p>
                        <p className="text-[10px] text-amber-400 mt-2">
                          {new Date(ann.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── User Online Status ── */}
          <div className="bg-white rounded-3xl border border-[#E5E7EB] overflow-hidden flex flex-col h-[480px] shadow-sm mt-6">
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#F3F4F6] flex items-center gap-3 shrink-0 bg-[#F9FAFB]">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20">
                <span className="text-white text-lg">👥</span>
              </div>
              <div>
                <h2 className="text-[#1F2937] font-black text-base">สถานะการทำงาน</h2>
                <p className="text-[#6B7280] text-xs font-bold mt-0.5">ผู้ใช้งานแยกตามทีม</p>
              </div>
            </div>
            
            {/* Status List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar bg-[#F9FAFB]">
              {Object.keys(onlineGroups).length > 0 ? (
                Object.entries(onlineGroups).map(([teamName, users]) => {
                  const tc = teamColorMap[teamName === 'ไม่มีทีม' ? '__none__' : teamName];
                  return (
                    <div key={teamName} className={`bg-white rounded-2xl p-4 border ${tc?.border || 'border-[#E5E7EB]'} shadow-[0_2px_12px_rgba(0,0,0,0.03)]`}>
                      
                      {/* Team Header */}
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#F3F4F6]">
                        <h3 className="font-black text-[#1F2937] flex items-center gap-2 text-sm uppercase tracking-wide">
                          <span className={`w-3 h-3 rounded-full ${tc?.dot || 'bg-[#D1D5DB]'}`} />
                          {teamName}
                        </h3>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${tc?.bg || 'bg-gray-100'} ${tc?.text || 'text-gray-600'}`}>
                          {users.length} คน
                        </span>
                      </div>

                      {/* Users Grid */}
                      <div className="grid grid-cols-1 gap-3">
                        {users.map(u => {
                          const roles = u.roles_csv ? u.roles_csv.split(',') : [u.role];
                          return (
                            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#A3E635]/50 hover:shadow-sm transition-all group">
                              
                              {/* Avatar */}
                              <div className="relative shrink-0">
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black overflow-hidden shadow-sm transition-transform group-hover:scale-105 relative ${tc?.bg || 'bg-[#F3F4F6]'} ${tc?.text || 'text-[#374151]'}`}>
                                  <span className="absolute inset-0 flex items-center justify-center">{u.full_name.charAt(0)}</span>
                                  {u.profile_image && (
                                    <img src={`/uploads/profiles/${u.profile_image.split('/').pop()}`}
                                      className="w-full h-full object-cover absolute inset-0 z-10 bg-white" alt={u.full_name}
                                      onError={(e) => { e.target.style.display = 'none'; }} />
                                  )}
                                </div>
                                <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-[2.5px] border-white shadow-sm ${u.is_online ? 'bg-[#A3E635]' : 'bg-[#D1D5DB]'}`} />
                              </div>

                              {/* Info */}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-black text-[#1F2937] truncate leading-tight">{u.full_name}</p>
                                <p className={`text-[10px] ${u.is_online ? 'text-[#65a30d] font-bold' : 'text-[#9CA3AF] font-medium'}`}>
                                  {u.is_online ? '● กำลังใช้งาน' : `○ ${timeOffline(u.last_active)}`}
                                </p>
                                
                                {/* Multi-roles display */}
                                <div className="flex gap-1 flex-wrap mt-1">
                                  {roles.map(r => <RoleBadge key={r} role={r} />)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 bg-white shadow-sm border border-[#E5E7EB] rounded-full flex items-center justify-center text-3xl mb-4">👥</div>
                  <p className="text-[#1F2937] font-black text-base">ไม่มีข้อมูลผู้ใช้งาน</p>
                  <p className="text-[#9CA3AF] text-xs font-bold mt-1">ยังไม่มีผู้ใช้ออนไลน์หรือออฟไลน์</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
