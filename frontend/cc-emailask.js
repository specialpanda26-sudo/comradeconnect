/* cc-emailask.js v2: the ONE recovery-email panel.
   Opens from three places only: right after a new account is made (username or Google), Settings > Recovery email, and window.ccAskEmail().
   Always optional: "Skip, add it later" closes it and points to Settings. No timers, no nagging, never two panels at once.
   Same server routes as before: GET /api/me/recovery-email, POST /start, POST /confirm. All text is set with textContent.
   The 6-digit field is a normal one-time-code input, so cc-otp.js turns it into the code boxes automatically. */
(function () {
  'use strict';
  if (window.__ccEmailAsk) return; window.__ccEmailAsk = 1;
  var NEW = 'cc_ask_email_new', busyNow = false, tries = 0;
  var api = function () { try { return ((typeof CC_API === 'string' && CC_API) || '').replace(/\/$/, ''); } catch (e) { return ''; } };
  var auth = function () { try { var a = window.ccAuth ? window.ccAuth() : JSON.parse(localStorage.getItem('cc_auth') || 'null'); return a && a.token ? a : null; } catch (e) { return null; } };
  var say = function (t) { try { if (window.ccTools && ccTools.toast) ccTools.toast(t); else if (typeof toast === 'function') toast(t); } catch (e) {} };
  var el = function (t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  var okMail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()); };
  var MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="4"/><path d="M3.5 7.5 12 13l8.500-5.500"/></svg>';
  var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.500 4.500 4.500L19 7.500"/></svg>';

  function call(path, body) {
    var a = auth(), h = { 'Content-Type': 'application/json' };
    if (a) { h['X-Aid'] = a.aid; h['X-Token'] = a.token; }
    return fetch(api() + path, { method: body === undefined ? 'GET' : 'POST', headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.'); return d; }); });
  }

  /* mode: 'new' (just signed up), 'manage' (already has an email), or 'add' (from Settings).
     It is now a FULL PAGE that reuses the Forgot password page (#ccfgt): same top bar, step bar, buttons, code boxes, envelope and lock pictures,
     and the same Back handling. cc-pages.css, cc-verify.css, cc-verify.js and cc-otp.js style and animate it with no extra code. */
  function ask(mode, cb) {
    if (busyNow || document.getElementById('ccea') || document.getElementById('ccfgt')) { if (cb) cb(); return; }
    busyNow = true;
    var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    var XICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    var pg = document.createElement('div');
    pg.id = 'ccfgt'; pg.className = 'ccrem'; pg.setAttribute('role', 'dialog'); pg.setAttribute('aria-modal', 'true'); pg.setAttribute('aria-label', 'Recovery email');
    pg.__cchint = 1;   /* cc-remember.js must not add its "send the reset code" shortcut to this page */
    pg.innerHTML = '<div class="fp-top"><button type="button" class="fp-ic" id="ccfg-bk" aria-label="Back">' + ARROW + '</button>'
      + '<div class="fp-brand"><img src="cc-mark.png" alt=""><span>Comrade Connect</span></div>'
      + '<button type="button" class="fp-ic" id="ccfg-x" aria-label="Close">' + XICON + '</button></div>'
      + '<div class="fp-body"><div class="fp-bar" id="ccfg-bar"><i class="on"></i><i></i><i></i></div><p class="fp-step" id="ccfg-st"></p><h1 id="ccfg-h"></h1>'
      + '<p class="fp-sub" id="ccfg-in"></p>'
      + '<div class="fp-f" id="ccfg-f1"><label for="ccfg-m">Your email</label><input id="ccfg-m" name="email" type="email" inputmode="email" placeholder="name@gmail.com" autocomplete="email" autocapitalize="off" aria-label="Your email"></div>'
      + '<div id="ccfg-2" hidden><form id="ccfg-fm" style="display:contents" novalidate><div id="ccfg-cb"><div class="fp-f"><label for="ccfg-c">6-digit code</label>'
      + '<input id="ccfg-c" name="code" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code" aria-label="6-digit code"></div></div></form></div>'
      + '<p class="fp-msg" id="ccfg-e" role="status" aria-live="polite"></p>'
      + '<button type="button" class="fp-go" id="ccfg-go">Send code</button>'
      + '<button type="button" class="fp-link" id="ccfg-have" hidden>Send me a new code</button>'
      + '<button type="button" class="fp-link" id="ccfg-si">Skip, add it later</button></div>';
    document.body.appendChild(pg);
    var $ = function (i) { return pg.querySelector('#' + i); };
    var em = $('ccfg-m'), cd = $('ccfg-c'), go = $('ccfg-go'), have = $('ccfg-have'), si = $('ccfg-si');
    var step = 1, sentTo = '', cool = 0, ct = 0, finished = false;

    function setMsg(t, bad) { var e = $('ccfg-e'); e.textContent = t || ''; e.classList.toggle('bad', !!(bad && t)); }
    function onKey(ev) { if (ev.key === 'Escape') close(mode === 'new'); }
    function close(skipped) {
      if (finished) return; finished = true; busyNow = false; clearInterval(ct); document.removeEventListener('keydown', onKey);
      try { pg.remove(); } catch (e) {}
      if (skipped) say('No problem. Add it later in Settings, under Recovery email.');
      if (cb) cb();
    }
    document.addEventListener('keydown', onKey);
    function bar(n) { [].forEach.call(pg.querySelectorAll('#ccfg-bar i'), function (x, k) { x.classList.toggle('on', k < n); }); }
    function tick() {
      if (step !== 2) return;
      if (cool > 0) { have.disabled = true; have.textContent = 'Send me a new code (' + cool + 's)'; }
      else { have.disabled = false; have.textContent = 'Send me a new code'; clearInterval(ct); }
    }
    function startCool() { cool = 30; clearInterval(ct); ct = setInterval(function () { cool--; tick(); }, 1000); tick(); }
    function paint() {   /* step 0 = already saved, 1 = type the email, 2 = type the code, 3 = saved */
      var s = $('ccfg-st'), h = $('ccfg-h'), sub = $('ccfg-in');
      pg.classList.toggle('mg', step === 0); pg.classList.toggle('ccv-ok', step === 3);
      $('ccfg-f1').hidden = step !== 1; $('ccfg-2').hidden = step !== 2; have.hidden = step !== 2;
      bar(step === 0 ? 0 : step);
      if (step === 0) {
        s.textContent = 'Settings'; h.textContent = 'Recovery email';
        sub.textContent = 'Saved. You can reset your password by email if you forget it.';
        go.textContent = 'Change email'; si.textContent = 'Done';
      } else if (step === 1) {
        s.textContent = 'Step 1 of 3'; h.textContent = mode === 'manage' ? 'Change recovery email' : 'Add a recovery email';
        sub.textContent = 'Optional. We use it only for "Forgot password" and to get you back in on a new phone. We keep a scrambled copy, never the email itself.';
        go.textContent = 'Send code'; si.textContent = mode === 'new' ? 'Skip, add it later' : 'Cancel';
      } else if (step === 2) {
        s.textContent = 'Step 2 of 3'; h.textContent = 'Check your email';
        sub.textContent = 'We sent a 6-digit code to ' + sentTo + '. It works for 15 minutes. It can take a minute, so check your spam folder too.';
        go.textContent = 'Verify code'; si.textContent = mode === 'new' ? 'Skip, add it later' : 'Cancel'; tick();
      } else {
        s.textContent = 'Step 3 of 3'; h.textContent = 'Email saved';
        sub.textContent = 'You can now reset your password by email if you forget it.';
        go.textContent = 'Done'; si.hidden = true;
      }
      si.hidden = step === 3; setMsg('');
    }
    step = mode === 'manage' ? 0 : 1; paint();

    function focusField() { setTimeout(function () { try { if (step === 1) em.focus({ preventScroll: true }); else if (step === 2) { var b = pg.querySelector('.cco-b'); (b || cd).focus(); } } catch (e) {} }, 80); }
    $('ccfg-x').onclick = function () { close(mode === 'new' && step < 3); };
    si.onclick = function () { close(mode === 'new' && step < 3); };
    $('ccfg-bk').onclick = function () { if (step === 2) { clearInterval(ct); step = 1; paint(); focusField(); } else close(mode === 'new' && step === 1); };
    have.onclick = function () {
      if (cool > 0) return; setMsg('');
      call('/api/me/recovery-email/start', { email: em.value.trim() }).then(function (d) { sentTo = d.sent_to || em.value.trim(); setMsg(d.message || 'A new code is on its way.'); startCool(); }, function (e) { setMsg(e.message, true); });
    };
    go.onclick = function () {
      setMsg('');
      if (step === 3) return close(false);
      if (step === 0) { step = 1; paint(); focusField(); return; }
      if (step === 1) {
        if (!okMail(em.value)) return setMsg('Enter a real email address, for example name@gmail.com', true);
        go.disabled = true; go.textContent = 'Sending code...';
        call('/api/me/recovery-email/start', { email: em.value.trim() }).then(function (d) { sentTo = d.sent_to || em.value.trim(); step = 2; paint(); startCool(); focusField(); },
          function (e) { setMsg(e.message, true); go.textContent = 'Send code'; }).then(function () { go.disabled = false; });
      } else {
        var c = String(cd.value).replace(/\D/g, '');
        if (c.length !== 6) return setMsg('The code has 6 digits.', true);
        go.disabled = true; go.textContent = 'Checking code...';
        call('/api/me/recovery-email/confirm', { code: c }).then(function () { step = 3; clearInterval(ct); paint(); say('Email saved. You can now reset your password by email.'); },
          function (e) { setMsg(e.message, true); go.textContent = 'Verify code'; }).then(function () { go.disabled = false; });
      }
    };
    em.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
    cd.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
    if (mode !== 'manage') focusField();
  }

  /* wait while another full screen is up (first screen, lock screen, recovery code sheet, username setup) */
  function otherScreen() {
    var lk = document.getElementById('lk');
    return !!(document.getElementById('ccfrst') || document.getElementById('ccsu') || document.getElementById('ccfp') || document.getElementById('ccfgt') || document.getElementById('ccrst') ||
      document.getElementById('ccaid') || document.getElementById('ccwl-go') || document.getElementById('ccgate') || (lk && lk.classList.contains('on')));
  }
  var inflight = null;
  function offer(cb) {   /* asks once, for new accounts of every kind (username or Google) */
    if (inflight) return inflight.then(function () { if (cb) cb(); });
    inflight = new Promise(function (res) {
      if (!auth()) return res();
      call('/api/me/recovery-email').then(function (d) { if (d.has_email || !d.available) return res(); ask('new', res); }).catch(function () { res(); });
    }).then(function () { inflight = null; try { localStorage.removeItem(NEW); } catch (e) {} });
    return inflight.then(function () { if (cb) cb(); });
  }
  window.ccAskEmailSignup = function () { return offer(); };

  window.ccAskEmail = function () {   /* Settings > Recovery email, always works */
    if (!auth()) return say('Sign in first.');
    call('/api/me/recovery-email').then(function (d) {
      if (!d.available) return say('Email is not switched on yet. Try again later.');
      ask(d.has_email ? 'manage' : 'add');
    }).catch(function (e) { say(e.message); });
  };

  /* a brand new Google account: cc-core sets the flag, the page reloads, and once the username screen is done we ask (once) */
  var timer = setInterval(function () {
    var flag = ''; try { flag = localStorage.getItem(NEW) || ''; } catch (e) {}
    if (!flag || ++tries > 120) { clearInterval(timer); return; }
    if (!auth() || otherScreen() || !api() || navigator.onLine === false) return;
    clearInterval(timer); setTimeout(function () { if (!otherScreen()) offer(); }, 900);
  }, 1500);
})();
