import { useState, useEffect, useCallback, useRef } from 'react';
import { requestNotificationPermission, onForegroundMessage } from '../lib/firebase';
import api from '../api/axios';
import Swal from 'sweetalert2';

// ── Toast Notification Component ────────────────────────────
function NotificationToast({ notification, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed top-20 right-4 z-[9999] max-w-sm w-full animate-slide-in-right"
      style={{ animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      <div
        className="rounded-2xl shadow-2xl border overflow-hidden backdrop-blur-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(240,245,255,0.95))',
          borderColor: 'rgba(55,138,221,0.25)',
          boxShadow: '0 20px 60px rgba(4,44,83,0.15), 0 0 0 1px rgba(55,138,221,0.1)',
        }}
      >
        {/* Gradient accent bar */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #378ADD, #185FA5, #042C53)' }} />
        
        <div className="p-4 flex items-start gap-3">
          {/* Bell icon with pulse */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative"
            style={{ background: 'linear-gradient(135deg, #378ADD, #185FA5)' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {/* Pulse ring */}
            <div
              className="absolute inset-0 rounded-xl animate-ping"
              style={{ background: 'rgba(55,138,221,0.3)', animationDuration: '1.5s', animationIterationCount: '2' }}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-[#042C53] truncate">
              {notification.title || 'แจ้งเตือนใหม่'}
            </p>
            <p className="text-xs text-[#378ADD] mt-0.5 line-clamp-2">
              {notification.body || ''}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#042C53] hover:bg-slate-100 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Inline animation keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Notification Provider ───────────────────────────────────
export default function NotificationProvider({ children }) {
  const [toast, setToast] = useState(null);
  const fcmTokenRef = useRef(null);
  const registeredRef = useRef(false);

  // Register FCM token with backend
  const registerToken = useCallback(async (token) => {
    if (!token || registeredRef.current) return;
    
    try {
      await api.post('/fcm/register-token', {
        fcm_token: token,
        device_info: navigator.userAgent.substring(0, 200),
      });
      registeredRef.current = true;
      console.log('FCM token registered with backend');
    } catch (err) {
      console.error('Failed to register FCM token:', err);
    }
  }, []);

  // Initialize: request permission + register token
  useEffect(() => {
    const init = async () => {
      // Check if user is logged in
      const token = localStorage.getItem('bou_token');
      if (!token) return;

      // Small delay to not block initial render
      await new Promise(r => setTimeout(r, 2000));

      // If notification permission is default (not asked yet), prompt with SweetAlert first
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        const result = await Swal.fire({
          title: 'เปิดรับการแจ้งเตือน',
          text: 'กรุณากดอนุญาตเพื่อรับแจ้งเตือนงานและข้อความใหม่ๆ ได้ทันที',
          icon: 'info',
          showCancelButton: true,
          confirmButtonText: 'อนุญาต',
          cancelButtonText: 'ไว้ทีหลัง',
          confirmButtonColor: '#3B82F6',
          cancelButtonColor: '#9CA3AF',
        });

        if (result.isConfirmed) {
          const fcmToken = await requestNotificationPermission();
          if (fcmToken) {
            fcmTokenRef.current = fcmToken;
            await registerToken(fcmToken);
            Swal.fire({
              title: 'สำเร็จ!',
              text: 'เปิดการแจ้งเตือนเรียบร้อยแล้ว',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
          }
        }
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        // Already granted, just fetch token silently
        const fcmToken = await requestNotificationPermission();
        if (fcmToken) {
          fcmTokenRef.current = fcmToken;
          await registerToken(fcmToken);
        }
      }
    };

    init();
  }, [registerToken]);

  // Listen for foreground messages
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload.notification?.title || payload.data?.title || 'แจ้งเตือนใหม่';
      const body = payload.notification?.body || payload.data?.body || '';
      
      setToast({ title, body });
      
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(title, { body });
        } catch (e) {
          if (navigator.serviceWorker) {
            navigator.serviceWorker.ready.then((registration) => {
              registration.showNotification(title, { body });
            });
          }
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Listen for local test alerts
  useEffect(() => {
    const handleLocalAlert = (e) => {
      if (e.detail) {
        const { title, body } = e.detail;
        setToast({ title, body });
        
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(title, { body });
          } catch (e) {
            if (navigator.serviceWorker) {
              navigator.serviceWorker.ready.then((registration) => {
                registration.showNotification(title, { body });
              });
            }
          }
        }
      }
    };
    
    window.addEventListener('new_message_alert', handleLocalAlert);
    return () => window.removeEventListener('new_message_alert', handleLocalAlert);
  }, []);

  return (
    <>
      {children}
      {toast && (
        <NotificationToast
          notification={toast}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
