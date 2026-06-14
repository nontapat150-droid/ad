import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api/axios';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stats/admin-dashboard');
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch admin dashboard stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const todayDate = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="flex h-dvh font-sans overflow-hidden" style={{ background: 'var(--page-bg)', backgroundAttachment: 'fixed' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="admin_dashboard" />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px] overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 h-16 backdrop-blur-xl border-b border-white/50 shadow-sm shrink-0"
          style={{ background: 'rgba(255,255,255,0.80)' }}>
          <button onClick={() => setSidebarOpen(true)}
            className="md:hidden flex flex-col items-center justify-center gap-[5px] w-10 h-10 rounded-xl glass border border-white/50 transition-all active:scale-95">
            <span className="block w-[18px] h-[2px] rounded-full bg-slate-600" />
            <span className="block w-[18px] h-[2px] rounded-full bg-slate-600" />
            <span className="block w-[18px] h-[2px] rounded-full bg-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-[#042C53] font-bold text-lg">แดชบอร์ดแอดมิน</h2>
          </div>
          <button onClick={fetchDashboardData}
            className="flex items-center gap-1.5 text-xs text-[#185FA5] hover:text-[#0C447C] font-semibold bg-[#E6F1FB] hover:bg-[#B5D4F4] px-3 py-1.5 rounded-lg border border-[#185FA5]/20 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            รีเฟรช
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">

            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 mb-6"
              style={{ background: 'linear-gradient(135deg, #042C53 0%, #0C447C 40%, #185FA5 75%, #378ADD 100%)' }}>
              <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full opacity-10 bg-white blur-2xl pointer-events-none" />
              <div className="absolute left-1/2 -bottom-16 w-48 h-48 rounded-full opacity-8 bg-blue-300 blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-blue-200 text-sm font-medium mb-1">{todayDate}</p>
                  <h1 className="text-white text-2xl md:text-3xl font-bold">
                    👑 แดชบอร์ดผู้ดูแลระบบ
                  </h1>
                  <p className="text-blue-300 text-sm mt-2">ภาพรวมสรุปการดำเนินงานประจำวัน</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                  <button onClick={() => navigate('/jobs')}
                    className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-bold px-5 py-2.5 rounded-xl backdrop-blur-sm transition-all hover:scale-105 active:scale-95">
                    🛠️ จ่ายงานทั้งหมด
                  </button>
                  <button onClick={() => navigate('/inventory')}
                    className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-bold px-5 py-2.5 rounded-xl backdrop-blur-sm transition-all hover:scale-105 active:scale-95">
                    📦 คลังสินค้า
                  </button>
                </div>
              </div>
            </div>

            {loading && !data ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-36 rounded-3xl" />)}
                </div>
                <div className="skeleton h-64 rounded-3xl" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column */}
                <div className="lg:col-span-2 flex flex-col gap-6">

                  {/* Stats Grid */}
                  <div>
                    <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#185FA5] to-[#0C447C] flex items-center justify-center shadow-md">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      </div>
                      ยอดสรุปงานวันนี้
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <StatCard title="สินค้าในคลังทั้งหมด"
                        value={Number(data?.summary?.totalInventory || 0).toLocaleString()}
                        suffix="ชิ้น" gradient="from-slate-600 to-slate-800" icon="📦" shadow="shadow-slate-500/20" />
                      <StatCard title="งานยังไม่มอบหมาย"
                        value={data?.summary?.unassignedToday || 0}
                        suffix="งาน" gradient="from-rose-500 to-pink-600" icon="⚠️" shadow="shadow-rose-500/20" urgent={data?.summary?.unassignedToday > 0} />
                      <StatCard title="งาน Office วันนี้"
                        value={data?.summary?.officeAssignedToday || 0}
                        suffix="งาน" gradient="from-[#185FA5] to-[#378ADD]" icon="🏢" shadow="shadow-blue-500/20" />
                      <StatCard title="งาน MA วันนี้"
                        value={data?.summary?.maAssignedToday || 0}
                        suffix="งาน" gradient="from-emerald-500 to-teal-500" icon="🛠️" shadow="shadow-emerald-500/20" />
                    </div>
                  </div>

                  {/* Quick Shortcuts */}
                  <div className="glass rounded-3xl p-6 border border-white/50 shadow-sm">
                    <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2 mb-5">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      ทางลัดด่วน
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <ShortcutBtn icon="📦" label="จัดการคลังสินค้า" sublabel="รับ-จ่ายสินค้า"
                        onClick={() => navigate('/inventory')} gradient="from-slate-600 to-slate-800" shadow="shadow-slate-500/25" />
                      <ShortcutBtn icon="🛠️" label="จ่ายงาน MA" sublabel="มอบหมายงานช่าง"
                        onClick={() => navigate('/jobs?tab=ma')} gradient="from-[#185FA5] to-[#0C447C]" shadow="shadow-blue-500/25" />
                      <ShortcutBtn icon="🏢" label="จ่ายงาน Office" sublabel="มอบหมายงานออฟฟิศ"
                        onClick={() => navigate('/jobs?tab=office')} gradient="from-emerald-500 to-teal-500" shadow="shadow-emerald-500/25" />
                    </div>
                  </div>

                  {/* ── Activity Feed ── */}
                  <div className="glass rounded-3xl border border-white/50 shadow-sm overflow-hidden flex flex-col h-[500px]">
                    {/* Feed Header */}
                    <div className="px-6 py-4 border-b border-white/30 flex items-center justify-between shrink-0"
                      style={{ background: 'rgba(255,255,255,0.4)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
                          <span className="text-white text-xs">💬</span>
                        </div>
                        <div>
                          <h2 className="text-[#042C53] font-bold text-base">Live Activity Feed</h2>
                          <p className="text-[#378ADD] text-xs">การทำรายการล่าสุดแบบเรียลไทม์</p>
                        </div>
                      </div>
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        LIVE
                      </span>
                    </div>

                    {/* Feed Items (Chat Style) */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/40 flex flex-col-reverse gap-4">
                      {data?.feed?.length > 0 ? (
                        data.feed.map((item, idx) => {
                          const FEED_CONFIG = {
                            oil: { icon: '⛽', color: 'from-amber-400 to-orange-500', shadow: 'shadow-orange-500/20', label: 'ลงน้ำมัน' },
                            entry_fee: { icon: '💰', color: 'from-emerald-400 to-teal-500', shadow: 'shadow-teal-500/20', label: 'ค่าแรกเข้า' },
                            checkin: { icon: '📍', color: 'from-blue-400 to-indigo-500', shadow: 'shadow-blue-500/20', label: 'ลงเวลา' },
                            job: { icon: '🛠️', color: 'from-purple-400 to-pink-500', shadow: 'shadow-purple-500/20', label: 'งานเสร็จ' }
                          };
                          const cfg = FEED_CONFIG[item.type] || { icon: '📌', color: 'from-slate-400 to-slate-500', shadow: 'shadow-slate-400/20', label: 'กิจกรรม' };
                          
                          // timeAgo function inside component
                          const timeAgo = (dateStr) => {
                            const diff = (new Date() - new Date(dateStr)) / 1000;
                            if (diff < 60) return 'เมื่อสักครู่';
                            if (diff < 3600) return `${Math.floor(diff/60)} นาทีที่แล้ว`;
                            if (diff < 86400) return `${Math.floor(diff/3600)} ชั่วโมงที่แล้ว`;
                            return `${Math.floor(diff/86400)} วันที่แล้ว`;
                          };

                          return (
                            <div
                              key={`${item.type}-${item.id}-${idx}`}
                              className="flex items-end gap-3 group animate-fade-in-up"
                            >
                              {/* Avatar/Icon */}
                              <div className={`w-10 h-10 shrink-0 rounded-full bg-gradient-to-br ${cfg.color} flex items-center justify-center text-sm shadow-md ${cfg.shadow} ring-2 ring-white/50`}>
                                {cfg.icon}
                              </div>

                              {/* Chat Bubble Content */}
                              <div className="flex flex-col max-w-[85%] md:max-w-[75%]">
                                <span className="text-[11px] font-bold text-slate-500 mb-1 ml-2 flex items-center gap-1.5">
                                  {item.user_name || 'ผู้ใช้'} 
                                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded border bg-gradient-to-br ${cfg.color} text-white shadow-sm`}>{cfg.label}</span>
                                </span>
                                <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 relative">
                                  <p className="text-[#042C53] text-sm font-medium leading-relaxed">
                                    {item.action}
                                  </p>
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1 ml-2 font-medium">
                                  {timeAgo(item.created_at)}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center py-10">
                          <div className="w-16 h-16 bg-[#E6F1FB] rounded-2xl flex items-center justify-center text-3xl mb-3 shadow-inner">📭</div>
                          <p className="text-[#042C53] font-bold">ยังไม่มีรายการล่าสุด</p>
                          <p className="text-[#378ADD] text-sm mt-1">การทำรายการใหม่จะปรากฏที่นี่</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column — Announcements */}
                <div className="lg:col-span-1">
                  <div className="glass rounded-3xl p-6 border border-white/50 shadow-sm h-full">
                    <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2 mb-5">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-sm shadow-md shadow-amber-500/20">📢</div>
                      ประกาศล่าสุด
                    </h3>
                    {!data?.announcements || data.announcements.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 bg-[#E6F1FB] rounded-2xl flex items-center justify-center text-3xl mb-3 shadow-inner">🔔</div>
                        <p className="text-[#378ADD] text-sm font-medium">ไม่มีประกาศในขณะนี้</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.announcements.map(ann => (
                          <div key={ann.id} className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 hover:shadow-md hover:-translate-y-0.5 transition-all">
                            <div className="flex items-start gap-2">
                              <span className="text-lg shrink-0">📋</span>
                              <div className="min-w-0">
                                <h4 className="font-bold text-amber-900 text-sm truncate">{ann.title}</h4>
                                <p className="text-xs text-amber-700 mt-1 line-clamp-3 whitespace-pre-wrap">{ann.content}</p>
                                <p className="text-[10px] text-amber-500 mt-2">
                                  {new Date(ann.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ title, value, suffix, gradient, icon, shadow, urgent }) {
  return (
    <div className={`glass rounded-2xl overflow-hidden border ${urgent ? 'border-rose-200 animate-pulse-slow' : 'border-white/50'} hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group`}>
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shadow-lg ${shadow} mb-4 group-hover:scale-110 transition-transform duration-300`}>
            {icon}
          </div>
          {urgent && (
            <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg animate-pulse">
              รอดำเนินการ
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

function ShortcutBtn({ icon, label, sublabel, onClick, gradient, shadow }) {
  return (
    <button onClick={onClick}
      className={`relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg ${shadow} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] group text-left`}>
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
      <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm shrink-0 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-white font-bold text-sm">{label}</div>
        <div className="text-white/60 text-xs truncate">{sublabel}</div>
      </div>
    </button>
  );
}
