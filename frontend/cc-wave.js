(function () {
  'use strict';
  if (window.__ccWel) return; window.__ccWel = 1;
  var HAND = '<svg class="cwh" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="cwhg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC59A"/><stop offset="1" stop-color="#F4895A"/></linearGradient></defs>'
    + '<g class="cww" fill="url(#cwhg)"><rect x="17" y="12" width="8" height="28" rx="4"/><rect x="25.5" y="7" width="8.5" height="32" rx="4.25"/><rect x="34" y="10" width="8" height="30" rx="4"/><rect x="42" y="17" width="7" height="24" rx="3.5"/><rect x="15" y="28" width="35" height="27" rx="13"/><rect x="6" y="31" width="19" height="8.5" rx="4.25" transform="rotate(-38 15 35)"/></g></svg>';
  function fix(el) {
    if (!el || el.__cw) return; el.__cw = 1;
    var hz = el.querySelector('.hz'); if (hz) hz.remove();
    var cd = el.querySelector('.cd'); if (cd && !cd.querySelector('.cwh')) cd.insertAdjacentHTML('afterbegin', HAND);
    var p = el.querySelector('.bt .p'), g = el.querySelector('.bt .g');
    if (p) { p.classList.remove('p'); p.classList.add('cwp'); }
    if (g) { g.classList.remove('g'); g.classList.add('cwg'); }
  }
  new MutationObserver(function (ms) {
    ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.id === 'cctwl') fix(n); }); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
