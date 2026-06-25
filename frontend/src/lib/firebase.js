import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ── Firebase Configuration ──────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDPrfWpTT1P51w5VguDMgNWXsUFcHSOXK4",
  authDomain: "notification-35907.firebaseapp.com",
  projectId: "notification-35907",
  storageBucket: "notification-35907.firebasestorage.app",
  messagingSenderId: "233471687863",
  appId: "1:233471687863:web:44db15f5a11c8bd26e2132",
  measurementId: "G-CQJ710ZM01"
};

const VAPID_KEY = 'BIwdBYoZYhw3qu3rKCge84TffrgAEkP1iEAltSAdtxegiQVZqmRWBbudvOMjJVG1fnJnYl5a4Z2LpYz5I1P6fSA';

// ── Initialize Firebase ─────────────────────────────────────
const app = initializeApp(firebaseConfig);

// messaging may fail in unsupported browsers or inside iframes
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (err) {
  console.warn('Firebase Messaging not supported in this browser:', err.message);
}

// ── Request Notification Permission & Get FCM Token ─────────
export async function requestNotificationPermission() {
  if (!messaging) {
    console.warn('Firebase Messaging is not initialized');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Register service worker explicitly
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      console.log('FCM Token:', token);
      return token;
    } else {
      console.log('No FCM token available');
      return null;
    }
  } catch (err) {
    console.error('Error getting FCM token:', err);
    return null;
  }
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
