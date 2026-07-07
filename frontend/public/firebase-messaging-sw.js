/* eslint-disable no-undef */
// Firebase Messaging Service Worker
// Handles background push notifications when the app tab is not active

importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js');

// Load dynamic config from backend
importScripts('/api/settings/firebase-config.js');

// firebaseConfig is provided globally by firebase-config.js
firebase.initializeApp(firebaseConfig);

// Let Firebase handle background messages natively using the 'notification' block.
// This is the most reliable way to bypass Android battery optimizations
// and wake up the device when the app is completely closed.


