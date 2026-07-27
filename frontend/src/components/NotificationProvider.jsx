import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestNotificationPermission, askBrowserNotificationPermission, getFcmTokenIfGranted, onForegroundMessage } from '../lib/firebase';
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

function readPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export default function NotificationProvider({ children }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [toast, setToast] = useState(null);
  const [permission, setPermission] = useState(() => readPermission());
  const promptingRef = useRef(false);
  const nagTimerRef = useRef(null);
  const retryTimerRef = useRef(null);

  const bumpBell = useCallback(() => {
    window.dispatchEvent(new CustomEvent('new_message_alert'));
  }, []);

  const refreshPermission = useCallback(() => {
    const next = readPermission();
    setPermission(next);
    return next;
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

  const completePushSetup = useCallback(async () => {
    const fcmToken = await requestNotificationPermission();
    const perm = refreshPermission();
    if (perm === 'granted' && fcmToken) {
      await registerToken(fcmToken);
    }
    return perm;
  }, [refreshPermission, registerToken]);

  /** After Chrome already granted, register FCM token only */
  const registerAfterGranted = useCallback(async () => {
    const fcmToken = await getFcmTokenIfGranted();
    refreshPermission();
    if (fcmToken) await registerToken(fcmToken);
    return refreshPermission();
  }, [refreshPermission, registerToken]);

  const scheduleRetryBox = useCallback((fn, delayMs = 600) => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      fn();
    }, delayMs);
  }, []);

  const showPermissionMessageBoxRef = useRef(null);

  /** กล่องข้อความ: กดอนุญาต → Chrome เด้งทันที / กดยกเลิก → เด้งซ้ำ */
  const showPermissionMessageBox = useCallback(async () => {
    if (!hasAuthToken() || !user) return;
    if (promptingRef.current) return;

    const current = refreshPermission();
    if (current === 'granted' || current === 'unsupported') return;

    promptingRef.current = true;
    try {
      if (current === 'denied') {
        const deniedResult = await Swal.fire({
          title: 'ยังไม่ได้เปิดการแจ้งเตือน',
          html: `
            <p style="text-align:left;margin:0 0 10px;color:#4B5563;font-size:14px;line-height:1.6">
              คุณเคยกดบล็อกการแจ้งเตือนไว้แล้ว<br/>
              ระบบจะเด้งกล่องนี้จนกว่าจะอนุญาต
            </p>
            <div style="text-align:left;background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:12px;font-size:13px;color:#92400E;line-height:1.7">
              <b>วิธีเปิดสิทธิ์:</b><br/>
              1) กดไอคอนแม่กุญแจ / ข้อมูลเว็บ ข้างแถบที่อยู่<br/>
              2) ตั้งค่า “การแจ้งเตือน” เป็น <b>อนุญาต</b><br/>
              3) กลับมาแล้วกด <b>อนุญาต</b>
            </div>
          `,
          icon: 'error',
          showCancelButton: true,
          confirmButtonText: 'อนุญาต',
          cancelButtonText: 'ยกเลิก',
          confirmButtonColor: '#185FA5',
          cancelButtonColor: '#9CA3AF',
          allowOutsideClick: false,
          allowEscapeKey: false,
          reverseButtons: true,
        });

        if (!deniedResult.isConfirmed) {
          scheduleRetryBox(() => showPermissionMessageBoxRef.current?.(), 1500);
          return;
        }

        await completePushSetup();
        if (refreshPermission() === 'granted') {
          await Swal.fire({
            title: 'เปิดการแจ้งเตือนแล้ว',
            text: 'พร้อมใช้งานระบบได้ตามปกติ',
            icon: 'success',
            timer: 1600,
            showConfirmButton: false,
          });
        } else {
          await Swal.fire({
            title: 'ยังบล็อกการแจ้งเตือนอยู่',
            text: 'เปิดสิทธิ์ในตั้งค่าเบราว์เซอร์ก่อน แล้วกดอนุญาตอีกครั้ง',
            icon: 'info',
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#185FA5',
            allowOutsideClick: false,
            allowEscapeKey: false,
          });
          scheduleRetryBox(() => showPermissionMessageBoxRef.current?.(), 800);
        }
        return;
      }

      // permission === 'default'
      // กด "อนุญาต" → เรียก Chrome requestPermission() ทันทีใน preConfirm (user gesture)
      const result = await Swal.fire({
        title: 'อนุญาตการแจ้งเตือน',
        html: `
          <p style="color:#4B5563;font-size:14px;line-height:1.75;margin:0 0 8px">
            กดปุ่ม <b style="color:#185FA5">อนุญาต</b> ด้านล่าง<br/>
            จากนั้น Chrome จะเด้งหน้าต่างขึ้นมาทันที<br/>
            ให้กด <b>Allow / อนุญาต</b> ในหน้าต่างของ Chrome อีกครั้ง
          </p>
          <p style="color:#9CA3AF;font-size:12px;margin:0">
            หากกดยกเลิก ระบบจะเด้งกล่องนี้ซ้ำจนกว่าจะอนุญาต
          </p>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'อนุญาต',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#185FA5',
        cancelButtonColor: '#9CA3AF',
        allowEscapeKey: false,
        reverseButtons: true,
        showLoaderOnConfirm: true,
        allowOutsideClick: () => !Swal.isLoading(),
        preConfirm: () => {
          // สำคัญ: เรียกทันทีตอนกดปุ่ม เพื่อให้ Chrome แสดงหน้าต่างขอสิทธิ์ทันที
          return askBrowserNotificationPermission();
        },
      });

      if (!result.isConfirmed) {
        scheduleRetryBox(() => showPermissionMessageBoxRef.current?.(), 1500);
        return;
      }

      const browserPerm = result.value || refreshPermission();
      refreshPermission();

      if (browserPerm === 'granted') {
        await registerAfterGranted();
        await Swal.fire({
          title: 'เปิดการแจ้งเตือนแล้ว',
          text: 'พร้อมใช้งานระบบได้ตามปกติ',
          icon: 'success',
          timer: 1600,
          showConfirmButton: false,
        });
      } else if (browserPerm === 'denied') {
        scheduleRetryBox(() => showPermissionMessageBoxRef.current?.(), 600);
      } else {
        await Swal.fire({
          title: 'ยังไม่อนุญาตในหน้าต่าง Chrome',
          html: 'กรุณากด <b>Allow / อนุญาต</b> ในหน้าต่างของเบราว์เซอร์ด้วย',
          icon: 'info',
          confirmButtonText: 'ลองอีกครั้ง',
          confirmButtonColor: '#185FA5',
          allowOutsideClick: false,
          allowEscapeKey: false,
        });
        scheduleRetryBox(() => showPermissionMessageBoxRef.current?.(), 600);
      }
    } finally {
      promptingRef.current = false;
      refreshPermission();
    }
  }, [user, refreshPermission, completePushSetup, registerAfterGranted, scheduleRetryBox]);

  showPermissionMessageBoxRef.current = showPermissionMessageBox;

  // เข้าเว็บ/ล็อกอิน → เด้งกล่องข้อความทันที + วนซ้ำจนกว่าจะอนุญาต
  useEffect(() => {
    if (!user) {
      if (nagTimerRef.current) {
        clearInterval(nagTimerRef.current);
        nagTimerRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      Swal.close();
      return undefined;
    }

    refreshPermission();
    const start = setTimeout(() => {
      showPermissionMessageBox();
    }, 350);

    // สำรอง: ถ้ากล่องหายไปโดยไม่ตั้งใจ เด้งซ้ำทุก 8 วินาที
    nagTimerRef.current = setInterval(() => {
      const perm = refreshPermission();
      if (perm === 'granted' || perm === 'unsupported') return;
      showPermissionMessageBox();
    }, 8000);

    return () => {
      clearTimeout(start);
      if (nagTimerRef.current) {
        clearInterval(nagTimerRef.current);
        nagTimerRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [user?.id, showPermissionMessageBox, refreshPermission]);

  // กลับมาที่แท็บ → ตรวจสิทธิ์ / เด้งกล่องอีกครั้งถ้ายังไม่อนุญาต
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !hasAuthToken() || !user) return;
      const perm = refreshPermission();
      if (perm === 'granted') {
        completePushSetup();
        bumpBell();
      } else if (perm !== 'unsupported') {
        showPermissionMessageBox();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [user, refreshPermission, completePushSetup, showPermissionMessageBox, bumpBell]);

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

  const mustBlock =
    Boolean(user) &&
    permission !== 'granted' &&
    permission !== 'unsupported';

  return (
    <>
      {children}
      {/* กันคลิกหลังบ้านขณะยังไม่อนุญาต — กล่องข้อความ Swal เป็นตัวหลัก */}
      {mustBlock && (
        <div
          className="fixed inset-0 z-[9998] bg-[#042C53]/35"
          aria-hidden="true"
        />
      )}
      {toast && (
        <NotificationToast
          notification={toast}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
