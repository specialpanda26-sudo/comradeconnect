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
    const urls = new Set(['/site.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/favicon.png', '/config.js']);
    (html.match(/(?:src|href)="[^"#]+"/g) || []).forEach((m) => {
      const u = m.slice(m.indexOf('"') + 1, -1);
      if (/^(https?:)?\/\/|^data:|^mailto:|^tel:|^javascript:/.test(u)) return;
      const a = new URL(u, self.location.origin + '/'); urls.add(a.pathname + a.search);
    });
    await c.put('/index.html', r);
    await Promise.allSettled([...urls].map((u) => c.add(u)));
    await Promise.allSettled(['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/favicon.png', '/apple-touch-icon.png'].map((u) => fetch(u, { cache: 'reload' }).then((x) => x.ok && c.put(u, x))));
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
  if (req.method === 'POST' && new URL(req.url).pathname === '/share-target') { e.respondWith(ccShare(req)); return; }
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

const SHARE_HOME = '/';   // where shared things open. Change to '/' once the new app is the main page.
async function ccShare(req) {
  try {
    const fd = await req.formData(), file = fd.get('media'), c = await caches.open('cc-share');
    for (const k of await c.keys()) await c.delete(k);
    const meta = { title: String(fd.get('title') || ''), text: String(fd.get('text') || ''), url: String(fd.get('url') || ''), name: (file && file.name) || '', type: (file && file.type) || '', size: (file && file.size) || 0 };
    await c.put('/shared-meta', new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } }));
    if (file && file.size) await c.put('/shared-file', new Response(file, { headers: { 'content-type': file.type || 'video/mp4' } }));
  } catch (x) {}
  return Response.redirect(SHARE_HOME + '?shared=1', 303);
}

/* cc-fix4: tapping a notification brings the app forward and opens the right place */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const v = (e.notification.data && e.notification.data.view) || '';
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) { if ('focus' in c) { await c.focus(); c.postMessage({ ccOpen: v }); return; } }
    if (self.clients.openWindow) await self.clients.openWindow('/');
  })());
});

/* Website push is switched off for good: a push that still arrives is ignored. Alerts come through the Android app. */
self.addEventListener('push', () => {});
