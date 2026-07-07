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

// Let Firebase handle background messages natively using the 'notification' block.
// This is the most reliable way to bypass Android battery optimizations
// and wake up the device when the app is completely closed.


