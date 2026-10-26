/* cc-native.js: only does anything inside the Android app.
   Google sign-in opens Google's own account chooser (the one with the app name and logo) in the phone's secure browser tab,
   then the callback page hands the sign-in back to the app. The button inside web views never works because Google blocks it. */
(function () {
  'use strict';
  var cap = window.Capacitor;
  var native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  window.ccApp = { native: native };
  if (!native) return;
  document.documentElement.classList.add('cc-in-app');

  var SCHEME = 'ke.co.comradeconnect.app';
  var CALLBACK = 'https://comradeconnect.co.ke/google-callback.html';   // must be listed as an Authorized redirect URI in Google Cloud
  var P = cap.Plugins || {};
  ['Browser', 'App', 'GoogleSignIn'].forEach(function (n) { try { if (!P[n] && cap.registerPlugin) P[n] = cap.registerPlugin(n); } catch (e) {} });   // plugins that are not listed on Capacitor.Plugins yet
  var pending = null;
  var KEEP = 'cc_g_pending';
  var keep = function (o) { try { if (o) localStorage.setItem(KEEP, JSON.stringify({ n: o.nonce, s: o.state, at: Date.now() })); else localStorage.removeItem(KEEP); } catch (e) {} };
  var kept = function () { try { var o = JSON.parse(localStorage.getItem(KEEP) || 'null'); return o && Date.now() - o.at < 10 * 60 * 1000 ? o : null; } catch (e) { return null; } };

  var rand = function () { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); };
  var payload = function (t) { try { return JSON.parse(decodeURIComponent(escape(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return {}; } };
  var done = function (fn, v) {
    var p = pending; pending = null; keep(null);
    setTimeout(function () { if (!pending) window.ccAwayOK = false; }, 4000);         // the lock may come back a moment after the sign-in is finished
    if (p) { clearTimeout(p.t); if (fn === 'res') { try { sessionStorage.setItem('cc_just', String(Date.now())); } catch (e) {} } p[fn](v); }
  };
  var oops = function (e) { var m = String((e && e.message) || ''); return /failed to fetch|networkerror|load failed|network request/i.test(m) ? 'Could not reach Comrade Connect. Check your data and try again.' : (m || 'Google sign-in failed. Try again.'); };

  // Real phone lock. Nothing here is drawn or pretended: every "true" comes from Android's own BiometricPrompt.
  //   kind 'fingerprint' -> STRONG biometrics only (that is the fingerprint sensor on almost every phone)
  //   kind 'face'        -> any enrolled biometric class, which is what lets the phone's face unlock in (Android rates most face unlock as "weak")
  //   kind 'credential'  -> the phone's own PIN / pattern / password
  //   no kind            -> reuse a check that just succeeded (one prompt per action), otherwise ask with everything allowed
  // Android decides the exact sensor on phones that have both, so the picker on screen only offers what checkBiometry() says exists.
  var bioRecent = 0, bioBusy = false;
  var bioPlugin = null;   // the plugin's native name is BiometricAuthNative (not BiometricAuth), and its prompt method is internalAuthenticate
  var BIO = function () { if (!bioPlugin) { try { bioPlugin = P.BiometricAuthNative || (cap.registerPlugin ? cap.registerPlugin('BiometricAuthNative') : null); } catch (e) {} } return bioPlugin; };
  var caps = function () {
    var B = BIO(), none = { fingerprint: false, face: false, credential: false, any: false };
    if (!B || !B.checkBiometry) return Promise.resolve(none);
    return B.checkBiometry().then(function (r) {
      r = r || {};
      var t = r.biometryTypes || (r.biometryType ? [r.biometryType] : []), has = function (n) { return t.indexOf(n) > -1; };
      var strong = !!r.strongBiometryIsAvailable, weak = !!r.isAvailable;
      var fp = strong || (weak && (has(3) || has(1)));
      var face = weak && (has(4) || has(2) || (!strong && !has(3) && !has(1)));       // some phones do not list face unlock, but report a weak biometric
      var cred = !!r.deviceIsSecure;
      return { fingerprint: fp, face: face, credential: cred, any: fp || face || cred, reason: r.reason || '' };
    }, function () { return none; });
  };
  var WHY = { userCancel: 'cancelled', systemCancel: 'cancelled', appCancel: 'cancelled', authenticationFailed: 'nomatch', biometryLockout: 'locked',
              biometryNotEnrolled: 'notenrolled', biometryNotAvailable: 'unavailable', noDeviceCredential: 'nolock' };
  window.ccNativeBio = {
    last: '', busy: function () { return bioBusy; },
    caps: caps,
    available: function () { return caps().then(function (c) { return c.any; }); },
    pref: function () { try { return localStorage.getItem('cc_bio_kind') || ''; } catch (e) { return ''; } },
    setPref: function (k) { try { localStorage.setItem('cc_bio_kind', k); } catch (e) {} },
    verify: function (why, kind) {
      var self = window.ccNativeBio; self.last = '';
      if (!kind && Date.now() - bioRecent < 8000) { bioRecent = 0; return Promise.resolve(true); }   // the screen just confirmed it: use that once, never twice
      var B = BIO(); if (!B || !B.internalAuthenticate) { self.last = 'unavailable'; return Promise.resolve(false); }
      var o = { reason: why || 'Confirm it is really you', cancelTitle: 'Cancel', allowDeviceCredential: true, androidTitle: 'Comrade Connect',
                androidSubtitle: why || 'Use your fingerprint, face or phone password', androidConfirmationRequired: false, androidBiometryStrength: 0 };
      if (kind === 'fingerprint') { o.allowDeviceCredential = false; o.androidBiometryStrength = 1; o.androidSubtitle = 'Touch the fingerprint sensor'; }
      else if (kind === 'face') { o.allowDeviceCredential = false; o.androidBiometryStrength = 0; o.androidSubtitle = 'Look at your phone'; }
      bioBusy = true;
      return B.internalAuthenticate(o).then(function () { bioRecent = kind ? Date.now() : 0; return true; },
        function (e) { self.last = WHY[e && e.code] || 'nomatch'; return false; })
        .then(function (ok) { setTimeout(function () { bioBusy = false; }, 1500); return ok; });
    }
  };
  // after a sign-in the lock must not pop up on top of it
  try { var jt = +sessionStorage.getItem('cc_just') || 0; if (Date.now() - jt < 30000) window.ccJustAuthed = true; sessionStorage.removeItem('cc_just'); } catch (e) {}
  // when the lock screen appears (app start, or coming back after a minute), ask the phone straight away
  var autoAsk = function () {
    var lk = document.getElementById('lk'), b = document.getElementById('lku');
    if (!bioBusy && !window.ccAwayOK && lk && b && lk.classList.contains('on')) b.click();
  };
  window.addEventListener('load', function () { setTimeout(autoAsk, 900); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(autoAsk, 500); });

  // New version of the app? Ask the person: "Update now" or "Cancel". The website inside the app cannot change by itself, so every change you push
  // builds a new APK (GitHub Releases); the app checks for it when it opens, when you come back to it, and when the internet returns.
  var REPO = 'specialpanda26-sudo/comradeconnect-releases';
  var updBusy = false, updOpen = false, updLast = 0;
  var checkUpdate = function (force) {
    if (updBusy || updOpen || !P.App || !P.App.getInfo || navigator.onLine === false) return;
    if (force !== true && Date.now() - updLast < 20 * 60 * 1000) return;                 // at most every 20 minutes on its own
    updBusy = true; updLast = Date.now();
    P.App.getInfo().then(function (i) {
      var cur = parseInt(String((i && i.version) || '').split('.').pop(), 10) || 0;
      return fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=15', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (list) { var rel = (Array.isArray(list) ? list : []).filter(function (x) { return /^app-\d+/.test(x.tag_name || '') && !x.draft; })[0] || null;
        var say = function (t) { if (force === true) { try { if (window.ccTools && ccTools.toast) ccTools.toast(t); else if (typeof toast === 'function') toast(t); } catch (e) {} } };
        if (!rel) return say('Could not check for updates. Try again later.');
        var n = parseInt(String(rel.tag_name || '').replace(/\D/g, ''), 10) || 0;
        var a = (rel.assets || []).filter(function (x) { return /\.apk$/i.test(x.name); })[0];
        if (!a || n <= cur) return say('You already have the newest version.');
        var until = 0; try { until = +localStorage.getItem('cc_upd_until_' + n) || 0; } catch (e) {}
        if (force !== true && Date.now() < until) return;                                 // they tapped Cancel: ask again tomorrow
        showUpdate(n, String(rel.body || ''), a.browser_download_url);
      });
    }).catch(function () {}).then(function () { updBusy = false; });
  };
  var showUpdate = function (n, notes, url) {
    if (updOpen) return; updOpen = true;
    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    notes = notes.replace(/Install comrade-connect\.apk on your (Android )?phone\.?/i, '').replace(/[#*_`>]/g, '').trim().slice(0, 300);
    var ov = document.createElement('div'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Update available');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10200;display:grid;place-items:center;padding:22px;background:rgba(16,20,34,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:Poppins,system-ui,sans-serif';
    ov.innerHTML = '<div style="width:100%;max-width:340px;border-radius:24px;padding:24px 22px 18px;background:var(--bg,#101422);color:var(--fg,#fff);border:1px solid var(--gb,rgba(255,255,255,.28));text-align:center">'
      + '<h2 style="margin:0 0 8px;font-size:21px;font-weight:700">Update available</h2>'
      + '<p style="margin:0;font-size:14px;line-height:1.55;color:var(--mut,var(--mut))">A new version of Comrade Connect is ready.' + (notes ? '<br><span style="display:block;margin-top:10px;color:var(--fg,#fff)">What is new: ' + esc(notes) + '</span>' : '') + '</p>'
      + '<button type="button" data-u style="width:100%;margin-top:18px;border:0;border-radius:999px;padding:14px;background:var(--fg,#fff);color:var(--bg,#101422);font:600 15px Poppins,system-ui,sans-serif;cursor:pointer">Update now</button>'
      + '<button type="button" data-x style="width:100%;margin-top:8px;border:0;background:none;color:var(--mut,var(--mut));padding:12px;font:500 14px Poppins,system-ui,sans-serif;cursor:pointer">Cancel</button>'
      + '<p style="margin:6px 0 0;font-size:11px;color:var(--mut,var(--mut))">Your account and saved data stay as they are. When the download finishes, open it and tap Install.</p></div>';
    var close = function () { updOpen = false; ov.remove(); };
    ov.querySelector('[data-u]').onclick = function () { close(); try { P.Browser.open({ url: url }); } catch (e) { location.href = url; } };
    ov.querySelector('[data-x]').onclick = function () { try { localStorage.setItem('cc_upd_until_' + n, String(Date.now() + 864e5)); } catch (e) {} close(); };
    document.body.appendChild(ov);
  };
  window.ccApp.checkUpdate = function () { checkUpdate(true); };                          // "Check for updates" buttons can call this
  window.addEventListener('load', function () { setTimeout(checkUpdate, 4000); });
  window.addEventListener('online', function () { setTimeout(checkUpdate, 1500); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(checkUpdate, 1200); });

  // Google sign-in uses the phone's secure browser tab (Chrome Custom Tab). The old in-app picker plugin was removed: it closed the whole app
  // ("Unfortunately, Comrade Connect has stopped") on phones where Google Play services or the SHA-1 key did not match, and a native crash cannot be caught.
  // Preferred: the native "Choose an account" bottom sheet (Android Credential Manager) that slides up over the app.
  // If it is missing, there is no Google account on the phone, or this build's SHA-1 is not registered in Google Cloud, we fall back to the browser tab.
  // A user who swipes the sheet away is a cancel: nothing else opens.
  var nativeGoogle = function () {
    return new Promise(function (res, rej) {
      var N = P.GoogleSignIn;
      if (!N || !N.signIn) return rej(Object.assign(new Error('unavailable'), { code: 'UNIMPLEMENTED' }));
      N.signIn({ serverClientId: CC_GOOGLE_ID, nonce: rand() }).then(function (r) {
        if (r && r.idToken) res(r.idToken); else rej(Object.assign(new Error('no token'), { code: 'FAILED' }));
      }, rej);
    });
  };
  window.ccApp.googleLogin = function () {
    if (typeof CC_NATIVE_GOOGLE === 'undefined' || CC_NATIVE_GOOGLE !== true) return browserGoogle();
    return nativeGoogle().catch(function (e) {
      if (e && (e.code === 'CANCELLED' || e.cancelled || /^cancel/i.test(String(e.message || '')))) throw Object.assign(new Error('cancelled'), { cancelled: true });
      return browserGoogle();
    });
  };

  // Open any link in the secure tab (card page, update download, etc). Resolves true if the tab opened.
  window.ccApp.open = function (url) {
    return new Promise(function (res) {
      try {
        if (P.Browser && P.Browser.open) { P.Browser.open({ url: url }).then(function () { res(true); }, function () { res(false); }); return; }
      } catch (e) {}
      res(false);
    });
  };
  var browserGoogle = function () {
    return new Promise(function (res, rej) {
      if (navigator.onLine === false) return rej(new Error('You are offline. Connect to data or Wi-Fi to sign in with Google.'));
      if (!P.Browser) return rej(new Error('Sign-in is not ready in this app version. Please update the app.'));
      var nonce = rand(), state = rand();
      pending = { res: res, rej: rej, nonce: nonce, state: state, t: setTimeout(function () { done('rej', Object.assign(new Error('Sign-in took too long. Try again.'), {})); }, 180000) };
      var url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(CC_GOOGLE_ID)
        + '&redirect_uri=' + encodeURIComponent(CALLBACK) + '&response_type=id_token&scope=' + encodeURIComponent('openid profile')
        + '&nonce=' + nonce + '&state=' + state + '&prompt=select_account';
      keep(pending); window.ccAwayOK = true;
      P.Browser.open({ url: url }).catch(function () { done('rej', new Error('Could not open Google. Try again.')); });
    });
  };

  // The sign-in came back. Normal case: the app was alive and is waiting (pending). Android sometimes closes the app while the
  // browser tab is open; then the app starts again with no memory of the request, so we check it against the copy kept on the phone.
  var handleReturn = function (u) {
    u = String(u || ''); if (u.indexOf(SCHEME + '://') !== 0) return;
    var q = new URLSearchParams(u.split('?')[1] || ''); var tok = q.get('id_token'), st = q.get('state');
    try { var cl = P.Browser && P.Browser.close && P.Browser.close(); if (cl && cl.catch) cl.catch(function () {}); } catch (e) {}
    if (pending) {
      if (!tok || st !== pending.state || payload(tok).nonce !== pending.nonce) return done('rej', new Error('Google sign-in failed. Try again.'));
      return done('res', tok);
    }
    var k = kept(); keep(null);
    if (!tok || !k || st !== k.s || payload(tok).nonce !== k.n) return;
    finishKept(tok);
  };
  var finishKept = function (tok) {
    var say = function (t) { try { if (window.ccTools && ccTools.toast) ccTools.toast(t); else if (typeof toast === 'function') toast(t); } catch (e) {} };
    var go = function (n) {
      if (window.ccGoogle && window.ccGoogle.signIn) {
        try { sessionStorage.setItem('cc_just', String(Date.now())); } catch (e) {}
        window.ccGoogle.signIn(tok, false).then(function () { say('Signed in with Google'); setTimeout(function () { location.reload(); }, 400); },
          function (e) { say(oops(e)); });
      } else if (n < 20) setTimeout(function () { go(n + 1); }, 300);
    };
    go(0);
  };
  // The app was closed by Android while the browser tab was open and the app link did not arrive: ask the server relay once when the app starts again.
  var resumeKept = function () {
    var k = kept(); if (!k || pending) return;
    fetch(CC_API + '/api/auth/relay?state=' + encodeURIComponent(k.s), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) {
      if (!d || !d.ready || !d.credential || pending || !kept()) return;
      if (payload(d.credential).nonce !== k.n) return;
      keep(null); finishKept(d.credential);
    });
  };
  window.addEventListener('load', function () { setTimeout(resumeKept, 1500); });
  if (P.App) {
    P.App.addListener('appUrlOpen', function (ev) { handleReturn(ev && ev.url); });
    if (P.App.getLaunchUrl) P.App.getLaunchUrl().then(function (r) { if (r && r.url) handleReturn(r.url); }, function () {});
  }
  // Backup way back. The callback page also hands the sign-in to our server (keyed by the secret "state" only this app knows). If Android blocked the
  // app link, closing the tab (or coming back to the app) picks the sign-in up from there. Same checks as the app link: state and nonce must match.
  var relayPoll = function (left) {
    var p = pending; if (!p) return;
    fetch(CC_API + '/api/auth/relay?state=' + encodeURIComponent(p.state), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) {
      if (pending !== p) return;
      if (d && d.ready && d.credential) {
        if (payload(d.credential).nonce !== p.nonce) return done('rej', new Error('Google sign-in failed. Try again.'));
        return done('res', d.credential);
      }
      if (left > 0) setTimeout(function () { relayPoll(left - 1); }, 1200);
      else done('rej', Object.assign(new Error('cancelled'), { cancelled: true }));                      // really closed before signing in
    });
  };
  if (P.Browser) P.Browser.addListener('browserFinished', function () {
    setTimeout(function () { if (pending) relayPoll(4); }, 1500);               // long enough for the app link to arrive first
  });
  if (P.App) P.App.addListener('appStateChange', function (st) {
    if (st && st.isActive && pending) setTimeout(function () { if (pending) relayPoll(4); }, 2500);
  });

  var G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
  var st = document.createElement('style');
  st.textContent = '.cc-gbtn{display:inline-flex;align-items:center;justify-content:center;gap:0;width:48px;height:48px;min-height:48px;padding:0;border-radius:50%;border:0;box-shadow:0 6px 18px rgba(16,20,34,.18);background:#fff;color:#101422;font:600 14px Poppins,system-ui,sans-serif}.cc-gbtn:disabled{opacity:.6}.cc-gbtn:active{transform:scale(.98)}';
  document.head.appendChild(st);

  window.ccApp.mountGoogle = function (box, onDone, onErr, opts, sign) {
    box.innerHTML = '';
    var bn = !!(opts && opts.banner), bz = bn && typeof opts.busy === 'function' ? opts.busy : null;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'cc-gbtn'; b.innerHTML = bn ? G + '<span class="gb-t">Continue with Google</span><i class="gb-sp"></i>' : G; b.setAttribute('aria-label', 'Continue with Google'); b.title = 'Continue with Google';
    b.onclick = function () {
      var ok = false; b.disabled = true; if (bz) bz(true);
      window.ccApp.googleLogin().then(function (tok) { return sign(tok, !!(opts && opts.link)); }).then(function (r) { ok = true; return onDone(r); }, function (e) { if (!(e && e.cancelled)) onErr(oops(e)); }).then(function () { if (!ok || !bn) { b.disabled = false; if (bz) bz(false); } });
    };
    box.appendChild(b);
    return true;
  };
})();
