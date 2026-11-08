const V = 'dockside-v1';
const SHELL = ['/', '/login', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  // never touch API, uploads, or websocket traffic
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/socket.io/')) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).catch(() => caches.match(u.pathname).then((m) => m || caches.match('/'))));
    return;
  }
  if (u.pathname.startsWith('/_next/static/') || u.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => {
      const copy = res.clone();
      caches.open(V).then((c) => c.put(r, copy));
      return res;
    })));
  }
});
