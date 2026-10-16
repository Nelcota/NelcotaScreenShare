/**
 * Service worker for Nelcota's system notifications, served at /notifications-sw.js (the
 * root path gives it the whole site as scope). It only handles notification clicks: no
 * fetch handler and no cache. Each click reaches the open tabs as a
 * `nelcota-notification` message; actions listed in `data.background` (e.g. "Recusar")
 * do not bring a tab forward.
 */
const WORKER_SOURCE = `"use strict";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = event.action || "open";
  const data = event.notification.data || {};
  const background = Array.isArray(data.background) ? data.background : [];
  const message = { type: "nelcota-notification", tag: event.notification.tag, action };
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) client.postMessage(message);
    if (background.includes(action)) return;
    const target = windows.find((client) => client.focused) || windows[0];
    if (target) return void (await target.focus());
    await self.clients.openWindow("/");
  })());
});
`;

export function notificationsWorker(): Response {
  return new Response(WORKER_SOURCE, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      // A new version must reach the browser on the next registration check.
      "Cache-Control": "no-cache",
    },
  });
}
