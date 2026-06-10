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

export default function MaTechDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, annRes] = await Promise.all([
        api.get('/stats/ma-tech-dashboard'),
        api.get('/announcements/active')
      ]);
      setData(statsRes.data);
      setAnnouncements(annRes.data);
    } catch (err) {
      console.error('Failed to fetch ma tech dashboard stats', err);
    } finally {
      setLoading(false);
    }
  };

  const isMet = data?.summary?.isConditionMet;
  const firstName = user?.full_name?.split(' ')[0] || 'ช่าง';
  const greeting = getGreeting();
  const todayDate = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const completedMonth = data?.summary?.completedMonth || 0;
  const targetJobs = data?.summary?.targetJobs || 1;
  const progressPct = Math.min(100, Math.round((completedMonth / targetJobs) * 100));

  const checkinsMonth = data?.summary?.checkinsMonth || 0;
  const targetDays = data?.summary?.targetDays || 1;
  const checkinPct = Math.min(100, Math.round((checkinsMonth / targetDays) * 100));

  return (
    <div className="flex min-h-screen font-sans overflow-hidden" style={{ background: 'var(--page-bg)', backgroundAttachment: 'fixed' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="home_ma" />

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
            <h2 className="text-[#042C53] font-bold text-lg">สรุปผล MA ของฉัน</h2>
          </div>
          <button onClick={fetchDashboardData}
            className="flex items-center gap-1.5 text-xs text-[#185FA5] hover:text-[#0C447C] font-semibold bg-[#E6F1FB] hover:bg-[#B5D4F4] px-3 py-1.5 rounded-lg border border-[#185FA5]/20 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            รีเฟรช
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto w-full space-y-6">

            {/* Hero Greeting — MA theme: deep teal-navy */}
            <div className="relative overflow-hidden rounded-3xl p-6 md:p-8"
              style={{ background: 'linear-gradient(135deg, #064E3B 0%, #065F46 45%, #059669 100%)' }}>
              <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full opacity-10 bg-white blur-2xl pointer-events-none" />
              <div className="absolute right-10 -bottom-12 w-36 h-36 rounded-full opacity-10 bg-white blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <p className="text-emerald-200 text-sm font-medium mb-1">{todayDate}</p>
                <h1 className="text-white text-2xl md:text-3xl font-bold leading-snug">
                  {greeting}, <span className="text-emerald-200">{firstName}</span> 🛠️
                </h1>
                <p className="text-emerald-300 text-sm mt-2">ตรวจสอบเป้าหมายประจำเดือนและงานประจำวัน</p>
              </div>
              <div className="absolute top-6 right-6 bg-white/10 border border-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
                🛠️ ช่าง MA
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
                    danger:  { bg: 'bg-red-50',     border: 'border-red-200',     title: 'text-red-800',     msg: 'text-red-700',     icon: '🚨' },
                    warning: { bg: 'bg-amber-50',   border: 'border-amber-200',   title: 'text-amber-800',   msg: 'text-amber-700',   icon: '⚠️' },
                    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'text-emerald-800', msg: 'text-emerald-700', icon: '✅' },
                  }[ann.type] || { bg: 'bg-blue-50', border: 'border-blue-200', title: 'text-blue-800', msg: 'text-blue-700', icon: '📋' };
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

            {loading && !data ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-32 rounded-3xl" />)}
              </div>
            ) : (
              <>
                {/* Daily Stats */}
                <div>
                  <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#185FA5] to-[#0C447C] flex items-center justify-center shadow-md">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    งานประจำวัน (วันนี้)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard title="จำนวนงานที่ได้รับ" value={data?.summary?.jobsToday || 0}
                      suffix="งาน" gradient="from-[#185FA5] to-[#378ADD]" icon="📋" shadow="shadow-blue-500/20" />
                    <StatCard title="งานที่สำเร็จ" value={data?.summary?.jobsCompleted || 0}
                      suffix="งาน" gradient="from-emerald-500 to-teal-500" icon="✅" shadow="shadow-emerald-500/20" />
                    <StatCard title="งานที่ไม่สำเร็จ" value={data?.summary?.jobsFailed || 0}
                      suffix="งาน" gradient="from-rose-500 to-pink-500" icon="❌" shadow="shadow-rose-500/20" />
                  </div>
                </div>

                {/* Monthly Progress */}
                <div>
                  <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    เป้าหมายประจำเดือน
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ProgressCard
                      title="เป้าการมาเช็คอิน"
                      icon="📍"
                      current={checkinsMonth}
                      target={targetDays}
                      suffix="วัน"
                      pct={checkinPct}
                      gradient="from-indigo-500 to-violet-600"
                      trackColor="bg-indigo-100"
                      barColor="from-indigo-500 to-violet-600"
                    />
                    <ProgressCard
                      title="เป้าหมายงานที่จบ"
                      icon="🎯"
                      current={completedMonth}
                      target={targetJobs}
                      suffix="งาน"
                      pct={progressPct}
                      gradient="from-amber-500 to-orange-500"
                      trackColor="bg-amber-100"
                      barColor="from-amber-500 to-orange-500"
                    />
                  </div>
                </div>

                {/* Goal Status Banner */}
                <div className={`relative overflow-hidden rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-5 border shadow-lg transition-all ${
                  isMet ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 shadow-emerald-500/10' 
                        : 'glass border-white/50 shadow-slate-200/50'
                }`}>
                  <div className={`w-20 h-20 shrink-0 rounded-2xl flex items-center justify-center text-4xl shadow-xl ${
                    isMet ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/30' 
                           : 'bg-gradient-to-br from-slate-300 to-slate-400 shadow-slate-400/20'
                  }`}>
                    {isMet ? '🏆' : '⏳'}
                  </div>
                  <div className="text-center sm:text-left flex-1">
                    <h3 className={`text-xl font-bold mb-1 ${isMet ? 'text-emerald-800' : 'text-[#042C53]'}`}>
                      {isMet ? 'ยอดเยี่ยม! คุณบรรลุเป้าหมายแล้ว 🎉' : 'สถานะการบรรลุเป้าหมายบริษัท'}
                    </h3>
                    <p className={`text-sm ${isMet ? 'text-emerald-600' : 'text-[#378ADD]'}`}>
                      {isMet
                        ? 'คุณทำผลงานได้ตามเงื่อนไขของบริษัทในเดือนนี้ครบถ้วนเรียบร้อยแล้ว'
                        : 'คุณยังทำผลงานไม่ถึงเป้าหมายที่บริษัทกำหนด พยายามเข้านะครับ!'}
                    </p>
                  </div>
                  <div className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold border shadow-sm ${
                    isMet ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20' 
                           : 'bg-white text-slate-600 border-slate-200'
                  }`}>
                    {isMet ? '✅ ผ่านเงื่อนไข' : '⏳ ยังไม่ผ่าน'}
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
