// Service worker – instalovatelnost PWA + Web Push (badge na ikoně).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // bez offline cache – jen aby PWA splňovala podmínku instalovatelnosti
});

// Příchozí push: přenastaví odznáček na ikoně a ukáže notifikaci.
// (Chrome vyžaduje u push notifikaci – proto ji vždy zobrazíme.)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const count = typeof data.count === "number" ? data.count : undefined;

  event.waitUntil(
    (async () => {
      // Badge na ikoně appky
      if (count != null && self.navigator && "setAppBadge" in self.navigator) {
        try {
          if (count > 0) await self.navigator.setAppBadge(count);
          else await self.navigator.clearAppBadge();
        } catch {
          /* ignore */
        }
      }
      // Notifikace (povinná u userVisibleOnly). Jedním tagem se překrývá.
      const title = data.title || "schvaleem";
      await self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "schvaleem-pending",
        renotify: false,
        data: { url: "/zaznamy" },
      });
    })(),
  );
});

// Klik na notifikaci: přepne do appky (nebo ji otevře).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/zaznamy";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if ("focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
