/* cc-float.js v2: the robot (Tech) and the Spill button slide out of the way while you scroll down on phones,
   and come back when you scroll up, reach the top or bottom, or stop for a moment. Computers are left alone.
   v2 (smoothness): the scroll handler now runs once per frame, never reads the page height while scrolling,
   and puts the "away" class on the two buttons only, not on <body>, so scrolling no longer restyles the whole page. */
(function () {
  'use strict';
  if (window.__ccFloat) return; window.__ccFloat = 1;

  var st = document.createElement('style');
  st.textContent =
    '@media (prefers-reduced-motion:no-preference){' +
    'html:not([data-lay="desktop"]) body #fab,html:not([data-lay="desktop"]) body #tkr{transition:translate .28s ease,opacity .28s ease}}' +
    'html:not([data-lay="desktop"]) body #fab.ccfl-away{translate:0 90px;opacity:0;pointer-events:none}' +
    'html:not([data-lay="desktop"]) body #tkr.ccfl-away{translate:-86px 0;opacity:0;pointer-events:none}';
  (document.head || document.documentElement).appendChild(st);

  var H = document.documentElement;
  var last = window.pageYOffset || 0, away = false, idle = 0, queued = false, maxY = 0, maxAt = 0;

  function set(on) {
    if (on === away) return;
    away = on;
    var a = document.getElementById('fab'), b = document.getElementById('tkr');
    if (a) a.classList.toggle('ccfl-away', on);
    if (b) b.classList.toggle('ccfl-away', on);
  }
  function menuOpen() {
    var m = document.getElementById('tkb');
    return !!(m && m.classList.contains('on'));
  }
  function pageMax() {                         // reading the height forces layout, so do it at most twice a second
    var now = Date.now();
    if (now - maxAt > 500) { maxAt = now; maxY = H.scrollHeight - window.innerHeight; }
    return maxY;
  }
  function frame() {
    queued = false;
    if (H.dataset.lay === 'desktop') { set(false); return; }
    var y = window.pageYOffset || 0, d = y - last;
    last = y;
    if (y < 80 || menuOpen() || y > pageMax() - 80) { set(false); return; }
    if (d > 6) set(true);
    else if (d < -6) set(false);
    if (away) { clearTimeout(idle); idle = setTimeout(function () { set(false); }, 2500); }
  }
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { maxAt = 0; }, { passive: true });
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest('#tkr,#tkb,#fab')) set(false);                       // tapping the robot brings it back
    if (t.closest('#tb button')) { last = 0; maxAt = 0; set(false); }  // changing tabs: show them again
  });
})();
