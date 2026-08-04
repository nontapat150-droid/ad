import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { StatCard, ShortcutBtn } from './SharedComponents';

const FEED_CONFIG = {
  oil:       { icon: '⛽', label: 'น้ำมัน',  color: 'bg-amber-100 text-amber-600',  dot: 'bg-amber-400' },
  entry_fee: { icon: '💰', label: 'แรกเข้า', color: 'bg-teal-100 text-teal-600',    dot: 'bg-teal-400' },
  checkin:   { icon: '📍', label: 'เช็คอิน', color: 'bg-violet-100 text-violet-600', dot: 'bg-violet-400' },
  job:       { icon: '📋', label: 'ผลงาน',   color: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-400' },
};

const ROLE_CONFIG = {
  super_admin:       { label: 'ผู้ดูแลระบบ',  bg: 'bg-[#1F2937]',     text: 'text-white'        },
  admin:             { label: 'แอดมิน',      bg: 'bg-[#A3E635]',     text: 'text-[#1F2937]'    },
  ma_technician:     { label: 'ช่าง MA',      bg: 'bg-violet-100',    text: 'text-violet-700'   },
  technician:        { label: 'ช่าง Office',  bg: 'bg-sky-100',       text: 'text-sky-700'      },
  contractor_office: { label: 'รับเหมาติดตั้ง', bg: 'bg-amber-100',    text: 'text-amber-700'    },
  contractor_ma:     { label: 'รับเหมา MA',    bg: 'bg-indigo-100',    text: 'text-indigo-700'   },
  sales:             { label: 'เซล',        bg: 'bg-pink-100',      text: 'text-pink-700'     },
  user:              { label: 'พนักงาน',     bg: 'bg-slate-100',     text: 'text-slate-600'    },
};

const TEAM_COLORS = [
  { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500',    border: 'border-blue-200' },
  { bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500',  border: 'border-violet-200' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   border: 'border-amber-200' },
  { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500',    border: 'border-rose-200' },
  { bg: 'bg-cyan-100',    text: 'text-cyan-700',    dot: 'bg-cyan-500',    border: 'border-cyan-200' },
  { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500',  border: 'border-orange-200' },
  { bg: 'bg-pink-100',    text: 'text-pink-700',    dot: 'bg-pink-500',    border: 'border-pink-200' },
];

function getRoleStyle(role) {
  return ROLE_CONFIG[role] || { label: role || 'พนักงาน', bg: 'bg-gray-100', text: 'text-gray-600' };
}

function RoleBadge({ role }) {
  const s = getRoleStyle(role);
  return (
    <span className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-md ${s.bg} ${s.text} shadow-sm border border-black/5`}>
      {s.label}
    </span>
  );
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return `${Math.floor(diff)} วินาทีที่แล้ว`;
  if (diff < 3600)  return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  return new Date(dateStr).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function timeOffline(dateStr) {
  if (!dateStr) return 'ไม่เคยเข้าใช้งาน';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return `ออฟไลน์ไปแล้ว ${Math.floor(diff)} วินาที`;
  if (diff < 3600)  return `ออฟไลน์ไปแล้ว ${Math.floor(diff / 60)} นาที`;
  if (diff < 86400) return `ออฟไลน์ไปแล้ว ${Math.floor(diff / 3600)} ชั่วโมง`;
  return `ออฟไลน์ไปแล้ว ${Math.floor(diff / 86400)} วัน`;
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center text-base shadow-md shadow-lime-500/20 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-[#1F2937] dark:text-slate-100 font-black text-lg leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-[#6B7280] font-medium truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function SuperAdminSection() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const feedRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'visible'
  );

  useEffect(() => {
    const onVisibility = () => setIsTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!isTabVisible) return;

    let animationFrameId;
    let lastTime = performance.now();
    const speed = 20;

    const scroll = (time) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (!isHovered && feedRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
        if (scrollHeight > clientHeight) {
          if (scrollTop + clientHeight < scrollHeight - 1) {
            feedRef.current.scrollTop += speed * delta;
          } else {
            feedRef.current.scrollTop = 0;
          }
        }
      }
      animationFrameId = requestAnimationFrame(scroll);
    };

    animationFrameId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isHovered, isTabVisible]);

  const fetchData = () => {
    api.get('/stats/super-admin-dashboard?refresh=1')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
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

  const onlineGroups = data?.onlineStatus?.reduce((acc, curr) => {
    if (!acc[curr.team_name]) acc[curr.team_name] = [];
    acc[curr.team_name].push(curr);
    return acc;
  }, {}) || {};

  const teamColorMap = {};
  let colorIdx = 0;
  if (data?.onlineStatus) {
    data.onlineStatus.forEach(u => {
      const key = u.team_name || '__none__';
      if (!teamColorMap[key]) {
        teamColorMap[key] = TEAM_COLORS[colorIdx % TEAM_COLORS.length];
        colorIdx++;
      }
    });
  }

  const s = data?.summary || {};
  const pendingUsers = Number(s.pendingUsers || 0);
  const openReports = Number(s.openReports || 0);
  const unassigned = Number(s.unassignedToday || 0);
  const onlineUsers = Number(s.onlineUsers || 0);
  const totalUsers = Number(s.totalUsers || 0);

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-3xl bg-[#F3F4F6]" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-36 rounded-3xl bg-[#F3F4F6]" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Title */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB] dark:border-slate-700">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1F2937] to-[#374151] flex items-center justify-center shadow-md shrink-0">
            <span className="text-[#A3E635] text-sm">🛡️</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-[#1F2937] dark:text-slate-100 font-extrabold text-lg leading-tight">ดูแลระบบ</h2>
            <p className="text-xs text-[#6B7280] font-medium truncate">จัดการผู้ใช้ ตั้งค่า และดูภาพรวม — ช่วยแอดมินเมื่อมีปัญหา</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/users')}
          className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-[#1F2937] text-white hover:bg-[#374151] transition-colors"
        >
          จัดการผู้ใช้
        </button>
      </div>

      {/* System KPIs */}
      <div>
        <SectionHeader icon="📊" title="ภาพรวมระบบ" subtitle="ตัวเลขระดับองค์กร / เดือนนี้" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="สินค้าในคลังทั้งหมด"
            value={Number(s.totalInventory || 0).toLocaleString()}
            suffix="ชิ้น" gradient="from-[#374151] to-[#1F2937]" icon="📦" shadow="shadow-slate-500/20"
            onClick={() => navigate('/inventory')} />
          <StatCard title="ลูกค้า NON ทั้งหมด"
            value={Number(s.totalNonCustomers || 0).toLocaleString()}
            suffix="ราย" gradient="from-violet-500 to-purple-700" icon="🏢" shadow="shadow-violet-500/20"
            onClick={() => navigate('/customers')} />
          <StatCard title="บิลน้ำมันเดือนนี้"
            value={s.monthlyOilBills || 0}
            suffix="บิล" gradient="from-amber-500 to-orange-500" icon="⛽" shadow="shadow-amber-500/20"
            onClick={() => navigate('/oil')} />
          <StatCard title="ค่าแรกเข้าเดือนนี้"
            value={s.monthlyEntryFees || 0}
            suffix="รายการ" gradient="from-teal-500 to-cyan-500" icon="💰" shadow="shadow-teal-500/20"
            onClick={() => navigate('/entry-fee')} />
        </div>
      </div>

      {/* Help admin / system alerts — secondary, not full dispatch UI */}
      <div>
        <SectionHeader icon="🛟" title="ช่วยแอดมิน / สิ่งที่ต้องดู" subtitle="จุดที่อาจติดขัด — ไม่ใช่คิวจ่ายงานหลัก" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="ผู้ใช้รออนุมัติ"
            value={pendingUsers}
            suffix="คน"
            gradient="from-amber-500 to-orange-500"
            icon="👤"
            shadow="shadow-amber-500/20"
            urgent={pendingUsers > 0}
            onClick={() => navigate('/users?status=pending')}
          />
          <StatCard
            title="รายการแจ้งปัญหา"
            value={openReports}
            suffix="รายการ"
            gradient="from-rose-500 to-pink-600"
            icon="🆘"
            shadow="shadow-rose-500/20"
            urgent={openReports > 0}
            onClick={() => navigate('/report')}
          />
          <StatCard
            title="งานยังไม่มอบหมาย"
            value={unassigned}
            suffix="งาน"
            gradient="from-slate-600 to-slate-800"
            icon="📭"
            shadow="shadow-slate-500/20"
            urgent={unassigned > 0}
            onClick={() => navigate('/dispatch-dashboard?tab=office&queue=unassigned')}
          />
          <StatCard
            title="ผู้ใช้ออนไลน์ตอนนี้"
            value={onlineUsers}
            suffix={`/ ${totalUsers} คน`}
            gradient="from-emerald-500 to-teal-500"
            icon="🟢"
            shadow="shadow-emerald-500/20"
          />
        </div>
      </div>

      {/* System stewardship shortcuts */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-[#E5E7EB] dark:border-slate-700"
        style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <SectionHeader icon="⚡" title="ทางลัดดูแลระบบ" subtitle="หน้าที่แอดมินเข้าไม่ได้ หรือใช้แก้ปัญหา" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ShortcutBtn icon="👥" label="จัดการผู้ใช้" sublabel="อนุมัติ / บทบาท / ทีม"
            onClick={() => navigate('/users')} gradient="from-[#1F2937] to-[#374151]" shadow="shadow-slate-500/25" />
          <ShortcutBtn icon="⚙️" label="ตั้งค่าระบบ" sublabel="แบรนด์ / ค่าคอนฟิก"
            onClick={() => navigate('/settings')} gradient="from-slate-600 to-slate-800" shadow="shadow-slate-500/25" />
          <ShortcutBtn icon="📈" label="สรุปผล MA" sublabel="ประสิทธิภาพงาน MA"
            onClick={() => navigate('/ma-performance')} gradient="from-violet-500 to-purple-600" shadow="shadow-violet-500/25" />
          <ShortcutBtn icon="🆘" label="รายการแจ้งปัญหา" sublabel="ติดตามเคสจากผู้ใช้"
            onClick={() => navigate('/report')} gradient="from-rose-500 to-pink-600" shadow="shadow-rose-500/25" />
          <ShortcutBtn icon="📢" label="ระบบประกาศ" sublabel="ประกาศถึงพนักงาน"
            onClick={() => navigate('/announcements')} gradient="from-amber-500 to-orange-500" shadow="shadow-amber-500/25" />
          <ShortcutBtn icon="📋" label="ช่วยจ่ายงาน" sublabel="เปิด Dispatch เมื่อแอดมินติด"
            onClick={() => navigate('/dispatch-dashboard')} gradient="from-[#65a30d] to-[#A3E635]" shadow="shadow-lime-500/25" />
        </div>
      </div>

      {/* Feed + Online */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-[#E5E7EB] dark:border-slate-700 overflow-hidden flex flex-col h-[480px] shadow-sm">
          <div className="px-6 py-5 border-b border-[#F3F4F6] dark:border-slate-700 flex items-center justify-between shrink-0 bg-[#F9FAFB] dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center shadow-md shadow-lime-500/20">
                <span className="text-[#1F2937] text-lg font-black">⚡</span>
              </div>
              <div>
                <h2 className="text-[#1F2937] dark:text-slate-100 font-black text-base">Activity Feed</h2>
                <p className="text-[#6B7280] dark:text-slate-400 text-xs font-bold mt-0.5">การทำรายการล่าสุดวันนี้</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>

          <div
            ref={feedRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={() => setIsHovered(true)}
            onTouchEnd={() => setIsHovered(false)}
            className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-[#F9FAFB] dark:bg-slate-900/30"
          >
            {data?.feed?.length > 0 ? (
              data.feed.map((item, idx) => {
                const cfg = FEED_CONFIG[item.type] || { icon: '📌', label: 'กิจกรรม', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' };
                return (
                  <div
                    key={`feed-${item.type}-${item.id}-${idx}`}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-slate-700 rounded-2xl border border-[#E5E7EB] dark:border-slate-600 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-all hover:border-[#A3E635]/40"
                  >
                    <div className="relative shrink-0">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black overflow-hidden shadow-sm border border-black/5 relative ${cfg.color}`}>
                        <span className="absolute inset-0 flex items-center justify-center opacity-80">{item.user_name ? item.user_name.charAt(0) : cfg.icon}</span>
                        {item.profile_image && (
                          <img src={`/uploads/profiles/${item.profile_image.split('/').pop()}`}
                            className="w-full h-full object-cover absolute inset-0 z-10 bg-white" alt={item.user_name}
                            onError={(e) => { e.target.style.display = 'none'; }} />
                        )}
                      </div>
                      <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 flex items-center justify-center bg-white rounded-full border border-[#E5E7EB] shadow-sm text-[10px] z-20">
                        {cfg.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#1F2937] dark:text-slate-100 text-sm font-medium truncate">
                        <span className="font-black text-base">{item.user_name || 'ผู้ใช้'}</span>
                        {' '}
                        <span className="text-[#6B7280] font-bold">{item.action}</span>
                      </p>
                      <p className="text-[#9CA3AF] text-xs font-bold mt-1">{timeAgo(item.created_at)}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-lg ${cfg.color} border border-black/5 hidden sm:block shadow-sm`}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-16 h-16 bg-white shadow-sm border border-[#E5E7EB] rounded-full flex items-center justify-center text-3xl mb-4">📭</div>
                <p className="text-[#1F2937] font-black text-base">ยังไม่มีรายการล่าสุด</p>
                <p className="text-[#9CA3AF] text-xs font-bold mt-1">การทำรายการใหม่จะปรากฏที่นี่</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-[#E5E7EB] dark:border-slate-700 overflow-hidden flex flex-col h-[480px] shadow-sm">
          <div className="px-6 py-5 border-b border-[#F3F4F6] dark:border-slate-700 flex items-center gap-3 shrink-0 bg-[#F9FAFB] dark:bg-slate-900/50">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20">
              <span className="text-white text-lg">👥</span>
            </div>
            <div>
              <h2 className="text-[#1F2937] dark:text-slate-100 font-black text-base">สถานะการทำงาน</h2>
              <p className="text-[#6B7280] dark:text-slate-400 text-xs font-bold mt-0.5">
                ออนไลน์ {onlineUsers} / {totalUsers} คน · แยกตามทีม
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar bg-[#F9FAFB] dark:bg-slate-900/30">
            {Object.keys(onlineGroups).length > 0 ? (
              Object.entries(onlineGroups).map(([teamName, users]) => {
                const tc = teamColorMap[teamName === 'ไม่มีทีม' ? '__none__' : teamName];
                return (
                  <div key={teamName} className={`bg-white dark:bg-slate-700 rounded-2xl p-4 border ${tc?.border || 'border-[#E5E7EB]'} dark:border-slate-600 shadow-[0_2px_12px_rgba(0,0,0,0.03)]`}>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#F3F4F6] dark:border-slate-600">
                      <h3 className="font-black text-[#1F2937] dark:text-slate-100 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <span className={`w-3 h-3 rounded-full ${tc?.dot || 'bg-[#D1D5DB]'}`} />
                        {teamName}
                      </h3>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${tc?.bg || 'bg-gray-100'} ${tc?.text || 'text-gray-600'}`}>
                        {users.length} คน
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {users.map(u => {
                        const roles = u.roles_csv ? u.roles_csv.split(',') : [u.role];
                        return (
                          <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F9FAFB] dark:bg-slate-800 border border-[#E5E7EB] dark:border-slate-600 hover:border-[#A3E635]/50 hover:shadow-sm transition-all group">
                            <div className="relative shrink-0">
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black overflow-hidden shadow-sm transition-transform group-hover:scale-105 relative ${tc?.bg || 'bg-[#F3F4F6]'} ${tc?.text || 'text-[#374151]'}`}>
                                <span className="absolute inset-0 flex items-center justify-center">{u.full_name.charAt(0)}</span>
                                {u.profile_image && (
                                  <img src={`/uploads/profiles/${u.profile_image.split('/').pop()}`}
                                    className="w-full h-full object-cover absolute inset-0 z-10 bg-white" alt={u.full_name}
                                    onError={(e) => { e.target.style.display = 'none'; }} />
                                )}
                              </div>
                              <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-[2.5px] border-white shadow-sm ${u.is_online ? 'bg-[#A3E635]' : 'bg-[#D1D5DB]'}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-[#1F2937] dark:text-slate-100 truncate leading-tight">{u.full_name}</p>
                              <p className={`text-[10px] ${u.is_online ? 'text-[#65a30d] font-bold' : 'text-[#9CA3AF] font-medium'}`}>
                                {u.is_online ? '● กำลังใช้งาน' : `○ ${timeOffline(u.last_active)}`}
                              </p>
                              <div className="flex gap-1 flex-wrap mt-1">
                                {roles.map(r => <RoleBadge key={r} role={r} />)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-white shadow-sm border border-[#E5E7EB] rounded-full flex items-center justify-center text-3xl mb-4">👥</div>
                <p className="text-[#1F2937] font-black text-base">ไม่มีข้อมูลผู้ใช้งาน</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
