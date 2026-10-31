/* cc-gate-shuffle.js v1: Get started cards.
   Tapping the cards no longer jumps to the next 3 cards. The three cards on screen shuffle in place: the front card slides to the back
   and the others move up one place, smoothly. Swiping, the dots and the Next button still move between the 3 groups. */
(function () {
'use strict';
var E = 'cubic-bezier(.3,.85,.3,1)';
/* slot 0 = back left, 1 = back right, 2 = front. Same spots the cards always had (art is 300x250, card 140x186). */
var CSS =
'.art .cd{left:0!important;right:auto!important;top:0!important;transition:transform .62s ' + E + ',box-shadow .62s;will-change:transform}' +
'.art .cd[data-sl="0"]{transform:translate(0,52px) rotate(-9deg)!important;z-index:1}' +
'.art .cd[data-sl="1"]{transform:translate(160px,40px) rotate(8deg)!important;z-index:2}' +
'.art .cd[data-sl="2"]{transform:translate(80px,0) rotate(-2deg)!important;z-index:3}' +
'.art .cd.mv{box-shadow:0 22px 30px -14px rgba(0,0,0,.45)}' +
'.art .cd.go{transition:transform .62s ' + E + ',box-shadow .62s}' +
'.art.sh .cd{animation:none!important}' +
'@media(prefers-reduced-motion:reduce){.art .cd{transition-duration:.01s!important}}';

function setup(r) {
  if (!r.getElementById('ccgsh')) { var st = document.createElement('style'); st.id = 'ccgsh'; st.textContent = CSS; r.appendChild(st); }
  var arts = r.querySelectorAll('.gsl .art');
  Array.prototype.forEach.call(arts, function (art) {
    if (art.getAttribute('data-ccsh')) return;
    art.setAttribute('data-ccsh', '1');
    var cards = Array.prototype.slice.call(art.querySelectorAll('.cd'));
    if (cards.length !== 3) return;
    cards.forEach(function (c, i) { c.setAttribute('data-sl', String(i)); });
    var busy = false, x0 = 0, y0 = 0, moved = false;
    art.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; moved = false; }, true);
    art.addEventListener('pointermove', function (e) { if (Math.abs(e.clientX - x0) > 10 || Math.abs(e.clientY - y0) > 10) moved = true; }, true);
    /* capture phase: runs before the old "tap = next group" handler, which then never sees the click */
    art.addEventListener('click', function (e) {
      e.stopImmediatePropagation(); e.stopPropagation();
      if (moved || busy) return;
      busy = true; art.classList.add('sh');
      cards.forEach(function (c) {
        var s = +c.getAttribute('data-sl'), n = (s + 1) % 3;
        if (s === 2) {                                   // the front card slides to the back: drop it behind the others half-way
          c.classList.add('mv');
          setTimeout(function () { c.style.zIndex = '0'; }, 160);
          setTimeout(function () { c.style.zIndex = ''; c.classList.remove('mv'); }, 640);
        }
        c.setAttribute('data-sl', String(n));
      });
      setTimeout(function () { busy = false; }, 460);
    }, true);
  });
}
function check() { var h = document.getElementById('ccgate'); if (h && h.shadowRoot && h.shadowRoot.querySelector('.gsl .art')) { setup(h.shadowRoot); return true; } return false; }
if (!check()) { var mo = new MutationObserver(function () { check(); }); mo.observe(document.documentElement, { childList: true, subtree: true }); }
setInterval(check, 500);   // also covers the gate being rebuilt later
})();
