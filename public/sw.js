// Minimální service worker – kvůli instalovatelnosti PWA (fetch handler).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // bez offline cache – jen aby PWA splňovala podmínku instalovatelnosti
});
