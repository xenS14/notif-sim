// Service worker : cache hors-ligne + réception des notifications push (mode arrière-plan).
const CACHE = 'notifsim-v2';
const SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-96.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Réseau d'abord (pour recevoir les mises à jour), cache en secours.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin || req.url.includes('/api/')) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch {
      return (await caches.match(req, { ignoreSearch: true })) || caches.match('./index.html');
    }
  })());
});

self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { p = { title: 'Notification', body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(p.title || 'Notification', {
      body: p.body || '',
      tag: p.tag || String(Date.now()),
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-96.png',
      data: p,
    });
    if (typeof p.badge === 'number' && self.navigator.setAppBadge) {
      try { await self.navigator.setAppBadge(p.badge); } catch {}
    }
    // Prévient l'app si elle est ouverte (historique / stats)
    for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'pushed', payload: p });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow('./');
  })());
});
