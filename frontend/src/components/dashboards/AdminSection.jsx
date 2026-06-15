import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { StatCard, ShortcutBtn } from './SharedComponents';

export default function AdminSection() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stats/admin-dashboard')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="skeleton h-32 rounded-3xl" />;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
          <span className="text-white text-xs">👑</span>
        </div>
        <h2 className="text-[#042C53] font-extrabold text-lg">แดชบอร์ดแอดมิน</h2>
      </div>

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
    </div>
  );
}
