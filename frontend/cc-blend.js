/* cc-blend.js v1: finds the main colour of each marketplace photo and tints the card with it.
   - Looks at every card (.mc) that has a photo (img.mm). Cards without a photo stay as they are.
   - Colour is read from a small canvas copy of the photo. If the photo host does not allow that (no CORS), the card simply stays plain.
   - Results are remembered on this phone (localStorage 'cc_blend_v1') so a card is tinted the moment it is drawn.
   - Nothing here touches the page's own code: it only adds a class and CSS variables. window.ccBlend is shared with the item view. */
(function () {
  'use strict';
  if (window.__ccBlend) return; window.__ccBlend = 1;

  var KEY = 'cc_blend_v1', MAX = 240, store = {}, wait = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
  function save() {
    try {
      var k = Object.keys(store);
      if (k.length > MAX) k.slice(0, k.length - MAX).forEach(function (x) { delete store[x]; });
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (e) {}
  }
  var clean = function (u) { return String(u || '').split('#')[0].split('?')[0]; };

  /* pixels (RGBA array) -> [r,g,b]: the most colourful common colour, ignoring white and black backdrops */
  function domColor(d) {
    var bins = {}, ar = 0, ag = 0, ab = 0, n = 0, best = null;
    for (var i = 0; i + 3 < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      var r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      var sat = mx ? (mx - mn) / mx : 0, l = (mx + mn) / 510;
      ar += r; ag += g; ab += b; n++;
      if (l > .93 || l < .07 || (sat < .14 && (l > .8 || l < .2))) continue;   // white, black and grey backdrops
      var w = .15 + sat * sat * 3, key = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5);
      var o = bins[key] || (bins[key] = { w: 0, r: 0, g: 0, b: 0 });
      o.w += w; o.r += r * w; o.g += g * w; o.b += b * w;
    }
    Object.keys(bins).forEach(function (k) { if (!best || bins[k].w > best.w) best = bins[k]; });
    if (best) return [Math.round(best.r / best.w), Math.round(best.g / best.w), Math.round(best.b / best.w)];
    return n ? [Math.round(ar / n), Math.round(ag / n), Math.round(ab / n)] : null;
  }
  function lum(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }

  /* tint strength: softer when the colour would fight the text (very light on dark, very dark on light) */
  function paint(el, c) {
    var l = lum(c), pad = l > .72 ? .4 : l < .12 ? .42 : .5, pal = l < .3 ? .3 : l > .85 ? .46 : .4;
    el.style.setProperty('--pc', c[0] + ',' + c[1] + ',' + c[2]);
    el.style.setProperty('--pad', pad); el.style.setProperty('--pal', pal);
    el.classList.add('cb');
  }

  /* get the colour for a photo url, then call back (sync when it is already known) */
  function color(url, cb) {
    var k = clean(url); if (!k) return;
    if (k in store) { if (store[k]) cb(store[k]); return; }
    if (wait[k]) { wait[k].push(cb); return; }
    wait[k] = [cb];
    var im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
    im.onload = function () {
      var c = null;
      try {
        var cv = document.createElement('canvas'); cv.width = cv.height = 24;
        var cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(im, 0, 0, 24, 24);
        c = domColor(cx.getImageData(0, 0, 24, 24).data);
      } catch (e) { c = null; }
      store[k] = c; save();
      (wait[k] || []).forEach(function (f) { if (c) f(c); }); delete wait[k];
    };
    im.onerror = function () { store[k] = null; delete wait[k]; };
    im.src = url;
  }

  function scan(root) {
    var cards = (root || document).querySelectorAll('.mc:not([data-cb]) img.mm');
    for (var i = 0; i < cards.length; i++) {
      var img = cards[i], card = img.closest('.mc'); if (!card || card.dataset.cb) continue;
      card.dataset.cb = '1';
      (function (card, img) { color(img.currentSrc || img.src, function (c) { paint(card, c); }); })(card, img);
    }
  }

  window.ccBlend = { color: color, paint: paint, dom: domColor };

  var mo = new MutationObserver(function () { scan(); });
  function start() { scan(); mo.observe(document.body, { childList: true, subtree: true }); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
