import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { StatCard, ShortcutBtn, TechJobActionCard, AdminContactButton } from './SharedComponents';
import { useBranding } from '../../context/BrandingContext';
import { ACTIVE_JOB_STATUSES } from '../../constants/jobStatus';

export default function TechSection() {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [overdueJobs, setOverdueJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const todayISO = new Date().toLocaleDateString('en-CA');

  const fetchData = () => {
    api.get('/stats/office-tech-dashboard')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));

    api.get(`/dispatch/jobs?type=office`)
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

  const openJob = (job) => navigate(`/dispatch-dashboard?tab=office&openJob=${job.id}`);

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(5)].map((_, i) => <div key={i} className="h-36 rounded-2xl bg-[#F3F4F6]" />)}
      </div>
      <div className="h-36 rounded-2xl bg-[#F3F4F6]" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* Stats */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#374151] to-[#1F2937] flex items-center justify-center shadow-md">
            <span className="text-white text-xs">📋</span>
          </div>
          <h3 className="text-[#1F2937] font-bold text-base">สรุปงานประจำวัน (ช่างติดตั้ง)</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard title="งานที่ได้รับมอบหมาย"
            value={data?.summary?.jobsToday || 0}
            suffix="งาน" gradient="from-[#374151] to-[#1F2937]" icon="📋" shadow="shadow-slate-500/20" />
          <StatCard title="งานที่สำเร็จ"
            value={data?.summary?.jobsCompleted || 0}
            suffix="งาน" gradient="from-emerald-500 to-teal-500" icon="✅" shadow="shadow-emerald-500/20" />
          <StatCard title="งานที่ไม่สำเร็จ"
            value={data?.summary?.jobsFailed || 0}
            suffix="งาน" gradient="from-rose-500 to-pink-500" icon="❌" shadow="shadow-rose-500/20" />
          <StatCard title="บิลน้ำมันวันนี้"
            value={data?.summary?.oilToday || 0}
            suffix="บิล" gradient="from-amber-500 to-orange-500" icon="⛽" shadow="shadow-amber-500/20" />
          <StatCard title="ค่าแรกเข้าวันนี้"
            value={data?.summary?.entryToday || 0}
            suffix="รายการ" gradient="from-teal-500 to-cyan-500" icon="💰" shadow="shadow-teal-500/20" />
        </div>
      </div>

      {(branding?.admin_phone || branding?.admin_line) && (
        <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB]" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <p className="text-[11px] font-black text-[#6B7280] uppercase tracking-wide mb-2">ติดต่อแอดมิน</p>
          <AdminContactButton phone={branding.admin_phone} lineId={branding.admin_line} />
        </div>
      )}

      {/* Big CTAs */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB]"
        style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center shadow-md shadow-lime-500/20">
            <span className="text-[#1F2937] text-xs">⚡</span>
          </div>
          <h3 className="text-[#1F2937] font-bold text-base">ทางลัด</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ShortcutBtn icon="📋" label="งานติดตั้งทั้งหมด" sublabel={`${jobs.length} รายการค้าง`}
            onClick={() => navigate('/dispatch-dashboard?tab=office')} gradient="from-[#374151] to-[#1F2937]" shadow="shadow-slate-500/25" />
          <ShortcutBtn icon="⛽" label="กรอกบิลน้ำมัน"
            onClick={() => navigate('/oil')} gradient="from-amber-500 to-orange-500" shadow="shadow-amber-500/25" />
          <ShortcutBtn icon="💰" label="บันทึกค่าแรกเข้า"
            onClick={() => navigate('/entry-fee')} gradient="from-[#A3E635] to-[#65a30d]" shadow="shadow-lime-500/25" />
        </div>
      </div>

      {/* Next / today job highlight */}
      {nextJob && (
        <div className="rounded-2xl border border-[#A3E635]/40 bg-[#A3E635]/10 p-4 sm:p-5">
          <p className="text-[11px] font-black text-[#4D7C0F] uppercase tracking-wide mb-3">
            {todayJobs.length ? 'งานถัดไปวันนี้' : 'งานถัดไป'}
          </p>
          <TechJobActionCard job={nextJob} jobType="office" onOpen={openJob} />
        </div>
      )}

      {/* Today's Jobs */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E5E7EB]" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#1F2937] flex items-center justify-center shadow-md shrink-0">
              <span className="text-[#A3E635] text-xs">🚗</span>
            </div>
            <h3 className="text-[#1F2937] font-bold text-base truncate">งานที่ต้องดำเนินการ</h3>
          </div>
          <button onClick={() => navigate('/dispatch-dashboard?tab=office')} className="text-xs font-bold text-[#1F2937] px-3 py-2 bg-[#A3E635]/20 border border-[#A3E635]/40 rounded-xl shrink-0">
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
              <TechJobActionCard key={job.id} job={job} jobType="office" onOpen={openJob} />
            ))}
          </div>
        )}
      </div>

      {/* Overdue Jobs */}
      {overdueJobs.length > 0 && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-red-200" style={{ boxShadow: '0 1px 6px rgba(239,68,68,0.1)' }}>
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-md shrink-0">
                <span className="text-white text-xs">⚠️</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-red-700 font-bold text-base">งานที่เลยกำหนด</h3>
                <p className="text-[11px] text-red-400 font-medium">ด่วน {overdueJobs.length} รายการ</p>
              </div>
            </div>
            <button onClick={() => navigate('/dispatch-dashboard?tab=office')} className="text-xs font-bold text-red-700 px-3 py-2 bg-red-50 border border-red-200 rounded-xl shrink-0">
              ดูทั้งหมด
            </button>
          </div>
          <div className="space-y-3 max-h-[360px] overflow-y-auto">
            {overdueJobs.slice(0, 6).map(job => (
              <TechJobActionCard key={job.id} job={job} jobType="office" overdue onOpen={openJob} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
