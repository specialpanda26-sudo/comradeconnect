/* cc-welcome.js v1: a big "Welcome to Comrade Connect" banner with the logo, at the top of the Feed for new people.
   It shows until it is closed (X, Maybe later or Get started) and then stays away. No emojis: the real logo only. */
(function () {
  'use strict';
  if (window.__ccWelcome) return; window.__ccWelcome = 1;
  var KEY = 'cc_wb';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var dismissed = function () { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  var signedIn = function () { try { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); } catch (e) { return false; } };
  var isNew = function () { if (!signedIn()) return true; try { return Date.now() - (ME.joined || 0) < 7 * 864e5; } catch (e) { return false; } };   // signed out, or an account under a week old

  var css = document.createElement('style');
  css.textContent = [
    '#ccwb{position:relative;margin:0 0 26px;padding:26px 22px 24px;border-radius:28px;animation:ccwbin .6s ease both}',
    '@keyframes ccwbin{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}',
    '#ccwb .ccwb-logo{width:clamp(96px,28vw,150px);display:block;margin:0 0 16px}',
    '#ccwb .ccwb-k{margin:0 0 4px;font-size:15px;font-weight:500;color:var(--fg);letter-spacing:.02em}',
    '#ccwb .ccwb-t{margin:0;font-size:clamp(44px,13.5vw,84px);font-weight:700;letter-spacing:-.04em;line-height:.98;background:linear-gradient(90deg,var(--fg) 42%,#9a9a9a);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none!important}',
    '#ccwb .ccwb-s{margin:14px 0 0;max-width:460px;font-size:14.5px;line-height:1.7}',
    '#ccwb .ccwb-b{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}',
    '#ccwb .ccwb-b .btn{flex:1 1 150px}',
    '#ccwb .ccwb-x{position:absolute;top:12px;right:12px;width:38px;height:38px;border-radius:50%;border:1px solid var(--line,rgba(255,255,255,.25));background:rgba(127,127,127,.2);color:inherit;display:grid;place-items:center;padding:0;cursor:pointer}',
    '#ccwb .ccwb-x svg{width:18px;height:18px}'
  ].join('');
  document.head.appendChild(css);

  function close(save) {
    var b = $('#ccwb'); if (!b) return;
    if (save) { try { localStorage.setItem(KEY, '1'); } catch (e) {} }
    b.style.transition = 'opacity .25s, transform .25s'; b.style.opacity = '0'; b.style.transform = 'translateY(-8px)';
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 260);
  }
  function show() {
    var hero = $('#v-feed .hero');
    if (!hero || $('#ccwb') || dismissed() || !isNew()) return;
    var b = document.createElement('section'); b.id = 'ccwb'; b.className = 'g'; b.setAttribute('aria-label', 'Welcome to Comrade Connect');
    b.innerHTML = '<button type="button" class="ccwb-x" aria-label="Close welcome banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
      + '<span class="lgo ccwb-logo" role="img" aria-label="Comrade Connect logo"></span>'
      + '<p class="ccwb-k">Welcome to</p><h2 class="ccwb-t">Comrade Connect</h2>'
      + '<p class="ccwb-s">The anonymous campus feed for Kirinyaga comrades. Spill the tea, buy and sell safely, and meet people who get it.</p>'
      + '<div class="ccwb-b"><button type="button" class="btn p" id="ccwb-go">' + (signedIn() ? 'Start spilling' : 'Create my account') + '</button><button type="button" class="btn g" id="ccwb-no">Maybe later</button></div>';
    hero.insertBefore(b, hero.firstChild);
    try {                                                                 // the logo picture lives on the nav logo: reuse exactly that
      var src = $('nav .nb .lgo'), lg = $('.ccwb-logo', b), cs = src && getComputedStyle(src);
      if (cs) {
        var mask = cs.webkitMaskImage || cs.maskImage;
        lg.style.background = 'var(--fg)'; lg.style.aspectRatio = '440 / 324';
        lg.style.webkitMaskImage = mask; lg.style.maskImage = mask;
        lg.style.webkitMaskRepeat = 'no-repeat'; lg.style.maskRepeat = 'no-repeat'; lg.style.webkitMaskSize = 'contain'; lg.style.maskSize = 'contain'; lg.style.webkitMaskPosition = 'left center'; lg.style.maskPosition = 'left center';
      }
    } catch (e) {}
    $('.ccwb-x', b).onclick = function () { close(true); };
    $('#ccwb-no', b).onclick = function () { close(true); };
    $('#ccwb-go', b).onclick = async function () {
      if (signedIn()) { close(true); return; }
      if (window.ccAuthPanel) {                                           // the same Log in / Create account panel as first open
        window.ccAuthPanel();
        var t = setInterval(function () { if (signedIn()) { clearInterval(t); close(true); } }, 700);
        setTimeout(function () { clearInterval(t); }, 600000);
        return;
      }
      try { if (window.CC && CC.ensureAccount) { await CC.ensureAccount(); close(true); } }
      catch (e) { try { toast((e && e.message) || 'Could not create the account. Try again.'); } catch (x) {} }   // cancelled or failed: the banner stays
    };
  };
  window.addEventListener('load', function () { setTimeout(show, 80); });
  if (document.readyState === 'complete') setTimeout(show, 80);
})();
