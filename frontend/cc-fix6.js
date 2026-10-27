/* cc-fix6.js: phone notifications inside the Android app (Firebase). Does nothing on the website or on iPhone.
   Asks for permission, gives this phone's address to the server, and opens the right place when a notification is tapped.
   It only turns on when the server says Firebase is set up. */
(function () {
  'use strict';
  if (window.__ccFix6) return; window.__ccFix6 = 1;
  var cap = window.Capacitor;
  if (!cap || !(cap.isNativePlatform && cap.isNativePlatform())) return;
  var P; try { P = (cap.Plugins && cap.Plugins.PushNotifications) || cap.registerPlugin('PushNotifications'); } catch (e) { return; }
  if (!P) return;
  var TK = 'ccfx_fcm', wired = false;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function enabled() { return true; }   // which kinds you get is chosen in the bell panel > Alerts and kept on the server
  function signed() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
  function call(p, body) { return window.ccCall(p, body ? { body: body, auth: false } : { auth: false }); }
  function openView(v) {
    if (v === 'update') { try { if (window.ccApp && window.ccApp.checkUpdate) window.ccApp.checkUpdate(); } catch (e) {} return; }   // tapped "Update available"
    if (v === 'live' && typeof window.go === 'function') { try { window.go('videos'); } catch (e) {} return; }
    var n = 0, t = setInterval(function () { var b = document.querySelector('.ccb'); if (b || ++n > 20) { clearInterval(t); if (b) b.click(); } }, 500);
  }
  function wire() {
    if (wired) return; wired = true;
    P.addListener('registration', function (t) {
      if (!t || !t.value) return; ls(TK, t.value);
      call('/api/push/fcm', { token: t.value }).catch(function () {});
    });
    P.addListener('registrationError', function () {});
    P.addListener('pushNotificationReceived', function () { try { if (window.ccNotifyRefresh) window.ccNotifyRefresh(); } catch (e) {} });
    P.addListener('pushNotificationActionPerformed', function (a) {
      var d = a && a.notification && a.notification.data;
      try { if (window.ccNotifyRefresh) window.ccNotifyRefresh(); } catch (e) {}
      openView(d && d.view);
    });
  }
  function sync() {
    if (!window.ccCall || !signed()) return;
    if (!enabled()) {
      var old = ls(TK); if (old) { call('/api/push/fcm-remove', { token: old }).catch(function () {}); ls(TK, null); }
      return;
    }
    call('/api/push/key').then(function (d) {
      if (!d || !d.fcm) return;                                   // Firebase is not set up on the server yet
      wire();
      return P.checkPermissions().then(function (p) {
        if (p.receive === 'granted' || p.receive === 'denied') return p;
        return P.requestPermissions();
      }).then(function (p) { if (p && p.receive === 'granted') return P.register(); });
    }).catch(function () {});
  }
  setTimeout(sync, 7000);
  window.addEventListener('focus', function () { setTimeout(sync, 1500); });
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.ccfx-t')) { setTimeout(sync, 1200); setTimeout(sync, 5000); }
  });
})();
