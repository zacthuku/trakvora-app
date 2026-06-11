/**
 * Firebase Messaging Service Worker for Trakvora.
 * Handles background push notifications when the app tab is not active.
 *
 * This file must be placed at /public/firebase-messaging-sw.js so that
 * the browser can register it at the root scope.
 */
importScripts("https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js");

// Firebase config is injected at build time via __FIREBASE_CONFIG__
// or read from the service worker query string if needed.
// For simplicity, the config is embedded here — rotate keys via environment.
const firebaseConfig = self.__FIREBASE_CONFIG__ || {
  apiKey:            "VITE_FIREBASE_API_KEY_PLACEHOLDER",
  projectId:         "VITE_FIREBASE_PROJECT_ID_PLACEHOLDER",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID_PLACEHOLDER",
  appId:             "VITE_FIREBASE_APP_ID_PLACEHOLDER",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw] Background message:", payload);
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || "trakvora", {
    body:  body  || "",
    icon:  icon  || "/logo192.png",
    badge: "/favicon.ico",
    data:  payload.data || {},
  });
});

// Open the app when notification is clicked
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
