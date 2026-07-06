/* eslint-disable no-undef */
// Firebase Messaging Service Worker
// Handles background push notifications when the app tab is not active

importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDPrfWpTT1P51w5VguDMgNWXsUFcHSOXK4",
  authDomain: "notification-35907.firebaseapp.com",
  projectId: "notification-35907",
  storageBucket: "notification-35907.firebasestorage.app",
  messagingSenderId: "233471687863",
  appId: "1:233471687863:web:44db15f5a11c8bd26e2132",
  measurementId: "G-CQJ710ZM01"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'แจ้งเตือนใหม่';
  const notificationOptions = {
    body: payload.notification?.body || 'คุณมีข้อความใหม่',
    tag: 'bou-notification-' + Date.now(),
    data: payload.data || {},
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'เปิดดู' },
      { action: 'close', title: 'ปิด' }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      return clients.openWindow('/dashboard');
    })
  );
});
