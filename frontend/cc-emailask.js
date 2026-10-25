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

  /* mode: 'new' (just signed up), 'manage' (already has an email), or 'add' (from Settings) */
  function ask(mode, cb) {
    if (busyNow || document.getElementById('ccea')) { if (cb) cb(); return; }
    var m = window.ccTools && ccTools.sheet ? ccTools.sheet('') : null;
    if (!m) { if (cb) cb(); return; }
    busyNow = true; m.id = 'ccea';
    var box = m.firstChild; box.textContent = '';
    var wrap = el('div', 'cf-ea'); box.appendChild(wrap);
    var ic = el('div', 'cf-ic'); ic.innerHTML = MAIL;
    var h3 = el('h3', 'cf-h', mode === 'manage' ? 'Recovery email' : 'Add a recovery email');
    var sub = el('p', 'cf-s');
    var f = el('form'); f.noValidate = true; f.addEventListener('submit', function (e) { e.preventDefault(); });
    var w1 = el('div', 'cf-f');
    var em = el('input'); em.type = 'email'; em.name = 'email'; em.setAttribute('autocomplete', 'email'); em.setAttribute('inputmode', 'email'); em.setAttribute('autocapitalize', 'off'); em.placeholder = 'name@gmail.com'; em.setAttribute('aria-label', 'Your email'); w1.appendChild(em);
    var w2 = el('div', 'cf-f'); w2.hidden = true;
    var cd = el('input'); cd.name = 'code'; cd.setAttribute('inputmode', 'numeric'); cd.setAttribute('autocomplete', 'one-time-code'); cd.maxLength = 6; cd.placeholder = '6-digit code'; cd.setAttribute('aria-label', '6-digit code'); w2.appendChild(cd);
    f.appendChild(w1); f.appendChild(w2);
    var msg = el('p', 'cf-m'); msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite');
    var go = el('button', 'btn p cf-go', 'Send code'); go.type = 'button';
    var link = el('button', 'cf-lnk', 'Skip, add it later'); link.type = 'button';
    var hint = el('p', 'cf-hint', 'You can add it any time in Settings, under Recovery email.');
    var done = el('div', 'cf-done'); done.hidden = true;
    var dic = el('div', 'cf-dic'); dic.innerHTML = TICK; done.appendChild(dic); done.appendChild(el('b', '', 'Email saved')); done.appendChild(el('span', '', 'You can now reset your password by email.'));
    [ic, h3, sub, f, msg, go, link, hint, done].forEach(function (n) { wrap.appendChild(n); });

    var step = 1, sentTo = '', cool = 0, ct = 0;
    function setMsg(t, bad) { msg.textContent = t || ''; msg.classList.toggle('bad', !!bad); if (t && bad) { wrap.classList.remove('cf-shake'); void wrap.offsetWidth; wrap.classList.add('cf-shake'); } }
    function close(skipped) { busyNow = false; clearInterval(ct); try { m.close(); } catch (e) {} if (skipped) say('No problem. Add it later in Settings, under Recovery email.'); if (cb) cb(); }
    function paint() {
      if (step === 1) {
        h3.textContent = mode === 'manage' ? 'Change recovery email' : 'Add a recovery email';
        sub.textContent = 'Optional. We use it only for "Forgot password" and to get you back in on a new phone. We keep a scrambled copy, never the email itself.';
        w1.hidden = false; w2.hidden = true; go.textContent = 'Send code'; link.textContent = mode === 'manage' ? 'Cancel' : 'Skip, add it later'; hint.hidden = mode === 'manage';
      } else {
        h3.textContent = 'Check your email';
        sub.textContent = 'We sent a 6-digit code to ' + sentTo + '. It works for 15 minutes. Check spam too.';
        w1.hidden = true; w2.hidden = false; go.textContent = 'Confirm'; link.textContent = cool > 0 ? 'Use a different email (resend in ' + cool + 's)' : 'Use a different email'; hint.hidden = true;
      }
      setMsg('');
    }
    function startCool() { cool = 30; clearInterval(ct); ct = setInterval(function () { cool--; if (step === 2) link.textContent = cool > 0 ? 'Use a different email (resend in ' + cool + 's)' : 'Use a different email'; if (cool <= 0) clearInterval(ct); }, 1000); }
    function manageView() {
      h3.textContent = 'Recovery email'; sub.textContent = 'Saved. You can reset your password by email if you forget it.';
      f.hidden = true; go.textContent = 'Change email'; link.textContent = 'Done'; hint.hidden = true; step = 0;
    }
    if (mode === 'manage') manageView(); else paint();

    link.onclick = function () {
      if (step === 2) { step = 1; paint(); try { em.focus(); } catch (e) {} return; }
      close(mode === 'new');
    };
    m.addEventListener('click', function (e) { if (e.target === m) close(mode === 'new'); });
    go.onclick = function () {
      setMsg('');
      if (step === 0) { step = 1; f.hidden = false; paint(); try { em.focus(); } catch (e) {} return; }
      if (step === 1) {
        if (!okMail(em.value)) return setMsg('Enter a real email address, for example name@gmail.com', true);
        go.disabled = true; go.textContent = 'Sending...';
        call('/api/me/recovery-email/start', { email: em.value.trim() }).then(function (d) { sentTo = d.sent_to || em.value.trim(); step = 2; startCool(); paint(); setTimeout(function () { var b = wrap.querySelector('.cco-b'); try { (b || cd).focus(); } catch (e) {} }, 60); },
          function (e) { setMsg(e.message, true); go.textContent = 'Send code'; }).then(function () { go.disabled = false; });
      } else {
        var c = String(cd.value).replace(/\D/g, '');
        if (c.length !== 6) return setMsg('The code has 6 digits.', true);
        go.disabled = true; go.textContent = 'Checking...';
        call('/api/me/recovery-email/confirm', { code: c }).then(function () {
          f.hidden = true; go.hidden = true; link.hidden = true; hint.hidden = true; msg.hidden = true; sub.hidden = true; h3.hidden = true; ic.hidden = true; done.hidden = false;
          setTimeout(function () { close(false); say('Email saved. You can now reset your password by email.'); }, 1500);
        }, function (e) { setMsg(e.message, true); go.disabled = false; go.textContent = 'Confirm'; });
      }
    };
    em.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
    cd.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
    if (mode !== 'manage') setTimeout(function () { try { em.focus({ preventScroll: true }); } catch (e) {} }, 120);
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
