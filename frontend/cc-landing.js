/* cc-landing.js v2: the page people see BEFORE logging in. Rotating pictures (set by the admin), "Get started" and "Log in".
   Also: per-tab background pictures from the admin, and a gate so notifications, the guide card and banners wait until the main page.
   Look = the site's Aqua foundation (cc-aqua.css): night #101422, aqua #A8DCE7, slate #272B3B, white. Light and dark both follow the site theme.
   The overlay id is #ccland. It used to be #ccl, which is ALSO the id of the "Join our community" list on the Me page, so the gate below
   never lifted and the robot guide stayed hidden (it showed in the browser only when that list was missing). */
(function () {
'use strict';
if (window.__ccLand) return; window.__ccLand = 1;
var H = document.documentElement, KEY = 'cc_land', ID = 'ccland';
function cfg() { try { return JSON.parse(localStorage.getItem('cc_site_v1') || '{}') || {}; } catch (e) { return {}; } }
function signed() { try { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); } catch (e) { return false; } }
function seen() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return !!window.__ccLs; } }
function mark() { window.__ccLs = 1; try { sessionStorage.setItem(KEY, '1'); } catch (e) {} }
function https(u) { return /^https:\/\/[^\s<>"']+$/i.test(u || ''); }

/* ---- gate: nothing pops up over the loading screen or this page ---- */
H.classList.add('cc-gate');
var st = document.createElement('style');
st.textContent = 'html.cc-gate #tkb,html.cc-gate #cc-banner,html.cc-gate .toast,html.cc-gate #toast,html.cc-gate #ccal,html.cc-gate #ck,html.cc-gate #cch{display:none!important}'
+ '#tkb .ccx-plain,#tkb .ccx-b{display:none!important}'
+ '#ccland{position:fixed;inset:0;z-index:9600;background:var(--bg,#101422);color:var(--fg,#fff);font-family:Poppins,system-ui,sans-serif;overflow:hidden;transition:opacity .4s,transform .4s}'
+ '#ccland.out{opacity:0;transform:scale(1.03);pointer-events:none}'
/* the same soft aqua glow the whole site has behind it */
+ '#ccland:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 52% at 50% -8%,rgba(168,220,231,.2),transparent 62%)}'
+ ':root[data-theme="light"] #ccland:before{background:linear-gradient(180deg,#A8DCE7 0,rgba(168,220,231,.35) 220px,rgba(255,255,255,0) 420px)}'
+ '#ccland .i{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.1s ease}'
+ '#ccland .i.on{opacity:1;animation:cclz 7s ease-out forwards}@keyframes cclz{from{transform:scale(1)}to{transform:scale(1.07)}}'
+ '#ccland .sh{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,transparent 0,transparent 38%,color-mix(in srgb,var(--bg,#101422) 88%,transparent) 70%,var(--bg,#101422) 100%)}'
/* brand mark, only when the admin has not set pictures */
+ '#ccland .hero{position:absolute;left:0;right:0;top:0;bottom:46%;display:grid;place-items:center;pointer-events:none}'
+ '#ccland .hero i{display:block;width:min(46vw,190px);aspect-ratio:440/324;background:url(cc-mark.png) center/contain no-repeat;filter:drop-shadow(0 0 26px rgba(168,220,231,.5));animation:ccllf 6s ease-in-out infinite}'
+ '@keyframes ccllf{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}'
+ '#ccland.pic .hero{display:none}#ccland.pic .top{display:none}#ccland.pic.brand .top{display:flex}'
+ '#ccland .top{position:absolute;left:18px;top:calc(16px + env(safe-area-inset-top,0px));display:flex;align-items:center;gap:10px;padding:7px 16px 7px 8px;border-radius:999px;background:var(--sl,#272B3B);color:var(--fg,#fff);font-weight:600;font-size:13px;letter-spacing:.02em;box-shadow:0 10px 28px rgba(16,20,34,.35)}'
+ ':root[data-theme="light"] #ccland .top{background:#fff;border:1px solid var(--line,rgba(16,20,34,.1));box-shadow:0 10px 28px rgba(16,20,34,.1)}'
+ '#ccland .top img{width:auto;height:22px;border-radius:0;margin-left:4px}'
+ ':root[data-theme="light"] #ccland .hero i,:root[data-theme="light"] #ccland .top img{filter:invert(1)}'
+ '#ccland .bt{position:absolute;left:0;right:0;bottom:0;max-width:480px;margin:0 auto;padding:0 22px calc(22px + env(safe-area-inset-bottom,0px))}'
+ '#ccland .dots{display:flex;gap:6px;margin-bottom:18px}#ccland .dots b{width:7px;height:7px;border-radius:9px;background:color-mix(in srgb,var(--fg,#fff) 28%,transparent);transition:.3s;cursor:pointer}#ccland .dots b.on{width:26px;background:var(--aq,#A8DCE7)}'
+ ':root[data-theme="light"] #ccland .dots b.on{background:var(--nt,#101422)}'
+ '#ccland h1{margin:0;font-family:var(--disp,Unbounded,Poppins,system-ui,sans-serif);font-size:clamp(25px,7.2vw,36px);line-height:1.16;letter-spacing:-.01em;font-weight:700;color:var(--fg,#fff);min-height:3.5em;display:flex;align-items:flex-end}'
+ '#ccland p{margin:12px 0 24px;font-size:14.5px;line-height:1.6;color:var(--mut,rgba(255,255,255,.62));min-height:3.2em}'
+ '#ccland .cap{animation:cclu .5s ease}@keyframes cclu{from{opacity:0;transform:translateY(10px)}}'
/* same pill as every primary button on the site: aqua with night text (night with white text in light mode) */
+ 'html #ccland .go{all:unset;box-sizing:border-box;display:block;width:100%;text-align:center;cursor:pointer;padding:17px;border-radius:999px;font:700 16px Poppins,system-ui,sans-serif;color:var(--inkfg,#101422);background:var(--ink,#A8DCE7) !important;background-image:none !important;border:0 !important;box-shadow:none !important;-webkit-backdrop-filter:none !important;backdrop-filter:none !important;-webkit-tap-highlight-color:transparent}'
+ 'html #ccland .go:active{transform:scale(.98)}html #ccland .go:focus-visible{outline:2px solid var(--fg,#fff);outline-offset:3px}'
+ '#ccland .lg{display:block;text-align:center;margin-top:16px;font-size:14px;color:var(--mut,rgba(255,255,255,.62))}#ccland .lg button{all:unset;cursor:pointer;color:var(--fg,#fff);font-weight:700;text-decoration:underline;text-underline-offset:3px}'
+ '#ccland .gu{all:unset;display:block;margin:12px auto 0;cursor:pointer;font-size:12.5px;color:var(--mut,rgba(255,255,255,.62));opacity:.8}'
+ '@media(prefers-reduced-motion:reduce){#ccland .i.on,#ccland .hero i{animation:none}}'
+ '#ccbgi{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity .8s}#ccbgi.on{opacity:.9}#ccbgi:after{content:"";position:absolute;inset:0;background:rgba(16,20,34,.35)}';
document.head.appendChild(st);

/* ---- slides ---- */
var CAPS = [['Spill it. Nobody will know it was you.', 'The anonymous campus feed for Kirinyaga comrades. No name, no trace.'], ['Buy and sell safely.', 'Your money stays in escrow until you confirm the item with your handover code.'], ['Find your people.', 'Roommates, study groups, hostels, events and Kura, all in one place.']];
function caps(C) {
  var a = String(C.landing_captions || '').split('\n').map(function (l) { var p = l.split('|'); return [p[0].trim(), (p[1] || '').trim()]; }).filter(function (p) { return p[0]; });
  return a.length ? a : CAPS;
}
function imgs(C) { var a = []; for (var i = 1; i <= 5; i++) if (https(C['landing_img_' + i])) a.push(C['landing_img_' + i]); return a; }
var L = null, idx = 0, timer = null, slides = [], capList = CAPS;

function build() {
  var C = cfg(); capList = caps(C); var im = imgs(C); slides = im.length ? im : [0, 1, 2];
  L.classList.toggle('pic', !!im.length); L.classList.toggle('brand', !!C.landing_brand);
  L.querySelectorAll('.i').forEach(function (n) { n.remove(); });
  var host = L.querySelector('.sh'), dots = L.querySelector('.dots'); dots.textContent = '';
  slides.forEach(function (s, i) {
    if (im.length) { var d = document.createElement('div'); d.className = 'i'; d.style.backgroundImage = 'url("' + s + '")'; L.insertBefore(d, host); }
    var b = document.createElement('b'); b.onclick = function () { go(i, true); }; dots.appendChild(b);
  });
  L.querySelector('.go').textContent = C.landing_cta || 'Get started';
  L.querySelector('.lg span').textContent = (C.landing_login_q || 'Already have an account?') + ' ';
  idx = 0; go(0);
}
function go(i, user) {
  idx = (i + slides.length) % slides.length;
  var n = L.querySelectorAll('.i'), d = L.querySelectorAll('.dots b');
  n.forEach(function (e, k) { e.classList.remove('on'); void e.offsetWidth; if (k === idx) e.classList.add('on'); });
  d.forEach(function (e, k) { e.classList.toggle('on', k === idx); });
  var c = capList[idx % capList.length], h = L.querySelector('h1'), p = L.querySelector('p');
  h.textContent = c[0]; p.textContent = c[1]; h.classList.remove('cap'); void h.offsetWidth; h.classList.add('cap');
  clearInterval(timer); timer = setInterval(function () { go(idx + 1); }, 4800);
}
function open() {
  if (window.ccGate) { window.ccGate.welcome(); return; }      // the new Get started cards (cc-gate.js)
  if (L) return;
  L = document.createElement('div'); L.id = ID; L.setAttribute('role', 'dialog'); L.setAttribute('aria-label', 'Welcome to Comrade Connect');
  if (window.ccApp && window.ccApp.native && window.ccAppIntro) {      // the Android app gets the animated cards (cc-appintro.js); the website keeps the page below
    document.body.appendChild(L);
    window.ccAppIntro.mount(L, { caps: caps(cfg()), start: function () { done(); panel('create'); }, login: function () { done(); panel('login'); }, skip: done });
    return;
  }
  L.innerHTML = '<div class="hero" aria-hidden="true"><i></i></div><div class="sh"></div><div class="top"><img src="cc-mark.png" alt="" width="30" height="22">Comrade Connect</div>'
    + '<div class="bt"><div class="dots"></div><h1></h1><p></p><button type="button" class="go">Get started</button>'
    + '<div class="lg"><span></span><button type="button" data-l>Log in</button></div><button type="button" class="gu">Just looking around</button></div>';
  document.body.appendChild(L); build();
  var x0 = null;
  L.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  L.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 45) go(idx + (dx < 0 ? 1 : -1), true); }, { passive: true });
  L.querySelector('.go').onclick = function () { done(); panel('create'); };
  L.querySelector('[data-l]').onclick = function () { done(); panel('login'); };
  L.querySelector('.gu').onclick = done;
}
/* ONE sign-in panel with a switch (Log in / Sign up). Get started opens it on Sign up, Log in opens it on Log in. */
function panel(mode) {
  var t = 0, tryOpen = function () {
    if (window.ccAuthPanel) window.ccAuthPanel(mode);
    else if (t++ < 20) setTimeout(tryOpen, 250);
  }; tryOpen();
}
function done() {
  mark(); clearInterval(timer);
  if (L) { var n = L; L = null; n.classList.add('out'); setTimeout(function () { n.remove(); }, 450); }
}

