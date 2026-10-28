/* Comrade Connect service worker: app screens, fonts and pictures keep working without data.
   The API itself is saved by cc-offline.js, not here.
   BUILD changes on every deploy (the push script stamps it), so each deploy gets a fresh cache and the old one is deleted.
   App files (html, js, css) are fetched fresh when online and only fall back to the saved copy when offline or very slow.
   v2: legal pages are saved too, a failing server (5xx) falls back to the saved page, clean links like /terms open terms.html offline. */
const BUILD = '20261028130059';
const SHELL = 'cc-shell-' + BUILD, RUNTIME = 'cc-runtime-v1';
const CDN = ['https://cdn.tailwindcss.com/3.4.17', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'];
const PAGES = ['/terms.html', '/privacy.html', '/legal.html', '/contact.html', '/about.html', '/safety.html', '/refunds.html', '/payments.html', '/cookies.html', '/trust.html', '/trust.css', '/get.html'];
const APPFILE = /\.(?:js|css|html|json|webmanifest)$/i;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    const r = await fetch('/index.html', { cache: 'reload' });
    const html = await r.clone().text();
    const urls = new Set(['/site.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/favicon.png', '/config.js'].concat(PAGES));
    (html.match(/(?:src|href)="[^"#]+"/g) || []).forEach((m) => {
      const u = m.slice(m.indexOf('"') + 1, -1);
      if (/^(https?:)?\/\/|^data:|^mailto:|^tel:|^javascript:/.test(u)) return;
      const a = new URL(u, self.location.origin + '/'); urls.add(a.pathname + a.search);
    });
    await c.put('/index.html', r);
    // fetch past the browser's own cache so an old copy can never be saved as the new build
    await Promise.allSettled([...urls].map((u) => fetch(u, { cache: 'reload' }).then((x) => x.ok && c.put(u, x))));
    await Promise.allSettled(CDN.map((u) => fetch(u, { mode: 'no-cors' }).then((x) => c.put(u, x))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if ((k.startsWith('cc-shell-') && k !== SHELL) || k === 'cc-api-v1') await caches.delete(k);
    await self.clients.claim();
  })());
});

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), ms));

async function saved(req, url) {                                  // the saved copy of a page or file, by the most exact match first
  return (await caches.match(req))
    || (await caches.match(req, { ignoreSearch: true }))
    || (url && !/\.[a-z0-9]+$/i.test(url.pathname) && url.pathname !== '/' ? await caches.match(url.pathname.replace(/\/$/, '') + '.html') : undefined);
}

async function fresh(req, url, ms) {                              // online: newest file. Offline or very slow: the saved copy
  try {
    const r = await Promise.race([fetch(url, { cache: 'no-cache', credentials: 'same-origin' }), timeout(ms)]);
    if (r && r.ok) { const c = await caches.open(SHELL); c.put(req, r.clone()); return r; }
    if (r && r.status >= 500) { const s = await saved(req); if (s) return s; }   // server failing: the saved copy is better than an error page
    return r;
  } catch (x) {
    return (await saved(req)) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method === 'POST' && new URL(req.url).pathname === '/share-target') { e.respondWith(ccShare(req)); return; }
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/scan')) return;
  const same = url.origin === self.location.origin;

  if (req.mode === 'navigate') {                                  // page: fresh when online, saved copy when not
    e.respondWith((async () => {
      try {
        const r = await Promise.race([fetch(req), timeout(5000)]);
        if (r && r.status >= 500) throw new Error('server');
        if (r && r.ok && !r.redirected && (url.pathname === '/' || url.pathname === '/index.html')) caches.open(SHELL).then((c) => c.put('/index.html', r.clone()));
        return r;
      } catch (x) { return (await saved(req, url)) || (await caches.match('/index.html')) || Response.error(); }
    })());
    return;
  }
  if (same && (APPFILE.test(url.pathname) || ['script', 'style'].includes(req.destination))) {   // app files: never an old build while online
    e.respondWith(fresh(req, req.url, 4000));
    return;
  }
  if (same) {                                                     // pictures, icons and other files: saved copy first, refreshed in the background
    e.respondWith((async () => {
      const hit = await caches.match(req);
      const net = fetch(req).then((r) => { if (r && r.ok && !/\/(media)\//.test(url.pathname)) caches.open(SHELL).then((c) => c.put(req, r.clone())); return r; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || Response.error();
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
