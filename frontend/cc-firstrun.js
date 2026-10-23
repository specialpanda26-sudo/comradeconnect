/* cc-firstrun.js v5: the sign-in panel. ONE panel with a switch at the top: Log in / Sign up / Anonymous.
   Nothing pops up on top of it any more (Sign up used to open a second pop-up over the login screen).
   It opens when you open the app or site signed out, and you can close it (X or Skip for now) so it stays away for that visit.
   window.ccAuthPanel('login' | 'create' | 'anon') opens the same panel from anywhere (landing page, Welcome banner, lock screen...).
   Look = the site's Aqua foundation: night, slate, aqua. Password strength + "Suggest a strong password" come from cc-pass.js
   (it picks up any autocomplete="new-password" field by itself). */
(function () {
  'use strict';
  if (window.__ccFirstRun) return; window.__ccFirstRun = 1;
  var KEY = 'cc_fr';
  var signedIn = function () { try { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); } catch (e) { return false; } };
  // Shown when you open the app or site signed out, then never again during that visit (X, Skip, back button or signing in all count).
  // It comes back the next time you open the app or site, until you are signed in.
  var seen = function () { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return window.__ccFrSeen === 1; } };
  var mark = function () { window.__ccFrSeen = 1; try { sessionStorage.setItem(KEY, '1'); } catch (e) {} };
  var say = function (t) { try { if (window.ccTools && ccTools.toast) ccTools.toast(t); else if (typeof toast === 'function') toast(t); } catch (e) {} };

  window.ccFirstRunOpen = !seen() && !signedIn();      // read by the cookie banner timer: wait for this panel first

  var COPY = {
    login:  ['Welcome back', 'Log in to Comrade Connect. Your stories always stay anonymous.'],
    create: ['Create your account', 'Pick a username and a password you will remember. No email, no phone number. Your password is the only way back in on a new phone.'],
    anon:   ['Stay fully anonymous', 'No username and no password. You get a random recovery code to save. It is the only way back in on a new phone.']
  };

  var css = document.createElement('style');
  css.textContent = [
    '#ccfrst{position:fixed;inset:0;z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:0;background:var(--bg,#101422);color:var(--fg,#fff);overflow:auto;animation:ccfrstin .3s ease}',
    '@keyframes ccfrstin{from{opacity:0;transform:translateY(14px)}}',
    '#ccfrst:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(120% 52% at 50% -8%,rgba(168,220,231,.2),transparent 62%)}',
    ':root[data-theme="light"] #ccfrst:before{background:linear-gradient(180deg,#A8DCE7 0,rgba(168,220,231,.35) 220px,rgba(255,255,255,0) 420px)}',
    '#ccfrst .ccfrst-b{position:relative;width:100%;max-width:440px;min-height:100%;margin:0 auto;padding:calc(22px + env(safe-area-inset-top,0px)) 22px calc(24px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;box-sizing:border-box}',
    '@media(min-width:700px){#ccfrst{align-items:center;background:rgba(16,20,34,.8)}#ccfrst:before{display:none}#ccfrst .ccfrst-b{min-height:0;margin:24px auto;border-radius:28px;border:1px solid var(--line,rgba(255,255,255,.1));background:var(--bg,#101422)}}',
    '#ccfrst .ccfrst-x{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));right:16px;width:40px;height:40px;border-radius:50%;border:0;background:var(--soft,rgba(255,255,255,.06));color:inherit;display:grid;place-items:center;padding:0;cursor:pointer}',
    '#ccfrst .ccfrst-x svg{width:18px;height:18px}',
    /* header */
    '#ccfrst .ccfrst-hd{display:flex;align-items:center;gap:12px;margin:2px 0 22px;padding-right:52px;min-height:44px;font:600 14px Poppins,system-ui,sans-serif}',
    '#ccfrst .ccfrst-hd img{width:44px;height:44px;border-radius:13px;background:#000;flex:none}',
    '#ccfrst h2{margin:0 0 8px;font-family:var(--disp,Unbounded,Poppins,system-ui,sans-serif);font-size:clamp(24px,6.6vw,30px);line-height:1.18;letter-spacing:-.01em;font-weight:700;color:var(--fg,#fff)}',
    '#ccfrst p.ccfrst-s{margin:0 0 20px;font-size:14px;line-height:1.6;color:var(--mut,rgba(255,255,255,.62));min-height:3.2em}',
    /* the switch */
    '#ccfrst .ccfrst-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px;margin:0 0 22px;border-radius:999px;background:var(--g,#272B3B);border:1px solid var(--gb,rgba(255,255,255,.07))}',
    '#ccfrst .ccfrst-seg button{all:unset;box-sizing:border-box;text-align:center;cursor:pointer;padding:11px 6px;border-radius:999px;font:600 13px Poppins,system-ui,sans-serif;color:var(--mut,rgba(255,255,255,.62));transition:background .2s,color .2s;-webkit-tap-highlight-color:transparent}',
    '#ccfrst .ccfrst-seg button{background:none !important;background-image:none !important;border:0 !important;box-shadow:none !important}#ccfrst .ccfrst-seg button[aria-selected="true"]{background:var(--ink,#A8DCE7) !important;color:var(--inkfg,#101422)}',
    '#ccfrst .ccfrst-seg button:focus-visible{outline:2px solid var(--fg,#fff);outline-offset:2px}',
    /* fields: label, input, hint. Same spacing everywhere */
    '#ccfrst .ccfrst-pn[hidden]{display:none}',
    '#ccfrst .ccfrst-f{position:relative;display:block !important;margin:0 0 16px;padding:0 !important}',
    '#ccfrst .ccfrst-f label{display:block !important;width:auto !important;margin:0 0 7px 4px;font-size:12.5px;font-weight:600;color:var(--mut,rgba(255,255,255,.62))}',
    '#ccfrst .ccfrst-f input{display:block !important;width:100% !important;box-sizing:border-box;min-height:52px;font:500 16px Poppins,system-ui,sans-serif;color:inherit;outline:0}',
    '#ccfrst .ccfrst-f input:focus{border-color:#A8DCE7 !important}',
    '#ccfrst .ccfrst-f.pw input{padding-right:52px !important}',
    '#ccfrst .ccfrst-f .ccfrst-eye{position:absolute;right:6px;bottom:6px;width:40px;height:40px;border:0;background:none;color:var(--mut,rgba(255,255,255,.62));display:grid;place-items:center;cursor:pointer;padding:0}',
    '#ccfrst .ccfrst-hint{margin:-6px 4px 16px;font-size:12px;line-height:1.5;color:var(--mut,rgba(255,255,255,.62))}',
    '#ccfrst .ccpw-m{margin:-6px 4px 16px}',
    /* buttons */
    '#ccfrst .ccfrst-btn{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;margin-top:6px;border-radius:999px;font:700 15px Poppins,system-ui,sans-serif;text-align:center;cursor:pointer;background:var(--ink,#A8DCE7) !important;background-image:none !important;border:0 !important;box-shadow:none !important;color:var(--inkfg,#101422);-webkit-backdrop-filter:none !important;backdrop-filter:none !important;-webkit-tap-highlight-color:transparent}',
    '#ccfrst .ccfrst-btn:active{transform:scale(.98)}#ccfrst .ccfrst-btn[disabled]{opacity:.55;cursor:default}',
    '#ccfrst .ccfrst-btn:focus-visible{outline:2px solid var(--fg,#fff);outline-offset:3px}',
    '#ccfrst .ccfrst-box{padding:16px 18px;margin:0 0 6px;border-radius:20px;background:var(--g,#272B3B);border:1px solid var(--gb,rgba(255,255,255,.07));font-size:13px;line-height:1.65;color:var(--mut,rgba(255,255,255,.62))}',
    '#ccfrst .ccfrst-box b{color:var(--fg,#fff)}',
    '#ccfrst .ccfrst-or{display:flex;align-items:center;gap:12px;margin:20px 0 4px;font-size:12px;color:var(--mut,rgba(255,255,255,.62))}',
    '#ccfrst .ccfrst-or:before,#ccfrst .ccfrst-or:after{content:"";flex:1;height:1px;background:var(--line,rgba(255,255,255,.1))}',
    '#ccfrst .ccfrst-g{display:flex;justify-content:center;margin-top:10px;min-height:44px}',
    '#ccfrst .ccfrst-n{margin:14px 0 0;font-size:11.5px;line-height:1.5;color:var(--mut,rgba(255,255,255,.62));text-align:center}',
    '#ccfrst .ccfrst-n[role=alert]{font-size:13px;font-weight:600;color:var(--fg,#fff);padding:12px 14px;border-radius:14px;background:var(--soft,rgba(255,255,255,.06));text-align:left}',
    '#ccfrst .ccfrst-sk{all:unset;display:block;width:100%;box-sizing:border-box;text-align:center;margin-top:10px;padding:12px;color:var(--mut,rgba(255,255,255,.62));font:500 14px Poppins,system-ui,sans-serif;cursor:pointer}',
    '#ccfrst .ccfrst-ft{margin-top:auto;padding-top:8px}'
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

  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  function field(id, label, extra) { return '<div class="ccfrst-f' + (extra.pw ? ' pw' : '') + '"><label for="' + id + '">' + label + '</label><input id="' + id + '" ' + extra.attr + '>' + (extra.pw ? '<button type="button" class="ccfrst-eye" data-eye="' + (extra.eye || id) + '" id="' + id + '-eye" aria-label="Show password">' + EYE + '</button>' : '') + '</div>'; }

  function open(mode) {
    if (typeof mode !== 'string' || !COPY[mode]) mode = 'login';
    var ex = document.getElementById('ccfrst');
    if (ex) { if (ex.__set) ex.__set(mode); return; }
    var m = document.createElement('div'); m.id = 'ccfrst'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Welcome to Comrade Connect');
    m.innerHTML = '<div class="ccfrst-b"><button type="button" class="ccfrst-x" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
      + '<div class="ccfrst-hd"><img src="/icon-192.png" alt="" width="44" height="44">Comrade Connect</div>'
      + '<h2 id="ccfrst-t"></h2><p class="ccfrst-s" id="ccfrst-s"></p>'
      + '<div class="ccfrst-seg" role="tablist" aria-label="Account"><button type="button" role="tab" data-m="login">Log in</button><button type="button" role="tab" data-m="create">Sign up</button><button type="button" role="tab" data-m="anon">Anonymous</button></div>'
      /* LOG IN */
      + '<form class="ccfrst-pn" data-pn="login" id="ccfrst-form" autocomplete="on" novalidate>'
      + field('ccfrst-u', 'Username or account ID', { attr: 'name="username" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Enter your username"' })
      + field('ccfrst-p', 'Password', { pw: 1, attr: 'name="password" type="password" autocomplete="current-password" autocapitalize="off" placeholder="Enter your password"' })
      + '<p class="ccfrst-hint">Lost your password? Type the recovery code you saved instead.</p>'
      + '<button type="submit" class="ccfrst-btn" id="ccfrst-in">Log in</button></form>'
      /* SIGN UP */
      + '<div class="ccfrst-pn" data-pn="create" hidden>'
      + field('ccfrst-cu', 'Username', { attr: 'maxlength="20" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="e.g. night_owl"' })
      + '<p class="ccfrst-hint" style="margin-top:-8px">3 to 20 letters, numbers or _</p>'
      + field('ccfrst-cp', 'Password', { pw: 1, eye: 'create', attr: 'type="password" maxlength="100" autocomplete="new-password" placeholder="At least 8 characters"' })
      + field('ccfrst-cp2', 'Confirm password', { attr: 'type="password" maxlength="100" autocomplete="new-password" placeholder="Type it again"' })
      + '<button type="button" class="ccfrst-btn" id="ccfrst-new">Create account</button></div>'
      /* ANONYMOUS */
      + '<div class="ccfrst-pn" data-pn="anon" hidden><div class="ccfrst-box"><b>How it works</b><br>We make you an account with a random ID. After it is created you see a recovery code once. Screenshot it or write it down, because we cannot show it again.</div>'
      + '<button type="button" class="ccfrst-btn" id="ccfrst-anon">Create anonymous account</button></div>'
      + '<p class="ccfrst-n" id="ccfrst-e" role="alert" hidden></p>'
      + '<div id="ccfrst-gw" hidden><p class="ccfrst-or">or</p><div class="ccfrst-g" id="ccfrst-gb"></div></div>'
      + '<div class="ccfrst-ft"><button type="button" class="ccfrst-sk" id="ccfrst-skip">Skip for now</button>'
      + '<p class="ccfrst-n">By continuing you agree to our <a href="/terms.html" style="color:inherit;text-decoration:underline">Terms</a> and <a href="/privacy.html" style="color:inherit;text-decoration:underline">Privacy Policy</a>.</p></div></div>';
    document.body.appendChild(m);
    var $ = function (s) { return m.querySelector(s); }, $$ = function (s) { return [].slice.call(m.querySelectorAll(s)); };
    var err = function (t) { var e = $('#ccfrst-e'); e.textContent = t || ''; e.hidden = !t; };
    var ready = function () { if (window.CC) return true; err('The app is still starting. Try again in a second.'); return false; };

    function setMode(k, focus) {
      if (!COPY[k]) k = 'login';
      $('#ccfrst-t').textContent = COPY[k][0]; $('#ccfrst-s').textContent = COPY[k][1];
      $$('.ccfrst-seg button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.m === k ? 'true' : 'false'); });
      $$('.ccfrst-pn').forEach(function (p) { p.hidden = p.dataset.pn !== k; });
      $('#ccfrst-gw').style.display = k === 'anon' ? 'none' : '';
      err('');
      if (focus !== false) setTimeout(function () { var f = k === 'login' ? $('#ccfrst-u') : k === 'create' ? $('#ccfrst-cu') : null; try { if (f) f.focus({ preventScroll: true }); } catch (e) {} }, 60);
      m.__mode = k;
    }
    m.__set = setMode;
    $$('.ccfrst-seg button').forEach(function (b) { b.onclick = function () { setMode(b.dataset.m); }; });

    // eye buttons (log in has one field, sign up toggles both)
    $$('.ccfrst-eye').forEach(function (eb) {
      eb.onclick = function () {
        var ids = eb.dataset.eye === 'create' ? ['ccfrst-cp', 'ccfrst-cp2'] : ['ccfrst-p'], first = $('#' + ids[0]), show = first.type === 'password';
        ids.forEach(function (i) { $('#' + i).type = show ? 'text' : 'password'; }); eb.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      };
    });

    var busy = function (btn, on, txt, back) { btn.disabled = on; if (txt) btn.textContent = on ? txt : back; };
    var fail = function (e) { if (e && e.message && !/sign in to continue/i.test(e.message)) err(e.message); };

    $('#ccfrst-form').onsubmit = function (ev) {
      ev.preventDefault(); if (!ready()) return; err('');
      var u = $('#ccfrst-u').value.trim(), p = $('#ccfrst-p').value, b = $('#ccfrst-in');
      if (!u || !p) return err('Enter your username and password');
      busy(b, true, 'Logging in...', 'Log in');
      CC.restoreAccount(u, p).then(function () { say('Welcome back, comrade'); close(true); setTimeout(function () { location.reload(); }, 350); },
        function (e) { busy(b, false, 'Logging in...', 'Log in'); err((e && e.message) || 'That username or password is not right'); });
    };

    function create() {
      if (!ready()) return; err('');
      var u = $('#ccfrst-cu').value.trim(), p = $('#ccfrst-cp').value, b = $('#ccfrst-new');
      if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) return err('Username: 3 to 20 letters, numbers or _');
      if (p.length < 8) return err('The password needs at least 8 characters');
      if (p.toLowerCase() === u.toLowerCase()) return err('The password cannot be your username');
      if (p !== $('#ccfrst-cp2').value) return err('The two passwords do not match');
      busy(b, true, 'Creating...', 'Create account');
      var r; try { r = CC.createAccount('password', { handle: u, password: p }); } catch (e) { busy(b, false, 'Creating...', 'Create account'); return fail(e); }
      r.then(function () { busy(b, false, 'Creating...', 'Create account'); }, function (e) { busy(b, false, 'Creating...', 'Create account'); fail(e); });
    }
    $('#ccfrst-new').onclick = create;
    ['ccfrst-cu', 'ccfrst-cp', 'ccfrst-cp2'].forEach(function (id) { $('#' + id).addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); create(); } }); });

    $('#ccfrst-anon').onclick = function () {
      if (!ready()) return; err('');
      var b = $('#ccfrst-anon'); busy(b, true, 'Creating...', 'Create anonymous account');
      var r; try { r = CC.createAccount('random'); } catch (e) { busy(b, false, 'Creating...', 'Create anonymous account'); return fail(e); }
      r.then(function () { busy(b, false, 'Creating...', 'Create anonymous account'); }, function (e) { busy(b, false, 'Creating...', 'Create anonymous account'); fail(e); });
    };

    $('.ccfrst-x', m).onclick = $('#ccfrst-skip').onclick = function () { close(true); };
    if (window.ccGoogle && ccGoogle.on && ccGoogle.on()) {
      $('#ccfrst-gw').hidden = false;
      try { ccGoogle.mount($('#ccfrst-gb'), function () { say('Signed in with Google'); }, function (t) { err(t || 'Google sign-in failed. Try again.'); }, { theme: 'outline', width: 280 }); } catch (e) {}
    }
    setMode(mode);
    timer = setInterval(function () {                // signed in (any way): the panel is done
      if (signedIn()) { close(true); say('You are in, comrade'); }
    }, 500);
  }
  window.ccAuthPanel = open;

  function first() { if (!seen() && !signedIn()) open('login'); else if (window.ccFirstRunOpen) close(false); }
  if (document.readyState === 'complete') setTimeout(first, 250); else window.addEventListener('load', function () { setTimeout(first, 250); });
})();
