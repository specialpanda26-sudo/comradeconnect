/* cc-tiles.js v1: turns the word pills for categories into photo tiles with a small caption.
   Pictures: img/tiles/<name>.webp (or .jpg / .png). If a picture is missing the tile shows a soft color until you add it.
   Names: all, tech, books, clothes, furniture, food, services, saved, notices, hosteltea, crush, strikeupdates,
          roommates, studygroups, polls, hearts, topspills, events, search.
   Zones (Kerugoya, Kutus...) and other places stay as words. The page's own click handlers are not touched:
   they read data attributes, and the buttons keep them. */
(function () {
  'use strict';
  if (window.__ccTiles) return; window.__ccTiles = 1;
  var X = { rm: 'roommates', sg: 'studygroups', pl: 'polls', ht: 'hearts', top: 'topspills', nt: 'notices', ev: 'events', sr: 'search' };
  var NICE = { all: 'All', tech: 'Tech', books: 'Books', clothes: 'Clothes', furniture: 'Furniture', food: 'Food', services: 'Services', saved: 'Saved', notices: 'Notices', hosteltea: 'HostelTea', crush: 'Crush', strikeupdates: 'Strike updates', roommates: 'Roommates', studygroups: 'Study groups', polls: 'Polls', hearts: 'Hearts', topspills: 'Top spills', events: 'Events', search: 'Search' };
  var TINT = { all: '#d9e7f0,#eef4f8', tech: '#cfe3f6,#e8f1fa', books: '#f3dcc4,#faeee0', clothes: '#f4d3df,#fbe9ef', furniture: '#e8dccb,#f5eee4', food: '#f6e0b8,#fbf0d9', services: '#d4e6d2,#eaf3e8', saved: '#f3d6d6,#faeaea', notices: '#f6e6b8,#fbf3d8', hosteltea: '#e9d3ee,#f5e8f8', crush: '#f7cfd8,#fce7ec', strikeupdates: '#f3cfc2,#fae6df', roommates: '#d3e3ee,#e8f1f7', studygroups: '#d6dcf0,#eaedf8', polls: '#d2ecdf,#e8f6ef', hearts: '#f7cfd8,#fce7ec', topspills: '#f6e0b8,#fbf0d9', events: '#e3d3f0,#f1e8f8', search: '#d9e7f0,#eef4f8' };
  var RULES = [
    { sel: '#tabs .tab', key: function (b) { return (b.dataset.c || '').toLowerCase(); } },
    { sel: '.mu-cats .mu-cat', key: function (b) { var c = (b.dataset.c || '').toLowerCase(); return c === 'electronics' ? 'tech' : c; } },
    { sel: '#xt .tab', key: function (b) { return X[b.dataset.x] || ''; } }
  ];
  var EXT = ['webp', 'jpg', 'png'];

  function picture(slug) {
    var img = document.createElement('img'), i = 0; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.onerror = function () { i++; if (i < EXT.length) img.src = 'img/tiles/' + slug + '.' + EXT[i]; else img.remove(); };
    img.src = 'img/tiles/' + slug + '.' + EXT[0];
    return img;
  }
  function decorate(b, slug) {
    if (!slug || b.dataset.cct) return;
    b.dataset.cct = slug; b.classList.add('cct');
    var label = NICE[slug] || (b.textContent || '').replace(/^#/, '').trim();
    b.setAttribute('aria-label', label);
    while (b.firstChild) b.removeChild(b.firstChild);
    var t = document.createElement('span'); t.className = 'cct-i'; t.style.setProperty('--t', 'linear-gradient(145deg,' + (TINT[slug] || '#d9e7f0,#eef4f8') + ')');
    t.appendChild(picture(slug));
    var l = document.createElement('span'); l.className = 'cct-l'; l.textContent = label;
    b.appendChild(t); b.appendChild(l);
    if (b.parentNode) b.parentNode.classList.add('cct-row');
  }
  function run() {
    RULES.forEach(function (r) {
      var list = document.querySelectorAll(r.sel);
      for (var i = 0; i < list.length; i++) { try { decorate(list[i], r.key(list[i])); } catch (e) {} }
    });
  }
  var t = 0; function queue() { clearTimeout(t); t = setTimeout(run, 60); }
  function start() {
    run();
    try { new MutationObserver(queue).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    [600, 1800, 4000].forEach(function (ms) { setTimeout(run, ms); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
