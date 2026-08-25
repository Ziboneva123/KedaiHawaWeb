/* Kedai Hawa v16 - Firebase Cloud Messaging Service Worker */
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCCxE1sZw3CBV8A71hkfdnGNTr7P1pEU5Q",
  authDomain: "kedai-hawa.firebaseapp.com",
  projectId: "kedai-hawa",
  storageBucket: "kedai-hawa.firebasestorage.app",
  messagingSenderId: "237267777888",
  appId: "1:237267777888:web:6a1dec04d2e8a255e14605"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const d = payload.data || {};
  const title = n.title || d.title || "Kedai Hawa";
  const body = n.body || d.body || "Ada order baru.";
  self.registration.showNotification(title, {
    body,
    icon: d.icon || "/icon-192.png",
    badge: d.badge || "/icon-192.png",
    tag: d.tag || "kedai-hawa-order",
    renotify: true,
    data: { url: d.url || "/web1/" }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/web1/";
  event.waitUntil(
    clients.matchAll({type:"window", includeUncontrolled:true}).then((list)=>{
      for(const client of list){
        if("navigate" in client) client.navigate(url);
        if("focus" in client) return client.focus();
      }
      return clients.openWindow ? clients.openWindow(url) : undefined;
    })
  );
});