/* ---- gate lifts when the loader is gone and this page is closed ---- */
var lift = setInterval(function () {
  if (document.getElementById('loader') || document.getElementById('ccgate') || document.getElementById(ID)) return;
  clearInterval(lift); H.classList.remove('cc-gate'); window.ccIsReady = true;
  try { document.dispatchEvent(new CustomEvent('cc-ready')); } catch (e) {}
}, 300);

/* ---- start ---- */
function start() {
  if (!seen() && !signed() && !cfg().landing_off) { window.__ccFrSeen = 1; try { sessionStorage.setItem('cc_fr', '1'); } catch (e) {} open(); }
}
if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
document.addEventListener('cc-site', function () { if (L && !L.classList.contains('ccapp')) build(); paintBg(); });
window.ccLanding = { open: function () { open(); }, close: done };

/* ---- admin pictures behind each tab ---- */
function paintBg() {
  var C = cfg(), bg = document.querySelector('.bg'); if (!bg) return;
  var b = document.querySelector('#tb button.on[data-v]'), v = (b && b.dataset.v) || 'feed', u = C['bg_' + v] || C.bg_all;
  var el = document.getElementById('ccbgi');
  if (!https(u)) { if (el) el.classList.remove('on'); return; }
  if (!el) { el = document.createElement('div'); el.id = 'ccbgi'; bg.appendChild(el); }
  if (el.dataset.u !== u) { el.dataset.u = u; el.style.backgroundImage = 'url("' + u + '")'; }
  el.classList.add('on');
}
window.addEventListener('load', function () {
  paintBg(); var tb = document.getElementById('tb');
  if (tb) new MutationObserver(paintBg).observe(tb, { attributes: true, subtree: true, attributeFilter: ['class'] });
});
})();
