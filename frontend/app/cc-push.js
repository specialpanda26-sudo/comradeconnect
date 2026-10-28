/* cc-push.js: phone alerts for the new app (Android app only; does nothing on the website).
   1. Gives this phone's Firebase address to the server once you are signed in, and again after every sign-in or account change.
   2. Me > Notifications > "Allow alerts" asks for the phone permission; "Send a test" runs a check that names the broken link:
      app > sign-in > phone permission > Firebase file in the build > address saved on Render > Firebase key on Render > delivery.
   3. Tapping an alert opens the right screen.
   4. The two switches in Me > Notifications are saved on the server (replies and messages, notices and events). */
(function () {
  'use strict';
  if (window.__ccPush) return; window.__ccPush = 1;
  var cap = window.Capacitor;
  var native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  var TK = 'ccpush_tk', SAVED = 'ccpush_saved', ASK = 'ccpush_ask';
  var ST = { native: native, perm: '', err: '', token: '', saved: '', testSeen: 0, running: null };
  var P = null, N = null, wired = false, lastTry = '';

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } return null; }
  function say(t) { try { if (typeof toast === 'function') toast(t); } catch (e) { /* no toast yet */ } }
  function plug(n) { try { return (cap.Plugins && cap.Plugins[n]) || (cap.registerPlugin ? cap.registerPlugin(n) : null); } catch (e) { return null; } }
  if (native) {
    P = plug('PushNotifications');
    try { if (cap.isPluginAvailable && cap.isPluginAvailable('CCNotif')) N = plug('CCNotif'); } catch (e) { N = null; }
  }
  function auth() { try { return window.ccAuth ? window.ccAuth() : null; } catch (e) { return null; } }
  function signed() { var a = auth(); return !!(a && a.token); }
  function who() { var a = auth(); return a && a.token ? a.aid : ''; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc2(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* one call to the server; never throws. The page's fetch shim adds X-Aid and X-Token. */
  function call(method, path, body) {
    var ac = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ac && setTimeout(function () { ac.abort(); }, 20000);
    var o = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) o.body = JSON.stringify(body);
    if (ac) o.signal = ac.signal;
    return fetch((typeof CC_API === 'string' ? CC_API : '') + path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d || {} }; });
    }, function () { return { ok: false, status: 0, data: {} }; }).then(function (x) { if (t) clearTimeout(t); return x; });
  }

  /* ---------- tapping an alert opens the right screen ---------- */
  function route(d) {
    d = d || {};
    var v = String(d.view || ''), rt = String(d.ref_type || ''), id = String(d.ref_id || '');
    setTimeout(function () {
      try {
        if (rt === 'test' || v === 'bell' || v === 'update' || rt === 'update') A.bell();
        else if (v === 'live' || rt === 'live') { S.wTab = 'live'; go('watch'); }
        else if (v === 'orders' || rt === 'order' || rt === 'payment' || rt === 'withdrawal') { S.mkTab = 'orders'; go('market'); }
        else if (v === 'listing' || rt === 'listing') { S.mkTab = 'mine'; go('market'); }
        else if (v === 'message' || rt === 'thread') A.msgs();
        else if (v === 'clip' || rt === 'clip') { S.wTab = 'clips'; go('watch'); }
        else if (v === 'post' || rt === 'post' || rt === 'story') { S.cat = 'All'; go('home'); }
        else if (v === 'rewards' || rt === 'referral') { go('me'); A.rewards(); }
        else if (v === 'me' || rt === 'verification') go('me');
        else A.bell();
      } catch (e) { try { A.bell(); } catch (x) { /* nothing more to try */ } }
    }, 350);
  }

  /* ---------- phone registration ---------- */
  function save(token) {
    var key = who() + ':' + token;
    return call('POST', '/api/push/fcm', N ? { token: token, v: 2 } : { token: token }).then(function (r) {
      if (r.ok) { ST.saved = key; ST.saveStatus = 200; ls(SAVED, key); } else { ST.saveStatus = r.status; }
      return r;
    });
  }
  function wire() {
    if (wired || !P) return; wired = true;
    P.addListener('registration', function (t) {
      if (!t || !t.value) return;
      ST.token = t.value; ST.err = ''; ls(TK, t.value);
      if (signed()) save(t.value);
    });
    P.addListener('registrationError', function (e) { ST.err = String((e && (e.error || e.message)) || e || 'registration failed'); });
    P.addListener('pushNotificationReceived', function (n) {   // the app is open: the bell refreshes, no pop-up
      var d = (n && n.data) || {};
      if (d.kind === 'test' || (n && n.title === 'Test alert')) ST.testSeen = Date.now();
      try { document.dispatchEvent(new Event('visibilitychange')); } catch (e) { /* old webview */ }
    });
    P.addListener('pushNotificationActionPerformed', function (a) { route(a && a.notification && a.notification.data); });
    if (N) {
      try { N.addListener('ccTap', route); } catch (e) { /* plugin too old */ }
      try { N.takeTap().then(function (r) { if (r && r.tap) route(r.tap); }).catch(function () {}); } catch (e) { /* plugin too old */ }
    }
  }
  function channel() {
    try { if (P.createChannel) return Promise.resolve(P.createChannel({ id: 'cc_alerts', name: 'Comrade Connect alerts', description: 'Orders, comments, live, events and app updates', importance: 4, visibility: 1, vibration: true, lights: true })).catch(function () {}); } catch (e) { /* older plugin */ }
    return Promise.resolve();
  }
  /* Walks the chain once. Resolves with { stage, ... } and never rejects. userTap = the person pressed a button, so asking again is fine. */
  function run(userTap) {
    if (!native) return Promise.resolve({ stage: 'web' });
    if (!P) return Promise.resolve({ stage: 'plugin' });
    if (!signed()) return Promise.resolve({ stage: 'signin' });
    wire();
    return P.checkPermissions().then(function (p) {
      ST.perm = p.receive;
      if (p.receive === 'granted') return p;
      if (!userTap && p.receive === 'denied') {   // Android 13+ lets us ask once more; at most once a day so it never nags
        var last = +ls(ASK) || 0; if (Date.now() - last < 864e5) return p;
      }
      ls(ASK, String(Date.now()));
      return P.requestPermissions();
    }).then(function (p) {
      ST.perm = p.receive;
      if (p.receive !== 'granted') return { stage: 'permission' };
      ST.err = '';
      return channel().then(function () { return P.register(); }).then(function () {
        var n = 0;
        return new Promise(function (res) {   // the address arrives by event; give it 12 seconds
          (function tick() { if (ST.err || ST.token || ++n > 24) return res(); setTimeout(tick, 500); })();
        });
      }, function (e) { ST.err = String((e && e.message) || e || 'register failed'); }).then(function () {
        if (ST.err) return { stage: 'firebase', err: ST.err };
        if (!ST.token) return { stage: 'firebase', err: 'No answer from Firebase after 12 seconds.' };
        if (ST.saved === who() + ':' + ST.token) return { stage: 'ok' };
        return save(ST.token).then(function (r) { return r.ok ? { stage: 'ok' } : { stage: 'save', status: r.status }; });
      });
    }, function (e) { return { stage: 'plugin', err: String((e && e.message) || e) }; }).then(function (r) { lastTry = who() + ':' + ST.token; return r; });
  }
  function sync(userTap) {
    if (ST.running) return ST.running;
    ST.running = run(userTap).then(function (r) { ST.running = null; ST.last = r; return r; }, function (e) { ST.running = null; return { stage: 'plugin', err: String(e) }; });
    return ST.running;
  }

  /* ---------- Me > Notifications: Allow alerts and Send a test ---------- */
  var TEXT = {
    web: 'You are on the website. Phone alerts come from the Android app: open Comrade Connect from your app drawer.',
    plugin: 'This app build has no alerts plug-in. Install the newest app from the Download page.',
    signin: 'Sign in first, then check again.',
    permission: 'Alerts are blocked for this app. Open phone Settings > Apps > Comrade Connect > Notifications and turn them on, then come back.'
  };
  function firebaseText(err) {
    if (/firebaseapp|google-services|not initialized|initializeapp|default firebase/i.test(err || ''))
      return 'This app was built WITHOUT the Firebase file. On GitHub open Settings > Secrets and variables > Actions, add GOOGLE_SERVICES_JSON_BASE64 (your google-services.json as base64), run "Build Android APK", then install the new app. (' + err + ')';
    return 'Firebase did not give this phone an address: ' + (err || 'no reason given') + '. Check the phone is online and Google Play services is up to date.';
  }
  function glyph(s) { return s === 'ok' ? '<b style="color:var(--ok);font-size:18px">&#10003;</b>' : s === 'bad' ? '<b style="color:var(--bad);font-size:18px">&#10007;</b>' : s === 'warn' ? '<b style="color:var(--o);font-size:18px">!</b>' : s === 'run' ? '<b style="font-size:16px">&hellip;</b>' : '<b style="color:var(--mut);font-size:16px">&middot;</b>'; }
  var STEPS = [['app', 'Android app'], ['signed', 'Signed in'], ['perm', 'Phone permission'], ['fb', 'Firebase file in this app'], ['saved', 'Phone address saved on the server'], ['key', 'Firebase key on Render'], ['send', 'Test alert delivered']];
  function setStep(id, state, text) {
    var el = document.getElementById('ccpk-' + id); if (!el) return false;
    el.innerHTML = '<span class="ri">' + glyph(state) + '</span><span class="rx"><b>' + esc2(STEPS.filter(function (s) { return s[0] === id; })[0][1]) + '</b>' + (text ? '<small style="white-space:normal">' + esc2(text) + '</small>' : '') + '</span>';
    return true;
  }
  function openCheck() {
    var rows = STEPS.map(function (s) { return '<div class="row" id="ccpk-' + s[0] + '"></div>'; }).join('');
    openSheet('Check notifications', '<p class="sub1" style="margin-bottom:10px">This finds the exact link that is broken, from your phone to Firebase.</p>' + rows +
      '<p class="note" id="ccpk-sum" style="margin:10px 0 12px"></p><div class="two"><button class="btn w sm" style="width:100%" id="ccpk-again">Check again</button><button class="btn w sm" style="width:100%" id="ccpk-later">Test in 10 seconds</button></div>' +
      '<p class="note" style="margin-top:10px">"Test in 10 seconds": tap it, then press the phone\'s Home button. The alert should appear on the lock screen.</p>', function (sh) {
        sh.querySelector('#ccpk-again').onclick = check;
        sh.querySelector('#ccpk-later').onclick = function () { later(); };
      });
    check();
  }
  function sum(t) { var e = document.getElementById('ccpk-sum'); if (e) e.textContent = t || ''; }
  function check() {
    STEPS.forEach(function (s) { setStep(s[0], 'wait', ''); }); sum('');
    function stop(id, text, why) { setStep(id, 'bad', text); sum(why || text); return null; }
    if (!native) { setStep('app', 'bad', TEXT.web); sum(TEXT.web); return; }
    setStep('app', 'ok', P ? 'Running inside the app.' : '');
    if (!P) { setStep('app', 'bad', TEXT.plugin); sum(TEXT.plugin); return; }
    if (!signed()) { stop('signed', TEXT.signin); return; }
    setStep('signed', 'ok', '');
    setStep('perm', 'run', 'Checking...');
    ST.saved = ''; ls(SAVED, null);   // a manual check always sends the phone address again
    sync(true).then(function (r) {
      if (!document.getElementById('ccpk-perm')) return null;
      if (r.stage === 'plugin') return stop('app', TEXT.plugin + (r.err ? ' (' + r.err + ')' : ''));
      if (r.stage === 'permission') return stop('perm', TEXT.permission);
      setStep('perm', 'ok', 'Allowed.');
      if (r.stage === 'firebase') { setStep('fb', 'bad', firebaseText(r.err)); sum('The Firebase file is missing from this build, or Google Play services is not ready.'); return null; }
      setStep('fb', 'ok', 'This phone has a Firebase address (...' + String(ST.token).slice(-6) + ').');
      if (r.stage === 'save') return stop('saved', 'The server refused it (error ' + r.status + '). ' + (r.status === 0 ? 'The server could not be reached: check your internet.' : r.status === 401 ? 'Sign out and sign in again.' : 'Try again in a minute.'));
      setStep('saved', 'run', 'Asking the server...');
      return call('GET', '/api/push/status?deep=1');
    }).then(function (s) {
      if (!s) return null;
      if (!s.ok) return stop('saved', s.status === 401 ? 'Please sign out and sign in again.' : 'Could not reach the server (error ' + s.status + ').');
      var d = s.data, mine = ST.token ? String(ST.token).slice(-6) : '';
      if (!d.phones || !d.phones.length) return stop('saved', 'The server has no phone saved for this account. Tap "Check again".');
      setStep('saved', 'ok', d.phones.length + (d.phones.length === 1 ? ' phone is' : ' phones are') + ' saved for this account' + (d.phones.some(function (p) { return mine && p.phone.slice(-6) === mine; }) ? ', including this one.' : ' (this one may need another check).'));
      if (!d.fcm || d.key_ok === false) return stop('key', d.hint || 'Render has no working Firebase key.', 'Fix this on Render, then check again.');
      setStep('key', 'ok', 'Render signed in to Firebase (project ' + d.project + ').');
      setStep('send', 'run', 'Sending a real test alert...');
      ST.testSeen = 0;
      return call('POST', '/api/push/test', {}).then(function (t) {
        if (!document.getElementById('ccpk-send')) return null;
        if (!t.ok) return stop('send', 'The test could not be sent (error ' + t.status + ').');
        if (!t.data.ok) return stop('send', t.data.message || 'Firebase refused the test.', 'Firebase refused the alert. ' + (t.data.message || ''));
        var n = 0;
        return new Promise(function (res) { (function tick() { if (ST.testSeen || ++n > 16) return res(); setTimeout(tick, 500); })(); }).then(function () {
          if (ST.testSeen) { setStep('send', 'ok', 'Firebase accepted it and it reached this phone.'); sum('Everything works. Use "Test in 10 seconds" to also see the banner on the lock screen.'); }
          else { setStep('send', 'warn', 'Firebase accepted it, but this phone did not report it within 8 seconds.'); sum('Your setup is right. If real alerts still do not appear, open phone Settings > Apps > Comrade Connect > Battery and choose Unrestricted, and turn off Data saver.'); }
        });
      });
    });
  }
  function later() {
    if (!native || !signed()) { sum(!native ? TEXT.web : TEXT.signin); return; }
    call('POST', '/api/push/test', { delay: 10 }).then(function (r) {
      sum(r.ok ? 'Sent in 10 seconds. Press Home now. If nothing appears, open the app and tap Check again to see what Firebase answered.' : 'Could not schedule the test (error ' + r.status + ').');
      if (r.ok) { var n = 0; (function poll() { if (++n > 12) return; setTimeout(function () { call('GET', '/api/push/status').then(function (s) { var l = s.data && s.data.last_test; if (l && l.at > Date.now() - 60000) sum(l.ok ? 'Firebase accepted the delayed test. If the banner did not show, check battery and Data saver settings.' : 'Firebase refused the delayed test: ' + (l.message || '')); else poll(); }); }, 5000); })(); }
    });
  }
  A.allow = function () {
    if (!native) return say('Phone alerts work in the Android app, not in the browser.');
    if (!signed()) return say('Sign in first, then tap Allow alerts.');
    say('Checking alerts...');
    ST.saved = ''; ls(SAVED, null);
    sync(true).then(function (r) {
      say(r.stage === 'ok' ? 'Alerts are on for this phone' : r.stage === 'permission' ? 'Alerts are blocked. Turn them on in phone Settings > Apps > Comrade Connect > Notifications.' : r.stage === 'firebase' ? 'Alerts could not start. Tap "Send a test" to see why.' : 'Alerts could not be saved. Tap "Send a test" to see why.');
    });
  };
  A.testn = openCheck;

  /* ---------- the two switches are saved on the server (orders, money and live alerts stay on) ---------- */
  var MAPS = { n1: ['updates', 'events'], n2: ['comments', 'messages'] };
  var oMe = A.mesheet;
  A.mesheet = function (a) {
    var r = oMe.apply(this, arguments);
    if (a !== 'notif' || !signed()) return r;
    var sh = document.getElementById('sheet'), server = null;
    call('GET', '/api/notifications/prefs').then(function (g) {
      if (!g.ok || !g.data.prefs) return;
      server = g.data.prefs;
      var on = { n1: server.updates !== false && server.events !== false, n2: server.comments !== false && server.messages !== false };
      Object.keys(on).forEach(function (k) { S.notif[k] = on[k]; var el = sh && sh.querySelector('#' + k); if (el) el.checked = on[k]; });
    });
    ['n1', 'n2'].forEach(function (k) {
      var el = sh && sh.querySelector('#' + k);
      if (el) el.addEventListener('change', function () {
        var p = Object.assign({ comments: true, live: true, events: true, orders: true, wallet: true, messages: true, updates: true }, server || {});
        MAPS[k].forEach(function (c) { p[c] = el.checked; });
        server = p;
        call('POST', '/api/notifications/prefs', { prefs: p }).then(function (x) { if (!x.ok) say('Could not save that choice. Check your internet.'); });
      });
    });
    return r;
  };

  /* opening the bell clears the app's phone notifications; signing out stops this phone getting the old account's alerts */
  var oBell = A.bell;
  if (oBell) A.bell = function () { try { if (N) N.clear(); } catch (e) { /* ignore */ } return oBell.apply(this, arguments); };
  var oOut = A.signout;
  if (oOut) A.signout = function () {
    try { var tk = ST.token || ls(TK); if (native && tk && signed()) call('POST', '/api/push/fcm-remove', { token: tk }); } catch (e) { /* ignore */ }
    ST.saved = ''; ls(SAVED, null); lastTry = '';
    return oOut.apply(this, arguments);
  };

  /* ---------- keep it registered ---------- */
  if (native) {
    ST.saved = ls(SAVED) || ''; ST.token = ls(TK) || '';
    setInterval(function () {   // signing in or switching account happens after launch: register again when the account changes
      if (!signed() || ST.running) return;
      var now = who() + ':' + (ST.token || '');
      if (ST.saved !== now && lastTry !== now) sync(false);
      else if (!lastTry) sync(false);
    }, 4000);
    var again = function () { if (!document.hidden && signed()) setTimeout(function () { if (ST.saved !== who() + ':' + ST.token) { lastTry = ''; sync(false); } }, 1500); };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('focus', again);
  }
  window.ccPush = { sync: sync, check: openCheck, state: ST, route: route };
})();
