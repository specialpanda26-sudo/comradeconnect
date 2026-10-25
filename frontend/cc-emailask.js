/* cc-emailask.js v1: asks anonymous accounts (random ID, or username + password with no email) to add a recovery email.
   Why: "Forgot password" works by emailed code, so an account with no email saved cannot be reset, and cannot be linked to a new phone easily.
   It is optional and never blocks anything. Skipping snoozes it (2 days, then 4, then 6) and after three skips it stays quiet.
   It can always be opened by hand with window.ccAskEmail().
   Uses the server routes that already exist: GET /api/me/recovery-email, POST /start, POST /confirm. Text is inserted with textContent only. */
(function () {
  'use strict';
  if (window.__ccEmailAsk) return; window.__ccEmailAsk = 1;
  var KEY = 'cc_emailask', open = false, tries = 0;
  var api = function () { try { return ((typeof CC_API === 'string' && CC_API) || '').replace(/\/$/, ''); } catch (e) { return ''; } };
  var auth = function () { try { var a = window.ccAuth ? window.ccAuth() : JSON.parse(localStorage.getItem('cc_auth') || 'null'); return a && a.token ? a : null; } catch (e) { return null; } };
  var say = function (t) { try { if (window.ccTools && ccTools.toast) ccTools.toast(t); else if (typeof toast === 'function') toast(t); } catch (e) {} };
  var st = function () { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  var save = function (o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  var el = function (t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  var okMail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()); };
  var googleLinked = function () { try { var me = JSON.parse(localStorage.getItem('cs_me') || '{}'); return !!(me && me.google); } catch (e) { return false; } };

  function call(path, body) {
    var a = auth(), h = { 'Content-Type': 'application/json' };
    if (a) { h['X-Aid'] = a.aid; h['X-Token'] = a.token; }
    return fetch(api() + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.'); return d; }); });
  }

  function busyBtn(b, on, label) { b.disabled = on; if (label) b.textContent = label; }

  function ask(force, cb) {
    if (open || document.getElementById('ccea')) return;
    open = true;
    var m = window.ccTools && ccTools.sheet ? ccTools.sheet('') : null;
    if (!m) { open = false; return; }
    m.id = 'ccea';
    var box = m.firstChild; box.textContent = '';
    var h3 = el('h3', '', 'Add an email so you never lose your account');
    var sub = el('p', 'sub', 'Optional. We use it only for "Forgot password" and to get you back in on a new phone. We keep a scrambled copy, never the email itself.'); sub.style.marginTop = '6px';
    var f = el('form'); f.style.display = 'contents'; f.noValidate = true; f.autocomplete = 'on'; f.addEventListener('submit', function (e) { e.preventDefault(); });
    var w1 = el('div', 'fld'); w1.style.marginTop = '10px';
    var em = el('input'); em.type = 'email'; em.name = 'email'; em.setAttribute('autocomplete', 'email'); em.setAttribute('inputmode', 'email'); em.setAttribute('autocapitalize', 'off'); em.placeholder = 'name@gmail.com'; em.setAttribute('aria-label', 'Your email'); w1.appendChild(em);
    var w2 = el('div', 'fld'); w2.hidden = true;
    var cd = el('input'); cd.name = 'code'; cd.setAttribute('inputmode', 'numeric'); cd.setAttribute('autocomplete', 'one-time-code'); cd.maxLength = 6; cd.placeholder = '6-digit code'; cd.setAttribute('aria-label', '6-digit code'); w2.appendChild(cd);
    f.appendChild(w1); f.appendChild(w2);
    var msg = el('p', 'sub'); msg.style.cssText = 'min-height:18px;margin-top:8px'; msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite');
    var go = el('button', 'btn p', 'Send code'); go.type = 'button'; go.style.cssText = 'width:100%;margin-top:6px';
    var alt = el('button', 'btn g', 'Not now'); alt.type = 'button'; alt.style.cssText = 'width:100%;margin-top:6px';
    var have = el('button', 'btn g', 'I have a code'); have.type = 'button'; have.id = 'ccea-have'; have.style.cssText = 'width:100%;margin-top:6px';
    [h3, sub, f, msg, go, have, alt].forEach(function (n) { box.appendChild(n); });

    var step = 1, say2 = function (t, bad) { msg.textContent = t || ''; msg.style.color = bad ? 'var(--bad,#fff)' : ''; };
    function close() { open = false; m.close(); if (cb) cb(); }
    function snooze() { var s = st(); s.n = (s.n || 0) + 1; s.until = Date.now() + s.n * 2 * 864e5; save(s); close(); }
    function toStep(n) {
      step = n; w1.hidden = n === 2; w2.hidden = n !== 2; have.hidden = n === 2;
      go.textContent = n === 2 ? 'Confirm' : 'Send code'; alt.textContent = n === 2 ? 'Use a different email' : 'Not now';
      say2(''); try { (n === 2 ? cd : em).focus(); } catch (e) {}
    }
    have.onclick = function () { sub.textContent = 'Type the 6-digit code from your email. You do not need a new one. If it was already used or has expired, we will tell you.'; toStep(2); };
    alt.onclick = function () { if (step === 2) toStep(1); else if (force) close(); else snooze(); };
    m.addEventListener('click', function (e) { if (e.target === m) { if (force) close(); else snooze(); } });
    go.onclick = function () {
      say2('');
      if (step === 1) {
        if (!okMail(em.value)) return say2('Enter a real email address, for example name@gmail.com', true);
        busyBtn(go, true, 'Sending...');
        call('/api/me/recovery-email/start', { email: em.value.trim() }).then(function (d) {
          sub.textContent = 'We sent a 6-digit code to ' + d.sent_to + '. It works for ' + d.expires_minutes + ' minutes. Check spam too.';
          toStep(2);
        }, function (e) { say2(e.message, true); }).then(function () { busyBtn(go, false, step === 2 ? 'Confirm' : 'Send code'); });
      } else {
        if (String(cd.value).replace(/\D/g, '').length !== 6) return say2('The code has 6 digits.', true);
        busyBtn(go, true, 'Checking...');
        call('/api/me/recovery-email/confirm', { code: cd.value }).then(function () {
          var s = st(); s.done = 1; save(s); close(); say('Email saved. You can now reset your password by email.');
        }, function (e) { say2(e.message, true); busyBtn(go, false, 'Confirm'); });
      }
    };
    em.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
    cd.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
    setTimeout(function () { try { em.focus({ preventScroll: true }); } catch (e) {} }, 80);
  }

  // Is something else on screen (first screen, lock screen, the recovery code sheet, the account setup page)? Then wait.
  function busy() {
    var lk = document.getElementById('lk');
    return !!(document.getElementById('ccfrst') || document.getElementById('ccsu') || document.getElementById('ccfp') || document.getElementById('ccfgt') || document.getElementById('ccrst') || document.getElementById('ccea') ||
      document.getElementById('ccaid') || document.getElementById('ccwl-go') || (lk && lk.classList.contains('on')));
  }
  function check() {
    var s = st();
    if (open || s.done || (s.n || 0) >= 3 || (s.until && Date.now() < s.until)) return false;
    return true;
  }
  var timer = setInterval(function () {
    if (!check() || ++tries > 600) { clearInterval(timer); return; }
    if (!auth() || busy() || !api() || navigator.onLine === false) return;
    clearInterval(timer);
    setTimeout(function () {
      if (busy() || !check()) return;
      call('/api/me/recovery-email').then(function (d) {
        if (d.has_email) { var s = st(); s.done = 1; save(s); return; }
        if (!d.available || googleLinked()) return;
        ask(false);
      }).catch(function () {});
    }, 2500);
  }, 2000);

  window.ccAskEmailSignup = function () {
    return new Promise(function (done) {
      if (!auth()) return done();
      call("/api/me/recovery-email").then(function (d) { if (d.has_email || !d.available || googleLinked()) return done(); ask(false, done); }).catch(function () { done(); });
    });
  };
  window.ccAskEmailSignup = function () {
    return new Promise(function (done) {
      if (!auth()) return done();
      call("/api/me/recovery-email").then(function (d) { if (d.has_email || !d.available || googleLinked()) return done(); ask(false, done); }).catch(function () { done(); });
    });
  };
  window.ccAskEmail = function () {                    // always works, even after "Not now" three times
    if (!auth()) return say('Sign in first.');
    call('/api/me/recovery-email').then(function (d) {
      if (d.has_email) return say('You already have a recovery email saved.');
      if (!d.available) return say('Email is not switched on yet. Try again later.');
      ask(true);
    }).catch(function (e) { say(e.message); });
  };
})();
