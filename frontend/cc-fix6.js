/* cc-fix6.js (cc-fix8): phone notifications inside the Android app (Firebase). Does nothing on the website or on iPhone.
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
  var N = null; try { if (cap.isPluginAvailable && cap.isPluginAvailable('CCNotif')) N = cap.registerPlugin('CCNotif'); } catch (e) { N = null; }   // cc-fix8: set only in the new app build
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function enabled() { return true; }   // which kinds you get is chosen in the bell panel > Alerts and kept on the server
  function signed() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
  function call(p, body) { return window.ccCall(p, body ? { body: body, auth: false } : { auth: false }); }
  /* cc-fix8: tapping a phone notification opens the right screen. d = { view, ref_type, ref_id, kind } */
  function ready(fn) { var n = 0, t = setInterval(function () { if ((typeof window.go === 'function' && window.ccCall) || ++n > 75) { clearInterval(t); setTimeout(fn, 300); } }, 400); }
  function clickWhen(sel) { var n = 0, t = setInterval(function () { var b = document.querySelector(sel); if (b || ++n > 12) { clearInterval(t); if (b) b.click(); } }, 250); }
  function openBell() { var n = 0, t = setInterval(function () { var b = document.querySelector('.ccb'); if (b || ++n > 20) { clearInterval(t); if (b) b.click(); } }, 500); }
  function openLive(id) {
    call('/api/live').then(function (d) {
      var l = (d && d.streams) || [], s = null;
      for (var i = 0; i < l.length; i++) if (id && l[i].id === id) s = l[i];
      s = s || l[0];
      if (s && window.ccLiveStrip && window.ccLiveStrip.open) window.ccLiveStrip.open(s); else window.go('live');
    }).catch(function () { try { window.go('live'); } catch (e) {} });
  }
  function route(d) {
    d = d || {};
    var v = String(d.view || ''), rt = String(d.ref_type || ''), id = String(d.ref_id || '');
    ready(function () {
      try { if (window.ccNotifyRefresh) window.ccNotifyRefresh(); } catch (e) {}
      try {
        if (v === 'update' || rt === 'update') { if (window.ccApp && window.ccApp.checkUpdate) window.ccApp.checkUpdate(); }
        else if (v === 'live' || rt === 'live') openLive(id);
        else if (v === 'orders' || rt === 'order') { window.go('market'); clickWhen('#mseg button[data-s="orders"]'); }
        else if (v === 'listing' || rt === 'listing') { window.go('market'); clickWhen('#mseg button[data-s="mine"]'); }
        else if ((v === 'message' || rt === 'thread') && id && window.ccOpenThread) window.ccOpenThread({ tid: id, title: 'Anonymous message' });
        else if ((v === 'post' || v === 'clip' || rt === 'post' || rt === 'clip' || rt === 'story') && window.ccNotifOpen) window.ccNotifOpen({ ref_type: rt || v, ref_id: id });
        else if (v === 'rewards') window.go('rewards');
        else if (v === 'me' || rt === 'verification') window.go('me');
        else if (rt === 'payment' || rt === 'withdrawal') { window.go('market'); clickWhen('#mseg button[data-s="orders"]'); }
        else openBell();
      } catch (e) { openBell(); }
    });
  }
  function nativeTaps() {   // the Android app's own notifications (cc-fix7): taps arrive here, and opening the bell clears them
    if (!N) return;
    try { N.addListener('ccTap', function (t) { route(t); }); } catch (e) {}
    try { N.takeTap().then(function (r) { if (r && r.tap) route(r.tap); }).catch(function () {}); } catch (e) {}
    window.addEventListener('click', function (e) { if (e.target && e.target.closest && e.target.closest('.ccb')) { try { N.clear(); } catch (x) {} } }, true);
  }
  function makeChannel() {   // Android 8+: the panel entry needs a channel. Created once; asking again does nothing.
    try { if (P.createChannel) P.createChannel({ id: 'cc_alerts', name: 'Comrade Connect alerts', description: 'Comments, events, live and updates', importance: 4, visibility: 1, vibration: true, lights: true }).catch(function () {}); } catch (e) {}
  }
  function channel() {
    try { if (P.createChannel) return Promise.resolve(P.createChannel({ id: 'cc_alerts', name: 'Comrade Connect alerts', description: 'Orders, comments, live, events and app updates', importance: 4, visibility: 1, vibration: true, lights: true })).catch(function () {}); } catch (e) {}
    return Promise.resolve();
  }
  function wire() {
    if (wired) return; wired = true;
    P.addListener('registration', function (t) {
      if (!t || !t.value) return; ls(TK, t.value);
      call('/api/push/fcm', N ? { token: t.value, v: 2 } : { token: t.value }).catch(function () {});
    });
    P.addListener('registrationError', function () {});
    P.addListener('pushNotificationReceived', function () { /* app is open: only refresh the bell, no pop-up of any kind */ try { if (window.ccNotifyRefresh) window.ccNotifyRefresh(); } catch (e) {} });
    P.addListener('pushNotificationActionPerformed', function (a) {
      var d = a && a.notification && a.notification.data;
      try { if (window.ccNotifyRefresh) window.ccNotifyRefresh(); } catch (e) {}
      route(d);
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
      wire(); makeChannel();
      return P.checkPermissions().then(function (p) {
        if (p.receive === 'granted') return p;
        if (p.receive === 'denied') {   // cc-fix1: Android 13+ lets us ask once more; at most once a day so it never nags
          var last = +ls('ccfx_ask') || 0; if (Date.now() - last < 864e5) return p;
          ls('ccfx_ask', String(Date.now()));
        }
        return P.requestPermissions();
      }).then(function (p) { if (p && p.receive === 'granted') return channel().then(function () { return P.register(); }); });
    }).catch(function () {});
  }
  nativeTaps();
  setTimeout(sync, 7000);
  (function keepTrying() {   // cc-fix1: signing in comes after launch, so keep checking until this phone has given its address to the server
    var n = 0, t = setInterval(function () { if (ls(TK) || ++n > 40) { clearInterval(t); return; } sync(); }, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(sync, 1500); });
  })();
  window.addEventListener('focus', function () { setTimeout(sync, 1500); });
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.ccfx-t')) { setTimeout(sync, 1200); setTimeout(sync, 5000); }
  });
})();
