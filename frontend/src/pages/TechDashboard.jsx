import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AOS from 'aos';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Layout         from '../components/Layout';
import JobCard        from '../components/JobCard';
import TechBagDrawer  from '../components/TechBagDrawer';
import { CompleteJobModal, IncompleteJobModal, PostponeJobModal } from '../components/JobActionModals';
import CompleteMaJobModal from '../components/CompleteMaJobModal';

// ── Checkin status helpers ────────────────────────────────
function getCheckinStatus(data) {
  if (!data) return 'none';
  if (data.checkout_time) return 'checkout';
  if (data.is_late) return 'late';
  return 'checkin';
}

const STATUS_CONFIG = {
  none:     { ring: 'border-[#D1D5DB]', glow: 'none',                              emoji: '⏰', title: 'แตะเพื่อลงเวลา',     sub: 'ยังไม่ได้เริ่มงานวันนี้',      pulse: false, btnGrad: 'from-[#A3E635] to-[#65a30d]',   btnShadow: 'shadow-lime-500/30' },
  checkin:  { ring: 'border-[#A3E635]', glow: '0 0 40px rgba(163,230,53,0.2)',     emoji: '✅', title: 'ลงเวลาเข้างานแล้ว',  sub: 'ลุยงานกันเลย!',             pulse: true,  btnGrad: 'from-emerald-500 to-teal-500',   btnShadow: 'shadow-emerald-500/30' },
  late:     { ring: 'border-orange-400',glow: '0 0 40px rgba(251,146,60,0.2)',      emoji: '⚠️', title: 'เข้างานสาย',         sub: 'อย่าลืมตรงต่อเวลาพรุ่งนี้', pulse: false, btnGrad: 'from-emerald-500 to-teal-500',   btnShadow: 'shadow-emerald-500/30' },
  checkout: { ring: 'border-[#D1D5DB]', glow: 'none',                              emoji: '🏁', title: 'ออกงานเรียบร้อย',    sub: 'พักผ่อนให้เต็มที่',         pulse: false, btnGrad: null, btnShadow: null },
};

const PAGE_TITLES = {
  home:    'หน้าแรก',
  jobs:    'ระบบแจกจ่ายงาน',
  bag:     'กระเป๋าช่าง',
  oil:     'ประวัติเติมน้ำมัน',
  checkin: 'บันทึกเวลาทำงาน',
  map:     'แผนที่หน้างาน',
  report:  'แจ้งปัญหา',
  profile: 'โปรไฟล์ส่วนตัว',
};

