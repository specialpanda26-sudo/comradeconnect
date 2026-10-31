/* cc-fast.js v1: the app opens fast, with or without data.
   - warms the server (Render sleeps when idle) the moment the app opens, and keeps it awake while you use it
   - opens the connections to the server and to the fonts early
   Loads right after config.js, before the fetch wrappers, so it uses the plain browser fetch. */
(function () {
  'use strict';
  if (window.__ccFast) return; window.__ccFast = 1;
  var API = (typeof CC_API === 'string') ? CC_API.replace(/\/$/, '') : '';
  var nf = window.fetch ? window.fetch.bind(window) : null;
  function hint(rel, href) {
    if (!href || !document.head) return;
    var l = document.createElement('link'); l.rel = rel; l.href = href; l.crossOrigin = ''; document.head.appendChild(l);
  }
  hint('preconnect', API); hint('preconnect', 'https://fonts.gstatic.com');
  var last = 0;
  function ping() {
    if (!API || !nf || document.hidden || navigator.onLine === false) return;
    if (Date.now() - last < 120000) return;
    last = Date.now();
    try { nf(API + '/healthz', { mode: 'no-cors', cache: 'no-store' }).catch(function () {}); } catch (e) {}
  }
  ping();
  setInterval(ping, 240000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) ping(); });
  window.addEventListener('online', ping);
})();
