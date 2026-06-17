import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { StatCard } from './SharedComponents';

const FEED_CONFIG = {
  oil:       { icon: '⛽', label: 'น้ำมัน',  color: 'bg-amber-100 text-amber-600',  dot: 'bg-amber-400' },
  entry_fee: { icon: '💰', label: 'แรกเข้า', color: 'bg-teal-100 text-teal-600',    dot: 'bg-teal-400' },
  checkin:   { icon: '📍', label: 'เช็คอิน', color: 'bg-violet-100 text-violet-600', dot: 'bg-violet-400' },
  job:       { icon: '📋', label: 'ผลงาน',   color: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-400' },
};

const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', bg: 'bg-[#1F2937]',     text: 'text-white'        },
  admin:       { label: 'Admin',       bg: 'bg-[#A3E635]',     text: 'text-[#1F2937]'    },
  ma:          { label: 'MA',          bg: 'bg-violet-100',    text: 'text-violet-700'   },
  technician:  { label: 'ช่าง',        bg: 'bg-sky-100',       text: 'text-sky-700'       },
  user:        { label: 'พนักงาน',     bg: 'bg-slate-100',     text: 'text-slate-600'     },
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

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return `${Math.floor(diff)} วินาทีที่แล้ว`;
  if (diff < 3600)  return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  return new Date(dateStr).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function timeOffline(dateStr) {
  if (!dateStr) return 'ไม่เคยเข้าใช้งาน';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return `ออฟไลน์ไปแล้ว ${Math.floor(diff)} วินาที`;
  if (diff < 3600)  return `ออฟไลน์ไปแล้ว ${Math.floor(diff / 60)} นาที`;
  if (diff < 86400) return `ออฟไลน์ไปแล้ว ${Math.floor(diff / 3600)} ชั่วโมง`;
  return `ออฟไลน์ไปแล้ว ${Math.floor(diff / 86400)} วัน`;
}

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center text-base shadow-md shadow-lime-500/20">
        {icon}
      </div>
      <h3 className="text-[#1F2937] font-black text-lg">{title}</h3>
    </div>
  );
}

export default function SuperAdminSection() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const feedRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();
    const speed = 20; // pixels per second

    const scroll = (time) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (!isHovered && feedRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
        if (scrollHeight > clientHeight) {
          if (scrollTop + clientHeight < scrollHeight - 1) {
            feedRef.current.scrollTop += speed * delta;
          } else {
            feedRef.current.scrollTop = 0;
          }
        }
      }
      animationFrameId = requestAnimationFrame(scroll);
    };

    animationFrameId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isHovered]);

  useEffect(() => {
    api.get('/stats/super-admin-dashboard')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const onlineGroups = data?.onlineStatus?.reduce((acc, curr) => {
    if (!acc[curr.team_name]) acc[curr.team_name] = [];
    acc[curr.team_name].push(curr);
    return acc;
  }, {}) || {};

  // Map each team to a consistent color
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
      <div className="h-28 rounded-3xl bg-[#F3F4F6]" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-36 rounded-3xl bg-[#F3F4F6]" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <style>{`
        @keyframes scroll-feed {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .animate-scroll-feed {
          animation: scroll-feed 30s linear infinite;
        }
        .animate-scroll-feed:hover { animation-play-state: paused; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── KPI Stats ── */}
      <div>
        <SectionHeader icon="📊" title="ภาพรวมระบบ" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="สินค้าในคลังทั้งหมด"
            value={Number(data?.summary?.totalInventory || 0).toLocaleString()}
            suffix="ชิ้น" gradient="from-[#374151] to-[#1F2937]" icon="📦" shadow="shadow-slate-500/20" />
          <StatCard title="ลูกค้า NON ทั้งหมด"
            value={Number(data?.summary?.totalNonCustomers || 0).toLocaleString()}
            suffix="ราย" gradient="from-violet-500 to-purple-700" icon="🏢" shadow="shadow-violet-500/20" />
          <StatCard title="บิลน้ำมันเดือนนี้"
            value={data?.summary?.monthlyOilBills || 0}
            suffix="บิล" gradient="from-amber-500 to-orange-500" icon="⛽" shadow="shadow-amber-500/20" />
          <StatCard title="ค่าแรกเข้าเดือนนี้"
            value={data?.summary?.monthlyEntryFees || 0}
            suffix="รายการ" gradient="from-teal-500 to-cyan-500" icon="💰" shadow="shadow-teal-500/20" />
        </div>
      </div>

      {/* ── Two Columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Activity Feed ── */}
        <div className="bg-white rounded-3xl border border-[#E5E7EB] overflow-hidden flex flex-col h-[480px] shadow-sm">
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#F3F4F6] flex items-center justify-between shrink-0 bg-[#F9FAFB]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center shadow-md shadow-lime-500/20">
                <span className="text-[#1F2937] text-lg font-black">⚡</span>
              </div>
              <div>
                <h2 className="text-[#1F2937] font-black text-base">Activity Feed</h2>
                <p className="text-[#6B7280] text-xs font-bold mt-0.5">การทำรายการล่าสุด</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>

          {/* Feed Items */}
          {/* Feed Items */}
          <div 
            ref={feedRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={() => setIsHovered(true)}
            onTouchEnd={() => setIsHovered(false)}
            className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-[#F9FAFB]"
          >
            {data?.feed?.length > 0 ? (
              data.feed.map((item, idx) => {
                const cfg = FEED_CONFIG[item.type] || { icon: '📌', label: 'กิจกรรม', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' };
                return (
                  <div
                    key={`feed-${item.type}-${item.id}-${idx}`}
                    className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-all hover:border-[#A3E635]/40"
                  >
                    <div className="relative shrink-0">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black overflow-hidden shadow-sm border border-black/5 relative ${cfg.color}`}>
                        <span className="absolute inset-0 flex items-center justify-center opacity-80">{item.user_name ? item.user_name.charAt(0) : cfg.icon}</span>
                        {item.profile_image && (
                          <img src={`/uploads/profiles/${item.profile_image.split('/').pop()}`}
                            className="w-full h-full object-cover absolute inset-0 z-10 bg-white" alt={item.user_name}
                            onError={(e) => { e.target.style.display = 'none'; }} />
                        )}
                      </div>
                      <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 flex items-center justify-center bg-white rounded-full border border-[#E5E7EB] shadow-sm text-[10px] z-20">
                        {cfg.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#1F2937] text-sm font-medium truncate">
                        <span className="font-black text-base">{item.user_name || 'ผู้ใช้'}</span>
                        {' '}
                        <span className="text-[#6B7280] font-bold">{item.action}</span>
                      </p>
                      <p className="text-[#9CA3AF] text-xs font-bold mt-1">{timeAgo(item.created_at)}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-lg ${cfg.color} border border-black/5 hidden sm:block shadow-sm`}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-16 h-16 bg-white shadow-sm border border-[#E5E7EB] rounded-full flex items-center justify-center text-3xl mb-4">📭</div>
                <p className="text-[#1F2937] font-black text-base">ยังไม่มีรายการล่าสุด</p>
                <p className="text-[#9CA3AF] text-xs font-bold mt-1">การทำรายการใหม่จะปรากฏที่นี่</p>
              </div>
            )}
          </div>
        </div>

        {/* ── User Online Status ── */}
        <div className="bg-white rounded-3xl border border-[#E5E7EB] overflow-hidden flex flex-col h-[480px] shadow-sm">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
  );
}
