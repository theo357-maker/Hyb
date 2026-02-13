// sw.js - Service Worker Principal pour CS La Colombe
const CACHE_NAME = 'cs-lacolombe-v3';
const APP_VERSION = '3.0.0';

// Assets statiques à mettre en cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icon-72x72.png',
  '/icon-96x96.png',
  '/icon-128x128.png',
  '/icon-144x144.png',
  '/icon-152x152.png',
  '/icon-192x192.png',
  '/icon-384x384.png',
  '/icon-512x512.png'
];

// Configuration Firebase
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBn7VIddclO7KtrXb5sibCr9SjVLjOy-qI",
  authDomain: "theo1d.firebaseapp.com",
  projectId: "theo1d",
  storageBucket: "theo1d.firebasestorage.app",
  messagingSenderId: "269629842962",
  appId: "1:269629842962:web:a80a12b04448fe1e595acb"
};

// Clé VAPID publique
const VAPID_KEY = "BM8H6cADaP6tiA4t9Oc9D36jk1UmYoUBV3cATlJ5mvZ_-eQ5xd6HgX5twxWvZ2U2Y98HBkJ8bTph7epPJJYqBpc";

let firebaseApp = null;
let firebaseMessaging = null;
let isFirebaseInitialized = false;

// === INSTALLATION ===
self.addEventListener('install', (event) => {
  console.log(`📦 SW v${APP_VERSION}: Installation...`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Mise en cache des ressources statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Activation immédiate
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Erreur cache:', error);
        return self.skipWaiting();
      })
  );
});

// === ACTIVATION ===
self.addEventListener('activate', (event) => {
  console.log(`🚀 SW v${APP_VERSION}: Activation...`);
  
  event.waitUntil(
    Promise.all([
      // Nettoyer les anciens caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log(`🗑️ Suppression ancien cache: ${name}`);
              return caches.delete(name);
            })
        );
      }),
      
      // Prendre le contrôle de tous les clients
      clients.claim()
    ])
  );
});

// === INITIALISATION FIREBASE ===
async function initializeFirebase() {
  if (isFirebaseInitialized) return true;
  
  try {
    importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');
    
    firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    firebaseMessaging = firebase.messaging();
    
    console.log('✅ Firebase Messaging initialisé dans le SW');
    isFirebaseInitialized = true;
    
    // Gestionnaire de messages en arrière-plan
    firebaseMessaging.onBackgroundMessage((payload) => {
      console.log('📨 Message en arrière-plan reçu:', payload);
      return handleBackgroundMessage(payload);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Erreur Firebase dans SW:', error);
    return false;
  }
}

// === TRAITEMENT DES MESSAGES ARRIÈRE-PLAN ===
function handleBackgroundMessage(payload) {
  const notificationTitle = payload.notification?.title || 'CS La Colombe';
  const notificationBody = payload.notification?.body || 'Nouvelle notification';
  const notificationData = payload.data || {};
  
  // Déterminer l'icône selon le type
  let icon = '/icon-192x192.png';
  let badge = '/icon-72x72.png';
  
  if (notificationData.type === 'incident') {
    icon = '/icon-192x192.png';
    badge = '/icon-72x72.png';
  }
  
  const notificationOptions = {
    body: notificationBody,
    icon: icon,
    badge: badge,
    vibrate: [200, 100, 200],
    data: notificationData,
    tag: notificationData.type + '_' + (notificationData.id || Date.now()),
    renotify: true,
    requireInteraction: true,
    silent: false,
    timestamp: Date.now(),
    actions: [
      { action: 'open', title: '🔓 Ouvrir' },
      { action: 'close', title: '❌ Fermer' }
    ]
  };
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
}

// === GESTION DES NOTIFICATIONS ===
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification cliquée:', event.notification);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();
  
  if (action === 'close') {
    return;
  }
  
  event.waitUntil(
    (async () => {
      // Vérifier si des clients existent
      const allClients = await clients.matchAll({
        includeUncontrolled: true,
        type: 'window'
      });
      
      // Priorité : trouver un client existant
      for (const client of allClients) {
        if (client.url.includes('index.html') && 'focus' in client) {
          await client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: data
          });
          return;
        }
      }
      
      // Ouvrir une nouvelle fenêtre
      await clients.openWindow('/index.html');
    })()
  );
});

// === STRATÉGIE DE CACHE INTELLIGENTE ===
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // ✅ IGNORER LES REQUÊTES API/FIREBASE
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('gstatic.com') ||
      url.pathname.includes('firestore') ||
      request.method !== 'GET') {
    return;
  }
  
  // ✅ STRATÉGIE: Network First pour les pages HTML
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Mettre en cache la réponse
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match('/offline.html');
        })
    );
    return;
  }
  
  // ✅ STRATÉGIE: Cache First pour les assets statiques
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          return cached || fetch(request).then(response => {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
            return response;
          });
        })
    );
    return;
  }
  
  // ✅ STRATÉGIE: Network Only par défaut
  return;
});

// === GESTION DES MESSAGES ===
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'PING':
      event.source?.postMessage({ 
        type: 'PONG', 
        version: APP_VERSION,
        status: 'active' 
      });
      break;
      
    case 'INIT_FIREBASE':
      initializeFirebase();
      break;
      
    default:
      break;
  }
});

// Initialiser Firebase au démarrage
initializeFirebase();

console.log(`✅ Service Worker v${APP_VERSION} chargé avec succès`);