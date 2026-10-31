/* cc-smooth.js v1: WhatsApp-style feel. Instant taps, a soft press effect, no 300 ms tap delay,
   no grey tap flash, no rubber-band bounce that drags the whole page, and calm timers.
   Only touches phones and tablets. Safe to delete (remove its <script> and <link> lines to undo). */
(function () {
  'use strict';
  if (window.__ccSmooth) return; window.__ccSmooth = 1;
  var st = document.createElement('style');
  st.textContent =
    'html{-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%}' +
    'a,button,[role="button"],.btn,.ib,.chip,.pill,#tb button,label,summary,select{touch-action:manipulation}' +
    '@media (hover:none) and (prefers-reduced-motion:no-preference){' +
      'button,.btn,.ib,#tb button{transition:transform .12s ease,opacity .12s ease}' +
      'button:active,.btn:active,.ib:active,#tb button:active{transform:scale(.96);opacity:.88}}' +
    '@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}';
  (document.head || document.documentElement).appendChild(st);

  /* Pause any page timer that only needs to run while the app is on screen: they sleep when the tab is hidden. */
  var si = window.setInterval;
  window.setInterval = function (fn, ms) {
    var a = [].slice.call(arguments, 2);
    if (typeof fn !== 'function' || !(ms >= 400 && ms <= 2600)) return si.apply(window, arguments);
    return si.apply(window, [function () { if (!document.hidden) fn.apply(this, a); }, ms]);
  };
})();
