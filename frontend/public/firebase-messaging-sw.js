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

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Extract title and body from the data payload
  const title = payload.data?.title || payload.notification?.title || 'การแจ้งเตือนใหม่';
  const options = {
    body: payload.data?.body || payload.notification?.body || '',
    icon: '/favicon.svg', // Static icon to prevent background crash on Android
    requireInteraction: true, // Keep notification on screen until interacted with
    vibrate: [200, 100, 200],
    data: payload.data || {}
  };
  
  return self.registration.showNotification(title, options);
});


