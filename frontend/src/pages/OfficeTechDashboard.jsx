import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'สวัสดีตอนเช้า';
  if (h < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

export default function OfficeTechDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(null);
  const [maData, setMaData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const userRoles = user?.roles || [user?.role];
  const isSales = userRoles.includes('sales') || user?.role === 'sales';
  const isMATech = userRoles.includes('ma_technician');
  const isOfficeTech = userRoles.includes('technician') || userRoles.includes('office_technician');  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const apiCalls = [
        api.get('/stats/office-tech-dashboard'),
        api.get('/announcements/active')
      ];
      if (isMATech) {
        apiCalls.push(api.get('/stats/ma-tech-dashboard'));
      }
      
      const results = await Promise.all(apiCalls);
      setData(results[0].data);
      setAnnouncements(results[1].data);
      if (isMATech) {
        setMaData(results[2].data);
      }
    } catch (err) {
      console.error('Failed to fetch office tech dashboard stats', err);
    } finally {
      setLoading(false);
    }
  };

  const firstName = user?.full_name?.split(' ')[0] || 'ผู้ใช้งาน';
  
  let roleTitle = 'ผู้ใช้งาน';
  if (isSales) roleTitle = 'เซล';
  else if (isOfficeTech && isMATech) roleTitle = 'ช่าง Office / MA';
  else if (isOfficeTech) roleTitle = 'ช่าง Office';
  else if (isMATech) roleTitle = 'ช่าง MA';
  const greeting = getGreeting();
  const todayDate = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="flex min-h-screen font-sans overflow-hidden" style={{ background: 'var(--page-bg)', backgroundAttachment: 'fixed' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="home" />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 h-16 backdrop-blur-xl border-b border-white/50 shadow-sm"
          style={{ background: 'rgba(255,255,255,0.80)' }}>
          <button onClick={() => setSidebarOpen(true)}
            className="md:hidden flex flex-col items-center justify-center gap-[5px] w-10 h-10 rounded-xl glass border border-white/50 transition-all active:scale-95">
            <span className="block w-[18px] h-[2px] rounded-full bg-slate-600" />
            <span className="block w-[18px] h-[2px] rounded-full bg-slate-600" />
            <span className="block w-[18px] h-[2px] rounded-full bg-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-[#042C53] font-bold text-lg">หน้าแรก ({roleTitle})</h2>
          </div>
          <button onClick={fetchDashboardData}
            className="flex items-center gap-1.5 text-xs text-[#185FA5] hover:text-[#0C447C] font-semibold bg-[#E6F1FB] hover:bg-[#B5D4F4] px-3 py-1.5 rounded-lg border border-[#185FA5]/20 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            รีเฟรช
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto w-full space-y-6">

            {/* Hero Greeting */}
            <div className="relative overflow-hidden rounded-3xl p-6 md:p-8"
              style={{ background: 'linear-gradient(135deg, #042C53 0%, #185FA5 50%, #378ADD 100%)' }}>
              {/* Decorative blobs */}
              <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full opacity-10 bg-white blur-2xl pointer-events-none" />
              <div className="absolute right-10 -bottom-12 w-36 h-36 rounded-full opacity-10 bg-white blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <p className="text-blue-200 text-sm font-medium mb-1"><span className="text-white/80 text-sm font-medium">{roleTitle}</span> {todayDate}</p>
                <h1 className="text-white text-2xl md:text-3xl font-bold leading-snug">
                  {greeting}, <span className="text-blue-200">{firstName}</span> 👋
                </h1>
                <p className="text-blue-300 text-sm mt-2">ยอดรวมงานและบันทึกต่างๆ ประจำวันนี้</p>
              </div>
              {/* Role badge */}
              <div className="absolute top-6 right-6 bg-white/10 border border-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
                🏢 {roleTitle}
              </div>
            </div>

            {/* Announcements */}
            {announcements.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-sm shadow-md shadow-amber-500/20">📢</div>
                  ประกาศจากบริษัท
                </h3>
                {announcements.map(ann => {
                  const styles = {
                    danger:  { bg: 'bg-red-50',     border: 'border-red-200',     title: 'text-red-800',     msg: 'text-red-700',     dot: 'bg-red-500',     icon: '🚨' },
                    warning: { bg: 'bg-amber-50',   border: 'border-amber-200',   title: 'text-amber-800',   msg: 'text-amber-700',   dot: 'bg-amber-500',   icon: '⚠️' },
                    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'text-emerald-800', msg: 'text-emerald-700', dot: 'bg-emerald-500', icon: '✅' },
                  }[ann.type] || { bg: 'bg-blue-50', border: 'border-blue-200', title: 'text-blue-800', msg: 'text-blue-700', dot: 'bg-blue-500', icon: '📋' };
                  return (
                    <div key={ann.id} className={`p-4 rounded-2xl border ${styles.bg} ${styles.border} flex gap-3 shadow-sm`}>
                      <div className="text-xl shrink-0 mt-0.5">{styles.icon}</div>
                      <div>
                        <h4 className={`font-bold text-sm ${styles.title}`}>{ann.title}</h4>
                        <p className={`text-sm mt-1 whitespace-pre-wrap ${styles.msg}`}>{ann.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stats Grid */}
            {loading && !data ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-32 rounded-3xl" />)}
              </div>
            ) : (
              <>
                {!isSales && (
                  <div>
                    <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#185FA5] to-[#0C447C] flex items-center justify-center shadow-md">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      </div>
                      สรุปงานประจำวัน
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <StatCard title="จำนวนงานในวันนี้" value={data?.summary?.jobsToday || 0}
                        suffix="งาน" gradient="from-[#185FA5] to-[#378ADD]" icon="📋" shadow="shadow-blue-500/20" />
                      <StatCard title="งานที่สำเร็จ" value={data?.summary?.jobsCompleted || 0}
                        suffix="งาน" gradient="from-emerald-500 to-teal-500" icon="✅" shadow="shadow-emerald-500/20" />
                      <StatCard title="งานที่ไม่สำเร็จ" value={data?.summary?.jobsFailed || 0}
                        suffix="งาน" gradient="from-rose-500 to-pink-500" icon="❌" shadow="shadow-rose-500/20" />
                      <StatCard title="บิลน้ำมันวันนี้" value={data?.summary?.oilToday || 0}
                        suffix="บิล" gradient="from-amber-500 to-orange-500" icon="⛽" shadow="shadow-amber-500/20" />
                      <StatCard title="ค่าแรกเข้าวันนี้" value={data?.summary?.entryToday || 0}
                        suffix="รายการ" gradient="from-teal-500 to-cyan-500" icon="💰" shadow="shadow-teal-500/20" />
                    </div>
                  </div>
                )}

                {/* Shortcuts */}
                <div className="glass rounded-3xl p-6 border border-white/50 shadow-sm">
                  <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    เมนูทางลัด
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {isSales && (
                      <ShortcutBtn icon="📍" label="เช็คอินเข้างาน" onClick={() => navigate('/checkin')}
                        gradient="from-indigo-500 to-violet-600" shadow="shadow-indigo-500/25" />
                    )}
                    <ShortcutBtn icon="📋" label={isSales ? 'ระบบงานขยาย AIS' : 'งานที่รับมอบหมาย'} onClick={() => navigate(isSales ? '/ais-expansion' : '/jobs')}
                      gradient="from-[#185FA5] to-[#378ADD]" shadow="shadow-blue-500/25" />
                    <ShortcutBtn icon="⛽" label="กรอกบิลน้ำมัน" onClick={() => navigate('/oil')}
                      gradient="from-amber-500 to-orange-500" shadow="shadow-amber-500/25" />
                    {!isSales && (
                      <ShortcutBtn icon="💰" label="บันทึกค่าแรกเข้า" onClick={() => navigate('/entry-fee')}
                        gradient="from-emerald-500 to-teal-500" shadow="shadow-emerald-500/25" />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* MA Tech Section */}
            {!loading && isMATech && maData && (
              <div className="mt-8 space-y-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <h2 className="text-[#042C53] font-extrabold text-lg">ภาพรวมงาน MA</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard title="จำนวนงาน MA วันนี้" value={maData?.summary?.jobsToday || 0}
                    suffix="งาน" gradient="from-[#185FA5] to-[#378ADD]" icon="📋" shadow="shadow-blue-500/20" />
                  <StatCard title="งานที่สำเร็จ" value={maData?.summary?.jobsCompleted || 0}
                    suffix="งาน" gradient="from-emerald-500 to-teal-500" icon="✅" shadow="shadow-emerald-500/20" />
                  <StatCard title="งานที่ไม่สำเร็จ" value={maData?.summary?.jobsFailed || 0}
                    suffix="งาน" gradient="from-rose-500 to-pink-500" icon="❌" shadow="shadow-rose-500/20" />
                </div>

                <div>
                  <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    เป้าหมายประจำเดือน MA
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ProgressCard
                      title="งาน MA สำเร็จเดือนนี้"
                      current={maData?.summary?.completedMonth || 0}
                      target={maData?.summary?.targetJobs || 1}
                      suffix="งาน"
                      pct={Math.min(100, Math.round(((maData?.summary?.completedMonth || 0) / (maData?.summary?.targetJobs || 1)) * 100))}
                      icon="🎯"
                      gradient="from-blue-500 to-indigo-600"
                      trackColor="bg-blue-100"
                      barColor="from-blue-500 to-indigo-500"
                    />
                    <ProgressCard
                      title="มาทำงาน (เดือนนี้)"
                      current={maData?.summary?.checkinsMonth || 0}
                      target={maData?.summary?.targetDays || 1}
                      suffix="วัน"
                      pct={Math.min(100, Math.round(((maData?.summary?.checkinsMonth || 0) / (maData?.summary?.targetDays || 1)) * 100))}
                      icon="📅"
                      gradient="from-emerald-500 to-teal-500"
                      trackColor="bg-emerald-100"
                      barColor="from-emerald-500 to-teal-500"
                    />
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

function StatCard({ title, value, suffix, gradient, icon, shadow }) {
  return (
    <div className="glass rounded-2xl overflow-hidden border border-white/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />
      <div className="p-5">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shadow-lg ${shadow} mb-4 group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-black text-[#042C53]">{value}</span>
          <span className="text-sm font-medium text-[#378ADD]">{suffix}</span>
        </div>
        <p className="text-xs font-medium text-[#378ADD] mt-1 truncate">{title}</p>
      </div>
    </div>
  );
}

function ShortcutBtn({ icon, label, onClick, gradient, shadow }) {
  return (
    <button onClick={onClick}
      className={`relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg ${shadow} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] group text-left`}>
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm shrink-0 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <span className="text-white font-bold text-sm leading-tight">{label}</span>
    </button>
  );
}

function ProgressCard({ title, icon, current, target, suffix, pct, gradient, trackColor, barColor }) {
  return (
    <div className="glass rounded-2xl p-5 border border-white/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-xl shadow-md`}>
            {icon}
          </div>
          <p className="text-sm font-bold text-[#042C53]">{title}</p>
        </div>
        <div className={`text-lg font-black bg-gradient-to-br ${gradient} bg-clip-text text-transparent`}>
          {pct}%
        </div>
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-black text-[#042C53]">{current}</span>
        <span className="text-sm text-[#378ADD]">/ {target} {suffix}</span>
      </div>
      <div className={`w-full ${trackColor} rounded-full h-2.5 overflow-hidden`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-1000 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
