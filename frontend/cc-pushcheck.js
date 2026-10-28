/* cc-pushcheck.js v1: "Check my alerts" and "Test in 10 seconds" buttons at the bottom of the Alerts sheet.
   Adds only. It uses the server's existing /api/push/status and /api/push/test and says which link is broken
   (app, sign-in, Firebase key on Render, phone address, switches). Text goes in with textContent only. */
(function () {
  'use strict';
  if (window.__ccPushCheck) return; window.__ccPushCheck = 1;
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
  function inApp() { try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); } catch (e) { return false; } }
  function call(path, body) {
    if (!window.ccCall) return Promise.reject(new Error('The app is still starting. Try again in a moment.'));
    return window.ccCall(path, body ? { body: body, auth: false } : { auth: false });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function line(box, ok, text) {
    var p = el('div'); p.style.cssText = 'display:flex;gap:8px;margin:7px 0;font:600 13px/1.45 Manrope,system-ui,sans-serif;color:var(--fg)';
    var g = el('b', '', ok === true ? '\u2713' : ok === false ? '\u2717' : '\u2022');
    g.style.cssText = 'flex:none;width:14px;color:' + (ok === true ? '#1a9d55' : ok === false ? '#d23b3b' : 'inherit');
    p.appendChild(g); p.appendChild(el('span', '', text)); box.appendChild(p);
  }
  /* walks the chain from the phone to Firebase; returns true when nothing is broken */
  function diagnose(out) {
    out.textContent = '';
    if (!signedIn()) { line(out, false, 'Sign in first, then check again.'); return Promise.resolve(false); }
    var good = true;
    if (inApp()) line(out, true, 'You are in the Android app.');
    else { good = false; line(out, false, 'You are on the website. Alerts only reach the Android app, so open the app and check there.'); }
    return call('/api/push/status?deep=1').then(function (d) {
      d = d || {};
      if (!d.fcm) { good = false; line(out, false, 'The server has no usable Firebase key. ' + (d.hint || '')); }
      else if (d.key_ok === false) { good = false; line(out, false, d.hint || 'Firebase refused the key on the server.'); }
      else line(out, true, 'The server can sign in to Firebase.');
      var ph = d.phones || [];
      if (!ph.length) { good = false; line(out, false, 'No phone is saved for this account yet. Open the Android app, sign in, and allow notifications.'); }
      else {
        line(out, true, ph.length + (ph.length === 1 ? ' phone is' : ' phones are') + ' saved for this account.');
        if (ph.some(function (x) { return x.app === 'old'; })) line(out, null, 'One saved phone runs an older version of the app. Update the app to get every kind of alert.');
      }
      var pr = d.prefs && typeof d.prefs === 'object' ? d.prefs : null;
      if (pr) { var v = Object.keys(pr).map(function (k) { return pr[k]; }); if (v.length && v.every(function (x) { return x === false; })) { good = false; line(out, false, 'Every alert is switched off in the list above.'); } }
      return good;
    });
  }
  function sendNow(out) {
    line(out, null, 'Sending a test alert...');
    return call('/api/push/test', {}).then(function (r) {
      r = r || {}; line(out, !!r.ok, r.message || (r.ok ? 'Sent.' : 'Not sent.'));
      if (r.ok) line(out, null, 'Look in the notification bar. If it never shows, open the phone\u2019s Settings > Apps > Comrade Connect > Notifications and allow them.');
    });
  }
  function sendLater(out) {
    out.textContent = '';
    if (!signedIn()) { line(out, false, 'Sign in first, then try again.'); return Promise.resolve(); }
    line(out, null, 'The test will arrive in 10 seconds. Press the phone\u2019s Home button now and watch the lock screen.');
    return call('/api/push/test', { delay: 10 }).then(function () { return wait(14000); })
      .then(function () { return call('/api/push/status'); })
      .then(function (s) { var t = s && s.last_test; if (t) line(out, !!t.ok, t.message || (t.ok ? 'Sent.' : 'Not sent.')); else line(out, null, 'No result yet. Tap it again.'); });
  }
  function run(btns, out, fn) {
    btns.forEach(function (b) { b.disabled = true; });
    Promise.resolve().then(fn).catch(function (e) { line(out, false, (e && e.message) || 'Something went wrong. Try again.'); })
      .then(function () { btns.forEach(function (b) { b.disabled = false; }); });
  }
  function build() {
    var bx = document.querySelector('.ccn.ccn-pf .bx');
    if (!bx || bx.querySelector('.pc-wrap')) return;
    var w = el('div', 'pc-wrap'); w.style.cssText = 'margin:16px 2px 4px;padding-top:14px;border-top:1px solid rgba(120,110,100,.25)';
    var h = el('b', '', 'Not getting alerts?'); h.style.cssText = 'display:block;font:800 15px/1.3 Manrope,system-ui,sans-serif;color:var(--fg)';
    var s = el('p', '', 'This checks every step from the app to Firebase and tells you which one is broken.'); s.style.cssText = 'margin:4px 0 10px;font:600 12.5px/1.45 Manrope,system-ui,sans-serif;color:var(--mut)';
    var b1 = el('button', 'btn g', 'Check my alerts'), b2 = el('button', 'btn g', 'Test in 10 seconds');
    b1.type = b2.type = 'button'; b1.style.cssText = 'width:100%'; b2.style.cssText = 'width:100%;margin-top:8px';
    var out = el('div', 'pc-out'); out.setAttribute('role', 'status'); out.style.marginTop = '8px';
    var both = [b1, b2];
    b1.onclick = function () { out.textContent = ''; run(both, out, function () { return diagnose(out).then(function (ok) { if (ok) return sendNow(out); }); }); };
    b2.onclick = function () { run(both, out, function () { return sendLater(out); }); };
    [h, s, b1, b2, out].forEach(function (n) { w.appendChild(n); });
    bx.appendChild(w);
  }
  new MutationObserver(build).observe(document.body, { childList: true, subtree: true });
  build();
})();
