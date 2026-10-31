/* cc-phonelink.js: "Link your WhatsApp number" screen. Shown ONLY when the admin switches phone_required on and the signed-in account has no linked number.
   The server never blocks old accounts; this screen is the gate. It fails soft: if the server cannot be reached, the app stays usable. */
(function () {
  'use strict';
  if (window.__ccPhoneLink) return; window.__ccPhoneLink = 1;
  var linked = false, busy = false, timer = null, left = 0, stage = 'number', polling = null, optional = false;
  var $ = function (id) { return document.getElementById(id); };
  var api = function () { return typeof CC_API === 'string' ? CC_API.replace(/\/$/, '') : ''; };
  var live = function () { return api() && api().indexOf('YOUR-SUBDOMAIN') < 0; };
  var signedIn = function () { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); };
  var IN = 'width:100%;margin:6px 0 12px;padding:14px;border-radius:14px;border:1px solid var(--gb,rgba(255,255,255,.28));background:transparent;color:inherit;font:inherit;font-size:18px;box-sizing:border-box';

  function call(path, body) {
    return fetch(api() + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); });
  }
  function say(t, good) { var e = $('ccplmsg'); if (!e) return; e.textContent = t || ''; e.style.color = good ? 'inherit' : '#ff6b6b'; }
  function setBusy(on) { busy = on; ['ccplsend', 'ccplgo', 'ccplagain'].forEach(function (id) { var b = $(id); if (b) b.disabled = on || (id === 'ccplagain' && left > 0); }); }

  // The 60-second resend timer. The server enforces it too; this just shows it.
  function tick() {
    var b = $('ccplagain'); if (!b) return;
    if (left > 0) { b.disabled = true; b.textContent = 'Send a new code in ' + left + 's'; left--; timer = setTimeout(tick, 1000); }
    else { b.disabled = busy; b.textContent = 'Send a new code'; }
  }
  function startTimer(s) { clearTimeout(timer); left = s || 60; tick(); }

  function view() {
    var h = '<div style="max-width:420px;margin:0 auto;padding:28px 22px 40px">'
      + '<h2 style="margin:0 0 8px;font-size:24px">Link your WhatsApp number</h2>'
      + '<p style="margin:0 0 18px;color:var(--mut,rgba(255,255,255,.7));line-height:1.55">To keep accounts real and safe, every account needs one WhatsApp number. We send a 6-digit code there to confirm it is yours. One number can back only one account. We use it for codes only. Offers are separate and only if you choose them.</p>';
    if (stage === 'number') {
      h += '<label for="ccplnum" style="font-weight:600">Your WhatsApp number</label>'
        + '<input id="ccplnum" type="tel" inputmode="tel" autocomplete="tel" placeholder="0712 345 678" maxlength="20" style="' + IN + '">'
        + '<button class="btn p" id="ccplsend" type="button" style="width:100%">Send code</button>';
    } else {
      h += '<label for="ccplcode" style="font-weight:600">Enter the 6-digit code from WhatsApp</label>'
        + '<input id="ccplcode" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" maxlength="6" style="' + IN + ';letter-spacing:8px;text-align:center">'
        + '<button class="btn p" id="ccplgo" type="button" style="width:100%">Confirm</button>'
        + '<button class="btn g" id="ccplagain" type="button" style="width:100%;margin-top:10px" disabled>Send a new code</button>'
        + '<button class="btn g" id="ccplchg" type="button" style="width:100%;margin-top:10px">Use a different number</button>';
    }
    h += '<p id="ccplmsg" role="alert" style="min-height:22px;margin:14px 0 0"></p>'
      + '<button type="button" id="' + (optional ? 'ccplx' : 'ccplout') + '" style="margin-top:18px;background:none;border:0;color:var(--mut,rgba(255,255,255,.7));text-decoration:underline;font:inherit;cursor:pointer">' + (optional ? 'Not now' : 'Sign out') + '</button></div>';
    return h;
  }

  function render() {
    var o = $('ccphonelink'); if (!o) return;
    o.innerHTML = view();
    var send = $('ccplsend'), go = $('ccplgo'), again = $('ccplagain'), chg = $('ccplchg');
    if (send) send.onclick = sendCode;
    if (again) again.onclick = sendCode;
    if (go) go.onclick = confirmCode;
    if (chg) chg.onclick = function () { stage = 'number'; clearTimeout(timer); render(); };
    if ($('ccplout')) $('ccplout').onclick = signOut;
    if ($('ccplx')) $('ccplx').onclick = close;
    var f = $('ccplnum') || $('ccplcode'); if (f) { f.onkeydown = function (e) { if (e.key === 'Enter') (send || go).click(); }; if (stage === 'code') f.oninput = function () { f.value = f.value.replace(/\D/g, '').slice(0, 6); }; }
    if (stage === 'code') tick();
  }

  var typed = '';
  function sendCode() {
    if (busy) return;
    var n = $('ccplnum'); if (n) typed = n.value.trim();
    if (!typed) return say('Enter your WhatsApp number.');
    setBusy(true); say('Sending the code on WhatsApp...', true);
    call('/api/me/phone/send', { phone: typed }).then(function (x) {
      setBusy(false);
      if (!x.ok) { say(x.d.error || 'Could not send the code.'); return; }
      stage = 'code'; render(); startTimer(x.d.resend_seconds);
      say('Code sent to the number ending ' + (x.d.last4 || '') + '. It works for ' + (x.d.expires_minutes || 10) + ' minutes.', true);
      var c = $('ccplcode'); if (c) c.focus();
    }).catch(function () { setBusy(false); say('Could not reach the server. Check your internet and try again.'); });
  }
  function confirmCode() {
    if (busy) return;
    var c = $('ccplcode'), code = c ? c.value.replace(/\D/g, '') : '';
    if (code.length !== 6) return say('The code has 6 digits.');
    setBusy(true); say('Checking...', true);
    call('/api/me/phone/verify', { code: code }).then(function (x) {
      setBusy(false);
      if (!x.ok) { say(x.d.error || 'Wrong code. Try again.'); if (x.status === 429 || x.status === 410 || x.status === 404) { var cc = $('ccplcode'); if (cc) cc.value = ''; } return; }
      done();
    }).catch(function () { setBusy(false); say('Could not reach the server. Check your internet and try again.'); });
  }
  function done() {
    linked = true; clearTimeout(timer); clearInterval(polling);
    var o = $('ccphonelink'); if (o) o.remove();
    document.documentElement.style.overflow = '';
    try { window.dispatchEvent(new CustomEvent('cc-phone-linked')); } catch (e) {}
    try { if (typeof toast === 'function') toast('WhatsApp number linked'); } catch (e) {}
  }
  // The same sign-out the app uses: tell the server, then clear this phone. An anonymous account needs its ID and recovery code to come back.
  function signOut() {
    var a = window.ccAuth && window.ccAuth();
    if (!window.confirm('Sign out? If this is an anonymous account, you can only get back in with your account ID and recovery code.')) return;
    var fin = function () {
      try { var aid = a && a.aid; Object.keys(localStorage).forEach(function (k) { if (k === 'cc_auth' || k === 'cc_pending' || k === 'cs_me' || k === 'cs_seen' || (aid && k.slice(-(aid.length + 1)) === ':' + aid)) localStorage.removeItem(k); }); } catch (e) {}
      location.reload();
    };
    Promise.race([fetch(api() + '/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), new Promise(function (r) { setTimeout(r, 3000); })]).then(fin, fin);
  }

  // Only the optional screen (opened from Offers and updates) can be closed. The required one cannot.
  function close() { clearTimeout(timer); var o = $('ccphonelink'); if (o) o.remove(); document.documentElement.style.overflow = ''; }
  function show(opt) {
    if ($('ccphonelink') || linked) return;
    optional = !!opt;
    var o = document.createElement('div'); o.id = 'ccphonelink';
    o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Link your WhatsApp number');
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483000;overflow:auto;background:var(--bg,#000);color:var(--fg,#fff);padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
    document.body.appendChild(o);
    document.documentElement.style.overflow = 'hidden';
    stage = 'number'; render();
  }

  // Ask the server two things: is the number required, and does this account already have one. Any failure = do nothing.
  function check() {
    if (linked || !live() || !signedIn() || $('ccphonelink')) return;
    call('/api/config').then(function (c) {
      if (!c.ok || !c.d.phone_required) return;
      return call('/api/me/phone').then(function (p) {
        if (!p.ok) return;
        if (p.d.linked) { linked = true; clearInterval(polling); return; }
        show();
      });
    }).catch(function () {});
  }
  window.ccPhoneLinkOpen = function () { show(true); };   // used by the WhatsApp tick box in Offers and updates
  function start() { check(); polling = setInterval(check, 30000); }   // 30s: also catches a sign-in that happens after the page loaded
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
})();
