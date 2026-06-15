import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

import SuperAdminSection from '../components/dashboards/SuperAdminSection';
import AdminSection from '../components/dashboards/AdminSection';
import SalesSection from '../components/dashboards/SalesSection';
import TechSection from '../components/dashboards/TechSection';
import MaTechSection from '../components/dashboards/MaTechSection';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'สวัสดีตอนเช้า';
  if (h < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

export default function UnifiedDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  
  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  
  const isSuperAdmin = userRoles.includes('super_admin');
  const isAdmin = userRoles.includes('admin') && !isSuperAdmin;
  const isSales = userRoles.includes('sales');
  const isTech = userRoles.includes('technician') || userRoles.includes('office_technician');
  const isMaTech = userRoles.includes('ma_technician');

  useEffect(() => {
    api.get('/announcements/active')
      .then(res => setAnnouncements(res.data))
      .catch(err => console.error('Failed to load announcements', err));
  }, []);

  const firstName = user?.full_name?.split(' ')[0] || 'ผู้ใช้งาน';
  const greeting = getGreeting();
  const todayDate = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="flex h-dvh font-sans overflow-hidden" style={{ background: 'var(--page-bg)', backgroundAttachment: 'fixed' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="dashboard" />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px] overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 h-16 backdrop-blur-xl border-b border-white/50 shadow-sm shrink-0"
          style={{ background: 'rgba(255,255,255,0.80)' }}>
          <button onClick={() => setSidebarOpen(true)}
            className="md:hidden flex flex-col items-center justify-center gap-[5px] w-10 h-10 rounded-xl glass border border-white/50 transition-all active:scale-95">
            <span className="block w-[18px] h-[2px] rounded-full bg-slate-600" />
            <span className="block w-[18px] h-[2px] rounded-full bg-slate-600" />
            <span className="block w-[18px] h-[2px] rounded-full bg-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-[#042C53] font-bold text-lg">ภาพรวมระบบ (Dashboard)</h2>
          </div>
          <button onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 text-xs text-[#185FA5] hover:text-[#0C447C] font-semibold bg-[#E6F1FB] hover:bg-[#B5D4F4] px-3 py-1.5 rounded-lg border border-[#185FA5]/20 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            รีเฟรช
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full space-y-8">

            {/* Hero Greeting */}
            <div className="relative overflow-hidden rounded-3xl p-6 md:p-8"
              style={{ background: 'linear-gradient(135deg, #042C53 0%, #185FA5 50%, #378ADD 100%)' }}>
              <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full opacity-10 bg-white blur-2xl pointer-events-none" />
              <div className="absolute right-10 -bottom-12 w-36 h-36 rounded-full opacity-10 bg-white blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <p className="text-blue-200 text-sm font-medium mb-1">{todayDate}</p>
                <h1 className="text-white text-2xl md:text-3xl font-bold leading-snug">
                  {greeting}, <span className="text-blue-200">{firstName}</span> 👋
                </h1>
                <p className="text-blue-300 text-sm mt-2">ยอดรวมงานและบันทึกต่างๆ ประจำวันนี้</p>
              </div>
            </div>

            {/* Global Announcements */}
            {(!isSuperAdmin && !isAdmin) && announcements.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-sm shadow-md shadow-amber-500/20">📢</div>
                  ประกาศจากบริษัท
                </h3>
                {announcements.map(ann => {
                  const styles = {
                    danger:  { bg: 'bg-red-50',     border: 'border-red-200',     title: 'text-red-800',     msg: 'text-red-700',     dot: 'bg-red-500',     icon: '🚨' },
                    warning: { bg: 'bg-amber-50',   border: 'border-amber-200',   title: 'text-amber-800',   msg: 'text-amber-700',   dot: 'bg-amber-500',   icon: '⚠️' },
                    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'text-emerald-800', msg: 'text-emerald-700', dot: 'bg-emerald-500', icon: '✅' },
                  }[ann.type] || { bg: 'bg-blue-50', border: 'border-blue-200', title: 'text-blue-800', msg: 'text-blue-700', dot: 'bg-blue-500', icon: '📋' };
                  return (
                    <div key={ann.id} className={`p-4 rounded-2xl border ${styles.bg} ${styles.border} flex gap-3 shadow-sm`}>
                      <div className="text-xl shrink-0 mt-0.5">{styles.icon}</div>
                      <div>
                        <h4 className={`font-bold text-sm ${styles.title}`}>{ann.title}</h4>
                        <p className={`text-sm mt-1 whitespace-pre-wrap ${styles.msg}`}>{ann.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Render Dashboard Sections based on roles */}
            <div className="space-y-10">
              {isSuperAdmin && <SuperAdminSection />}
              {isAdmin && <AdminSection />}
              {isSales && <SalesSection />}
              {isTech && <TechSection />}
              {isMaTech && <MaTechSection />}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
