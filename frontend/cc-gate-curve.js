/* cc-gate-curve.js v3: Get started, Login and Sign up headers.
   Same brand row, title and subtitle spacing on every page; a gentler swoosh curve that never touches the words.
   The black starts as a full-screen curtain and retracts upward while the form fades in step by step. Colors are untouched. */
(function () {
'use strict';
var E = 'cubic-bezier(.7,0,.2,1)';
var D = 'M0 0H100V22C86 34 68 40 48 40C26 40 8 38 0 32Z';
var CSS =
'.sheet::before{display:none!important}' +
'.app .sheet,.app.w .sheet,.app.a .sheet{transform:none!important}' +
'.app.w .sheet,.app.s .sheet{opacity:0;visibility:hidden;pointer-events:none;transition:opacity .3s .7s,visibility 0s 1s,padding-top 1.2s ' + E + '!important}' +
'.app.a .sheet{opacity:1;visibility:visible;transition:opacity .25s,padding-top 1.2s ' + E + '!important}' +
'.app .sheet{padding-top:calc(var(--ch) + 4px)!important}' +
'.app.a{--ch:272px!important}.app.a.su{--ch:250px!important}' +
'@media(max-height:720px){.app.a{--ch:252px!important}.app.a.su{--ch:232px!important}}' +
'.app .cv{z-index:2;height:var(--ch)!important;transform-origin:50% 0;will-change:transform}' +
'.app.w .cv,.app.s .cv{transform:scaleY(9);transition:transform .7s cubic-bezier(.5,0,.8,.3),height 1.2s ' + E + '!important}' +
'.app.a .cv{transform:none;transition:transform 1.4s .12s ' + E + ',height 1.2s ' + E + '!important}' +
'.app .brand{left:26px!important;top:calc(env(safe-area-inset-top,0px) + 30px)!important}' +
'.app.a .brand{transition:opacity .6s .5s,top .5s ' + E + '!important}' +
'.app .brand .row{gap:12px}' +
'.app .brand b{font-size:12px;letter-spacing:.22em}' +
'.app .brand .bt{margin:36px 0 0;font-size:clamp(28px,8.6vw,35px);line-height:1.04;letter-spacing:-.035em}' +
'.app .brand p{margin:10px 0 0;font-size:15px}' +
'.gt{justify-content:flex-start!important;gap:12px!important;padding:calc(env(safe-area-inset-top,0px) + 30px) 26px 0!important}' +
'@media(prefers-reduced-motion:reduce){.app .cv{transition-duration:.01s!important;transition-delay:0s!important}}';
function apply(r) {
  if (r.getElementById('ccgcv')) return;
  var app = r.querySelector('.app'), p = r.querySelector('.cv path');
  if (!app || !p) return;
  var st = document.createElement('style'); st.id = 'ccgcv'; st.textContent = CSS; r.appendChild(st);
  p.setAttribute('d', D);
  var t = 0;
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      if (/\bw\b/.test(m.oldValue || '') && /\ba\b/.test(app.className)) {
        app.style.setProperty('--b', '.85s');
        clearTimeout(t); t = setTimeout(function () { app.style.setProperty('--b', '0s'); }, 2600);
      }
    });
  }).observe(app, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
}
/* The curtain rules must be in place BEFORE the first paint. Waiting for a 300 ms timer (and a deferred script) let the white sheet with its black
   U-shaped curve show for a moment at launch, ahead of the Comrade Connect splash. A MutationObserver runs before the browser draws. */
function check() { var h = document.getElementById('ccgate'); if (h && h.shadowRoot) { apply(h.shadowRoot); return true; } return false; }
if (!check()) { var mo = new MutationObserver(function () { if (check()) mo.disconnect(); }); mo.observe(document.documentElement, { childList: true, subtree: true }); }
setInterval(check, 300);   // safety net: also covers the gate being rebuilt later
})();
