import { useState, useCallback, useEffect } from 'react';
import Sidebar from './Sidebar';
import InboxModal from './InboxModal';
import api from '../api/axios';

export default function Layout({ children, activeKey, onNavigate, pageTitle }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const close  = useCallback(() => setSidebarOpen(false), []);
  const toggle = useCallback(() => setSidebarOpen((v) => !v), []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/messages/unread-count');
      setUnreadCount(res.data.count);
    } catch (err) {
      console.error('Failed to fetch unread count', err);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

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
      <div className="flex-1 flex flex-col min-w-0 main-content-transition md:ml-[280px]">

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
            {/* Map Button */}
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('openAisExpansionMap'))}
              className="w-10 h-10 rounded-xl glass border border-white/50 flex items-center justify-center relative hover:bg-[#E6F1FB] transition-colors"
              title="แผนที่งานขยาย AIS"
            >
              <svg className="w-5 h-5 text-[#378ADD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </button>
            {/* Notification bell */}
            <button 
              onClick={() => setInboxOpen(true)}
              className="w-10 h-10 rounded-xl glass border border-white/50 flex items-center justify-center relative hover:bg-[#E6F1FB] transition-colors"
            >
              <svg className="w-5 h-5 text-[#378ADD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {/* Unread dot */}
              {unreadCount > 0 && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />
              )}
            </button>
          </div>
        </header>

        {/* ── Page Content ────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      <InboxModal 
        open={inboxOpen} 
        onClose={() => setInboxOpen(false)} 
        onReadMessage={fetchUnreadCount}
      />
    </div>
  );
}
