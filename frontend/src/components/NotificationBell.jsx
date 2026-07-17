import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import InboxModal from './InboxModal';

export default function NotificationBell() {
  const [inboxOpen, setInboxOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
    // Poll every 60 seconds, but only if the tab is active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
      }
    }, 60000);
    
    // Listen for instant local events (e.g. from testing event messages)
    const handleInstantAlert = () => fetchUnreadCount();
    window.addEventListener('new_message_alert', handleInstantAlert);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('new_message_alert', handleInstantAlert);
    };
  }, [fetchUnreadCount]);

  return (
    <>
      <button 
        onClick={() => setInboxOpen(true)}
        className="w-10 h-10 rounded-xl glass border border-[#E5E7EB] bg-white flex items-center justify-center relative hover:bg-[#E6F1FB] transition-colors"
        title="กล่องข้อความ"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <svg className="w-5 h-5 text-[#378ADD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {/* Unread badge with count */}
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 border-2 border-white flex items-center justify-center px-1">
            <span className="text-[10px] font-bold text-white leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </div>
        )}
      </button>

      {createPortal(
        <InboxModal 
          open={inboxOpen} 
          onClose={() => setInboxOpen(false)} 
          onReadMessage={fetchUnreadCount}
        />,
        document.body
      )}
    </>
  );
}