export default function TechDashboard() {
  const { user }              = useAuth();
  const navigate              = useNavigate();
  const [activeKey, setActive] = useState('home');
  const [checkinData, setCheckin] = useState(null);
  const [jobs, setJobs]           = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;
  const [completingJob, setCompleting] = useState(null);
  const [incompletingJob, setIncompleting] = useState(null);
  const [postponingJob, setPostponing] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({ announcements: [], goals: { completed: 0, target: 50 } });

  const [showBag, setShowBag]         = useState(false);

  const fetchCheckin = useCallback(() => {
    api.get('/checkin/today').then((r) => setCheckin(r.data)).catch(() => {});
  }, []);

  const fetchJobs = useCallback(() => {
    setLoadingJobs(true);
    const isMa = user?.role === 'ma_technician' || user?.roles?.includes('ma_technician')
      || user?.role === 'contractor_ma' || user?.roles?.includes('contractor_ma');
    api.get(`/dispatch/jobs${isMa ? '?type=ma' : ''}`)
      .then((r) => setJobs(r.data))
      .catch(() => setJobs([]))
      .finally(() => setLoadingJobs(false));
  }, [user]);

  const fetchStats = useCallback(() => {
    api.get('/stats/tech-dashboard')
      .then((r) => setDashboardStats(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCheckin();
    fetchJobs();
    fetchStats();
    AOS.refresh();
  }, [fetchCheckin, fetchJobs, fetchStats]);

  const handleNav = (key) => {
    setActive(key);
    if (key === 'bag')    setShowBag(true);
    if (key === 'oil')    navigate('/oil');
  };

  const confirmComplete = async () => {
    // This is now handled by CompleteJobModal
  };

  const handleSetOff = async (jobId) => {
    try {
      await api.put(`/dispatch/jobs/${jobId}/set-off`);
      fetchJobs();
    } catch (err) {
      console.error('Failed to set off:', err);
    }
  };

  const handleArrive = async (jobId) => {
    try {
      await api.put(`/dispatch/jobs/${jobId}/arrive`);
      fetchJobs();
    } catch (err) {
      console.error('Failed to arrive:', err);
    }
  };

  const checkinStatus = getCheckinStatus(checkinData);
  const cfg           = STATUS_CONFIG[checkinStatus];
  const canCheckin    = checkinStatus === 'none';
  const canCheckout   = checkinStatus === 'checkin' || checkinStatus === 'late';

  const todayDate = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const todayISO = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const greeting = getGreeting();
  const firstName = user?.full_name?.split(' ')[0] || 'ช่าง';
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const pendingCount   = jobs.filter((j) => j.status === 'pending').length;
  // Summary cards data
  const todayJobs      = jobs.filter(j => j.plan_arrival_date && j.plan_arrival_date.slice(0,10) === todayISO && j.status !== 'completed' && j.status !== 'failed');
  const unfinishedJobs = jobs.filter(j => ['pending','in_progress'].includes(j.status) && j.plan_arrival_date && j.plan_arrival_date.slice(0,10) < todayISO);

  const filteredJobs = jobs.filter(job => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return job.status === 'pending';
    if (activeTab === 'completed') return job.status === 'completed';
    if (activeTab === 'other') return ['incomplete', 'postponed'].includes(job.status);
    return true;
  });

  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const paginatedJobs = filteredJobs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <Layout
      activeKey={activeKey}
      onNavigate={handleNav}
      pageTitle={PAGE_TITLES[activeKey] || 'แดชบอร์ด'}>

      {/* ── Dashboard Grid Layout ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
        
        {/* Left Column (Main Info) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
          
          {/* Greeting Hero */}
          <div data-aos="fade-down">
            <p className="text-[#9CA3AF] text-[13px] font-medium tracking-wide mb-1">{todayDate}</p>
            <h1 className="text-[#1F2937] text-2xl md:text-3xl font-bold leading-snug">
              {greeting}, <span className="text-[#65a30d]">{firstName}</span> 👋
            </h1>
          </div>

          {/* Quick Stats Grid */}
          <div data-aos="fade-up" data-aos-delay="100" className="grid grid-cols-3 gap-3 md:gap-4">
            <StatCard value={jobs.length}    label="งานทั้งหมด"   color="text-[#1F2937]" />
            <StatCard value={pendingCount}   label="รอดำเนินการ" color="text-amber-500" />
            <StatCard value={completedCount} label="เสร็จสิ้น"    color="text-emerald-500" />
          </div>

          {/* Summary Action Cards */}
          <div data-aos="fade-up" data-aos-delay="150" className="grid grid-cols-2 gap-3">
            {/* Today's Jobs — Green */}
            <button
              onClick={() => navigate('/jobs?tab=office')}
              className="relative overflow-hidden rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.35)' }}
            >
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />
              <div className="relative z-10">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-white/80 text-xs font-semibold">งานวันนี้</p>
                <p className="text-white text-3xl font-black leading-none">{todayJobs.length}</p>
                <p className="text-white/70 text-[10px] mt-1">รายการที่ยังไม่จบ</p>
              </div>
            </button>

            {/* Unfinished jobs — Red */}
            <button
              onClick={() => navigate('/jobs?tab=office&status=overdue')}
              className="relative overflow-hidden rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              style={{ background: unfinishedJobs.length > 0 ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'linear-gradient(135deg, #6b7280, #4b5563)', boxShadow: unfinishedJobs.length > 0 ? '0 4px 20px rgba(239,68,68,0.35)' : '0 2px 8px rgba(0,0,0,0.1)' }}
            >
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />
              <div className="relative z-10">
                <div className="text-3xl mb-2">{unfinishedJobs.length > 0 ? '🔴' : '✅'}</div>
                <p className="text-white/80 text-xs font-semibold">งานค้างยังไม่จบ</p>
                <p className="text-white text-3xl font-black leading-none">{unfinishedJobs.length}</p>
                <p className="text-white/70 text-[10px] mt-1">{unfinishedJobs.length > 0 ? 'กดเพื่อดูรายการ' : 'ไม่มีงานค้าง'}</p>
              </div>
            </button>
          </div>

          {/* Jobs List Section */}
          <div className="mt-1 bg-white p-5 md:p-6 rounded-2xl border border-[#E5E7EB] flex flex-col gap-2"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <SectionHeader
              title="งานของวันนี้"
              action={
                <button onClick={fetchJobs} className="flex items-center gap-1.5 text-xs text-[#65a30d] hover:text-[#1F2937] transition-colors font-semibold bg-[#A3E635]/10 hover:bg-[#A3E635]/20 px-3 py-1.5 rounded-lg border border-[#A3E635]/25">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  โหลดข้อมูลใหม่
                </button>
              }
            />

            {/* Tab Selector */}
            <div className="flex overflow-x-auto gap-2 py-1 mb-2" style={{ scrollbarWidth: 'none' }}>
              {[
                { id: 'all', label: 'ทั้งหมด', count: jobs.length },
                { id: 'pending', label: 'รอดำเนินการ', count: pendingCount },
                { id: 'completed', label: 'เสร็จสิ้น', count: completedCount },
                { id: 'other', label: 'ไม่จบงาน/เลื่อน', count: jobs.filter(j => ['incomplete', 'postponed'].includes(j.status)).length }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                    activeTab === tab.id 
                      ? 'text-[#1F2937] shadow-sm' 
                      : 'bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]'
                  }`}
                  style={activeTab === tab.id ? {
                    background: 'linear-gradient(135deg, rgba(163,230,53,0.18), rgba(101,163,13,0.10))',
                    border: '1px solid rgba(163,230,53,0.35)',
                  } : {}}
                >
                  {tab.label}
                  <span className={`px-2 py-0.5 rounded-md text-xs ${
                    activeTab === tab.id ? 'bg-[#A3E635]/20 text-[#374151] font-bold' : 'bg-[#F3F4F6] text-[#9CA3AF]'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {loadingJobs ? (
              <div className="space-y-4">
                {[1,2].map((i) => <div key={i} className="h-32 w-full rounded-2xl bg-[#F3F4F6] animate-pulse" />)}
              </div>
            ) : jobs.length === 0 ? (
              <div className="rounded-2xl p-8 bg-[#F9FAFB] border border-[#E5E7EB] text-center flex flex-col items-center justify-center min-h-[250px] animate-fade-in">
                <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mb-4 text-2xl">
                  📭
                </div>
                <p className="text-[#1F2937] font-bold text-lg">ยังไม่มีงานในวันนี้</p>
                <p className="text-[#9CA3AF] text-sm mt-1">คุณยังไม่ได้รับมอบหมายงาน หรือทำงานเสร็จหมดแล้ว</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4 mt-2">
                {paginatedJobs.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-[#9CA3AF] font-medium">ไม่มีงานในหมวดหมู่นี้</div>
                ) : (
                  paginatedJobs.map((job, i) => (
                    <JobCard 
                      key={job.id} 
                      job={job} 
                      index={i} 
                      onComplete={setCompleting} 
                      onIncomplete={setIncompleting}
                      onPostpone={setPostponing}
                      onCardClick={(j) => navigate(`/jobs?openJob=${j.id}`)}
                    />
                  ))
                )}
              </div>
            )}

            {/* Pagination Controls */}
            {!loadingJobs && totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  ก่อนหน้า
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const page = idx + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-semibold flex items-center justify-center transition-colors ${
                          currentPage === page 
                            ? 'text-[#1F2937] font-bold' 
                            : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
                        }`}
                        style={currentPage === page ? {
                          background: 'linear-gradient(135deg, #A3E635, #84cc16)',
                          boxShadow: '0 2px 6px rgba(163,230,53,0.3)',
                        } : {}}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  ถัดไป
                </button>
              </div>
            )}
          </div>

          {/* Monthly Goals Section */}
          <div className="mt-2" data-aos="fade-up" data-aos-delay="200">
            <SectionHeader title="เป้าหมายประจำเดือน" />
            <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] flex flex-col md:flex-row items-center gap-6"
              style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div className="w-24 h-24 shrink-0 rounded-full border-4 border-[#A3E635]/30 flex items-center justify-center relative">
                <svg className="w-full h-full text-[#A3E635] absolute -rotate-90" viewBox="0 0 36 36">
                  <path strokeDasharray={`${Math.min(100, Math.max(0, (dashboardStats.goals.completed / dashboardStats.goals.target) * 100))}, 100`} className="stroke-current transition-all duration-1000" fill="none" strokeWidth="3" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span className="text-[#1F2937] font-black text-xl">{Math.round((dashboardStats.goals.completed / dashboardStats.goals.target) * 100)}%</span>
              </div>
              <div className="flex-1">
                <h3 className="text-[#1F2937] font-bold text-lg mb-1">ติดตั้งลูกค้าใหม่สำเร็จ</h3>
                <p className="text-[#6B7280] text-sm mb-3">ทีมของคุณทำผลงานได้ {dashboardStats.goals.completed} งานในเดือนนี้ จากเป้าหมาย {dashboardStats.goals.target} งาน</p>
                <div className="flex gap-4">
                  <div className="bg-[#A3E635]/10 px-3 py-1.5 rounded-lg border border-[#A3E635]/25">
                    <span className="text-xs text-[#65a30d] font-bold block">สำเร็จแล้ว</span>
                    <span className="text-sm font-black text-[#374151]">{dashboardStats.goals.completed} งาน</span>
                  </div>
                  <div className="bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                    <span className="text-xs text-orange-600 font-bold block">เป้าหมาย</span>
                    <span className="text-sm font-black text-orange-700">{dashboardStats.goals.target} งาน</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column (Actions & Check-in) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
          
          {/* Check-in Card */}
          <div
            data-aos="zoom-in"
            data-aos-delay="50"
            className="rounded-2xl p-6 relative overflow-hidden bg-white border transition-all duration-500"
            style={{
              borderColor: checkinStatus === 'checkin' ? 'rgba(163,230,53,0.5)' : '#E5E7EB',
              boxShadow: checkinStatus === 'checkin' ? '0 4px 20px rgba(163,230,53,0.15)' : '0 1px 6px rgba(0,0,0,0.04)',
            }}>

            {/* Decorative */}
            <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full pointer-events-none ${
              checkinStatus === 'checkin' ? 'bg-[#A3E635]/10' : 'bg-[#F3F4F6]'
            } blur-3xl`} />

            <div className="flex items-center gap-5 mb-5 relative z-10">
              {/* Status ring */}
              <div className="relative shrink-0">
                <div className={`w-[76px] h-[76px] rounded-2xl border-[2.5px] ${cfg.ring} flex items-center justify-center text-3xl bg-[#F9FAFB] transition-all duration-500`}
                     style={{ boxShadow: cfg.glow }}>
                  {cfg.emoji}
                </div>
                {cfg.pulse && (
                  <div className={`absolute inset-0 rounded-2xl border-2 ${cfg.ring} animate-ping opacity-30`} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[#1F2937] font-bold text-base">{cfg.title}</p>
                <p className="text-[#9CA3AF] text-[13px] mt-0.5">{cfg.sub}</p>
                {checkinData?.checkin_time && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-1">
                    <p className="text-[11px] text-[#6B7280] flex justify-between">
                      <span>เข้า:</span>
                      <span className="text-[#1F2937] font-mono font-semibold tracking-wide">
                        {new Date(checkinData.checkin_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </p>
                    {checkinData.checkout_time && (
                      <p className="text-[11px] text-[#6B7280] flex justify-between">
                        <span>ออก:</span>
                        <span className="text-[#1F2937] font-mono font-semibold tracking-wide">
                          {new Date(checkinData.checkout_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(canCheckin || canCheckout) && (
              <button
                onClick={() => navigate('/checkin')}
                className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-[#1F2937] shadow-md transition-transform active:scale-[0.98] bg-gradient-to-r ${cfg.btnGrad} ${cfg.btnShadow}`}
                style={checkinStatus === 'none' ? {} : { color: 'white' }}>
                {canCheckin ? '📸 เช็คอินเข้างาน' : '🏁 เช็คเอาท์เลิกงาน'}
              </button>
            )}
          </div>

          {/* Quick Actions Grid */}
          <div data-aos="fade-up" data-aos-delay="150" className="bg-white rounded-2xl p-5 border border-[#E5E7EB]"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-bold text-[#1F2937] mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              เมนูด่วน
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <QuickAction icon="📸" label="เข้างาน"    onClick={() => navigate('/checkin')}
                gradient="from-[#A3E635] to-[#65a30d]" shadow="shadow-lime-500/20" />
              <QuickAction icon="🎒" label="กระเป๋า"     onClick={() => { setShowBag(true); setActive('bag'); }}
                gradient="from-violet-500 to-purple-600" shadow="shadow-violet-500/20" />
              <QuickAction icon="⛽" label="น้ำมัน"      onClick={() => navigate('/oil')}
                gradient="from-amber-400 to-orange-500" shadow="shadow-amber-500/20" />
              <QuickAction icon="🗺️" label="แผนที่"      onClick={() => setActive('map')}
                gradient="from-[#374151] to-[#1F2937]"    shadow="shadow-slate-500/20" />
            </div>
          </div>

          {/* System Announcements */}
          <div data-aos="fade-up" data-aos-delay="250" className="bg-white rounded-2xl p-5 border border-[#E5E7EB]"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-bold text-[#1F2937] mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
              ประกาศจากระบบ
            </h3>
            <div className="space-y-3">
              {dashboardStats.announcements.length > 0 ? (
                dashboardStats.announcements.map((ann, idx) => (
                  <div key={idx} className="flex gap-3 p-3 rounded-xl bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors border border-[#E5E7EB] hover:border-[#A3E635]/20 cursor-pointer group">
                    <div className="w-10 h-10 rounded-xl bg-[#A3E635]/10 flex items-center justify-center shrink-0 text-xl group-hover:scale-110 transition-transform">
                      {ann.type === 'banner' ? '📢' : '🎁'}
                    </div>
                    <div>
                      <p className="text-[#1F2937] font-bold text-sm">{ann.title || 'ประกาศ'}</p>
                      <p className="text-[#6B7280] text-xs mt-0.5">{ann.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-[#9CA3AF] py-4">ไม่มีประกาศใหม่ในขณะนี้</p>
              )}
            </div>
          </div>
          
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────── */}
      {showBag && (
        <TechBagDrawer open={showBag} onClose={() => { setShowBag(false); setActive('home'); }} />
      )}

      {/* ── Job Completion Sheet ─────────────────────────── */}
      {completingJob && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-[#1F2937]/50 backdrop-blur-sm p-4"
             onClick={(e) => e.target === e.currentTarget && setCompleting(null)}>
          <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl p-6 animate-[slideUp_0.3s_ease-out]"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="sm:hidden flex justify-center mb-4">
              <div className="w-10 h-1.5 rounded-full bg-[#E5E7EB]" />
            </div>
            
            <div className="w-12 h-12 rounded-xl bg-[#A3E635]/15 text-[#65a30d] flex items-center justify-center text-2xl mb-4 border border-[#A3E635]/25">
              ✅
            </div>
            
            <h3 className="text-[#1F2937] font-bold text-xl mb-2">ยืนยันการปิดงาน?</h3>
            <p className="text-[#6B7280] text-sm mb-5 leading-relaxed">
              คุณต้องการยืนยันว่างานรหัส <span className="text-[#1F2937] font-mono bg-[#F3F4F6] border border-[#E5E7EB] px-1.5 py-0.5 rounded">{completingJob.access_no}</span> ของลูกค้ารายนี้เสร็จสมบูรณ์แล้วใช่หรือไม่?
              <br/><br/>
              <strong className="text-[#1F2937]">ลูกค้า:</strong> {completingJob.customer}
            </p>
            
            <div className="rounded-xl p-4 bg-[#F9FAFB] border border-[#E5E7EB] mb-6">
              <p className="text-[#9CA3AF] text-xs font-semibold mb-2 uppercase tracking-wider">ระบบจะทำการ:</p>
              <ul className="space-y-2 text-[13px] text-[#374151]">
                <li className="flex gap-2">✔️ <span className="flex-1">อัปเดตสถานะงานเป็น <strong className="text-[#65a30d]">เสร็จสิ้น</strong></span></li>
                <li className="flex gap-2">📊 <span className="flex-1">บันทึกประวัติการทำงานเข้าสู่ระบบส่วนกลาง</span></li>
                <li className="flex gap-2">⛽ <span className="flex-1">นับเพิ่ม 1 งาน สำหรับสถิติค่าเฉลี่ยการใช้น้ำมัน</span></li>
              </ul>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setCompleting(null)}
                className="flex-1 h-12 rounded-xl bg-[#F3F4F6] hover:bg-[#E5E7EB] border border-[#E5E7EB] text-[#6B7280] font-semibold transition-colors">
                ยกเลิก
              </button>
              <button
                onClick={confirmComplete}
                className="flex-1 h-12 rounded-xl text-[#1F2937] font-bold shadow-md transition-all"
                style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)', boxShadow: '0 4px 12px rgba(163,230,53,0.3)' }}>
                ยืนยันการปิดงาน
              </button>
            </div>
          </div>
        </div>
      )}
      {(user?.role === 'ma_technician' || user?.roles?.includes('ma_technician')
        || user?.role === 'contractor_ma' || user?.roles?.includes('contractor_ma')) ? (
        <CompleteMaJobModal
          isOpen={!!completingJob}
          onClose={() => setCompleting(null)}
          job={completingJob}
          onSuccess={fetchJobs}
        />
      ) : (
        <CompleteJobModal
          isOpen={!!completingJob}
          onClose={() => setCompleting(null)}
          job={completingJob}
          onSuccess={fetchJobs}
        />
      )}
      <IncompleteJobModal 
        isOpen={!!incompletingJob} 
        onClose={() => setIncompleting(null)} 
        job={incompletingJob} 
        onSuccess={fetchJobs} 
      />
      <PostponeJobModal 
        isOpen={!!postponingJob} 
        onClose={() => setPostponing(null)} 
        job={postponingJob} 
        onSuccess={fetchJobs} 
      />
    </Layout>
  );
}

// ── Helper Components ─────────────────────────────────────

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-[#A3E635] to-[#65a30d]" />
        <h2 className="text-[#1F2937] font-bold text-base md:text-lg">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function StatCard({ value, label, color }) {
  return (
    <div className="rounded-xl p-4 md:p-5 text-center bg-white border border-[#E5E7EB] hover:shadow-md hover:-translate-y-0.5 transition-all"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <p className={`${color} text-3xl md:text-4xl font-black leading-none tracking-tight`}>{value}</p>
      <p className="text-[#9CA3AF] text-[11px] md:text-xs mt-2 font-medium">{label}</p>
    </div>
  );
}

function QuickAction({ icon, label, onClick, gradient, shadow }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2.5 group active:scale-[0.96] transition-transform">
      <div className={`w-[52px] h-[52px] md:w-14 md:h-14 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br ${gradient} shadow-lg ${shadow} group-hover:scale-105 transition-transform text-white`}>
        {icon}
      </div>
      <span className="text-[#6B7280] text-[11px] font-semibold group-hover:text-[#1F2937] transition-colors">{label}</span>
    </button>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'สวัสดีตอนเช้า';
  if (h < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}
