// Kedai Hawa FCM helper
// The public VAPID key is intentionally left as a placeholder.
// Paste the PUBLIC key generated in Firebase Console here.
import {
  db, doc, setDoc, serverTimestamp,
  getMessaging, getToken, onMessage, isSupported
} from "./firebase.js";

const VAPID_PUBLIC_KEY = "BAvLwV1FeFB345jAc6r7UFp03-JX2FyIpOUq8rKyJ45CaVEfSVXZs8z4LgUDauJOPT9pfDW8KbHXrxIdMbk-5w8";

export async function enableOwnerPush(user) {
  if (!user || user.isAnonymous) throw new Error("Owner belum login.");
  if (!("Notification" in window)) throw new Error("Browser tidak mendukung notifikasi.");
  if (!("serviceWorker" in navigator)) throw new Error("Service Worker tidak didukung.");
  if (VAPID_PUBLIC_KEY.includes("PASTE_")) {
    throw new Error("Public VAPID key belum dimasukkan ke shared/fcm.js.");
  }

  const supported = await isSupported();
  if (!supported) throw new Error("FCM Web Push tidak didukung browser ini.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Izin notifikasi tidak diberikan.");

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/"
  });
  await navigator.serviceWorker.ready;

  const messaging = getMessaging();
  const token = await getToken(messaging, {
    vapidKey: VAPID_PUBLIC_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) throw new Error("FCM token tidak berhasil dibuat.");

  await setDoc(doc(db, "fcmTokens", user.uid), {
    uid: user.uid,
    email: user.email || "",
    token,
    updatedAt: serverTimestamp(),
    platform: navigator.userAgent,
    active: true
  }, { merge: true });

  return token;
}

export function listenForegroundPush(callback) {
  try {
    const messaging = getMessaging();
    return onMessage(messaging, callback);
  } catch (e) {
    return () => {};
  }
}
