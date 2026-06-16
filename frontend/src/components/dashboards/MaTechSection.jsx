import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { StatCard, ProgressCard } from './SharedComponents';

export default function MaTechSection() {
  const [maData, setMaData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    api.get('/stats/ma-tech-dashboard')
      .then(res => setMaData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));

    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    api.get(`/dispatch/jobs?type=ma&date=${today}`)
      .then(res => setJobs(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoadingJobs(false));
  }, []);

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

      {/* Today's Jobs */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20">
              <span className="text-white text-xs">🚗</span>
            </div>
            <h3 className="text-[#1F2937] font-bold text-base">งาน MA ที่ได้รับมอบหมายวันนี้</h3>
          </div>
          <button onClick={() => window.location.href = '/jobs?tab=ma'} className="text-sm text-blue-600 hover:text-blue-800 font-bold px-2 py-1 bg-blue-50 rounded-lg">ดูทั้งหมด</button>
        </div>
        
        {loadingJobs ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map(i => <div key={i} className="h-16 bg-[#F3F4F6] rounded-xl" />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-xl border border-slate-100 font-medium">
            ยังไม่มีงานในวันนี้
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {jobs.map(job => (
              <div key={job.id} onClick={() => window.location.href = '/jobs?tab=ma'} className="p-3.5 rounded-xl border border-[#E5E7EB] hover:bg-slate-50 transition-colors flex justify-between items-center cursor-pointer">
                <div>
                  <div className="font-bold text-slate-800">{job.access_no}</div>
                  <div className="text-sm text-slate-500 line-clamp-1">{job.customer || job.address}</div>
                </div>
                <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                  job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                  job.status === 'failed' ? 'bg-red-100 text-red-700' :
                  job.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {job.status === 'completed' ? 'สำเร็จ' : job.status === 'failed' ? 'ไม่สำเร็จ' : job.status === 'assigned' ? 'กำลังดำเนินการ' : 'รอการจ่ายงาน'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
