/* cc-findall.js: the top "Search anything..." box now finds content, not only page names.
   Type 2+ letters and it searches stories, notices, events, market listings and the Explore sections.
   It reads the latest items from the server once per visit (plus anything already on the phone), so it stays quick. */
(function () {
  'use strict';
  if (window.__ccFindAll) return; window.__ccFindAll = 1;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clean(s) { return String(s == null ? '' : s).replace(/\[vn:[^\]]*\]/g, '').replace(/\s+/g, ' ').trim(); }
  function snip(s, q) {
    s = clean(s); if (s.length <= 90) return s;
    var i = s.toLowerCase().indexOf(q); if (i < 0) i = 0;
    var a = Math.max(0, i - 25), b = Math.min(s.length, a + 90);
    return (a > 0 ? '...' : '') + s.slice(a, b) + (b < s.length ? '...' : '');
  }
  var ICON = {
    post: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    market: '<path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    notice: '<path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    event: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    explore: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'
  };
  function svg(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg>'; }

  var cache = { posts: [], listings: [], notices: [], events: [] }, loading = null, loaded = false;
  function getJSON(path) {
    if (typeof CC_API !== 'string' || CC_API.indexOf('YOUR-SUBDOMAIN') > -1) return Promise.resolve(null);
    return fetch(CC_API + path).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function load() {
    if (loading) return loading;
    loading = Promise.all([
      getJSON('/api/posts?page=1&limit=20'), getJSON('/api/posts?page=2&limit=20'), getJSON('/api/posts?page=3&limit=20'),
      getJSON('/api/market/listings?page=1&limit=30'), getJSON('/api/notices'), getJSON('/api/events')
    ]).then(function (r) {
      [r[0], r[1], r[2]].forEach(function (x) { if (x && x.posts) cache.posts = cache.posts.concat(x.posts); });
      if (r[3] && r[3].listings) cache.listings = r[3].listings;
      if (r[4] && r[4].notices) cache.notices = r[4].notices;
      if (r[5] && r[5].events) cache.events = r[5].events;
      loaded = true;
    });
    return loading;
  }

  function localPosts() { try { return typeof db === 'function' ? db() : []; } catch (e) { return []; } }
  function search(q) {
    var m = function (s) { return String(s == null ? '' : s).toLowerCase().indexOf(q) > -1; }, out = [], seen = {};
    var posts = cache.posts.concat(localPosts());
    posts.forEach(function (p) {
      var id = p._id || p.id; if (!p || p.hidden || (id && seen[id])) return; if (id) seen[id] = 1;
      if (m(clean(p.content)) || m(p.category) || m(p.zone)) out.push({ k: 'post', g: 'Stories', t: snip(p.content, q) || ('#' + p.category), s: '#' + (p.category || 'General') + (p.zone ? ' at ' + p.zone : ''), id: id });
    });
    cache.listings.forEach(function (l) {
      if (m(l.title) || m(l.description) || m(l.category) || m(l.zone)) out.push({ k: 'market', g: 'Market', t: l.title, s: (l.price ? 'KSh ' + l.price + ' · ' : '') + (l.category || 'Listing'), id: l.id });
    });
    var nt = cache.notices.map(function (n) { return { t: n.title, b: n.body }; });
    try { (window.ccNT || []).forEach(function (n) { nt.push({ t: n.t, b: n.b }); }); } catch (e) {}
    nt.forEach(function (n) { if (m(n.t) || m(n.b)) out.push({ k: 'notice', g: 'Notices', t: n.t, s: snip(n.b, q) }); });
    cache.events.forEach(function (e) {
      if (m(e.title) || m(e.venue) || m(e.details) || m(e.category)) out.push({ k: 'event', g: 'Events', t: e.title, s: [e.date, e.venue].filter(Boolean).join(' · ') });
    });
    Array.prototype.forEach.call(document.querySelectorAll('#xt button[data-x]'), function (b) {
      var l = clean((b.querySelector('.cct-l') || b).textContent), sub = clean((b.querySelector('.crd-xs') || {}).textContent);
      if (l && (m(l) || m(sub))) out.push({ k: 'explore', g: 'Explore', t: l, s: sub || 'Open in Explore', x: b.getAttribute('data-x') });
    });
    return out;
  }

  var order = ['Explore', 'Stories', 'Market', 'Notices', 'Events'];
  function render(fr, q) {
    var old = fr.querySelector('.ccfx-wrap'); if (old) old.remove();
    var hits = search(q), html = '';
    order.forEach(function (g) {
      var a = hits.filter(function (h) { return h.g === g; }).slice(0, g === 'Stories' ? 8 : 5);
      if (!a.length) return;
      html += '<div style="font:600 12px Poppins,sans-serif;color:var(--mut);padding:12px 12px 4px">' + g + '</div>';
      a.forEach(function (h) {
        html += '<button type="button" class="mit ccfx" data-k="' + h.k + '" data-id="' + esc(h.id || '') + '" data-x="' + esc(h.x || '') + '"><span class="ic">' + svg(h.k) + '</span><span><b>' + esc(h.t) + '</b><small>' + esc(h.s || '') + '</small></span><span class="ch" aria-hidden="true">›</span></button>';
      });
    });
    var none = fr.querySelector('.fe');
    if (!html) {
      if (!loaded && none) none.textContent = 'Searching...';
      return;
    }
    if (none) none.remove();
    var w = document.createElement('div'); w.className = 'ccfx-wrap'; w.innerHTML = html; fr.appendChild(w);
  }

  function nav(v) { var b = $('#tb button[data-v="' + v + '"]'); if (b) b.click(); }
  function open(btn) {
    var k = btn.dataset.k, id = btn.dataset.id, x = btn.dataset.x, c = $('#ccfclose'); if (c) c.click();
    if (k === 'post') {
      nav('feed');
      setTimeout(function () {
        var el = id && document.querySelector('#feed [data-id="' + id + '"]');
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.outline = '2px solid var(--fg)'; setTimeout(function () { el.style.outline = ''; }, 1800); }
      }, 350);
    } else if (k === 'market') nav('market');
    else {
      nav('explore');
      var key = k === 'notice' ? 'nt' : k === 'event' ? 'ev' : x;
      setTimeout(function () { var t = key && $('#xt [data-x="' + key + '"]'); if (t) t.click(); }, 250);
    }
  }

  function init() {
    if (!document.getElementById('ccfx-css')) { var st = document.createElement('style'); st.id = 'ccfx-css'; st.textContent = 'html body #v-explore .crd-hd>.ib{display:none!important}'; document.head.appendChild(st); }
    var fq = $('#ccfq'), fr = $('#ccfr'); if (!fq || !fr || fq.dataset.fa) return; fq.dataset.fa = 1;
    fq.placeholder = 'Search anything...'; fq.setAttribute('aria-label', 'Search anything');
    fr.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.ccfx'); if (!b) return;
      e.stopPropagation(); open(b);
    }, true);
    var run = function () {
      var q = fq.value.trim().toLowerCase(); if (q.length < 2) return;
      render(fr, q);
      if (!loaded) load().then(function () { if (fq.value.trim().toLowerCase() === q) { var none = fr.querySelector('.fe'); render(fr, q); if (!fr.querySelector('.ccfx-wrap') && none && none.isConnected) none.textContent = 'Nothing matches that. Try a different word.'; } });
    };
    fq.addEventListener('input', run);
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#fnd,.crd-search')) load(); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  setTimeout(init, 1500);
})();
