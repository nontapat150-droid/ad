import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { StatCard, ProgressCard, ShortcutBtn, TechJobActionCard, AdminContactButton } from './SharedComponents';
import { useBranding } from '../../context/BrandingContext';
import { ACTIVE_JOB_STATUSES } from '../../constants/jobStatus';

export default function MaTechSection() {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [maData, setMaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [overdueJobs, setOverdueJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const todayISO = new Date().toLocaleDateString('en-CA');

  const fetchData = () => {
    api.get('/stats/ma-tech-dashboard')
      .then(res => setMaData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));

    api.get(`/dispatch/jobs?type=ma`)
      .then(res => {
        const ACTIVE = ACTIVE_JOB_STATUSES;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const all = res.data.filter(job => ACTIVE.includes(job.status));
        const overdue = all.filter(job => job.plan_arrival_date && new Date(job.plan_arrival_date) < today);
        const active  = all.filter(job => !job.plan_arrival_date || new Date(job.plan_arrival_date) >= today);
        setJobs(active);
        setOverdueJobs(overdue);
      })
      .catch(err => console.error(err))
      .finally(() => setLoadingJobs(false));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    }, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const todayJobs = useMemo(
    () => jobs.filter((j) => j.plan_arrival_date && String(j.plan_arrival_date).slice(0, 10) === todayISO),
    [jobs, todayISO]
  );
  const nextJob = todayJobs[0] || jobs[0] || null;

  const openJob = (job) => navigate(`/dispatch-dashboard?tab=ma&openJob=${job.id}`);

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-36 rounded-2xl bg-[#F3F4F6]" />)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => <div key={i} className="h-32 rounded-2xl bg-[#F3F4F6]" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* Section Title */}
      <div className="flex items-center gap-3 pb-3 border-b border-[#E5E7EB]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center shadow-md shadow-lime-500/20">
          <span className="text-[#1F2937] text-sm">🔧</span>
        </div>
        <h2 className="text-[#1F2937] font-extrabold text-lg">ภาพรวมงาน MA</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="จำนวนงาน MA วันนี้"
          value={maData?.summary?.jobsToday || 0}
          suffix="งาน" gradient="from-[#374151] to-[#1F2937]" icon="📋" shadow="shadow-slate-500/20" />
        <StatCard title="งานที่สำเร็จ"
          value={maData?.summary?.jobsCompleted || 0}
          suffix="งาน" gradient="from-emerald-500 to-teal-500" icon="✅" shadow="shadow-emerald-500/20" />
        <StatCard title="งานที่ไม่สำเร็จ"
          value={maData?.summary?.jobsFailed || 0}
          suffix="งาน" gradient="from-rose-500 to-pink-500" icon="❌" shadow="shadow-rose-500/20" />
      </div>

      {(branding?.admin_phone || branding?.admin_line) && (
        <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB]" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <p className="text-[11px] font-black text-[#6B7280] uppercase tracking-wide mb-2">ติดต่อแอดมิน</p>
          <AdminContactButton phone={branding.admin_phone} lineId={branding.admin_line} />
        </div>
      )}

      {/* Monthly Targets */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
            <span className="text-white text-xs">🎯</span>
          </div>
          <h3 className="text-[#1F2937] font-bold text-base">เป้าหมายประจำเดือน MA</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ProgressCard
            title="งาน MA สำเร็จเดือนนี้"
            current={maData?.summary?.completedMonth || 0}
            target={maData?.summary?.targetJobs || 1}
            suffix="งาน"
            pct={Math.min(100, Math.round(((maData?.summary?.completedMonth || 0) / (maData?.summary?.targetJobs || 1)) * 100))}
            icon="🎯"
            gradient="from-[#374151] to-[#1F2937]"
            trackColor="bg-[#F3F4F6]"
            barColor="from-[#A3E635] to-[#65a30d]"
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

      {/* Shortcuts */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB]"
        style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center shadow-md shadow-lime-500/20">
            <span className="text-[#1F2937] text-xs">⚡</span>
          </div>
          <h3 className="text-[#1F2937] font-bold text-base">ทางลัด</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ShortcutBtn icon="🔧" label="งาน MA ทั้งหมด" sublabel={`${jobs.length} รายการค้าง`}
            onClick={() => navigate('/dispatch-dashboard?tab=ma')} gradient="from-[#374151] to-[#1F2937]" shadow="shadow-slate-500/25" />
          <ShortcutBtn icon="🎒" label="กระเป๋าช่าง" sublabel="อุปกรณ์ของฉัน"
            onClick={() => navigate('/bag')} gradient="from-teal-500 to-cyan-600" shadow="shadow-teal-500/25" />
          <ShortcutBtn icon="⛽" label="กรอกบิลน้ำมัน"
            onClick={() => navigate('/oil')} gradient="from-amber-500 to-orange-500" shadow="shadow-amber-500/25" />
        </div>
      </div>

      {/* Next / today job highlight */}
      {nextJob && (
        <div className="rounded-2xl border border-[#A3E635]/40 bg-[#A3E635]/10 p-4 sm:p-5">
          <p className="text-[11px] font-black text-[#4D7C0F] uppercase tracking-wide mb-3">
            {todayJobs.length ? 'งาน MA ถัดไปวันนี้' : 'งาน MA ถัดไป'}
          </p>
          <TechJobActionCard job={nextJob} jobType="ma" onOpen={openJob} />
        </div>
      )}

      {/* Active Jobs */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB]" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#1F2937] flex items-center justify-center shadow-md shrink-0">
              <span className="text-[#A3E635] text-xs">🚗</span>
            </div>
            <h3 className="text-[#1F2937] font-bold text-base truncate">งาน MA ที่ต้องดำเนินการ</h3>
          </div>
          <button onClick={() => navigate('/dispatch-dashboard?tab=ma')} className="text-xs font-bold text-[#1F2937] px-3 py-2 bg-[#A3E635]/20 border border-[#A3E635]/40 rounded-xl shrink-0">
            ดูทั้งหมด
          </button>
        </div>
        
        {loadingJobs ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map(i => <div key={i} className="h-28 bg-[#F3F4F6] rounded-xl" />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8 text-[#6B7280] bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] font-medium">
            ยังไม่มีงานที่ต้องดำเนินการ
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-0.5">
            {jobs.slice(0, 8).map(job => (
              <TechJobActionCard key={job.id} job={job} jobType="ma" onOpen={openJob} />
            ))}
          </div>
        )}
      </div>

      {/* Overdue MA Jobs */}
      {overdueJobs.length > 0 && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-red-200" style={{ boxShadow: '0 1px 6px rgba(239,68,68,0.1)' }}>
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-md shrink-0">
                <span className="text-white text-xs">⚠️</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-red-700 font-bold text-base">งาน MA ที่เลยกำหนด</h3>
                <p className="text-[11px] text-red-400 font-medium">ด่วน {overdueJobs.length} รายการ</p>
              </div>
            </div>
            <button onClick={() => navigate('/dispatch-dashboard?tab=ma')} className="text-xs font-bold text-red-700 px-3 py-2 bg-red-50 border border-red-200 rounded-xl shrink-0">
              ดูทั้งหมด
            </button>
          </div>
          <div className="space-y-3 max-h-[360px] overflow-y-auto">
            {overdueJobs.slice(0, 6).map(job => (
              <TechJobActionCard key={job.id} job={job} jobType="ma" overdue onOpen={openJob} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
