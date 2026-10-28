/* cc-market-map.js v1: "Map" button in Market > Browse. Opens a full-screen map of every item whose seller pinned a spot.
   Tap a pin to see the item, then View item (opens the normal item sheet) or Open in Maps. "Near me" shows distances.
   Leaflet + OpenStreetMap, free, no key. Adds only: the existing Market screen, grid and item sheet are untouched. */
(function () {
  'use strict';
  if (window.__ccMkMap) return; window.__ccMkMap = 1;
  var CDN = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/', LOCAL = 'vendor/leaflet/';
  var TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', HOME = [-0.5, 37.28], RAD = Math.PI / 180;
  var leafP = null, M = null;

  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function q(s) { return document.querySelector(s); }
  function ok(v, a) { return typeof v === 'number' && isFinite(v) && Math.abs(v) <= a; }
  function pinned(l) { return !!l && ok(l.lat, 90) && ok(l.lng, 180) && !(l.lat === 0 && l.lng === 0); }
  function say(m) { try { window.ccTools.toast(m); } catch (e) {} }
  function kes(n) { try { return ccMk.kes(n); } catch (e) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); } }
  function short(n) { n = Number(n) || 0; return n >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(Math.round(n)); }
  function dist(a, b, c, d) { var p = (c - a) * RAD, r = (d - b) * RAD, x = Math.sin(p / 2) * Math.sin(p / 2) + Math.cos(a * RAD) * Math.cos(c * RAD) * Math.sin(r / 2) * Math.sin(r / 2); return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }
  function fmt(km) { return km < 1 ? 'about ' + Math.max(50, Math.round(km * 20) * 50) + ' m away' : 'about ' + km.toFixed(1) + ' km away'; }

  var css = el('style');
  css.textContent = [
    '#mkov{position:fixed;inset:0;z-index:9500;background:var(--bg);display:flex;flex-direction:column}',
    '#mkov .tp{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 8px}',
    '#mkov .tp b{font-size:16px}#mkov .tp .sub{flex:1;margin:0;font-size:12px}',
    '#mkov .tp button,#mkov .me{flex:none;padding:8px 16px;border-radius:999px;font:500 12px Poppins,sans-serif;color:var(--fg);background:var(--g);border:1px solid var(--gb);cursor:pointer}',
    '#mkmap{flex:1;min-height:0;position:relative;z-index:0}',
    '#mkov .me{position:absolute;right:12px;top:calc(env(safe-area-inset-top,0px) + 64px);z-index:1000;font-weight:600;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}',
    '#mkov .cd{position:absolute;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:1000;max-width:520px;margin:0 auto;padding:12px;border-radius:20px}',
    '#mkov .cd .r{display:flex;gap:12px;align-items:center}#mkov .cd img{width:64px;height:64px;border-radius:12px;object-fit:cover;flex:none;background:var(--g)}',
    '#mkov .cd .t{min-width:0}#mkov .cd .t b{display:block;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#mkov .cd .t span{display:block;font-size:12px;color:var(--mut);margin-top:2px}#mkov .cd .t em{font-style:normal;font-weight:700;font-size:15px}',
    '#mkov .cd .bt{display:flex;gap:8px;margin-top:10px}#mkov .cd .bt .btn{flex:1;text-align:center;text-decoration:none;padding:10px 12px}',
    '.mkpin{background:none;border:0}.mkpin span{position:absolute;transform:translate(-50%,-100%);white-space:nowrap;padding:4px 9px;border-radius:999px;font:700 12px Poppins,sans-serif;background:var(--ink,#000);color:var(--inkfg,#fff);border:2px solid #fff;box-shadow:0 2px 8px rgba(16,20,34,.45)}',
    '.mkpin span.sel{background:#ee7a4f;color:#fff;transform:translate(-50%,-100%) scale(1.15);z-index:9999}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- the map library: the web copy first, the copy inside the Android app as a back-up ---------- */
  function tryLeaf(base) {
    return new Promise(function (res, rej) {
      var l = el('link'); l.rel = 'stylesheet'; l.href = base + 'leaflet.min.css'; document.head.appendChild(l);
      var s = el('script'); s.src = base + 'leaflet.min.js';
      s.onload = function () { if (window.L && window.L.map) res(); else rej(new Error('no map')); };
      s.onerror = function () { rej(new Error('no map')); };
      document.head.appendChild(s);
    });
  }
  function loadLeaflet() {
    if (window.L && window.L.map) return Promise.resolve();
    if (leafP) return leafP;
    leafP = tryLeaf(CDN).catch(function () { return tryLeaf(LOCAL); }).catch(function () { leafP = null; throw new Error('The map could not start. Check your internet and try again.'); });
    return leafP;
  }

  /* ---------- data: every approved item with a pin (30 per page, up to 4 pages) ---------- */
  function fetchAll() {
    var out = [];
    function page(n) {
      return window.ccCall('/api/market/listings?page=' + n + '&limit=30', { auth: false }).then(function (d) {
        out = out.concat((d && d.listings) || []);
        return d && d.hasMore && n < 4 ? page(n + 1) : out;
      });
    }
    return page(1);
  }

  function icon(l, sel) { return L.divIcon({ className: 'mkpin', html: '<span class="' + (sel ? 'sel' : '') + '">' + short(l.price) + '</span>', iconSize: [0, 0], iconAnchor: [0, 0] }); }
  function onKey(e) { if (e.key === 'Escape') closeMap(); }
  function closeMap() {
    if (!M) return;
    try { if (M.map) M.map.remove(); } catch (e) {}
    M.ov.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); M = null;
  }

  function pick(l) {
    if (!M) return;
    if (M.sel && M.markers[M.sel]) M.markers[M.sel].setIcon(icon(M.byId[M.sel], false));
    M.sel = l ? l.id : null;
    var cd = q('#mkcd'); if (!cd) return; cd.textContent = '';
    if (!l) { cd.hidden = true; return; }
    if (M.markers[l.id]) M.markers[l.id].setIcon(icon(l, true));
    var r = el('div', 'r'), t = el('div', 't');
    var ph = l.photos && l.photos[0]; if (ph) { var im = el('img'); im.alt = ''; im.src = ph; r.appendChild(im); }
    t.appendChild(el('b', '', l.title || 'Item')); t.appendChild(el('em', '', kes(l.price)));
    var meta = [l.zone, l.condition].filter(Boolean).join(' \u00b7 ');
    if (M.me) meta += (meta ? ' \u00b7 ' : '') + fmt(dist(M.me.lat, M.me.lng, l.lat, l.lng));
    if (meta) t.appendChild(el('span', '', meta));
    r.appendChild(t); cd.appendChild(r);
    var bt = el('div', 'bt'), v = el('button', 'btn p', 'View item'), m = el('a', 'btn g', 'Open in Maps');
    v.type = 'button'; v.onclick = function () { view(l); };
    m.href = 'https://www.google.com/maps?q=' + l.lat + ',' + l.lng; m.target = '_blank'; m.rel = 'noopener';
    bt.appendChild(v); bt.appendChild(m); cd.appendChild(bt); cd.hidden = false;
  }

  /* opens the normal item sheet through the app's own grid handler; the item is added to the loaded list if it is not there yet, so Buy and Message still work */
  function view(l) {
    var S = window.ccMk && ccMk.S, g = document.getElementById('mgrid');
    if (!S || !S.list || !g) return say('Open this item from Browse.');
    if (!S.list.some(function (x) { return x.id === l.id; })) S.list.push(l);
    closeMap();
    var b = el('button', 'mc'); b.type = 'button'; b.dataset.id = l.id; b.style.display = 'none'; g.appendChild(b); b.click(); b.remove();
  }

  function near() {
    if (!navigator.geolocation) return say('Location is not available here');
    var btn = q('#mkov .me'); if (btn) { btn.disabled = true; btn.textContent = 'Finding you...'; }
    navigator.geolocation.getCurrentPosition(function (p) {
      if (btn) { btn.disabled = false; btn.textContent = 'Near me'; }
      if (!M || !M.map) return;
      var la = p.coords.latitude, ln = p.coords.longitude;
      if (!ok(la, 90) || !ok(ln, 180)) return say('Could not read your location. Try again.');
      M.me = { lat: la, lng: ln };
      if (M.meMark) M.map.removeLayer(M.meMark);
      M.meMark = L.circleMarker([la, ln], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1, interactive: false }).addTo(M.map);
      M.map.setView([la, ln], 15); if (M.sel) pick(M.byId[M.sel]);
    }, function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Near me'; }
      say('Could not get your location. Allow location access and try again.');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  function show(items) {
    var seen = {}, n = q('#mkov-n');
    M.items = items.filter(function (l) { if (!l || seen[l.id] || !pinned(l)) return false; seen[l.id] = 1; M.byId[l.id] = l; return true; });
    M.items.forEach(function (l) {
      var mk = L.marker([l.lat, l.lng], { icon: icon(l, false), title: l.title, keyboard: true }).addTo(M.map);
      mk.on('click', function () { pick(l); }); M.markers[l.id] = mk;
    });
    if (n) n.textContent = M.items.length ? M.items.length + (M.items.length === 1 ? ' item on the map' : ' items on the map') : 'No pinned items yet. Sellers add a pin when they post.';
    if (M.items.length) M.map.fitBounds(L.latLngBounds(M.items.map(function (l) { return [l.lat, l.lng]; })).pad(0.25), { maxZoom: 16 });
  }

  function openMap() {
    if (M) return;
    var ov = el('div'); ov.id = 'mkov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Items on the map');
    ov.innerHTML = '<div class="tp"><b>Items on the map</b><span class="sub" id="mkov-n">Loading map...</span><button type="button" data-m="x">Close</button></div><div id="mkmap"></div><button type="button" class="me" data-m="me">Near me</button><div class="cd g" id="mkcd" hidden></div>';
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    M = { ov: ov, map: null, items: [], byId: {}, markers: {}, sel: null, me: null, meMark: null };
    ov.onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-m]'); if (!b) return; if (b.dataset.m === 'x') closeMap(); else near(); };
    document.addEventListener('keydown', onKey);
    loadLeaflet().then(function () {
      if (!M || M.ov !== ov) return;
      M.map = L.map('mkmap', { zoomControl: true }).setView(HOME, 12);
      L.tileLayer(TILE, { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(M.map);
      M.map.on('click', function () { pick(null); });
      return fetchAll();
    }).then(function (items) { if (items && M && M.ov === ov && M.map) show(items); })
      .catch(function (e) { var n = q('#mkov-n'); if (n) n.textContent = ''; say((e && e.message) || 'Could not load the map pins'); });
  }

  /* ---------- the button: a third choice next to Swipe and Grid; on its own if that toggle is not there ---------- */
  function addButton() {
    var mb = document.getElementById('mbrowse'); if (!mb) return;
    var v = mb.querySelector('.mkv'), b = document.getElementById('mkmapbtn');
    if (!b) {
      b = el('button', '', 'Map'); b.id = 'mkmapbtn'; b.type = 'button'; b.setAttribute('aria-label', 'Map of items'); b.onclick = openMap;
    }
    if (v) { if (b.parentNode !== v) { b.className = ''; b.style.cssText = ''; v.appendChild(b); } }
    else if (!b.parentNode) { b.className = 'btn g'; b.style.cssText = 'width:100%;order:5'; var g = document.getElementById('mgrid'); mb.insertBefore(b, g || null); }
  }
  var tm = null;
  new MutationObserver(function () { if (!tm) tm = setTimeout(function () { tm = null; addButton(); }, 200); }).observe(document.body, { childList: true, subtree: true });
  addButton(); document.addEventListener('DOMContentLoaded', addButton); setTimeout(addButton, 1500);
})();
