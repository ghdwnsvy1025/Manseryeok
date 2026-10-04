/* 사주읽는밤 일기 — 서비스 워커. 캐시는 하지 않는다 (옛 번들이 남아 화면이 깨지는 사고 방지). 푸시 알림만 맡는다. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "사주읽는밤 일기";
  const options = {
    body: data.body || "오늘 한 줄 남길 시간이에요.",
    icon: "/icons/app-icon-192.png",
    badge: "/icons/app-icon-192.png",
    tag: data.tag || "night-remind",
    renotify: false,
    data: { url: data.url || "/write" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/write";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
