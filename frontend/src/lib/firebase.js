import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ── Firebase Configuration ──────────────────────────────────
const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyDPrfWpTT1P51w5VguDMgNWXsUFcHSOXK4",
  authDomain: "notification-35907.firebaseapp.com",
  projectId: "notification-35907",
  storageBucket: "notification-35907.firebasestorage.app",
  messagingSenderId: "233471687863",
  appId: "1:233471687863:web:44db15f5a11c8bd26e2132",
  measurementId: "G-CQJ710ZM01"
};

const VAPID_KEY = window.FIREBASE_CONFIG?.vapidKey || 'BIwdBYoZYhw3qu3rKCge84TffrgAEkP1iEAltSAdtxegiQVZqmRWBbudvOMjJVG1fnJnYl5a4Z2LpYz5I1P6fSA';

// ── Initialize Firebase ─────────────────────────────────────
const app = initializeApp(firebaseConfig);

// messaging may fail in unsupported browsers or inside iframes
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (err) {
  console.warn('Firebase Messaging not supported in this browser:', err.message);
}

/**
 * Ask Chrome/browser for notification permission immediately.
 * Call this directly from a button click / Swal preConfirm (user gesture).
 */
export function askBrowserNotificationPermission() {
  if (typeof Notification === 'undefined') {
    return Promise.resolve('unsupported');
  }
  if (Notification.permission === 'granted') {
    return Promise.resolve('granted');
  }
  if (Notification.permission === 'denied') {
    return Promise.resolve('denied');
  }
  // Must run in the same user-gesture turn so Chrome shows the prompt right away
  return Notification.requestPermission();
}

/** Register SW + get FCM token when permission is already granted */
export async function getFcmTokenIfGranted() {
  if (!messaging) {
    console.warn('Firebase Messaging is not initialized');
    return null;
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=12');
    await swRegistration.update();

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      console.log('FCM Token:', token);
      return token;
    }
    console.log('No FCM token available');
    return null;
  } catch (err) {
    console.error('Error getting FCM token:', err);
    return null;
  }
}

// ── Request Notification Permission & Get FCM Token ─────────
export async function requestNotificationPermission() {
  const permission = await askBrowserNotificationPermission();
  if (permission !== 'granted') {
    console.log('Notification permission denied');
    return null;
  }
  return getFcmTokenIfGranted();
}

// ── Listen for Foreground Messages ──────────────────────────
export function onForegroundMessage(callback) {
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });
}

export { messaging };
export default app;
