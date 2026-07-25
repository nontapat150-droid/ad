import { useState, useCallback } from 'react';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import ManualModal from './ManualModal';
import ManualHelpButton from './ManualHelpButton';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { normalizePageKey } from '../manuals';

import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function Layout({ children, activeKey, onNavigate, pageTitle, manualPage }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [testingSend, setTestingSend] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('color-theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  const navigate = useNavigate();
  const { user } = useAuth();

  const userRoles = user?.roles || [user?.role || ''];
  const isAdmin = userRoles.includes('super_admin') || userRoles.includes('admin');
  const canUseExpansion = isAdmin || userRoles.includes('sales');

  const close  = useCallback(() => setSidebarOpen(false), []);
  const toggle = useCallback(() => setSidebarOpen((v) => !v), []);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem('color-theme', newTheme);
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return newTheme;
    });
  }, []);

  return (
    <div className="flex min-h-dvh ">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <Sidebar
        open={sidebarOpen}
        onClose={close}
        activeKey={activeKey}
        onNavigate={onNavigate}
      />

      {/* ── Main Area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 main-content-transition md:ml-[var(--sidebar-width)] transition-[margin] duration-300 ease-out">

        {/* ── Top Header Bar ──────────────────────────────── */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 h-16 glass/80 border-b border-white/50 backdrop-blur-xl">

          {/* Hamburger (Mobile Only) */}
          <button
            onClick={toggle}
            aria-label="Toggle menu"
            className="md:hidden flex flex-col items-center justify-center gap-[5px] w-10 h-10 rounded-xl glass border border-white/50 transition-all active:scale-95 shrink-0 hover:bg-[#E6F1FB]"
          >
            <span className={`block w-[18px] h-[2px] rounded-full transition-all duration-300 ${sidebarOpen ? 'bg-brand-500 rotate-45 translate-y-[7px]' : 'bg-slate-600'}`} />
            <span className={`block w-[18px] h-[2px] rounded-full transition-all duration-200 ${sidebarOpen ? 'bg-brand-500 opacity-0 scale-x-0' : 'bg-slate-600'}`} />
            <span className={`block w-[18px] h-[2px] rounded-full transition-all duration-300 ${sidebarOpen ? 'bg-brand-500 -rotate-45 -translate-y-[7px]' : 'bg-slate-600'}`} />
          </button>

          {/* Page Title */}
          <div className="flex-1 min-w-0">
            <h2 className="text-[#042C53] font-bold text-lg truncate">
              {pageTitle || 'แดชบอร์ด'}
            </h2>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <ManualHelpButton onClick={() => setShowManualModal(true)} />

            {/* Expansion jobs (sales / admin) */}
            {canUseExpansion && (
              <button 
                onClick={() => {
                  if (onNavigate) onNavigate('ais_expansion');
                  else navigate('/ais-expansion');
                }}
                className="w-10 h-10 rounded-xl glass border border-white/50 flex items-center justify-center relative hover:bg-[#E6F1FB] transition-colors"
                title="ระบบงานขยาย AIS"
              >
                <svg className="w-5 h-5 text-[#378ADD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </button>
            )}

            {/* Test FCM Button (Admin only) */}
            {isAdmin && (
              <button
                onClick={async () => {
                  if (testingSend) return;
                  setTestingSend(true);
                  try {
                    const res = await api.post('/fcm/test-send');
                    if (res.data.success) {
                      Swal.fire({
                        title: 'สำเร็จ!',
                        text: res.data.message || 'ส่งแจ้งเตือนทดสอบแล้ว',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                      });
                    } else {
                      alert(res.data.message || 'ส่งไม่สำเร็จ');
                    }
                  } catch (err) {
                    const msg = err.response?.data?.error || 'เกิดข้อผิดพลาด';
                    alert(msg);
                  } finally {
                    setTestingSend(false);
                  }
                }}
                disabled={testingSend}
                className="h-10 px-3 rounded-xl glass border border-white/50 flex items-center justify-center gap-1.5 hover:bg-[#E6F1FB] transition-all text-xs font-semibold text-[#378ADD] disabled:opacity-50 active:scale-95"
                title="ทดสอบส่ง Push Notification"
              >
                {testingSend ? (
                  <div className="w-4 h-4 border-2 border-[#378ADD]/30 border-t-[#378ADD] rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                <span className="hidden sm:inline">ทดสอบ FCM</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl glass border border-white/50 flex items-center justify-center relative hover:bg-[#E6F1FB] transition-colors"
              title={theme === 'dark' ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Notification bell */}
            <NotificationBell />
          </div>
        </header>

        {/* ── Page Content ────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      <ManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        userRoles={userRoles}
        pageName={normalizePageKey(manualPage || activeKey)}
      />
    </div>
  );
}
