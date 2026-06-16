import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { StatCard, ShortcutBtn } from './SharedComponents';

export default function TechSection() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    api.get('/stats/office-tech-dashboard')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));

    api.get(`/dispatch/jobs?type=office`)
      .then(res => {
        const activeJobs = res.data.filter(job => ['pending', 'assigned', 'in_progress', 'paused'].includes(job.status));
        setJobs(activeJobs);
      })
      .catch(err => console.error(err))
      .finally(() => setLoadingJobs(false));
  }, []);

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
          <h3 className="text-[#1F2937] font-bold text-base">สรุปงานประจำวัน (ช่าง)</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard title="จำนวนงานในวันนี้"
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

      {/* Shortcuts */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]"
        style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center shadow-md shadow-lime-500/20">
            <span className="text-[#1F2937] text-xs">⚡</span>
          </div>
          <h3 className="text-[#1F2937] font-bold text-base">เมนูทางลัด (ช่าง)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ShortcutBtn icon="📋" label="งานที่รับมอบหมาย"
            onClick={() => navigate('/jobs')} gradient="from-[#374151] to-[#1F2937]" shadow="shadow-slate-500/25" />
          <ShortcutBtn icon="⛽" label="กรอกบิลน้ำมัน"
            onClick={() => navigate('/oil')} gradient="from-amber-500 to-orange-500" shadow="shadow-amber-500/25" />
          <ShortcutBtn icon="💰" label="บันทึกค่าแรกเข้า"
            onClick={() => navigate('/entry-fee')} gradient="from-[#A3E635] to-[#65a30d]" shadow="shadow-lime-500/25" />
        </div>
      </div>

      {/* Today's Jobs */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20">
              <span className="text-white text-xs">🚗</span>
            </div>
            <h3 className="text-[#1F2937] font-bold text-base">งานที่ต้องดำเนินการ</h3>
          </div>
          <button onClick={() => navigate('/jobs?tab=office')} className="text-sm text-blue-600 hover:text-blue-800 font-bold px-2 py-1 bg-blue-50 rounded-lg">ดูทั้งหมด</button>
        </div>
        
        {loadingJobs ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map(i => <div key={i} className="h-16 bg-[#F3F4F6] rounded-xl" />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-xl border border-slate-100 font-medium">
            ยังไม่มีงานที่ต้องดำเนินการ
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {jobs.map(job => (
              <div key={job.id} onClick={() => navigate('/jobs?tab=office')} className="p-3.5 rounded-xl border border-[#E5E7EB] hover:bg-slate-50 transition-colors flex justify-between items-center cursor-pointer">
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
