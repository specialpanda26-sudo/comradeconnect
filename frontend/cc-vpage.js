/* cc-vpage.js v1: the standalone Recovery email page and Student verification page use the SAME full-page flow as Forgot password
   (#ccfgt): same top bar, step bar, envelope and lock pictures, code boxes, dots and tick (cc-pages.css, cc-verify.css, cc-verify.js, cc-otp.js do the styling and animation).
   Set window.CC_VPAGE to 'recovery' or 'student' before loading. All text is inserted with textContent. */
(function () {
  'use strict';
  var CFG = {
    recovery: {
      label: 'Recovery email', head: 'Add a recovery email', changeHead: 'Change recovery email', placeholder: 'name@gmail.com', inLabel: 'Your email',
      status: '/api/me/recovery-email', start: '/api/me/recovery-email/start', confirm: '/api/me/recovery-email/confirm', remove: '/api/me/recovery-email/remove',
      has: function (d) { return !!d.has_email; },
      sub1: function () { return 'Optional. We use it only for "Forgot password" and to get you back in on a new phone. We keep a scrambled copy, never the email itself.'; },
      doneSub: function () { return 'Saved. You can reset your password by email if you forget it.'; },
      okSub: 'You can now reset your password by email if you forget it.', okHead: 'Email saved', goDone: 'Change email', removeLabel: 'Remove my recovery email', removeAsk: 'Remove your recovery email?', removed: 'Recovery email removed.', offText: 'Email is not switched on yet. Try again later.', needText: 'Open Comrade Connect first and sign in, then come back to this page on the same phone.'
    },
    student: {
      label: 'Student badge', head: 'Verify as a student', changeHead: 'Verify as a student', placeholder: 'admission.number@kyu.ac.ke', inLabel: 'Your university email',
      status: '/api/verify/email/status', start: '/api/verify/email/start', confirm: '/api/verify/email/confirm', remove: '/api/verify/email/unlink',
      has: function (d) { return !!d.student_verified; },
      sub1: function (d) { var x = (d.domains || []).map(function (z) { return '@' + z; }).join(' or '); return 'Optional. Your feed stays anonymous. The badge shows only next to your name on Market listings.' + (x ? ' Your email must end in ' + x + '.' : ''); },
      doneSub: function (d) { return 'You are a verified student' + (d.since ? ', since ' + new Date(d.since).toLocaleDateString('en-KE') : '') + '.'; },
      okSub: 'Your verified student badge now shows next to your name on Market listings.', okHead: 'You are verified', goDone: 'Done', removeLabel: 'Remove my student badge', removeAsk: 'Remove your student badge?', removed: 'Badge removed.', offText: 'Student email verification is not switched on yet. Try again later.', needText: 'Open Comrade Connect first so your account exists, then come back to this page on the same phone.'
    }
  }[window.CC_VPAGE];
  if (!CFG || document.getElementById('ccfgt')) return;
  ['need', 'off', 'done', 's1', 's2'].forEach(function (i) { var o = document.getElementById(i); if (o && o.parentNode) o.parentNode.removeChild(o); });   /* the old plain steps are replaced by the page below */

  var API = (typeof CC_API !== 'undefined' ? CC_API : '').replace(/\/$/, '');
  var auth = function () { try { var a = JSON.parse(localStorage.getItem('cc_auth') || 'null'); return a && a.token ? a : null; } catch (e) { return null; } };
  var okMail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()); };
  function call(path, body) {
    var a = auth(), h = { 'Content-Type': 'application/json' };
    if (a) { h['X-Aid'] = a.aid; h['X-Token'] = a.token; }
    return fetch(API + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.'); return d; }); });
  }
  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var XICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var pg = document.createElement('div');
  pg.id = 'ccfgt'; pg.className = 'ccrem'; pg.setAttribute('role', 'dialog'); pg.setAttribute('aria-modal', 'true'); pg.setAttribute('aria-label', CFG.label);
  pg.innerHTML = '<div class="fp-top"><button type="button" class="fp-ic" id="ccfg-bk" aria-label="Back">' + ARROW + '</button>'
    + '<div class="fp-brand"><img src="cc-mark.png" alt=""><span>Comrade Connect</span></div>'
    + '<button type="button" class="fp-ic" id="ccfg-x" aria-label="Close">' + XICON + '</button></div>'
    + '<div class="fp-body"><div class="fp-bar" id="ccfg-bar"><i class="on"></i><i></i><i></i></div><p class="fp-step" id="ccfg-st"></p><h1 id="ccfg-h"></h1><p class="fp-sub" id="ccfg-in"></p>'
    + '<div class="fp-f" id="ccfg-f1"><label for="ccfg-m"></label><input id="ccfg-m" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off"></div>'
    + '<div id="ccfg-2" hidden><form id="ccfg-fm" style="display:contents" novalidate><div id="ccfg-cb"><div class="fp-f"><label for="ccfg-c">6-digit code</label>'
    + '<input id="ccfg-c" name="code" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code" aria-label="6-digit code"></div></div></form></div>'
    + '<p class="fp-msg" id="ccfg-e" role="status" aria-live="polite"></p>'
    + '<button type="button" class="fp-go" id="ccfg-go"></button>'
    + '<button type="button" class="fp-link" id="ccfg-have" hidden>Send me a new code</button>'
    + '<button type="button" class="fp-link" id="ccfg-si"></button></div>';
  document.body.appendChild(pg);
  var $ = function (i) { return pg.querySelector('#' + i); };
  var em = $('ccfg-m'), cd = $('ccfg-c'), go = $('ccfg-go'), have = $('ccfg-have'), si = $('ccfg-si');
  em.placeholder = CFG.placeholder; em.setAttribute('aria-label', CFG.inLabel); pg.querySelector('label[for="ccfg-m"]').textContent = CFG.inLabel;

  var step = 1, st = {}, sentTo = '', cool = 0, ct = 0, info = false;   /* step 0 = already done, 1 = email, 2 = code, 3 = just finished; info = message-only screen */
  var leave = function () { location.href = '/'; };
  function setMsg(t, bad) { var e = $('ccfg-e'); e.textContent = t || ''; e.classList.toggle('bad', !!(bad && t)); }
  function bar(n) { [].forEach.call(pg.querySelectorAll('#ccfg-bar i'), function (x, k) { x.classList.toggle('on', k < n); }); }
  function tick() {
    if (step !== 2) return;
    if (cool > 0) { have.disabled = true; have.textContent = 'Send me a new code (' + cool + 's)'; } else { have.disabled = false; have.textContent = 'Send me a new code'; clearInterval(ct); }
  }
  function startCool() { cool = 30; clearInterval(ct); ct = setInterval(function () { cool--; tick(); }, 1000); tick(); }
  function paint() {
    var s = $('ccfg-st'), h = $('ccfg-h'), sub = $('ccfg-in');
    pg.classList.toggle('mg', step === 0 || info); pg.classList.toggle('ccv-ok', step === 3);
    $('ccfg-f1').hidden = info || step !== 1; $('ccfg-2').hidden = info || step !== 2; have.hidden = info || step !== 2; si.hidden = false;
    bar(info || step === 0 ? 0 : step);
    if (info) return;
    if (step === 0) { s.textContent = CFG.label; h.textContent = CFG.head; sub.textContent = CFG.doneSub(st); go.textContent = CFG.goDone; si.textContent = CFG.removeLabel; }
    else if (step === 1) { s.textContent = 'Step 1 of 3'; h.textContent = CFG.has(st) ? CFG.changeHead : CFG.head; sub.textContent = CFG.sub1(st); go.textContent = 'Send code'; si.textContent = 'Not now'; }
    else if (step === 2) { s.textContent = 'Step 2 of 3'; h.textContent = 'Check your email'; sub.textContent = (sentTo ? 'We sent a 6-digit code to ' + sentTo + '. ' : 'Type the 6-digit code from your email. ') + 'It works for 15 minutes. It can take a minute, so check your spam folder too.'; go.textContent = 'Verify code'; si.textContent = 'Not now'; tick(); }
    else { s.textContent = 'Step 3 of 3'; h.textContent = CFG.okHead; sub.textContent = CFG.okSub; go.textContent = 'Done'; si.hidden = true; }
    setMsg('');
  }
  function message(head, text, btn, fn) {   /* sign in needed / not switched on */
    info = true; paint(); $('ccfg-st').textContent = CFG.label; $('ccfg-h').textContent = head; $('ccfg-in').textContent = text; go.textContent = btn; go.onclick = fn; si.hidden = true; setMsg('');
  }
  function focusField() { setTimeout(function () { try { if (step === 1) em.focus({ preventScroll: true }); else if (step === 2) { var b = pg.querySelector('.cco-b'); (b || cd).focus(); } } catch (e) {} }, 80); }
  function load() {
    if (!API) return message('Not set up', 'The app is not set up here yet.', 'Open the app', leave);
    if (!auth()) return message('Sign in first', CFG.needText, 'Open the app', leave);
    call(CFG.status).then(function (d) {
      st = d; info = false;
      if (CFG.has(d)) { step = 0; paint(); return; }
      if (!d.available) return message('Not available yet', CFG.offText, 'Back to the app', leave);
      step = d.code_pending ? 2 : 1; paint(); if (d.code_pending) startCool();
      if (d.code_used && step === 1) setMsg('Your last code was already used. Ask for a new one if you need it.');
      focusField();
    }).catch(function (e) { message('Something went wrong', e.message, 'Try again', function () { location.reload(); }); });
  }
  $('ccfg-x').onclick = leave;
  $('ccfg-bk').onclick = function () { if (!info && step === 2) { clearInterval(ct); step = 1; paint(); focusField(); } else leave(); };
  si.onclick = function () {
    if (step !== 0) return leave();
    if (!confirm(CFG.removeAsk)) return;
    call(CFG.remove, {}).then(function () { st = {}; load(); say2(CFG.removed); }, function (e) { setMsg(e.message, true); });
  };
  function say2(t) { setTimeout(function () { setMsg(t); }, 1000); }
  have.onclick = function () {
    if (cool > 0) return; setMsg('');
    call(CFG.start, { email: em.value.trim() }).then(function (d) { sentTo = d.sent_to || sentTo; setMsg(d.message || 'A new code is on its way.'); startCool(); }, function (e) { setMsg(e.message, true); });
  };
  go.onclick = function () {
    setMsg('');
    if (step === 3) return leave();
    if (step === 0) { if (CFG.goDone === 'Done') return leave(); step = 1; paint(); focusField(); return; }
    if (step === 1) {
      if (!okMail(em.value)) return setMsg('Enter a real email address, for example ' + CFG.placeholder, true);
      go.disabled = true; go.textContent = 'Sending code...';
      call(CFG.start, { email: em.value.trim() }).then(function (d) { sentTo = d.sent_to || em.value.trim(); step = 2; paint(); startCool(); focusField(); },
        function (e) { setMsg(e.message, true); go.textContent = 'Send code'; }).then(function () { go.disabled = false; });
    } else {
      var c = String(cd.value).replace(/\D/g, '');
      if (c.length !== 6) return setMsg('The code has 6 digits.', true);
      go.disabled = true; go.textContent = 'Checking code...';
      call(CFG.confirm, { code: c }).then(function () { step = 3; clearInterval(ct); paint(); },
        function (e) { setMsg(e.message, true); go.textContent = 'Verify code'; }).then(function () { go.disabled = false; });
    }
  };
  em.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
  cd.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') leave(); });
  paint(); load();
})();
