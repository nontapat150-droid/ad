/* eslint-disable no-undef */
// Firebase Messaging Service Worker — background push when app/tab is closed

importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js');

importScripts('/api/settings/firebase-config.js');

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

function pickTitle(payload) {
  return payload.notification?.title || payload.data?.title || 'แจ้งเตือน';
}

function pickBody(payload) {
  return payload.notification?.body || payload.data?.body || '';
}

function pickPath(payload) {
  const raw = payload.data?.path || '';
  if (!raw || typeof raw !== 'string') return '/dashboard';
  if (raw === '/dispatch' || raw.startsWith('/dispatch?')) {
    return raw.replace(/^\/dispatch/, '/dispatch-dashboard');
  }
  if (raw === '/') return '/dashboard';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function showPushNotification(payload) {
  const title = pickTitle(payload);
  const body = pickBody(payload);
  const path = pickPath(payload);
  const tag = payload.data?.event_key || payload.data?.notification_id || `bou-${Date.now()}`;

  return self.registration.showNotification(title, {
    body,
    icon: payload.notification?.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag,
    data: { ...(payload.data || {}), path },
    vibrate: [200, 100, 200],
    renotify: true,
  });
}

// Data + notification payloads when app is in background or closed
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] background message', payload);
  return showPushNotification(payload);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = pickPath({ data: event.notification.data || {} });
  const targetUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', path });
          if ('navigate' in client) {
            return client.navigate(targetUrl).then(() => client.focus());
          }
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
