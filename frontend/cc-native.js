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
  var pending = null;

  var rand = function () { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); };
  var payload = function (t) { try { return JSON.parse(decodeURIComponent(escape(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return {}; } };
  var done = function (fn, v) { var p = pending; pending = null; if (p) { clearTimeout(p.t); p[fn](v); } };

  // Real phone lock: fingerprint, face unlock or the phone's own PIN / pattern / password (no web page, no fake scan).
  var bioRecent = 0, bioBusy = false;
  var BIO = function () { return P.BiometricAuth || (cap.registerPlugin ? cap.registerPlugin('BiometricAuth') : null); };
  window.ccNativeBio = {
    available: function () {
      var B = BIO(); if (!B || !B.checkBiometry) return Promise.resolve(false);
      return B.checkBiometry().then(function (r) { return !!(r && (r.isAvailable || r.deviceIsSecure)); }, function () { return false; });
    },
    verify: function (why) {
      if (Date.now() - bioRecent < 5000) return Promise.resolve(true);      // one prompt per action, not two
      var B = BIO(); if (!B || !B.authenticate) return Promise.resolve(false);
      bioBusy = true;
      return B.authenticate({
        reason: why || 'Confirm it is really you', cancelTitle: 'Cancel', allowDeviceCredential: true,
        androidTitle: 'Comrade Connect', androidSubtitle: why || 'Use your fingerprint, face or phone password', androidConfirmationRequired: false
      }).then(function () { bioRecent = Date.now(); return true; }, function () { return false; })
        .then(function (ok) { setTimeout(function () { bioBusy = false; }, 1500); return ok; });
    }
  };
  // when the lock screen appears (app start, or coming back after a minute), ask the phone straight away
  var autoAsk = function () {
    var lk = document.getElementById('lk'), b = document.getElementById('lku');
    if (!bioBusy && lk && b && lk.classList.contains('on')) b.click();
  };
  window.addEventListener('load', function () { setTimeout(autoAsk, 900); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(autoAsk, 500); });

  // New version of the app? Show a bar with an Update button (the website itself cannot change the installed app).
  var REPO = 'specialpanda26-sudo/comradeconnect';
  var checkUpdate = function () {
    if (!P.App || !P.App.getInfo || navigator.onLine === false) return;
    P.App.getInfo().then(function (i) {
      var cur = parseInt(String((i && i.version) || '').split('.').pop(), 10) || 0;
      return fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (rel) {
        if (!rel) return;
        var n = parseInt(String(rel.tag_name || '').replace(/\D/g, ''), 10) || 0;
        var a = (rel.assets || []).filter(function (x) { return /\.apk$/i.test(x.name); })[0];
        var seen = 0; try { seen = +localStorage.getItem('cc_upd_seen') || 0; } catch (e) {}
        if (!a || n <= cur || n <= seen) return;
        var bar = document.createElement('div');
        bar.style.cssText = 'position:fixed;left:10px;right:10px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9000;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:18px;background:var(--bg,#000);color:var(--fg,#fff);border:1px solid var(--line,rgba(255,255,255,.2));font:500 13px Poppins,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5)';
        bar.innerHTML = '<span style="flex:1">A new version of Comrade Connect is ready.</span><button type="button" data-u style="border:0;border-radius:999px;padding:9px 16px;background:var(--fg,#fff);color:var(--bg,#000);font:600 13px Poppins,system-ui,sans-serif">Update</button><button type="button" data-x aria-label="Close" style="border:0;background:none;color:inherit;font-size:20px;padding:0 4px">&times;</button>';
        bar.querySelector('[data-u]').onclick = function () { try { P.Browser.open({ url: a.browser_download_url }); } catch (e) { location.href = a.browser_download_url; } };
        bar.querySelector('[data-x]').onclick = function () { try { localStorage.setItem('cc_upd_seen', String(n)); } catch (e) {} bar.remove(); };
        document.body.appendChild(bar);
      });
    }).catch(function () {});
  };
  window.addEventListener('load', function () { setTimeout(checkUpdate, 4000); });

  // In-app Google account picker: no web page and no redirect. Needs the Android client set up in Google Cloud (see README).
  var nativeGoogle = function () {
    if (navigator.onLine === false) return Promise.reject(new Error('You are offline. Connect to data or Wi-Fi to sign in with Google.'));
    var G = P.GoogleAuth;
    return Promise.resolve()
      .then(function () { return G.signOut ? G.signOut().catch(function () {}) : null; })      // so the account list shows every time
      .then(function () { return G.signIn(); })
      .then(function (u) {
        var t = u && u.authentication && u.authentication.idToken;
        if (!t) throw new Error('Google sign-in failed. Try again.');
        return t;
      }, function (e) {
        var m = String((e && (e.message || e.error || e.code)) || e || '');
        if (/cancel|12501|12502|popup_closed|dismiss/i.test(m)) throw Object.assign(new Error('cancelled'), { cancelled: true });
        if (/DEVELOPER_ERROR|10/.test(m)) throw new Error('Google sign-in is not set up for this app build yet. Add the Android client and SHA-1 in Google Cloud.');
        throw new Error('Google sign-in failed. Try again.');
      });
  };

  window.ccApp.googleLogin = function () {
    if (P.GoogleAuth) return nativeGoogle();                                                  // older app builds without the plugin use the browser tab below
    return new Promise(function (res, rej) {
      if (navigator.onLine === false) return rej(new Error('You are offline. Connect to data or Wi-Fi to sign in with Google.'));
      if (!P.Browser) return rej(new Error('Sign-in is not ready in this app version. Please update the app.'));
      var nonce = rand(), state = rand();
      pending = { res: res, rej: rej, nonce: nonce, state: state, t: setTimeout(function () { done('rej', Object.assign(new Error('Sign-in took too long. Try again.'), {})); }, 180000) };
      var url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(CC_GOOGLE_ID)
        + '&redirect_uri=' + encodeURIComponent(CALLBACK) + '&response_type=id_token&scope=' + encodeURIComponent('openid profile')
        + '&nonce=' + nonce + '&state=' + state + '&prompt=select_account';
      P.Browser.open({ url: url, presentationStyle: 'popover' }).catch(function () { done('rej', new Error('Could not open Google. Try again.')); });
    });
  };

  if (P.App) P.App.addListener('appUrlOpen', function (ev) {
    var u = String((ev && ev.url) || ''); if (u.indexOf(SCHEME + '://') !== 0 || !pending) return;
    var q = new URLSearchParams(u.split('?')[1] || '' ); var tok = q.get('id_token'), st = q.get('state');
    try { P.Browser && P.Browser.close(); } catch (e) {}
    if (!tok || st !== pending.state || payload(tok).nonce !== pending.nonce) return done('rej', new Error('Google sign-in failed. Try again.'));
    done('res', tok);
  });
  if (P.Browser) P.Browser.addListener('browserFinished', function () {
    setTimeout(function () { if (pending) done('rej', Object.assign(new Error('cancelled'), { cancelled: true })); }, 2500);   // the tab was closed before signing in (long enough for the app link to arrive first)
  });

  var G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
  var st = document.createElement('style');
  st.textContent = '.cc-gbtn{display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;max-width:300px;min-height:44px;padding:0 18px;border-radius:999px;border:1px solid #dadce0;background:#fff;color:#1f1f1f;font:600 14px Poppins,system-ui,sans-serif}.cc-gbtn:disabled{opacity:.6}.cc-gbtn:active{transform:scale(.98)}';
  document.head.appendChild(st);

  window.ccApp.mountGoogle = function (box, onDone, onErr, opts, sign) {
    box.innerHTML = '';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'cc-gbtn'; b.innerHTML = G + '<span>Continue with Google</span>';
    b.onclick = function () {
      b.disabled = true;
      window.ccApp.googleLogin().then(function (tok) { return sign(tok); }).then(onDone, function (e) { if (!(e && e.cancelled)) onErr((e && e.message) || 'Google sign-in failed. Try again.'); }).then(function () { b.disabled = false; });
    };
    box.appendChild(b);
    return true;
  };
})();
