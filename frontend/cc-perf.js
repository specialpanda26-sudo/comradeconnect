/* cc-perf.js: keeps the site smooth. Loads first in <head>.
   Groups the whole-page watchers so they run together, a little later, and not while the tab is hidden. */
(function () {
  'use strict';
  if (window.__ccPerf) return; window.__ccPerf = 1;
  var RMO = window.MutationObserver; if (!RMO) return;
  var GAP = 180;
  function TMO(cb) {
    var self = this, buf = [], t = 0, last = 0, wide = false;
    function flush() {
      t = 0; last = Date.now();
      if (!buf.length) return;
      var r = buf; buf = [];
      try { cb.call(self, r, self); } catch (e) { setTimeout(function () { throw e; }, 0); }
    }
    function sched() {
      if (t) return;
      var w = Math.max(0, GAP - (Date.now() - last));
      if (document.hidden) w = Math.max(w, 1500);
      t = setTimeout(flush, w);
    }
    var real = new RMO(function (recs) {
      if (!wide) { try { cb.call(self, recs, self); } catch (e) { setTimeout(function () { throw e; }, 0); } return; }
      for (var i = 0; i < recs.length; i++) buf.push(recs[i]);
      sched();
    });
    this.observe = function (target, opts) { wide = !!(opts && opts.subtree); return real.observe(target, opts); };
    this.disconnect = function () { clearTimeout(t); t = 0; buf = []; return real.disconnect(); };
    this.takeRecords = function () { var r = buf.concat(real.takeRecords()); buf = []; return r; };
  }
  window.MutationObserver = TMO;

  function lazy() {
    try {
      var im = document.images;
      for (var i = 0; i < im.length; i++) {
        var p = im[i];
        if (!p.hasAttribute('loading') && !(p.getRootNode && p.getRootNode() !== document)) p.setAttribute('loading', 'lazy');
        if (!p.hasAttribute('decoding')) p.setAttribute('decoding', 'async');
      }
    } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', function () { lazy(); setTimeout(lazy, 2500); });
  window.addEventListener('load', function () {
    var bd = document.body, v = bd && bd.getAttribute('data-view');
    if (bd) new RMO(function () { var n = bd.getAttribute('data-view'); if (n !== v) { v = n; setTimeout(lazy, 300); } }).observe(bd, { attributes: true, attributeFilter: ['data-view'] });
  });
})();
