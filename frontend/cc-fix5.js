/* cc-fix5.js: signs this phone up for real push alerts, so they arrive even when the app is closed.
   Follows the Alerts On/Off switch and the browser permission. Needs the server keys (VAPID) to be set. */
(function () {
  'use strict';
  if (window.__ccFix5) return; window.__ccFix5 = 1;
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function enabled() { try { return (JSON.parse(ls('cs_nt') || '{"n2":1}') || {}).n2 !== 0; } catch (e) { return true; } }
  function signed() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
  function call(p, body) { return window.ccCall(p, body ? { body: body, auth: false } : { auth: false }); }
  function u8(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var r = atob(s), o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
  function ok() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!window.ccCall; }
  function sync() {
    if (!ok() || !signed()) return;
    navigator.serviceWorker.ready.then(function (reg) {
      if (!enabled() || Notification.permission !== 'granted') {
        return reg.pushManager.getSubscription().then(function (s) { if (s) { call('/api/push/unsubscribe', { endpoint: s.endpoint }).catch(function () {}); return s.unsubscribe(); } });
      }
      return call('/api/push/key').then(function (d) {
        if (!d || !d.key) return;
        return reg.pushManager.getSubscription()
          .then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(d.key) }); })
          .then(function (s) { var j = s.toJSON(); return call('/api/push/subscribe', { endpoint: j.endpoint, keys: j.keys }); });
      });
    }).catch(function () {});
  }
  setTimeout(sync, 6000);
  window.addEventListener('focus', function () { setTimeout(sync, 1500); });
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.ccfx-t')) { setTimeout(sync, 1500); setTimeout(sync, 6000); setTimeout(sync, 15000); }
  });
})();
