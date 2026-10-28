/* cc-swupdate.js: when a new version of the app has been downloaded in the background, say so and offer a refresh,
   so nobody keeps running half old, half new files. Nothing reloads by itself, so nothing you are typing is lost. */
(function () {
  'use strict';
  if (window.__ccSwUpd || !('serviceWorker' in navigator)) return; window.__ccSwUpd = 1;
  var had = !!navigator.serviceWorker.controller, shown = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!had || shown) return; shown = true;
    var b = document.createElement('div'); b.id = 'ccupd'; b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:50%;bottom:calc(86px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:10px;padding:9px 12px 9px 16px;border-radius:999px;background:var(--fg,#16130f);color:var(--bg,#fff);font:600 12.5px Poppins,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)';
    var t = document.createElement('span'); t.textContent = 'New version ready';
    var u = document.createElement('button'); u.type = 'button'; u.textContent = 'Refresh';
    u.style.cssText = 'border:0;border-radius:999px;padding:7px 14px;background:var(--bg,#fff);color:var(--fg,#16130f);font:700 12px Poppins,system-ui,sans-serif;cursor:pointer';
    u.onclick = function () { location.reload(); };
    b.appendChild(t); b.appendChild(u); (document.body || document.documentElement).appendChild(b);
  });
})();
