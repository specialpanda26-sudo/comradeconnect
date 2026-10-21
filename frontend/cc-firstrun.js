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
  var seen = function () { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  var mark = function () { try { localStorage.setItem(KEY, '1'); } catch (e) {} };
  var say = function (t) { try { if (window.ccTools && ccTools.toast) ccTools.toast(t); else if (typeof toast === 'function') toast(t); } catch (e) {} };

  window.ccFirstRunOpen = native && !seen();      // read by the cookie banner timer: wait for this panel first

  var css = document.createElement('style');
  css.textContent = [
    '#ccfrst{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:0;background:var(--bg,#000);overflow:auto;animation:ccfrstin .3s ease}',
    '@keyframes ccfrstin{from{opacity:0;transform:translateY(14px)}}',
    '#ccfrst .ccfrst-b{position:relative;width:100%;max-width:440px;min-height:100%;margin:0 auto;padding:calc(34px + env(safe-area-inset-top,0px)) 22px calc(26px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;justify-content:center}',
    '@media(min-width:700px){#ccfrst{background:rgba(0,0,0,.8)}#ccfrst .ccfrst-b{min-height:0;border-radius:24px;border:1px solid var(--line,rgba(255,255,255,.18));background:var(--bg,#000)}}',
    '#ccfrst .ccfrst-x{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));right:14px;width:38px;height:38px;border-radius:50%;border:1px solid var(--line,rgba(255,255,255,.25));background:rgba(127,127,127,.18);color:inherit;display:grid;place-items:center;padding:0;cursor:pointer}',
    '#ccfrst .ccfrst-x svg{width:18px;height:18px}',
    '#ccfrst img{width:64px;height:64px;border-radius:16px;background:#000;margin:0 0 16px}',
    '#ccfrst h2{margin:0;font-size:clamp(28px,8vw,38px);line-height:1.05;letter-spacing:-.03em;font-weight:700}',
    '#ccfrst p.ccfrst-s{margin:10px 0 22px;font-size:14.5px;line-height:1.6;color:var(--mut,#bdbdbd)}',
    '#ccfrst .btn{width:100%;margin-top:10px}',
    '#ccfrst .ccfrst-g{display:flex;justify-content:center;margin-top:10px;min-height:44px}',
    '#ccfrst .ccfrst-or{margin:14px 0 0;text-align:center;font-size:12px;color:var(--mut,#bdbdbd)}',
    '#ccfrst .ccfrst-sk{display:block;width:100%;margin-top:14px;padding:10px;background:none;border:0;color:var(--mut,#bdbdbd);font:500 14px Poppins,system-ui,sans-serif;cursor:pointer}',
    '#ccfrst .ccfrst-n{margin:14px 0 0;font-size:11.5px;line-height:1.5;color:var(--mut,#bdbdbd);text-align:center}'
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
    m.innerHTML = '<div class="ccfrst-b"><button type="button" class="ccfrst-x" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
      + '<img src="/icon-192.png" alt="" width="64" height="64">'
      + '<h2>Welcome to Comrade Connect</h2>'
      + '<p class="ccfrst-s">The anonymous campus feed for Kirinyaga comrades. Log in, or make an account in a minute. Your stories always stay anonymous.</p>'
      + '<button type="button" class="btn p" id="ccfrst-in">Log in</button>'
      + '<button type="button" class="btn g" id="ccfrst-new">Create account</button>'
      + '<button type="button" class="btn g" id="ccfrst-anon">Create anonymous account</button>'
      + '<div id="ccfrst-gw" hidden><p class="ccfrst-or">or</p><div class="ccfrst-g" id="ccfrst-gb"></div></div>'
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
    $('#ccfrst-in').onclick = run($('#ccfrst-in'), function () { return CC.signIn(); });
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

  function first() { if (native && !seen() && !signedIn()) open(); else if (window.ccFirstRunOpen) close(false); }
  if (document.readyState === 'complete') setTimeout(first, 250); else window.addEventListener('load', function () { setTimeout(first, 250); });
})();
