import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api/axios';

const FEED_CONFIG = {
  oil:       { icon: '⛽', color: 'from-amber-400 to-orange-500',   shadow: 'shadow-amber-500/20',   label: 'น้ำมัน' },
  entry_fee: { icon: '💰', color: 'from-teal-400 to-cyan-500',      shadow: 'shadow-teal-500/20',    label: 'ค่าแรกเข้า' },
  checkin:   { icon: '📍', color: 'from-indigo-400 to-violet-500',  shadow: 'shadow-indigo-500/20',  label: 'เช็คอิน' },
  job:       { icon: '✅', color: 'from-emerald-400 to-teal-500',   shadow: 'shadow-emerald-500/20', label: 'ปิดงาน' },
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return `${Math.floor(diff)} วินาทีที่แล้ว`;
  if (diff < 3600) return `${Math.floor(diff/60)} นาทีที่แล้ว`;
  if (diff < 86400)return `${Math.floor(diff/3600)} ชั่วโมงที่แล้ว`;
  return new Date(dateStr).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const response = await api.get('/stats/super-admin-dashboard');
      setData(response.data);
    } catch (err) {
      console.error('Fetch dashboard failed', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => fetchDashboardData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const todayDate = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const onlineGroups = data?.onlineStatus?.reduce((acc, curr) => {
    if (!acc[curr.team_name]) acc[curr.team_name] = [];
    acc[curr.team_name].push(curr);
    return acc;
  }, {}) || {};

  return (
    <div className="flex min-h-screen font-sans overflow-hidden"
      style={{ background: 'var(--page-bg)', backgroundAttachment: 'fixed' }}>
      <style>{`
        @keyframes scroll-feed {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .animate-scroll-feed {
          animation: scroll-feed 30s linear infinite;
        }
        .animate-scroll-feed:hover {
          animation-play-state: paused;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="super_admin_dashboard" />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 h-16 backdrop-blur-xl border-b border-white/50 shadow-sm shrink-0"
          style={{ background: 'rgba(255,255,255,0.80)' }}>
          <button onClick={() => setSidebarOpen(true)}
            className="md:hidden flex flex-col items-center justify-center gap-[5px] w-10 h-10 rounded-xl glass border border-white/50 transition-all active:scale-95">
            <span className="block w-[18px] h-[2px] rounded-full bg-slate-600" />
            <span className="block w-[18px] h-[2px] rounded-full bg-slate-600" />
            <span className="block w-[18px] h-[2px] rounded-full bg-slate-600" />
          </button>
          <div className="flex-1 flex items-center gap-2">
            <h2 className="text-[#042C53] font-bold text-lg">ภาพรวมระบบ</h2>
            {/* Live indicator */}
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-[#185FA5] hover:text-[#0C447C] font-semibold bg-[#E6F1FB] hover:bg-[#B5D4F4] px-3 py-1.5 rounded-lg border border-[#185FA5]/20 transition-all disabled:opacity-50">
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'กำลังโหลด...' : 'รีเฟรช'}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full space-y-6">

            {/* ── Hero Banner ── */}
            <div className="relative overflow-hidden rounded-3xl p-6 md:p-8"
              style={{ background: 'linear-gradient(135deg, #1a0533 0%, #3b0764 30%, #6b21a8 65%, #9333ea 100%)' }}>
              {/* Decorative elements */}
              <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-10 bg-white blur-3xl pointer-events-none" />
              <div className="absolute left-1/3 -bottom-20 w-48 h-48 rounded-full opacity-10 bg-purple-300 blur-3xl pointer-events-none" />
              <div className="absolute right-24 bottom-4 opacity-5 text-[120px] pointer-events-none select-none">👑</div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-white/10 border border-white/20 text-purple-200 text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
                      Super Admin
                    </span>
                    <span className="bg-white/10 border border-white/20 text-purple-200 text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
                      Full Access
                    </span>
                  </div>
                  <p className="text-purple-300 text-sm font-medium mb-1">{todayDate}</p>
                  <h1 className="text-white text-2xl md:text-3xl font-bold leading-snug">
                    👑 ภาพรวมระบบทั้งหมด
                  </h1>
                  <p className="text-purple-300 text-sm mt-2">สรุปข้อมูลสถิติและการทำรายการล่าสุดของระบบ</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <QuickActionBtn icon="👥" label="จัดการผู้ใช้" onClick={() => navigate('/users')} />
                  <QuickActionBtn icon="📦" label="คลังสินค้า"   onClick={() => navigate('/inventory')} />
                  <QuickActionBtn icon="🛠️" label="จ่ายงาน"     onClick={() => navigate('/jobs')} />
                  <QuickActionBtn icon="📊" label="รายงาน MA"   onClick={() => navigate('/ma-performance')} />
                </div>
              </div>
            </div>

            {loading && !data ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-36 rounded-3xl" />)}
              </div>
            ) : (
              <>
                {/* ── KPI Stats ── */}
                <div>
                  <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center shadow-md shadow-purple-500/20">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    ตัวชี้วัดหลัก (KPI)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      title="สินค้าในคลังทั้งหมด"
                      value={Number(data?.summary?.totalInventory || 0).toLocaleString()}
                      suffix="ชิ้น"
                      gradient="from-slate-600 to-slate-800"
                      icon="📦"
                      shadow="shadow-slate-500/20"
                    />
                    <StatCard
                      title="ลูกค้า NON ทั้งหมด"
                      value={Number(data?.summary?.totalNonCustomers || 0).toLocaleString()}
                      suffix="ราย"
                      gradient="from-purple-500 to-violet-700"
                      icon="🏢"
                      shadow="shadow-purple-500/20"
                    />
                    <StatCard
                      title="บิลน้ำมันเดือนนี้"
                      value={data?.summary?.monthlyOilBills || 0}
                      suffix="บิล"
                      gradient="from-amber-500 to-orange-600"
                      icon="⛽"
                      shadow="shadow-amber-500/20"
                    />
                    <StatCard
                      title="ค่าแรกเข้าเดือนนี้"
                      value={data?.summary?.monthlyEntryFees || 0}
                      suffix="รายการ"
                      gradient="from-teal-500 to-cyan-600"
                      icon="💰"
                      shadow="shadow-teal-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* ── Activity Feed ── */}
                  <div className="glass rounded-3xl border border-white/50 shadow-sm overflow-hidden flex flex-col h-[500px]">
                    {/* Feed Header */}
                    <div className="px-6 py-4 border-b border-white/30 flex items-center justify-between shrink-0"
                      style={{ background: 'rgba(255,255,255,0.4)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
                          <span className="text-white text-xs">⚡</span>
                        </div>
                        <div>
                          <h2 className="text-[#042C53] font-bold text-base">Activity Feed</h2>
                          <p className="text-[#378ADD] text-xs">การทำรายการล่าสุดในระบบ</p>
                        </div>
                      </div>
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        LIVE FEED
                      </span>
                    </div>

                    {/* Feed Items Container */}
                    <div className="flex-1 overflow-hidden relative">
                      {data?.feed?.length > 0 ? (
                        <div className="absolute w-full animate-scroll-feed">
                          <div className="divide-y divide-white/20">
                            {[...data.feed, ...data.feed].map((item, idx) => {
                              const cfg = FEED_CONFIG[item.type] || { icon: '📌', color: 'from-slate-400 to-slate-500', shadow: 'shadow-slate-400/20', label: 'กิจกรรม' };
                              return (
                                <div
                                  key={`feed-${item.type}-${item.id}-${idx}`}
                                  className="flex items-center gap-4 px-6 py-4 hover:bg-white/30 transition-colors group"
                                >
                                  {/* Icon */}
                                  <div className={`w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br ${cfg.color} flex items-center justify-center text-lg shadow-lg ${cfg.shadow} group-hover:scale-110 transition-transform duration-200`}>
                                    {cfg.icon}
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[#042C53] text-sm font-medium">
                                      <span className="font-bold">{item.user_name || 'ผู้ใช้'}</span>
                                      {' '}
                                      <span className="text-[#378ADD]">{item.action}</span>
                                    </p>
                                    <p className="text-[#378ADD] text-xs mt-0.5">{timeAgo(item.created_at)}</p>
                                  </div>

                                  {/* Badge */}
                                  <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-gradient-to-br ${cfg.color} text-white shadow-sm hidden sm:block`}>
                                    {cfg.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                          <div className="w-16 h-16 bg-[#E6F1FB] rounded-2xl flex items-center justify-center text-3xl mb-3 shadow-inner">📭</div>
                          <p className="text-[#042C53] font-bold">ยังไม่มีรายการล่าสุด</p>
                          <p className="text-[#378ADD] text-sm mt-1">การทำรายการใหม่จะปรากฏที่นี่</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── User Online Status ── */}
                  <div className="glass rounded-3xl border border-white/50 shadow-sm overflow-hidden flex flex-col h-[500px]">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-white/30 flex items-center justify-between shrink-0" style={{ background: 'rgba(255,255,255,0.4)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
                          <span className="text-white text-xs">👥</span>
                        </div>
                        <div>
                          <h2 className="text-[#042C53] font-bold text-base">สถานะการทำงาน</h2>
                          <p className="text-[#378ADD] text-xs">ผู้ใช้งานแยกตามทีม</p>
                        </div>
                      </div>
                    </div>
                    {/* Status List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                      {Object.keys(onlineGroups).length > 0 ? (
                        Object.entries(onlineGroups).map(([teamName, users]) => (
                          <div key={teamName} className="bg-white/40 rounded-2xl p-4 border border-white/50">
                            <h3 className="font-bold text-[#042C53] mb-3 flex items-center gap-2 text-sm">
                              <span className="w-2 h-4 rounded-full bg-indigo-400" />
                              {teamName}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {users.map(u => (
                                <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/50 border border-white/30 hover:bg-white/70 transition-colors">
                                  <div className="relative">
                                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 overflow-hidden shadow-inner shrink-0">
                                      {u.profile_image ? (
                                        <img src={`http://localhost:3001/${u.profile_image.replace('../', '')}`} className="w-full h-full object-cover" alt={u.full_name} onError={(e) => { e.target.style.display = 'none'; }} />
                                      ) : u.full_name.charAt(0)}
                                    </div>
                                    <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${u.is_online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-[#042C53] truncate">{u.full_name}</p>
                                    <p className={`text-[10px] ${u.is_online ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>{u.is_online ? 'กำลังทำงาน' : 'ออฟไลน์'}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                          <p className="text-[#378ADD] text-sm">ไม่มีข้อมูลผู้ใช้งาน</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

// ── Components ──────────────────────────────────────────────

function StatCard({ title, value, suffix, gradient, icon, shadow, live }) {
  return (
    <div className="glass rounded-2xl overflow-hidden border border-white/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shadow-lg ${shadow} group-hover:scale-110 transition-transform duration-300`}>
            {icon}
          </div>
          {live && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-black text-[#042C53]">{value}</span>
          <span className="text-sm font-medium text-[#378ADD]">{suffix}</span>
        </div>
        <p className="text-xs font-medium text-[#378ADD] mt-1 leading-tight">{title}</p>
      </div>
    </div>
  );
}

function QuickActionBtn({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-bold px-4 py-2.5 rounded-xl backdrop-blur-sm transition-all hover:scale-105 active:scale-95 shadow-sm">
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
