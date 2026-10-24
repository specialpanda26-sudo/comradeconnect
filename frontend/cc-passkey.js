/* cc-passkey.js: passkeys (Section 1). Sign in with the phone's fingerprint, face or screen lock: no password to remember.
   - Me > "Passkeys": add, see and remove passkeys.
   - "Sign in with a passkey" button on the restore / sign-in screens.
   Works in the website (https://comradeconnect.co.ke). Android's in-app web view cannot make passkeys for a website yet,
   so inside the app the section explains that and points to the website; the app keeps its own fingerprint lock. */
(function () {
  'use strict';
  if (window.__ccPasskey) return; window.__ccPasskey = 1;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var api = function () { return (typeof CC_API === 'string' ? CC_API : ''); };
  var say = function (t) { try { if (typeof toast === 'function') toast(t); } catch (e) {} };
  var inApp = function () { return !!(window.ccApp && window.ccApp.native); };
  var supported = function () { return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create) && !inApp(); };

  var toBuf = function (s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }).buffer; };
  var toB64u = function (b) { return btoa(String.fromCharCode.apply(null, new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

  async function call(path, body, method) {
    var r;
    try { r = await fetch(api() + path, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) }); }
    catch (e) { throw new Error('Could not reach the server. Check your internet and try again.'); }
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error((window.ccErr ? ccErr(r.status, d.error) : d.error) || 'Something went wrong');
    return d;
  }
  var friendly = function (e) {
    var n = e && e.name;
    if (n === 'NotAllowedError' || n === 'AbortError') return 'Cancelled';
    if (n === 'InvalidStateError') return 'This device already has a passkey for your account';
    if (n === 'SecurityError') return 'Passkeys only work on the Comrade Connect website';
    return (e && e.message) || 'Passkey failed. Try again.';
  };

  // ---- add one ----
  async function register(name) {
    var o = (await call('/api/passkey/register/options', {})).publicKey;
    o.challenge = toBuf(o.challenge); o.user.id = toBuf(o.user.id);
    o.excludeCredentials = (o.excludeCredentials || []).map(function (x) { return { type: x.type, id: toBuf(x.id) }; });
    var c = await navigator.credentials.create({ publicKey: o });
    var r = c.response;
    return call('/api/passkey/register/verify', { id: c.id, name: name || '', response: { clientDataJSON: toB64u(r.clientDataJSON), attestationObject: toB64u(r.attestationObject) } });
  }
  // ---- sign in with one ----
  async function login() {
    var o = (await call('/api/passkey/login/options', {})).publicKey;
    o.challenge = toBuf(o.challenge);
    var c = await navigator.credentials.get({ publicKey: o });
    var r = c.response;
    var d = await call('/api/passkey/login/verify', { id: c.id, response: { clientDataJSON: toB64u(r.clientDataJSON), authenticatorData: toB64u(r.authenticatorData), signature: toB64u(r.signature), userHandle: r.userHandle ? toB64u(r.userHandle) : '' } });
    try { if (typeof saveAuth === 'function') saveAuth({ aid: d.aid, token: d.token }); else localStorage.setItem('cc_auth', JSON.stringify({ aid: d.aid, token: d.token })); } catch (e) {}
    try { ME.aid = d.aid; saveMe(); } catch (e) {}
    return d;
  }
  async function signIn(btn, fail) {
    if (btn) btn.disabled = true;
    try { await login(); say('Signed in'); setTimeout(function () { location.reload(); }, 400); }
    catch (e) { var m = friendly(e); if (m !== 'Cancelled') { if (fail) fail(m); else say(m); } if (btn) btn.disabled = false; }
  }

  // ---- the "Passkeys" box in Me ----
  var KEY = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M17 6l3 3M14 9l2 2"/></svg>';
  async function drawBox(box) {
    var list = $('#ccpk-l', box), st = $('#ccpk-s', box), add = $('#ccpk-a', box);
    if (inApp()) { st.textContent = 'Passkeys are made on the Comrade Connect website (comradeconnect.co.ke). Open it in your phone browser, sign in, and add a passkey under Me. This app keeps its own fingerprint lock above.'; add.hidden = true; list.innerHTML = ''; return; }
    if (!supported()) { st.textContent = 'This browser does not support passkeys. Try Chrome, Safari or Edge on a phone with a screen lock.'; add.hidden = true; return; }
    var a = window.ccAuth && ccAuth(); if (!a || !a.token) { st.textContent = 'Create or sign in to an account first.'; add.hidden = true; return; }
    st.textContent = 'Sign in with your fingerprint, face or screen lock. No password to remember.'; add.hidden = false;
    try {
      var d = await call('/api/passkey/list', null, 'GET');
      list.innerHTML = (d.passkeys || []).map(function (p) {
        return '<div class="rw"><span>' + esc(p.name) + '<small>Added ' + esc(String(p.created_at || '').slice(0, 10)) + (p.last_used_at ? ' · used ' + esc(String(p.last_used_at).slice(0, 10)) : '') + '</small></span><button class="act" data-id="' + esc(p.id) + '">Remove</button></div>';
      }).join('');
    } catch (e) { list.innerHTML = ''; }
  }
  function mountBox() {
    if ($('#ccpk')) return;
    var anchor = $('#sgo'); anchor = anchor && anchor.closest('.box'); if (!anchor) return;
    var box = document.createElement('div'); box.className = 'box g'; box.id = 'ccpk';
    box.innerHTML = '<h3>Passkeys</h3><p class="sub" id="ccpk-s"></p><div id="ccpk-l"></div><button class="btn g" id="ccpk-a" style="width:100%;margin-top:12px">' + KEY + 'Add a passkey</button>';
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
    $('#ccpk-a', box).onclick = async function (e) {
      var b = e.currentTarget; b.disabled = true;
      try { await register(''); say('Passkey added'); } catch (x) { var m = friendly(x); if (m !== 'Cancelled') say(m); }
      b.disabled = false; drawBox(box);
    };
    box.addEventListener('click', async function (e) {
      var rm = e.target.closest('button[data-id]'); if (!rm) return;
      rm.disabled = true;
      try { await call('/api/passkey/delete', { id: rm.getAttribute('data-id') }); say('Passkey removed'); } catch (x) { say(friendly(x)); }
      drawBox(box);
    });
    drawBox(box);
    var tb = $('#tb'); if (tb) tb.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && b.dataset.v === 'me') drawBox(box); });
  }

  // ---- "Sign in with a passkey" button on the restore screens ----
  function addSignIn(host, before, fail, cls, css) {
    if (!supported() || host.querySelector('.ccpk-in')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = (cls || 'btn g') + ' ccpk-in'; b.style.cssText = css || 'width:100%;margin-top:10px';
    b.innerHTML = KEY + 'Sign in with a passkey';
    b.onclick = function () { signIn(b, fail); };
    if (before && before.parentNode) before.parentNode.insertBefore(b, before); else host.appendChild(b);
  }
  function scan() {
    mountBox();
    var rrs = $('#rrs'); if (rrs) addSignIn(rrs.parentNode, rrs, null);
    var fr = $('#ccfrst-form'); if (fr) addSignIn(fr, null, function (m) { var e = $('#ccfrst-e'); if (e) { e.textContent = m; e.hidden = !m; } }, 'ccfrst-btn', 'margin-top:10px;background:transparent!important;border:1px solid rgba(255,255,255,.35)!important;color:inherit');
    var pr = $('#ccp-r'); if (pr) { var pf = $('#ccp-f'); if (pf) addSignIn(pf, null, function (m) { var e = $('#ccp-e'); if (e) e.textContent = m; }); }
    var sh = $('#ccrst'); if (sh) { var go = $('#ccrst-go', sh); if (go) addSignIn(go.parentNode.parentNode, go.parentNode, function (m) { var e = $('#ccrst-e', sh); if (e) e.textContent = m; }); }
  }
  new MutationObserver(function () { scan(); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
  window.ccPasskey = { supported: supported, register: register, login: login };
})();
