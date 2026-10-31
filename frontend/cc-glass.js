/* cc-glass.js v3: tints buttons, chips and badges to their own colour (the glass look).
   v3 (smoothness): never runs while you scroll or tap, works in small idle slices (60 at a time),
   and reads all colours first, then writes, so the browser does not recalculate the page again and again. */
(function () {
'use strict';
if (window.__ccGl) return; window.__ccGl = 1;
var H = document.documentElement;
if (/admin/i.test(location.pathname)) H.classList.add('cc-adm');
function orbs() { [].forEach.call(document.querySelectorAll('.cc-orbs'), function (n) { n.remove(); }); }   /* cc-noballs */
var SEL = 'button,.btn,.ib,#fab,.chip,.pill,.tag,.badge,[class*="badge"],[class*="chip"]';
var SLICE = 60, MAXN = 900;
function rgba(s) { var m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; var p = m[1].split(/[ ,\/]+/).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 && !isNaN(p[3]) ? p[3] : 1 }; }

var quietAt = 0;                                   /* last time the person scrolled or touched the screen */
function busy() { quietAt = Date.now(); }
window.addEventListener('scroll', busy, { passive: true, capture: true });
window.addEventListener('touchmove', busy, { passive: true });
window.addEventListener('touchstart', busy, { passive: true });

var idle = window.requestIdleCallback || function (fn) { return setTimeout(function () { fn({ timeRemaining: function () { return 8; } }); }, 50); };
var list = null, pos = 0, running = false;

function slice(dl) {
  if (Date.now() - quietAt < 250) { setTimeout(function () { idle(slice, { timeout: 1500 }); }, 260); return; }
  var end = Math.min(pos + SLICE, list.length), reads = [], i;
  for (i = pos; i < end; i++) {                    /* read everything first */
    var el = list[i];
    reads.push(el.isConnected ? rgba(getComputedStyle(el).backgroundColor) : null);
  }
  for (i = pos; i < end; i++) {                    /* then write everything */
    var c = reads[i - pos];
    if (c && c.a >= .6) { var e2 = list[i]; e2.setAttribute('data-gs', '1'); e2.style.setProperty('--tint', 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'); }
  }
  pos = end;
  if (pos < list.length) idle(slice, { timeout: 1500 }); else running = false;
}
function tint() {
  if (running) { pos = 0; list = [].slice.call(document.querySelectorAll(SEL), 0, MAXN); return; }   /* restart on a fresh list */
  list = [].slice.call(document.querySelectorAll(SEL), 0, MAXN); pos = 0; running = true;
  idle(slice, { timeout: 1500 });
}
var t = 0, q = function () { clearTimeout(t); t = setTimeout(tint, 900); };
function go() { orbs(); tint(); try { new MutationObserver(q).observe(document.body, { childList: true, subtree: true }); } catch (e) {} }
if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
document.addEventListener('cc-site', q); document.addEventListener('cc-ready', q);
})();
/* the lock screen has no balls either */
