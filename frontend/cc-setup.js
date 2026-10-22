/* cc-setup.js v1: right after someone signs in for the first time, offer to choose their own username, a password and a phone number.
   Everything is optional. Skip for now = nothing is asked again; it can be done any time later from the profile (Sign in details).
   Uses the server routes that already exist: POST /api/me/credentials (username + password) and POST /api/me/handle (username only).
   The phone number is kept on this phone (cc_phone) and used to fill in payments and withdrawals. */
(function () {
  'use strict';
  if (window.__ccSetup) return; window.__ccSetup = 1;
  var DONE = 'cc_setup_done', shown = false, tries = 0;
  var say = function (t) { try { if (window.ccTools && ccTools.toast) ccTools.toast(t); else if (typeof toast === 'function') toast(t); } catch (e) {} };
  var api = function () { try { return (typeof CC_API === 'string' && CC_API) || ''; } catch (e) { return ''; } };
  var signedIn = function () { try { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); } catch (e) { return false; } };
  var isDone = function () { try { return localStorage.getItem(DONE) === '1'; } catch (e) { return false; } };
  var mark = function () { try { localStorage.setItem(DONE, '1'); } catch (e) {} };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var css = document.createElement('style');
  css.textContent = [
    '#ccsu{position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;background:var(--bg,#0E0F0B);color:var(--fg,#fff);overflow:auto;font-family:Poppins,system-ui,sans-serif;animation:ccsuin .3s ease}',
    '@keyframes ccsuin{from{opacity:0;transform:translateY(14px)}}',
    '#ccsu .b{position:relative;width:100%;max-width:440px;min-height:100%;margin:0 auto;padding:calc(40px + env(safe-area-inset-top,0px)) 22px calc(26px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;justify-content:center;box-sizing:border-box}',
    '#ccsu h2{margin:0;font-size:clamp(26px,7.5vw,34px);line-height:1.1;letter-spacing:-.03em;font-weight:700}',
    '#ccsu .s{margin:10px 0 6px;font-size:14.5px;line-height:1.6;color:var(--mut,#bdbdbd)}',
    '#ccsu .f{position:relative;margin-top:12px}',
    '#ccsu label{display:block;margin:0 0 6px 4px;font-size:12px;font-weight:600;color:var(--mut,#bdbdbd)}',
    '#ccsu input{width:100%;box-sizing:border-box;border-radius:14px;border:1px solid var(--line,rgba(255,255,255,.28));background:rgba(127,127,127,.12);color:inherit;padding:15px 16px;font:500 16px Poppins,system-ui,sans-serif;outline:0}',
    '#ccsu input:focus{border-color:#FE813C;box-shadow:0 0 0 3px rgba(254,129,60,.22)}',
    '#ccsu .eye{position:absolute;right:6px;bottom:6px;width:40px;height:40px;border:0;background:none;color:var(--mut,#bdbdbd);display:grid;place-items:center;cursor:pointer}',
    '#ccsu .h{margin:6px 4px 0;font-size:11.5px;color:var(--mut,#bdbdbd)}',
    '#ccsu .go{width:100%;margin-top:18px;border:0;border-radius:999px;background:#FE813C;color:#0E0F0B;min-height:52px;font:700 16px Poppins,system-ui,sans-serif;cursor:pointer}',
    '#ccsu .go:disabled{opacity:.6}',
    '#ccsu .sk{display:block;width:100%;margin-top:8px;padding:12px;background:none;border:0;color:var(--mut,#bdbdbd);font:500 14px Poppins,system-ui,sans-serif;cursor:pointer}',
    '#ccsu .e{margin:12px 0 0;font-size:13px;color:#ff6b6b;text-align:center}'
  ].join('');
  document.head.appendChild(css);

  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var XI = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function post(path, body) {
    return fetch(api() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error((d && (d.error || d.message)) || 'Could not save. Try again.'); return d; }); });
  }
  function phoneOk(v) { var d = String(v || '').replace(/\D/g, ''); return /^(0[17]\d{8}|254[17]\d{8})$/.test(d) ? d : null; }

  function open() {
    if (document.getElementById('ccsu')) return;
    shown = true;
    var cur = ''; try { cur = (typeof ME !== 'undefined' && ME && ME.handle) ? String(ME.handle) : ''; } catch (e) {}
    var m = document.createElement('div'); m.id = 'ccsu'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Set up your account');
    m.innerHTML = '<div class="b">'
      + '<button type="button" class="ccx-plain" data-ccx="1" id="ccsu-x" aria-label="Close" style="position:absolute;top:calc(10px + env(safe-area-inset-top,0px));right:10px;width:44px;height:44px;display:grid;place-items:center;padding:0;border:0;background:none;color:inherit;cursor:pointer">' + XI + '</button>'
      + '<h2>Set up your account</h2>'
      + '<p class="s">Choose your own username and a password so you can sign in on any phone. Your stories always stay anonymous. You can skip this and do it later.</p>'
      + '<form id="ccsu-f" novalidate>'
      + '<div class="f"><label for="ccsu-u">Username (optional)</label><input id="ccsu-u" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="20" placeholder="' + esc(cur || 'Pick a username') + '"></div>'
      + '<p class="h">3 to 20 letters, numbers or _</p>'
      + '<div class="f"><label for="ccsu-p">Password (optional)</label><input id="ccsu-p" type="password" autocomplete="new-password" maxlength="100" placeholder="At least 8 characters"><button type="button" class="eye" id="ccsu-eye" aria-label="Show password">' + EYE + '</button></div>'
      + '<div class="f"><label for="ccsu-n">Phone number (optional)</label><input id="ccsu-n" type="tel" inputmode="tel" autocomplete="tel" placeholder="07XX XXX XXX"></div>'
      + '<p class="h">Used to fill in M-Pesa payments and withdrawals for you. It stays on this phone.</p>'
      + '<p class="e" id="ccsu-e" role="alert" hidden></p>'
      + '<button type="submit" class="go" id="ccsu-go">Save</button></form>'
      + '<button type="button" class="sk" id="ccsu-sk">Skip for now</button>'
      + '<p class="h" style="text-align:center">You can add these later in your profile.</p></div>';
    document.body.appendChild(m);
    var $ = function (s) { return m.querySelector(s); };
    var err = function (t) { var e = $('#ccsu-e'); e.textContent = t || ''; e.hidden = !t; };
    var close = function () { m.remove(); };
    $('#ccsu-x').onclick = $('#ccsu-sk').onclick = function () { mark(); close(); };
    $('#ccsu-eye').onclick = function () { var i = $('#ccsu-p'), s = i.type === 'password'; i.type = s ? 'text' : 'password'; this.setAttribute('aria-label', s ? 'Hide password' : 'Show password'); };
    $('#ccsu-f').onsubmit = function (ev) {
      ev.preventDefault(); err('');
      var u = $('#ccsu-u').value.trim(), p = $('#ccsu-p').value, n = $('#ccsu-n').value.trim(), go = $('#ccsu-go');
      if (u && !/^[A-Za-z0-9_]{3,20}$/.test(u)) return err('Username: 3 to 20 letters, numbers or _');
      if (p && p.length < 8) return err('Password: at least 8 characters');
      if (p && (u || cur).toLowerCase() === p.toLowerCase()) return err('The password cannot be your username');
      var ph = null; if (n) { ph = phoneOk(n); if (!ph) return err('Enter a phone number like 0712 345 678'); }
      if (!u && !p && !n) { mark(); close(); return; }
      go.disabled = true; go.textContent = 'Saving...';
      var job = Promise.resolve(null);
      if (p) job = post('/api/me/credentials', { handle: u || cur, password: p });          // a password needs a username: the current one is kept if none was typed
      else if (u) job = post('/api/me/handle', { handle: u });
      job.then(function (d) {
        var h = d && d.handle; if (h) { try { ME.handle = h; if (typeof saveMe === 'function') saveMe(); } catch (e) {} }
        if (ph) { try { if (typeof ST !== 'undefined' && ST.set) ST.set('cc_phone', ph); else localStorage.setItem('cc_phone', ph); } catch (e) {} }
        mark(); close();
        say(p ? 'Saved. Sign in with @' + (h || u || cur) + ' and your password.' : u ? 'Username saved: @' + (h || u) : 'Phone number saved');
      }, function (e) { go.disabled = false; go.textContent = 'Save'; err((e && e.message) || 'Could not save. Try again.'); });
    };
  }

  // wait until the person is signed in and nothing else is on screen, then ask once
  function busy() {
    var l = document.getElementById('loader'), lk = document.getElementById('lk');
    return !!(document.getElementById('ccfrst') || document.getElementById('ccfp') || (lk && lk.classList.contains('on')) || (l && getComputedStyle(l).display !== 'none' && l.getBoundingClientRect().height > 0));
  }
  var timer = setInterval(function () {
    if (shown || isDone() || ++tries > 400) { clearInterval(timer); return; }
    if (!signedIn() || busy()) return;
    clearInterval(timer);
    setTimeout(function () {
      if (isDone() || busy()) return;
      fetch(api() + '/api/me').then(function (r) { return r.ok ? r.json() : null; }).then(function (me) {
        if (!me || me.has_password || isDone()) { if (me && me.has_password) mark(); return; }
        open();
      }).catch(function () {});
    }, 1500);
  }, 1500);
  window.ccSetupAccount = open;                          // the profile can call this to reopen it later
})();
