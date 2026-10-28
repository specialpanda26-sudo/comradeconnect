/* cc-swupdate.js v2: when a new version of the app has been downloaded in the background, say so and offer a refresh,
   so nobody keeps running half old, half new files. Nothing reloads by itself, so nothing you are typing is lost.
   v2: glass design, its own id (it used to share "ccupd" with the update card on the Me tab) and a dismiss button. */
(function () {
  'use strict';
  if (window.__ccSwUpd || !('serviceWorker' in navigator)) return; window.__ccSwUpd = 1;
  var had = !!navigator.serviceWorker.controller, shown = false;
  function css() {
    if (document.getElementById('ccswupd-css')) return;
    var s = document.createElement('style'); s.id = 'ccswupd-css';
    s.textContent = '#ccswupd{position:fixed;left:50%;bottom:calc(86px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:10px;padding:8px 8px 8px 16px;border-radius:999px;background:color-mix(in srgb,var(--bg,#000) 55%,transparent);-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);border:1px solid var(--gb,rgba(255,255,255,.22));color:var(--fg,#fff);font:600 12.5px Poppins,system-ui,sans-serif;box-shadow:var(--sh,0 10px 30px rgba(0,0,0,.3));max-width:92vw}'
      + '#ccswupd i{width:8px;height:8px;border-radius:50%;background:#ff8a3d;flex:none}'
      + '#ccswupd button{border:1px solid var(--gb,rgba(255,255,255,.3));border-radius:999px;padding:7px 14px;background:transparent;color:inherit;font:700 12px Poppins,system-ui,sans-serif;cursor:pointer}'
      + '#ccswupd button.x{border:0;padding:7px 10px;font-weight:600;opacity:.7}';
    (document.head || document.documentElement).appendChild(s);
  }
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!had || shown) return; shown = true;
    css();
    var b = document.createElement('div'); b.id = 'ccswupd'; b.setAttribute('role', 'status');
    var d = document.createElement('i');
    var t = document.createElement('span'); t.textContent = 'New version ready';
    var u = document.createElement('button'); u.type = 'button'; u.textContent = 'Refresh';
    u.onclick = function () { location.reload(); };
    var x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.textContent = 'Later';
    x.onclick = function () { b.remove(); };
    b.appendChild(d); b.appendChild(t); b.appendChild(u); b.appendChild(x);
    (document.body || document.documentElement).appendChild(b);
  });
})();
