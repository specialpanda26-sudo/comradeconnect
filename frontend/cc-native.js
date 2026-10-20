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

  window.ccApp.googleLogin = function () {
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
