// firebase-messaging-sw.js - Service Worker DÉDIÉ pour Firebase
// Ce fichier DOIT être à la racine et avoir ce nom exact

importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBn7VIddclO7KtrXb5sibCr9SjVLjOy-qI",
  authDomain: "theo1d.firebaseapp.com",
  projectId: "theo1d",
  storageBucket: "theo1d.firebasestorage.app",
  messagingSenderId: "269629842962",
  appId: "1:269629842962:web:a80a12b04448fe1e595acb"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// === GESTIONNAIRE PRINCIPAL POUR NOTIFICATIONS ARRIÈRE-PLAN ===
messaging.onBackgroundMessage((payload) => {
  console.log('[FIREBASE-SW] Message arrière-plan reçu:', payload);
  
  const notificationTitle = payload.notification?.title || 'CS La Colombe';
  const notificationBody = payload.notification?.body || 'Nouvelle notification';
  const notificationData = payload.data || {};
  
  // Personnalisation selon le type
  let icon = '/icon-192x192.png';
  let badge = '/icon-72x72.png';
  let requireInteraction = true;
  
  if (notificationData.type === 'incident') {
    requireInteraction = true; // Important: reste à l'écran
  }
  
  const notificationOptions = {
    body: notificationBody,
    icon: icon,
    badge: badge,
    vibrate: [200, 100, 200],
    data: notificationData,
    tag: `${notificationData.type || 'notification'}_${Date.now()}`,
    renotify: true,
    requireInteraction: requireInteraction,
    silent: false,
    actions: [
      { action: 'open', title: '👆 Ouvrir' },
      { action: 'close', title: '✖️ Fermer' }
    ]
  };
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// === GESTION DU CLIC SUR NOTIFICATION ===
self.addEventListener('notificationclick', (event) => {
  console.log('[FIREBASE-SW] Clic sur notification:', event.notification);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();
  
  if (action === 'close') {
    return;
  }
  
  event.waitUntil(
    (async () => {
      const clientList = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      
      if (clientList.length > 0) {
        const client = clientList[0];
        await client.focus();
        client.postMessage({
          type: 'NOTIFICATION_CLICK',
          data: data
        });
      } else {
        await clients.openWindow('/index.html');
      }
    })()
  );
});

// === ACTIVATION IMMÉDIATE ===
self.addEventListener('install', (event) => {
  console.log('[FIREBASE-SW] Installation...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[FIREBASE-SW] Activation...');
  event.waitUntil(clients.claim());
});

console.log('[FIREBASE-SW] Service Worker Firebase chargé');