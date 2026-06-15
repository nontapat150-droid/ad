import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { StatCard, ShortcutBtn } from './SharedComponents';

export default function TechSection() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stats/office-tech-dashboard')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="skeleton h-32 rounded-3xl" />;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#185FA5] to-[#0C447C] flex items-center justify-center shadow-md">
            <span className="text-white text-xs">📋</span>
          </div>
          สรุปงานประจำวัน (ช่าง)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard title="จำนวนงานในวันนี้" value={data?.summary?.jobsToday || 0} suffix="งาน" gradient="from-[#185FA5] to-[#378ADD]" icon="📋" shadow="shadow-blue-500/20" />
          <StatCard title="งานที่สำเร็จ" value={data?.summary?.jobsCompleted || 0} suffix="งาน" gradient="from-emerald-500 to-teal-500" icon="✅" shadow="shadow-emerald-500/20" />
          <StatCard title="งานที่ไม่สำเร็จ" value={data?.summary?.jobsFailed || 0} suffix="งาน" gradient="from-rose-500 to-pink-500" icon="❌" shadow="shadow-rose-500/20" />
          <StatCard title="บิลน้ำมันวันนี้" value={data?.summary?.oilToday || 0} suffix="บิล" gradient="from-amber-500 to-orange-500" icon="⛽" shadow="shadow-amber-500/20" />
          <StatCard title="ค่าแรกเข้าวันนี้" value={data?.summary?.entryToday || 0} suffix="รายการ" gradient="from-teal-500 to-cyan-500" icon="💰" shadow="shadow-teal-500/20" />
        </div>
      </div>

      <div className="glass rounded-3xl p-6 border border-white/50 shadow-sm">
        <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20">
            <span className="text-white text-xs">⚡</span>
          </div>
          เมนูทางลัด (ช่าง)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ShortcutBtn icon="📋" label="งานที่รับมอบหมาย" onClick={() => navigate('/jobs')} gradient="from-[#185FA5] to-[#378ADD]" shadow="shadow-blue-500/25" />
          <ShortcutBtn icon="⛽" label="กรอกบิลน้ำมัน" onClick={() => navigate('/oil')} gradient="from-amber-500 to-orange-500" shadow="shadow-amber-500/25" />
          <ShortcutBtn icon="💰" label="บันทึกค่าแรกเข้า" onClick={() => navigate('/entry-fee')} gradient="from-emerald-500 to-teal-500" shadow="shadow-emerald-500/25" />
        </div>
      </div>
    </div>
  );
}
