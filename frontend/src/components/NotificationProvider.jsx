import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestNotificationPermission, onForegroundMessage } from '../lib/firebase';
import { resolveNotificationPath } from '../utils/notificationUi';
import api from '../api/axios';
import Swal from 'sweetalert2';

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
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #378ADD, #185FA5, #042C53)' }} />
        <div className="p-4 flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #378ADD, #185FA5)' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-[#042C53] truncate">
              {notification.title || 'แจ้งเตือนใหม่'}
            </p>
            <p className="text-xs text-[#378ADD] mt-0.5 line-clamp-2 whitespace-pre-line">
              {notification.body || ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#042C53] hover:bg-slate-100 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function hasAuthToken() {
  return Boolean(localStorage.getItem('bou_token') || sessionStorage.getItem('bou_token'));
}

export default function NotificationProvider({ children }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [toast, setToast] = useState(null);
  const promptedRef = useRef(false);

  const bumpBell = useCallback(() => {
    window.dispatchEvent(new CustomEvent('new_message_alert'));
  }, []);

  const registerToken = useCallback(async (token) => {
    if (!token || !hasAuthToken()) return false;
    try {
      await api.post('/fcm/register-token', {
        fcm_token: token,
        device_info: navigator.userAgent.substring(0, 200),
      });
      return true;
    } catch (err) {
      console.error('Failed to register FCM token:', err);
      return false;
    }
  }, []);

  const ensurePushReady = useCallback(async ({ promptIfNeeded = false } = {}) => {
    if (!hasAuthToken()) return;
    if (typeof Notification === 'undefined') return;

    if (Notification.permission === 'default' && promptIfNeeded) {
      const result = await Swal.fire({
        title: 'เปิดรับการแจ้งเตือนบนมือถือ',
        text: 'อนุญาตการแจ้งเตือนเพื่อรับงานและเหตุการณ์สำคัญ แม้ปิดเว็บไปแล้ว',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'อนุญาต',
        cancelButtonText: 'ไว้ทีหลัง',
        confirmButtonColor: '#185FA5',
        cancelButtonColor: '#9CA3AF',
      });
      if (!result.isConfirmed) return;
    }

    if (Notification.permission === 'denied') return;

    const fcmToken = await requestNotificationPermission();
    if (fcmToken) await registerToken(fcmToken);
  }, [registerToken]);

  useEffect(() => {
    if (!user) return undefined;

    const timer = setTimeout(() => {
      ensurePushReady({ promptIfNeeded: !promptedRef.current }).then(() => {
        if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
          promptedRef.current = true;
        }
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [user?.id, ensurePushReady]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && hasAuthToken()) {
        ensurePushReady({ promptIfNeeded: false });
        bumpBell();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [ensurePushReady, bumpBell]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        const path = resolveNotificationPath(event.data.path);
        if (path) navigate(path);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload.notification?.title || payload.data?.title || 'แจ้งเตือนใหม่';
      const body = payload.notification?.body || payload.data?.body || '';

      setToast({ title, body });
      bumpBell();

      if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            body,
            icon: payload.notification?.icon || '/favicon.ico',
            tag: payload.data?.event_key || `bou-fg-${Date.now()}`,
            data: payload.data || {},
            vibrate: [200, 100, 200],
          }).catch((err) => console.error('foreground native notification:', err));
        });
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [bumpBell]);

  useEffect(() => {
    const handleLocalAlert = (e) => {
      if (e.detail) {
        setToast({
          title: e.detail.title,
          body: e.detail.body,
        });
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
