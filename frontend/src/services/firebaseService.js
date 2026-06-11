/**
 * Firebase Cloud Messaging (FCM) service for Trakvora.
 *
 * Initialises the Firebase web SDK, requests notification permission,
 * retrieves the FCM registration token, and sets up foreground message handling.
 *
 * Required env vars (Vite):
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_MESSAGING_SENDER_ID
 *   VITE_FIREBASE_APP_ID
 *   VITE_FIREBASE_VAPID_KEY
 */
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

let _messaging = null;

function getFirebaseMessaging() {
  if (!firebaseConfig.apiKey) return null;          // Firebase not configured
  if (_messaging) return _messaging;
  try {
    const app = getApps().length === 0
      ? initializeApp(firebaseConfig)
      : getApps()[0];
    _messaging = getMessaging(app);
    return _messaging;
  } catch (err) {
    console.warn("[FCM] Firebase init failed:", err.message);
    return null;
  }
}

/**
 * Request notification permission, get FCM token, and register foreground handler.
 *
 * @param {function(payload)} onMessageCallback — called with message payload on foreground push
 * @returns {Promise<string|null>} FCM token or null if unavailable
 */
export async function initFCM(onMessageCallback) {
  const messaging = getFirebaseMessaging();
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.info("[FCM] Notification permission denied");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });

    if (!token) {
      console.warn("[FCM] No registration token available");
      return null;
    }

    // Handle foreground messages (app is open and focused)
    onMessage(messaging, (payload) => {
      console.info("[FCM] Foreground message:", payload);
      onMessageCallback?.(payload);
    });

    return token;
  } catch (err) {
    console.warn("[FCM] initFCM error:", err.message);
    return null;
  }
}
