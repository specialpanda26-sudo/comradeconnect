/* Comrade Connect service worker: app screens, fonts and pictures keep working without data.
   The API itself is saved by cc-offline.js, not here. */
const BUILD = 'dev';
const SHELL = 'cc-shell-' + BUILD, RUNTIME = 'cc-runtime-v1';
const CDN = ['https://cdn.tailwindcss.com/3.4.17', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    const r = await fetch('/index.html', { cache: 'reload' });
    const html = await r.clone().text();
    const urls = new Set(['/site.webmanifest', '/icon-192.png', '/icon-512.png', '/favicon.png', '/config.js']);
    (html.match(/(?:src|href)="[^"#]+"/g) || []).forEach((m) => {
      const u = m.slice(m.indexOf('"') + 1, -1);
      if (/^(https?:)?\/\/|^data:|^mailto:|^tel:|^javascript:/.test(u)) return;
      const a = new URL(u, self.location.origin + '/'); urls.add(a.pathname + a.search);
    });
    await c.put('/index.html', r);
    await Promise.allSettled([...urls].map((u) => c.add(u)));
    await Promise.allSettled(CDN.map((u) => fetch(u, { mode: 'no-cors' }).then((x) => c.put(u, x))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('cc-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), ms));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/scan')) return;
  const same = url.origin === self.location.origin;

  if (req.mode === 'navigate') {                                  // page: fresh when online, saved copy when not
    e.respondWith((async () => {
      try { return await Promise.race([fetch(req), timeout(4000)]); }
      catch (x) { return (await caches.match(req, { ignoreSearch: true })) || (await caches.match('/index.html')) || Response.error(); }
    })());
    return;
  }
  if (same) {                                                     // own files: saved copy first, refreshed in the background
    e.respondWith((async () => {
      const hit = await caches.match(req);
      const net = fetch(req).then((r) => { if (r && r.ok && !/\/(media)\//.test(url.pathname)) caches.open(SHELL).then((c) => c.put(req, r.clone())); return r; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
    return;
  }
  if (['script', 'style', 'font', 'image'].includes(req.destination)) {   // fonts, libraries and pictures from other sites
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r && (r.ok || r.type === 'opaque')) { const c = await caches.open(RUNTIME); c.put(req, r.clone()); c.keys().then((ks) => { if (ks.length > 250) c.delete(ks[0]); }); }
        return r;
      } catch (x) { return Response.error(); }
    })());
  }
});
