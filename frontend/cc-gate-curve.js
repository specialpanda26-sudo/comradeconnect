/* cc-gate-curve.js v1: Login / Sign up header curve, like the SLATE reference.
   One smooth asymmetric swoosh (deep on the left, sweeping up to the right). The black starts as a full-screen curtain
   and retracts upward into the header while the form fades in under it, step by step. Replaces the frozen curve. */
(function () {
'use strict';
var E = 'cubic-bezier(.7,0,.2,1)';
var D = 'M0 0H100V12C82 30 62 40 40 40C20 40 6 32 0 22Z';
var CSS =
'.sheet::before{display:none!important}' +
'.app .sheet,.app.w .sheet,.app.a .sheet{transform:none!important}' +
'.app.w .sheet,.app.s .sheet{opacity:0;visibility:hidden;pointer-events:none;transition:opacity .3s .7s,visibility 0s 1s,padding-top 1.2s ' + E + '!important}' +
'.app.a .sheet{opacity:1;visibility:visible;transition:opacity .25s,padding-top 1.2s ' + E + '!important}' +
'.app .cv{z-index:2;height:var(--ch)!important;transform-origin:50% 0;will-change:transform}' +
'.app.w .cv,.app.s .cv{transform:scaleY(14);transition:transform .7s cubic-bezier(.5,0,.8,.3),height 1.2s ' + E + '!important}' +
'.app.a .cv{transform:none;transition:transform 1.4s .12s ' + E + ',height 1.2s ' + E + '!important}' +
'.app.a .brand{transition:opacity .6s .5s,top .5s ' + E + '!important}' +
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
setInterval(function () { var h = document.getElementById('ccgate'); if (h && h.shadowRoot) apply(h.shadowRoot); }, 300);
})();
