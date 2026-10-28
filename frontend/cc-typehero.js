/* cc-typehero.js v2: the Home headline "Spill it. Nobody will know it was you." types itself out,
   on the website AND inside the Android app. It waits until Home is really on screen (not behind the loading
   or opening screens), types every time you land on Home or come back to the app, and keeps the headline whole.
   Skipped for people who turned animations off. */
(function () {
'use strict';
if (window.__ccTypeHero2) return; window.__ccTypeHero2 = 1;
var typing = 0, armed = 1, full = '';
function shown(el) {
  if (!el) return false;
  var cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.05;
}
function onScreen(h) {
  var r = h.getBoundingClientRect();
  if (!(r.height > 0 && r.bottom > 0 && r.top < innerHeight * 0.92)) return false;
  var v = document.getElementById('v-feed');
  if (!v || !shown(v) || !shown(h)) return false;
  var o = ['ccgate', 'loader', 'lk', 'ccuniv'];
  for (var i = 0; i < o.length; i++) { var e = document.getElementById(o[i]); if (e && shown(e) && e.getBoundingClientRect().height > 0) return false; }
  return true;
}
function type(h) {
  typing = 1; armed = 0;
  var b = document.querySelector('#v-feed .hero .crd-h1b'); if (b) b.remove();
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { typing = 0; return; }
  h.style.minHeight = h.offsetHeight + 'px';
  h.classList.add('cc-typing');
  var i = 0;
  (function tick() {
    if (!h.isConnected) { typing = 0; return; }
    i++; h.textContent = full.slice(0, i);
    if (i < full.length) setTimeout(tick, /[.!?]$/.test(full.slice(0, i)) ? 380 : 55);
    else setTimeout(function () { h.classList.remove('cc-typing'); h.style.minHeight = ''; typing = 0; }, 1200);
  })();
}
function check() {
  if (typing) return;
  var h = document.querySelector('#v-feed .hero h1');
  if (!h) return;
  var t = (h.textContent || '').trim();
  if (!t) return;
  full = t;
  if (!onScreen(h)) { armed = 1; return; }   // left Home or still behind a loading screen: type again when it is back
  if (armed) type(h);
}
var st = document.createElement('style');
st.textContent = '#v-feed .hero h1.cc-typing::after{content:"";display:inline-block;width:.08em;height:.9em;margin-left:.06em;vertical-align:-.08em;background:#FE813C;animation:cctb .8s steps(1) infinite}@keyframes cctb{50%{opacity:0}}';
document.head.appendChild(st);
document.addEventListener('visibilitychange', function () { if (!document.hidden) armed = 1; });
setInterval(check, 500);
})();
