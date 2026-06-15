import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { StatCard } from './SharedComponents';

const FEED_CONFIG = {
  oil:       { icon: '⛽', label: 'น้ำมัน',  color: 'bg-amber-100 text-amber-600',  dot: 'bg-amber-400' },
  entry_fee: { icon: '💰', label: 'แรกเข้า', color: 'bg-teal-100 text-teal-600',    dot: 'bg-teal-400' },
  checkin:   { icon: '📍', label: 'เช็คอิน', color: 'bg-violet-100 text-violet-600', dot: 'bg-violet-400' },
  job:       { icon: '📋', label: 'ผลงาน',   color: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-400' },
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return `${Math.floor(diff)} วินาทีที่แล้ว`;
  if (diff < 3600)  return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  return new Date(dateStr).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Section header helper ───────────────────────────────────────────────────
function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center text-sm shadow-md shadow-lime-500/20">
        {icon}
      </div>
      <h3 className="text-[#1F2937] font-bold text-base">{title}</h3>
    </div>
  );
}

export default function SuperAdminSection() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-2xl bg-[#F3F4F6]" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-36 rounded-2xl bg-[#F3F4F6]" />)}
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
        <SectionHeader icon="📊" title="ตัวชี้วัดหลัก (KPI)" />
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

        {/* Activity Feed */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden flex flex-col h-[480px]"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between shrink-0 bg-[#F9FAFB]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center shadow-md shadow-lime-500/20">
                <span className="text-[#1F2937] text-sm font-bold">⚡</span>
              </div>
              <div>
                <h2 className="text-[#1F2937] font-bold text-sm">Activity Feed</h2>
                <p className="text-[#9CA3AF] text-xs">การทำรายการล่าสุด</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>

          {/* Feed Items */}
          <div className="flex-1 overflow-hidden relative">
            {data?.feed?.length > 0 ? (
              <div className="absolute w-full animate-scroll-feed">
                <div className="divide-y divide-[#F3F4F6]">
                  {[...data.feed, ...data.feed].map((item, idx) => {
                    const cfg = FEED_CONFIG[item.type] || { icon: '📌', label: 'กิจกรรม', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' };
                    return (
                      <div
                        key={`feed-${item.type}-${item.id}-${idx}`}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F9FAFB] transition-colors"
                      >
                        <div className={`w-9 h-9 shrink-0 rounded-xl ${cfg.color} flex items-center justify-center text-base`}>
                          {cfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[#1F2937] text-sm font-medium">
                            <span className="font-bold">{item.user_name || 'ผู้ใช้'}</span>
                            {' '}
                            <span className="text-[#6B7280]">{item.action}</span>
                          </p>
                          <p className="text-[#9CA3AF] text-xs mt-0.5">{timeAgo(item.created_at)}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color} hidden sm:block`}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-14 h-14 bg-[#F3F4F6] rounded-2xl flex items-center justify-center text-3xl mb-3">📭</div>
                <p className="text-[#1F2937] font-bold text-sm">ยังไม่มีรายการล่าสุด</p>
                <p className="text-[#9CA3AF] text-xs mt-1">การทำรายการใหม่จะปรากฏที่นี่</p>
              </div>
            )}
          </div>
        </div>

        {/* User Online Status */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden flex flex-col h-[480px]"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center gap-3 shrink-0 bg-[#F9FAFB]">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20">
              <span className="text-white text-sm">👥</span>
            </div>
            <div>
              <h2 className="text-[#1F2937] font-bold text-sm">สถานะการทำงาน</h2>
              <p className="text-[#9CA3AF] text-xs">ผู้ใช้งานแยกตามทีม</p>
            </div>
          </div>
          {/* Status List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {Object.keys(onlineGroups).length > 0 ? (
              Object.entries(onlineGroups).map(([teamName, users]) => (
                <div key={teamName} className="bg-[#F9FAFB] rounded-xl p-4 border border-[#F3F4F6]">
                  <h3 className="font-bold text-[#1F2937] mb-3 flex items-center gap-2 text-sm">
                    <span className="w-2 h-4 rounded-full bg-[#A3E635]" />
                    {teamName}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {users.map(u => (
                      <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#A3E635]/40 transition-colors">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-full bg-[#F3F4F6] flex items-center justify-center text-sm font-bold text-[#374151] overflow-hidden">
                            {u.profile_image ? (
                              <img src={`http://localhost:3001/${u.profile_image.replace('../', '')}`}
                                className="w-full h-full object-cover" alt={u.full_name}
                                onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : u.full_name.charAt(0)}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${u.is_online ? 'bg-[#A3E635]' : 'bg-[#D1D5DB]'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#1F2937] truncate">{u.full_name}</p>
                          <p className={`text-[10px] ${u.is_online ? 'text-[#65a30d] font-medium' : 'text-[#9CA3AF]'}`}>
                            {u.is_online ? '● กำลังทำงาน' : '○ ออฟไลน์'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-[#9CA3AF] text-sm">ไม่มีข้อมูลผู้ใช้งาน</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
