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

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-36 rounded-2xl bg-[#F3F4F6]" />)}
      </div>
      <div className="h-40 rounded-2xl bg-[#F3F4F6]" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* Section Title */}
      <div className="flex items-center gap-3 pb-3 border-b border-[#E5E7EB]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center shadow-md shadow-lime-500/20">
          <span className="text-[#1F2937] text-sm">👑</span>
        </div>
        <h2 className="text-[#1F2937] font-extrabold text-lg">แดชบอร์ดแอดมิน</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Stats + Shortcuts */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Stats */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#374151] to-[#1F2937] flex items-center justify-center shadow-md">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-[#1F2937] font-bold text-base">ยอดสรุปงานวันนี้</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatCard title="สินค้าในคลังทั้งหมด"
                value={Number(data?.summary?.totalInventory || 0).toLocaleString()}
                suffix="ชิ้น" gradient="from-[#374151] to-[#1F2937]" icon="📦" shadow="shadow-slate-500/20" />
              <StatCard title="งานยังไม่มอบหมาย"
                value={data?.summary?.unassignedToday || 0}
                suffix="งาน" gradient="from-rose-500 to-pink-600" icon="⚠️" shadow="shadow-rose-500/20"
                urgent={data?.summary?.unassignedToday > 0} />
              <StatCard title="งาน Office วันนี้"
                value={data?.summary?.officeAssignedToday || 0}
                suffix="งาน" gradient="from-[#374151] to-[#1F2937]" icon="🏢" shadow="shadow-slate-500/20" />
              <StatCard title="งาน MA วันนี้"
                value={data?.summary?.maAssignedToday || 0}
                suffix="งาน" gradient="from-emerald-500 to-teal-500" icon="🛠️" shadow="shadow-emerald-500/20" />
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center shadow-md shadow-lime-500/20">
                <svg className="w-3.5 h-3.5 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-[#1F2937] font-bold text-base">ทางลัดด่วน</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ShortcutBtn icon="📦" label="จัดการคลังสินค้า" sublabel="รับ-จ่ายสินค้า"
                onClick={() => navigate('/inventory')} gradient="from-[#374151] to-[#1F2937]" shadow="shadow-slate-500/25" />
              <ShortcutBtn icon="🛠️" label="จ่ายงาน MA" sublabel="มอบหมายงานช่าง"
                onClick={() => navigate('/jobs?tab=ma')} gradient="from-[#65a30d] to-[#A3E635]" shadow="shadow-lime-500/25" />
              <ShortcutBtn icon="🏢" label="จ่ายงาน Office" sublabel="มอบหมายงานออฟฟิศ"
                onClick={() => navigate('/jobs?tab=office')} gradient="from-emerald-500 to-teal-500" shadow="shadow-emerald-500/25" />
            </div>
          </div>
        </div>

        {/* Right: Announcements */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] h-full"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-sm shadow-md shadow-amber-500/20">
                📢
              </div>
              <h3 className="text-[#1F2937] font-bold text-base">ประกาศล่าสุด</h3>
            </div>
            {!data?.announcements || data.announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 bg-[#F3F4F6] rounded-2xl flex items-center justify-center text-3xl mb-3">🔔</div>
                <p className="text-[#9CA3AF] text-sm font-medium">ไม่มีประกาศในขณะนี้</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.announcements.map(ann => (
                  <div key={ann.id}
                    className="p-4 rounded-2xl bg-amber-50 border border-amber-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-start gap-2">
                      <span className="text-lg shrink-0">📋</span>
                      <div className="min-w-0">
                        <h4 className="font-bold text-amber-900 text-sm truncate">{ann.title}</h4>
                        <p className="text-xs text-amber-700 mt-1 line-clamp-3 whitespace-pre-wrap">{ann.content}</p>
                        <p className="text-[10px] text-amber-400 mt-2">
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
