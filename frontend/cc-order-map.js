/* cc-order-map.js v1: "Meeting spot on map" button on a buyer's open orders (Market > Orders), when the seller pinned a spot.
   Adds only. It reads /api/orders/mine (which already returns lat and lng) and matches each card by position and title,
   so a button can never point at the wrong item. Opens the pin in Maps. Nothing is changed or removed. */
(function () {
  'use strict';
  if (window.__ccOrderMap) return; window.__ccOrderMap = 1;
  var cache = null, at = 0, busy = false, timer = null;
  function ok(v, a) { return typeof v === 'number' && isFinite(v) && Math.abs(v) <= a; }
  function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
  function cards() {
    var list = document.getElementById('olist'); if (!list) return [];
    return Array.prototype.filter.call(list.children, function (c) { return c.classList && c.classList.contains('box'); });
  }
  function load(cb) {
    if (cache && Date.now() - at < 15000) return cb(cache);
    if (busy || !window.ccCall || !signedIn()) return;
    busy = true;
    window.ccCall('/api/orders/mine', { auth: false }).then(function (d) { cache = (d && d.orders) || []; at = Date.now(); busy = false; cb(cache); }, function () { busy = false; });
  }
  function apply(orders) {
    var cs = cards();
    if (!cs.length || cs.length !== orders.length) return;
    cs.forEach(function (c, i) {
      var o = orders[i], h = c.querySelector('h3');
      if (c.getAttribute('data-om') || !h || h.textContent !== o.title) return;
      c.setAttribute('data-om', '1');
      if (o.role !== 'buyer' || (o.status !== 'held' && o.status !== 'handed')) return;
      if (!ok(o.lat, 90) || !ok(o.lng, 180) || (o.lat === 0 && o.lng === 0)) return;
      var a = document.createElement('a');
      a.className = 'btn g om-btn'; a.textContent = 'Meeting spot on map';
      a.href = 'https://www.google.com/maps?q=' + o.lat + ',' + o.lng; a.target = '_blank'; a.rel = 'noopener';
      a.style.cssText = 'text-decoration:none;display:inline-block;margin-top:10px;padding:8px 14px';
      c.appendChild(a);
    });
  }
  function check() {
    timer = null;
    var need = cards().some(function (c) { return !c.getAttribute('data-om'); });
    if (need) load(apply);
  }
  new MutationObserver(function () { if (!timer) timer = setTimeout(check, 300); }).observe(document.body, { childList: true, subtree: true });
  setTimeout(check, 1500);
})();
