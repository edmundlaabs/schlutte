/* Service Worker nur für das Modul /abnahme (Scope /abnahme/). Rest der Schlutte bleibt online-only.
 *
 * - Begehungs-Shell (/abnahme/begehung): network-first (3 s), sonst Cache.
 * - /_next/static, Schriften, Logos: cache-first (Dateinamen sind versioniert).
 * - Alles andere (inkl. /api/*, andere /abnahme-Seiten): unberührt; offline zeigt eine Hinweisseite.
 * - Nachricht {type:"PRECACHE", urls}: Shell und Chunks vorhalten („Für Baustelle laden“).
 */
const VERSION = "v1";
const STATIC = `abn-static-${VERSION}`;
const PAGES = `abn-pages-${VERSION}`;
const SHELL_URL = "/abnahme/begehung";
const OFFLINE_URL = "/abnahme-offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC).then((c) =>
      c.addAll([OFFLINE_URL, "/fonts/1-IBMPlexSans-Regular.ttf", "/fonts/1-IBMPlexSans-Light.ttf", "/fonts/1-IBMPlexSans-Medium.ttf", "/brand/grabner-schlutte-logo.svg"]).catch(() => undefined)
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Seiten-Cache wird je Version erneuert; statische (versionierte) Dateien bleiben stehen.
      for (const key of await caches.keys()) {
        if (key.startsWith("abn-pages-") && key !== PAGES) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

function istStatisch(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/icons/");
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function shellNetworkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(request, { signal: ctrl.signal });
    clearTimeout(timer);
    // Weiterleitungen (z. B. abgelaufene Anmeldung → /login) niemals als Shell speichern.
    if (res.ok && !res.redirected) cache.put(SHELL_URL, res.clone());
    return res;
  } catch {
    const hit = await cache.match(SHELL_URL);
    if (hit) return hit;
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate" && url.pathname.startsWith("/abnahme/")) {
    if (url.pathname === SHELL_URL || url.pathname === SHELL_URL + "/") {
      event.respondWith(shellNetworkFirst(request));
    } else {
      event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()));
    }
    return;
  }
  if (istStatisch(url)) event.respondWith(cacheFirst(request));
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "PRECACHE" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      for (const u of data.urls) {
        try {
          const url = new URL(u, self.location.origin);
          if (url.origin !== self.location.origin) continue;
          const res = await fetch(url.pathname + url.search, { credentials: "same-origin" });
          if (!res.ok || res.redirected) continue;
          if (url.pathname === SHELL_URL) {
            // Shell ablegen und alle darin referenzierten Chunks/Styles gleich mitnehmen (auch wenn der Aufruf
            // von einer anderen Seite kommt, z. B. direkt nach dem Import).
            const html = await res.clone().text();
            (await caches.open(PAGES)).put(SHELL_URL, res);
            for (const m of html.matchAll(/\/_next\/static\/[^"'\s\\)<>]+/g)) data.urls.push(m[0]);
          } else if (istStatisch(url)) (await caches.open(STATIC)).put(url.pathname + url.search, res);
        } catch {
          /* offline: später erneut */
        }
      }
      const clients = await self.clients.matchAll();
      clients.forEach((c) => c.postMessage({ type: "PRECACHE_DONE" }));
    })()
  );
});
