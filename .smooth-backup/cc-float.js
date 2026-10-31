/* cc-float.js v1: the robot (Tech) and the Spill button no longer sit on top of feed content.
   On phones they slide out of the way while you scroll down and come back when you scroll up,
   reach the top or bottom, or stop for a moment. Computers (side menu layout) are left alone.
   The robot menu stays put while it is open. */
(function () {
  'use strict';
  if (window.__ccFloat) return; window.__ccFloat = 1;

  var st = document.createElement('style');
  st.textContent =
    '@media (prefers-reduced-motion:no-preference){' +
    'html:not([data-lay="desktop"]) body #fab{transition:translate .28s ease,opacity .28s ease}' +
    'html:not([data-lay="desktop"]) body #tkr{transition:translate .28s ease,opacity .28s ease}}' +
    'html:not([data-lay="desktop"]) body.ccfl-away #fab{translate:0 90px;opacity:0;pointer-events:none}' +
    'html:not([data-lay="desktop"]) body.ccfl-away #tkr{translate:-86px 0;opacity:0;pointer-events:none}';
  (document.head || document.documentElement).appendChild(st);

  var last = window.pageYOffset || 0, away = false, idle = null;

  function set(on) {
    if (on === away) return;
    away = on;
    document.body.classList.toggle('ccfl-away', on);
  }
  function menuOpen() {
    var m = document.getElementById('tkb');
    return !!(m && m.classList.contains('on'));
  }
  function onScroll() {
    if (document.documentElement.dataset.lay === 'desktop') { set(false); return; }
    var y = window.pageYOffset || 0, d = y - last;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    last = y;
    if (menuOpen() || y < 80 || y > h - 80) { set(false); return; }   // top, bottom or robot menu open: show them
    if (d > 6) set(true);                                              // scrolling down: out of the way
    else if (d < -6) set(false);                                       // scrolling up: back
    clearTimeout(idle);
    idle = setTimeout(function () { set(false); }, 2500);              // stopped for a moment: back
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('click', function (e) {                    // tapping the robot always brings it back
    if (e.target.closest && e.target.closest('#tkr,#tkb,#fab')) set(false);
  });
  document.addEventListener('click', function (e) {                    // changing tabs: show them again
    if (e.target.closest && e.target.closest('#tb button')) { last = 0; set(false); }
  });
})();
