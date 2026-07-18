import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';
import { useBranding } from '../context/BrandingContext';
import { getImageUrl } from '../utils/imageUtils';
import ManualModal from '../components/ManualModal';

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
  const [showManualModal, setShowManualModal] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const { branding } = useBranding();

  const userRoles = user?.roles || (user?.role ? [user.role] : []);

  const isSuperAdmin = userRoles.includes('super_admin');
  const isAdmin      = userRoles.includes('admin') && !isSuperAdmin;
  const isSales      = userRoles.includes('sales');
  const isTech       = userRoles.includes('technician') || userRoles.includes('office_technician');
  const isMaTech     = userRoles.includes('ma_technician');

  useEffect(() => {
    api.get('/announcements/active')
      .then(res => setAnnouncements(res.data))
      .catch(err => console.error('Failed to load announcements', err));
  }, []);

  const firstName  = user?.full_name?.split(' ')[0] || 'ผู้ใช้งาน';
  const greeting   = getGreeting();
  const todayDate  = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Role label for hero
  const roleLabel = isSuperAdmin ? 'Super Admin'
    : isAdmin ? 'Admin'
    : isMaTech ? 'ช่าง MA'
    : userRoles.includes('contractor_office') ? 'รับเหมาติดตั้ง'
    : userRoles.includes('contractor_ma') ? 'รับเหมา MA'
    : isTech ? 'ช่างออฟฟิศ'
    : isSales ? 'เซล'
    : 'ผู้ใช้งาน';

  return (
    <div className="flex h-dvh font-sans overflow-hidden bg-[#F3F4F6] dark:bg-slate-900">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="dashboard" />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px] overflow-hidden">

        {/* ── Header ── */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-white dark:bg-slate-800 border-b border-[#E5E7EB] dark:border-slate-700 shrink-0"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden flex flex-col items-center justify-center gap-[5px] w-9 h-9 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors active:scale-95"
          >
            <span className="block w-[16px] h-[2px] rounded-full bg-[#374151]" />
            <span className="block w-[16px] h-[2px] rounded-full bg-[#374151]" />
            <span className="block w-[16px] h-[2px] rounded-full bg-[#374151]" />
          </button>

          <div className="flex-1 flex items-center gap-2">
            {/* Branding logo */}
            {branding?.website_logo ? (
              <img src={getImageUrl(branding.website_logo, 'branding')} alt="Logo" className="w-7 h-7 object-contain rounded-lg" />
            ) : (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}>
                <svg className="w-4 h-4 text-[#1F2937]" viewBox="0 0 24 24" fill="none">
                  <path d="M12 18a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
                  <path d="M8.5 14.5a5 5 0 017 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M5.5 11.5a9 9 0 0113 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            )}
            <h2 className="text-[#1F2937] dark:text-slate-100 font-bold text-base hidden sm:block">ภาพรวมระบบ</h2>
          </div>

          {/* Refresh */}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 text-xs text-[#65a30d] hover:text-[#1F2937] font-semibold bg-[#F3F4F6] dark:bg-slate-700 hover:bg-[#A3E635]/15 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-slate-600 hover:border-[#A3E635]/40 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            รีเฟรช
          </button>

          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-slate-800 font-semibold bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 px-3 py-1.5 rounded-lg border border-brand-200 dark:border-brand-800 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            คู่มือ
          </button>

          <ThemeToggle />
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full space-y-6">

            {/* ── Hero Greeting Banner ── */}
            <div className="relative overflow-hidden rounded-2xl p-6 md:p-8"
              style={{ background: 'linear-gradient(135deg, #1F2937 0%, #374151 50%, #1a2535 100%)' }}>
              {/* Lime accent line top */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#A3E635] to-transparent opacity-90" />

              {/* Decorative circles */}
              <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full border border-[#A3E635]/15" />
              <div className="absolute right-20 bottom-0 translate-y-1/2 w-24 h-24 rounded-full border border-[#A3E635]/10" />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:block">
                <svg className="w-28 h-28 text-[#A3E635]/8" viewBox="0 0 48 48" fill="none">
                  <path d="M24 36a2 2 0 100-4 2 2 0 000 4z" fill="currentColor"/>
                  <path d="M17.1 29.1a9.9 9.9 0 0113.8 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M11.3 23.3a17.9 17.9 0 0125.4 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M5.5 17.5a26 26 0 0137 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-[#A3E635] bg-[#A3E635]/10 border border-[#A3E635]/25 px-2.5 py-1 rounded-full tracking-widest uppercase">
                    {roleLabel}
                  </span>
                  <span className="text-[#9CA3AF] text-xs">{todayDate}</span>
                </div>
                <h1 className="text-white text-2xl md:text-3xl font-black leading-snug">
                  {greeting},{' '}
                  <span className="text-[#A3E635]">{firstName}</span>
                  {' '}👋
                </h1>
                <p className="text-[#9CA3AF] text-sm mt-2">ยอดรวมงานและบันทึกต่างๆ ประจำวันนี้</p>
              </div>
            </div>

            {/* ── Global Announcements (non-admin roles) ── */}
            {(!isSuperAdmin && !isAdmin) && announcements.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[#1F2937] dark:text-slate-100 font-bold text-sm flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-sm shadow-md shadow-amber-500/20">📢</div>
                  ประกาศจากบริษัท
                </h3>
                {announcements.map(ann => {
                  const styles = {
                    danger:  { bg: 'bg-red-50',     border: 'border-red-200',     title: 'text-red-800',     msg: 'text-red-700',     icon: '🚨' },
                    warning: { bg: 'bg-amber-50',   border: 'border-amber-200',   title: 'text-amber-800',   msg: 'text-amber-700',   icon: '⚠️' },
                    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'text-emerald-800', msg: 'text-emerald-700', icon: '✅' },
                  }[ann.type] || { bg: 'bg-blue-50', border: 'border-blue-200', title: 'text-blue-800', msg: 'text-blue-700', icon: '📋' };
                  return (
                    <div key={ann.id} className={`p-4 rounded-xl border ${styles.bg} ${styles.border} flex gap-3 shadow-sm`}>
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

            {/* ── Role Sections ── */}
            <div className="space-y-10">
              {isSuperAdmin && <SuperAdminSection />}
              {isAdmin      && <AdminSection />}
              {isSales      && <SalesSection />}
              {isTech       && <TechSection />}
              {isMaTech     && <MaTechSection />}
            </div>

          </div>
        </main>
      </div>

      <ManualModal 
        isOpen={showManualModal} 
        onClose={() => setShowManualModal(false)} 
        userRoles={userRoles} 
        pageName="dashboard" 
      />
    </div>
  );
}
