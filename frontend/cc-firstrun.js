/* cc-firstrun.js: the first thing you see when you open the Android app for the first time:
   Log in / Create account / Create anonymous account (and Google when it is set up).
   You can cancel it (X or Skip for now) and then it stays away. It shows BEFORE the cookie banner.
   window.ccAuthPanel() opens the same panel from anywhere (the Welcome banner uses it). */
(function () {
  'use strict';
  if (window.__ccFirstRun) return; window.__ccFirstRun = 1;
  var KEY = 'cc_fr';
  var native = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  var signedIn = function () { try { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); } catch (e) { return false; } };
  // Shown when you open the app or site signed out, then never again during that visit (X, Skip, back button or signing in all count).
  // It comes back the next time you open the app or site, until you are signed in.
  var seen = function () { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return window.__ccFrSeen === 1; } };
  var mark = function () { window.__ccFrSeen = 1; try { sessionStorage.setItem(KEY, '1'); } catch (e) {} };
  var say = function (t) { try { if (window.ccTools && ccTools.toast) ccTools.toast(t); else if (typeof toast === 'function') toast(t); } catch (e) {} };

  window.ccFirstRunOpen = !seen() && !signedIn();      // read by the cookie banner timer: wait for this panel first

  var css = document.createElement('style');
  css.textContent = [
    '#ccfrst{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:0;background:var(--bg,#0E0F0B);overflow:auto;animation:ccfrstin .3s ease}',
    '@keyframes ccfrstin{from{opacity:0;transform:translateY(14px)}}',
    '#ccfrst .ccfrst-b{position:relative;width:100%;max-width:440px;min-height:100%;margin:0 auto;padding:calc(34px + env(safe-area-inset-top,0px)) 22px calc(26px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;justify-content:center}',
    '@media(min-width:700px){#ccfrst{background:rgba(14,15,11,.8)}#ccfrst .ccfrst-b{min-height:0;border-radius:24px;border:1px solid var(--line,rgba(255,255,255,.18));background:var(--bg,#0E0F0B)}}',
    '#ccfrst .ccfrst-x{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));right:14px;width:38px;height:38px;border-radius:50%;border:1px solid var(--line,rgba(255,255,255,.25));background:rgba(127,127,127,.18);color:inherit;display:grid;place-items:center;padding:0;cursor:pointer}',
    '#ccfrst .ccfrst-x svg{width:18px;height:18px}',
    '#ccfrst img{width:64px;height:64px;border-radius:16px;background:#0E0F0B;margin:0 0 16px}',
    '#ccfrst h2{margin:0;font-size:clamp(28px,8vw,38px);line-height:1.05;letter-spacing:-.03em;font-weight:700}',
    '#ccfrst p.ccfrst-s{margin:10px 0 22px;font-size:14.5px;line-height:1.6;color:var(--mut,#bdbdbd)}',
    '#ccfrst .btn{width:100%;margin-top:10px}',
    '#ccfrst .ccfrst-g{display:flex;justify-content:center;margin-top:10px;min-height:44px}',
    '#ccfrst .ccfrst-or{margin:14px 0 0;text-align:center;font-size:12px;color:var(--mut,#bdbdbd)}',
    '#ccfrst .ccfrst-sk{display:block;width:100%;margin-top:14px;padding:10px;background:none;border:0;color:var(--mut,#bdbdbd);font:500 14px Poppins,system-ui,sans-serif;cursor:pointer}',
    '#ccfrst .ccfrst-n{margin:14px 0 0;font-size:11.5px;line-height:1.5;color:var(--mut,#bdbdbd);text-align:center}',
    '#ccfrst .ccfrst-f{position:relative;margin-top:12px}',
    '#ccfrst .ccfrst-f label{display:block;margin:0 0 6px 4px;font-size:12px;font-weight:600;color:var(--mut,#bdbdbd);text-align:left}',
    '#ccfrst .ccfrst-f input{width:100%;box-sizing:border-box;border-radius:14px;border:1px solid var(--line,rgba(255,255,255,.28));background:rgba(127,127,127,.12);color:inherit;padding:15px 16px;font:500 16px Poppins,system-ui,sans-serif;outline:0}',
    '#ccfrst .ccfrst-f input:focus{border-color:#FE813C;box-shadow:0 0 0 3px rgba(254,129,60,.22)}',
    '#ccfrst .ccfrst-f .ccfrst-eye{position:absolute;right:6px;bottom:6px;width:40px;height:40px;border:0;background:none;color:var(--mut,#bdbdbd);display:grid;place-items:center;cursor:pointer}',
    '#ccfrst #ccfrst-in{background:#FE813C;border-color:#FE813C;color:#0E0F0B;min-height:52px;font-weight:700}',
    '#ccfrst .ccfrst-row{display:flex;gap:8px}#ccfrst .ccfrst-row .btn{margin-top:10px;font-size:13.5px;padding-left:8px;padding-right:8px}',
    '#ccfrst .ccfrst-hint{margin:8px 4px 0;font-size:11.5px;color:var(--mut,#bdbdbd);text-align:left}'
  ].join('');
  document.head.appendChild(css);

  var timer = null;
  function close(markSeen) {
    var m = document.getElementById('ccfrst'); if (m) m.remove();
    clearInterval(timer); timer = null;
    if (markSeen) mark();
    window.ccFirstRunOpen = false;
    window.csWelcome = null;                       // the older "Welcome, comrade" pop-up is replaced by this panel
    try { if (window.ccCkShow) setTimeout(window.ccCkShow, 400); } catch (e) {}
  }
  function open() {
    if (document.getElementById('ccfrst')) return;
    var m = document.createElement('div'); m.id = 'ccfrst'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Welcome to Comrade Connect');
    var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    m.innerHTML = '<div class="ccfrst-b"><button type="button" class="ccfrst-x" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
      + '<img src="/icon-192.png" alt="" width="64" height="64">'
      + '<h2>Welcome back</h2>'
      + '<p class="ccfrst-s">Log in to Comrade Connect. Your stories always stay anonymous.</p>'
      + '<form id="ccfrst-form" autocomplete="on" novalidate>'
      + '<div class="ccfrst-f"><label for="ccfrst-u">Username or account ID</label><input id="ccfrst-u" name="username" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Enter your username"></div>'
      + '<div class="ccfrst-f"><label for="ccfrst-p">Password</label><input id="ccfrst-p" name="password" type="password" autocomplete="current-password" autocapitalize="off" placeholder="Enter your password"><button type="button" class="ccfrst-eye" id="ccfrst-eye" aria-label="Show password">' + EYE + '</button></div>'
      + '<p class="ccfrst-hint">Lost your password? Type the recovery code you saved instead.</p>'
      + '<button type="submit" class="btn p" id="ccfrst-in">Log in</button></form>'
      + '<div id="ccfrst-gw" hidden><p class="ccfrst-or">or</p><div class="ccfrst-g" id="ccfrst-gb"></div></div>'
      + '<p class="ccfrst-or">New here?</p>'
      + '<div class="ccfrst-row"><button type="button" class="btn g" id="ccfrst-new">Create account</button><button type="button" class="btn g" id="ccfrst-anon">Anonymous account</button></div>'
      + '<p class="ccfrst-n" id="ccfrst-e" role="alert" hidden></p>'
      + '<button type="button" class="ccfrst-sk" id="ccfrst-skip">Skip for now</button>'
      + '<p class="ccfrst-n">By continuing you agree to our <a href="/terms.html" style="color:inherit;text-decoration:underline">Terms</a> and <a href="/privacy.html" style="color:inherit;text-decoration:underline">Privacy Policy</a>.</p></div>';
    document.body.appendChild(m);
    var $ = function (s) { return m.querySelector(s); };
    var err = function (t) { var e = $('#ccfrst-e'); e.textContent = t || ''; e.hidden = !t; };
    var ready = function () { if (window.CC) return true; err('The app is still starting. Try again in a second.'); return false; };
    var run = function (btn, fn) {
      return function () {
        if (!ready()) return; err('');
        var r; try { r = fn(); } catch (e) { return err(e.message || 'Something went wrong'); }
        if (r && r.then) { btn.disabled = true; r.then(function () { btn.disabled = false; }, function (e) { btn.disabled = false; if (e && e.message && !/sign in to continue/i.test(e.message)) err(e.message); }); }
      };
    };
    $('#ccfrst-eye').onclick = function () { var i = $('#ccfrst-p'), show = i.type === 'password'; i.type = show ? 'text' : 'password'; this.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); };
    $('#ccfrst-form').onsubmit = function (ev) {
      ev.preventDefault(); if (!ready()) return; err('');
      var u = $('#ccfrst-u').value.trim(), p = $('#ccfrst-p').value, b = $('#ccfrst-in');
      if (!u || !p) return err('Enter your username and password');
      b.disabled = true; b.textContent = 'Logging in...';
      CC.restoreAccount(u, p).then(function () { say('Welcome back, comrade'); close(true); setTimeout(function () { location.reload(); }, 350); },
        function (e) { b.disabled = false; b.textContent = 'Log in'; err((e && e.message) || 'That username or password is not right'); });
    };
    $('#ccfrst-new').onclick = run($('#ccfrst-new'), function () { return CC.createAccount('password'); });
    $('#ccfrst-anon').onclick = run($('#ccfrst-anon'), function () { return CC.createAccount('random'); });
    $('.ccfrst-x', m).onclick = $('#ccfrst-skip').onclick = function () { close(true); };
    if (window.ccGoogle && ccGoogle.on && ccGoogle.on()) {
      $('#ccfrst-gw').hidden = false;
      try { ccGoogle.mount($('#ccfrst-gb'), function () { say('Signed in with Google'); }, function (t) { err(t || 'Google sign-in failed. Try again.'); }, { theme: 'outline', width: 280 }); } catch (e) {}
    }
    timer = setInterval(function () {                // signed in (any way): the panel is done
      if (signedIn()) { close(true); say('You are in, comrade'); }
    }, 500);
  }
  window.ccAuthPanel = open;

  function first() { if (!seen() && !signedIn()) open(); else if (window.ccFirstRunOpen) close(false); }
  if (document.readyState === 'complete') setTimeout(first, 250); else window.addEventListener('load', function () { setTimeout(first, 250); });
})();
