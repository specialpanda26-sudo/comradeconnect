/* cc-offline.js: the app never goes blank without data.
   1) Every read from the server is saved on the phone. No data? The saved copy is shown instead.
   2) A slow or sleeping server falls back to the saved copy after 8 seconds.
   3) A service worker keeps the app screens, fonts and pictures for offline use.
   Loaded right after the fetch shim in index.html, so it sits on top of the sign-in headers. */
(function () {
  'use strict';
  if (window.__ccOffline) return; window.__ccOffline = 1;
  var API = (typeof CC_API === 'string') ? CC_API : '';
  var CACHE = 'cc-api-v2', MAX = 160;
  var SKIP = /^\/api\/(admin|auth|live|pay|payments|callback|upload|media\/upload)/;
  var prev = window.fetch, hasCaches = 'caches' in window;
  var bar = null, hideT = 0;

  function css() {
    if (document.getElementById('ccoff-css')) return;
    var s = document.createElement('style'); s.id = 'ccoff-css';
    s.textContent = '#ccoff{position:fixed;left:50%;bottom:calc(86px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9998;display:flex;align-items:center;gap:10px;padding:9px 12px 9px 16px;border-radius:999px;background:var(--fg,#fff);color:var(--bg,#101422);font:600 12.5px Poppins,system-ui,sans-serif;box-shadow:0 8px 30px rgba(16,20,34,.45);max-width:92vw}#ccoff button{border:0;border-radius:999px;padding:6px 12px;background:var(--bg,#101422);color:var(--fg,#fff);font:600 12px Poppins,system-ui,sans-serif}';
    (document.head || document.documentElement).appendChild(s);
  }
  function show() {
    clearTimeout(hideT);
    var go = function () {
      css();
      if (bar && bar.isConnected) return;
      bar = document.createElement('div'); bar.id = 'ccoff'; bar.setAttribute('role', 'status');
      bar.innerHTML = '<span>Offline. Showing saved data</span><button type="button">Retry</button>';
      bar.querySelector('button').onclick = function () { location.reload(); };
      document.body.appendChild(bar);
    };
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  }
  function hide() { clearTimeout(hideT); hideT = setTimeout(function () { if (bar) { bar.remove(); bar = null; } }, 400); }
  window.addEventListener('online', hide);

  function keyFor(u) {
    var a = window.ccAuth && window.ccAuth();
    return new Request(u + (u.indexOf('?') < 0 ? '?' : '&') + '__u=' + encodeURIComponent(((a && a.aid) || 'guest') + '|' + (function () { try { return localStorage.getItem('cc_campus') || ''; } catch (e) { return ''; } })()));   // each campus keeps its own saved copy
  }
  function trim(c) {
    c.keys().then(function (ks) { if (ks.length > MAX) ks.slice(0, ks.length - MAX).forEach(function (k) { c.delete(k); }); });
  }

  window.fetch = function (u, o) {
    var self = this, args = arguments;
    if (typeof u !== 'string' || !API || u.indexOf(API) !== 0) return prev.apply(self, args);
    var method = ((o && o.method) || 'GET').toUpperCase();
    if (method !== 'GET') {                                      // saving, paying, posting: needs the internet, say so clearly
      if (navigator.onLine === false) return Promise.reject(new Error('You are offline. Connect to data or Wi-Fi and try again.'));
      return prev.apply(self, args).catch(function (e) {
        if (e && e.name === 'AbortError') throw e;
        throw new Error('Could not reach the server. Check your data or Wi-Fi and try again.');
      });
    }
    if (!hasCaches || SKIP.test(u.slice(API.length))) return prev.apply(self, args);
    var k = keyFor(u);
    return caches.open(CACHE).then(function (c) {
      return c.match(k).then(function (hit) {
        var net = prev.apply(self, args).then(function (r) {
          if (r && r.ok) { c.put(k, r.clone()).then(function () { trim(c); }, function () {}); hide(); }
          return r;
        });
        if (!hit) return net.catch(function (e) { if (navigator.onLine === false) show(); throw e; });
        var wait = new Promise(function (res) { setTimeout(function () { res(null); }, navigator.onLine === false ? 0 : 5000); });
        return Promise.race([net.catch(function () { return null; }), wait]).then(function (r) {
          if (r && (r.ok || r.status < 500)) return r;
          show(); return hit;                                    // no data, server asleep or failing: the saved copy
        });
      });
    }, function () { return prev.apply(self, args); });
  };
  window.ccClearOffline = function () { try { if (hasCaches) caches.delete(CACHE); } catch (e) {} };

  // The Android app also runs on "localhost", but over https with no port. A dev server on a laptop or phone
  // is http or has a port, and must never keep old files, so it gets no service worker and drops any old one.
  var devHost = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname) && !(location.protocol === 'https:' && !location.port);
  if ('serviceWorker' in navigator && devHost) {
    navigator.serviceWorker.getRegistrations().then(function (rs) {
      if (!rs.length) return;
      Promise.all(rs.map(function (r) { return r.unregister(); }))
        .then(function () { return hasCaches ? caches.keys() : []; })
        .then(function (ks) { return Promise.all(ks.filter(function (k) { return /^cc-(shell|runtime)/.test(k); }).map(function (k) { return caches.delete(k); })); })
        .then(function () { try { if (!sessionStorage.getItem('cc_sw_off')) { sessionStorage.setItem('cc_sw_off', '1'); location.reload(); } } catch (e) {} });
    }).catch(function () {});
  } else if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }
})();
