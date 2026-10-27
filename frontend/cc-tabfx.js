/* cc-tabfx.js: bottom tab bar helper. Puts every label in its own span and gives each tab a small dot element,
   so cc-fix9.css can open and close a tab smoothly (the circle grows into a pill and shrinks back with the icon staying centred).
   The page rewrites tab labels at start (Feed becomes Home, Videos becomes Watch), so this watches and re-wraps. */
(function () {
  'use strict';
  if (window.__ccTabFx) return; window.__ccTabFx = 1;
  function tidy(b) {
    [].slice.call(b.childNodes).forEach(function (n) {
      if (n.nodeType !== 3) return;
      var t = (n.nodeValue || '').trim();
      if (!t) { b.removeChild(n); return; }
      var s = document.createElement('span'); s.className = 'tl'; s.textContent = t; b.replaceChild(s, n);
    });
    if (b.querySelector('svg') && !b.querySelector('.td')) { var d = document.createElement('i'); d.className = 'td'; d.setAttribute('aria-hidden', 'true'); b.appendChild(d); }
  }
  function run() { var tb = document.getElementById('tb'); if (!tb) return; [].forEach.call(tb.querySelectorAll('button[data-v]'), tidy); }
  function boot() {
    run();
    var tb = document.getElementById('tb'); if (!tb) return;
    new MutationObserver(run).observe(tb, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
