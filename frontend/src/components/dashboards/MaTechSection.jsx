import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { StatCard, ProgressCard } from './SharedComponents';

export default function MaTechSection() {
  const [maData, setMaData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stats/ma-tech-dashboard')
      .then(res => setMaData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="skeleton h-32 rounded-3xl" />;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
          <span className="text-white text-xs">🔧</span>
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
            <span className="text-white text-xs">🎯</span>
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
  );
}
