/* cc-landing.js v1: the page people see BEFORE logging in. Rotating pictures (set by the admin), "Get started" and "Log in".
   Also: per-tab background pictures from the admin, and a gate so notifications, the guide card and banners wait until the main page. */
(function () {
'use strict';
if (window.__ccLand) return; window.__ccLand = 1;
var H = document.documentElement, KEY = 'cc_land';
var pal = ['#FE813C', '#BC656A', '#727E6E'];
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
+ '#ccl{position:fixed;inset:0;z-index:9600;background:#0E0F0B;color:#fff;font-family:Poppins,system-ui,sans-serif;overflow:hidden;transition:opacity .4s,transform .4s}'
+ '#ccl.out{opacity:0;transform:scale(1.03);pointer-events:none}'
+ '#ccl .i{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.1s ease}'
+ '#ccl .i.on{opacity:1;animation:cclz 7s ease-out forwards}@keyframes cclz{from{transform:scale(1)}to{transform:scale(1.09)}}'
+ '#ccl .sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,15,11,.55) 0,rgba(14,15,11,0) 26%,rgba(14,15,11,0) 40%,rgba(14,15,11,.88) 72%,#0E0F0B 100%)}'
+ '#ccl .top{position:absolute;left:18px;top:calc(16px + env(safe-area-inset-top,0px));display:flex;align-items:center;gap:10px;padding:7px 14px 7px 8px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);font-weight:600;font-size:13px;letter-spacing:.02em}'
+ '#ccl .top img{width:28px;height:28px;border-radius:9px}'
+ '#ccl .bt{position:absolute;left:0;right:0;bottom:0;max-width:480px;margin:0 auto;padding:0 22px calc(22px + env(safe-area-inset-bottom,0px))}'
+ '#ccl .dots{display:flex;gap:6px;margin-bottom:18px}#ccl .dots b{width:7px;height:7px;border-radius:9px;background:rgba(255,255,255,.35);transition:.3s;cursor:pointer}#ccl .dots b.on{width:26px;background:#FE813C}'
+ '#ccl h1{margin:0;font-size:clamp(32px,9.5vw,46px);line-height:1.06;letter-spacing:-.03em;font-weight:700;min-height:2.12em;display:flex;align-items:flex-end}'
+ '#ccl p{margin:10px 0 22px;font-size:14.5px;line-height:1.55;color:rgba(255,255,255,.74);min-height:3.1em}'
+ '#ccl .cap{animation:cclu .5s ease}@keyframes cclu{from{opacity:0;transform:translateY(10px)}}'
+ '#ccl .go{all:unset;box-sizing:border-box;width:100%;text-align:center;cursor:pointer;padding:17px;border-radius:999px;font-weight:700;font-size:16px;color:#0E0F0B;background:linear-gradient(100deg,#FE813C,#f5a06a);box-shadow:0 10px 30px rgba(254,129,60,.35)}'
+ '#ccl .go:active{transform:scale(.98)}'
+ '#ccl .lg{display:block;text-align:center;margin-top:16px;font-size:14px;color:rgba(255,255,255,.7)}#ccl .lg button{all:unset;cursor:pointer;color:#fff;font-weight:700;text-decoration:underline;text-underline-offset:3px}'
+ '#ccl .gu{all:unset;display:block;margin:12px auto 0;cursor:pointer;font-size:12.5px;color:rgba(255,255,255,.5)}'
+ '@media(prefers-reduced-motion:reduce){#ccl .i.on{animation:none}}'
+ '#ccbgi{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity .8s}#ccbgi.on{opacity:.9}#ccbgi:after{content:"";position:absolute;inset:0;background:rgba(14,15,11,.35)}';
document.head.appendChild(st);

/* ---- slides ---- */
var CAPS = [['Spill it. Nobody will know it was you.', 'The anonymous campus feed for Kirinyaga comrades. No name, no trace.'], ['Buy and sell safely.', 'Your money stays in escrow until you confirm the item with your handover code.'], ['Find your people.', 'Roommates, study groups, hostels, events and Kura, all in one place.']];
function caps(C) {
  var a = String(C.landing_captions || '').split('\n').map(function (l) { var p = l.split('|'); return [p[0].trim(), (p[1] || '').trim()]; }).filter(function (p) { return p[0]; });
  return a.length ? a : CAPS;
}
function imgs(C) { var a = []; for (var i = 1; i <= 5; i++) if (https(C['landing_img_' + i])) a.push(C['landing_img_' + i]); return a; }
var L = null, idx = 0, timer = null, slides = [], capList = CAPS;

function grad(i) { var a = pal[i % 3], b = pal[(i + 1) % 3]; return 'radial-gradient(120% 70% at 80% 12%,' + a + ' 0,transparent 60%),radial-gradient(100% 60% at 10% 45%,' + b + '55 0,transparent 65%),#0E0F0B'; }
function build() {
  var C = cfg(); capList = caps(C); var im = imgs(C); slides = im.length ? im : [0, 1, 2];
  L.querySelectorAll('.i').forEach(function (n) { n.remove(); });
  var host = L.querySelector('.sh'), dots = L.querySelector('.dots'); dots.textContent = '';
  slides.forEach(function (s, i) {
    var d = document.createElement('div'); d.className = 'i'; d.style.backgroundImage = im.length ? 'url("' + s + '")' : grad(i);
    L.insertBefore(d, host);
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
  if (L) return;
  L = document.createElement('div'); L.id = 'ccl'; L.setAttribute('role', 'dialog'); L.setAttribute('aria-label', 'Welcome to Comrade Connect');
  L.innerHTML = '<div class="sh"></div><div class="top"><img src="icon-192.png" alt="" width="28" height="28">Comrade Connect</div>'
    + '<div class="bt"><div class="dots"></div><h1></h1><p></p><button type="button" class="go">Get started</button>'
    + '<div class="lg"><span></span><button type="button" data-l>Log in</button></div><button type="button" class="gu">Just looking around</button></div>';
  document.body.appendChild(L); build();
  var x0 = null;
  L.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  L.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 45) go(idx + (dx < 0 ? 1 : -1), true); }, { passive: true });
  L.querySelector('.go').onclick = function () { done(); panel(true); };
  L.querySelector('[data-l]').onclick = function () { done(); panel(false); };
  L.querySelector('.gu').onclick = done;
}
function panel(create) {
  var t = 0, tryOpen = function () {
    if (window.ccAuthPanel) { window.ccAuthPanel(); setTimeout(function () { var b = document.getElementById(create ? 'ccfrst-new' : 'ccfrst-u'); if (b) { if (create) b.click(); else b.focus(); } }, 350); }
    else if (t++ < 20) setTimeout(tryOpen, 250);
  }; tryOpen();
}
function done() {
  mark(); clearInterval(timer);
  if (L) { var n = L; L = null; n.classList.add('out'); setTimeout(function () { n.remove(); }, 450); }
}

/* ---- gate lifts when the loader is gone and this page is closed ---- */
var lift = setInterval(function () {
  if (document.getElementById('loader') || document.getElementById('ccl')) return;
  clearInterval(lift); H.classList.remove('cc-gate'); window.ccIsReady = true;
  try { document.dispatchEvent(new CustomEvent('cc-ready')); } catch (e) {}
}, 300);

/* ---- start ---- */
function start() {
  if (!seen() && !signed() && !cfg().landing_off) { window.__ccFrSeen = 1; try { sessionStorage.setItem('cc_fr', '1'); } catch (e) {} open(); }
}
if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
document.addEventListener('cc-site', function () { if (L) build(); paintBg(); });
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
