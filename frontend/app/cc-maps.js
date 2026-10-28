/* cc-maps.js v1: real maps for the app. Leaflet + OpenStreetMap (free, no key). Loaded last.
   Market: seller meeting pin, real Map tab, map on item, pay sheet and orders. Wi-Fi: free Wi-Fi map with speed (up to 100 Mbps), trace, share form.
   It only wraps existing actions. Nothing is removed. */
(function () {
'use strict';
if (window.ccMaps) return;
var LEAF = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/', TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', HOME = [-0.5, 37.28];
var ME = null, leafP = null, OV = null, PIN = null, PAY = null, RAD = Math.PI / 180;
var q = function (s, r) { return (r || document).querySelector(s); };
var qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function say(m) { try { toast(m); } catch (e) {} }
function icon(n) { try { return ic(n, 's'); } catch (e) { return ''; } }
function signedIn() { try { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); } catch (e) { return false; } }
function needAcct() { say('Sign up first. Then tap it again.'); try { A.signup(); } catch (e) {} }
function okLL(la, ln) { return typeof la === 'number' && typeof ln === 'number' && isFinite(la) && isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180 && !(la === 0 && ln === 0); }
function r5(x) { return Math.round(x * 1e5) / 1e5; }
function call(method, path, body) {
  var o = { method: method }; if (body) { o.headers = { 'Content-Type': 'application/json' }; o.body = JSON.stringify(body); }
  return fetch(CC_API + path, o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error((d && d.error) || 'Something went wrong. Try again.'); e.status = r.status; throw e; } return d; }); }, function () { throw new Error('Could not reach the server. Check your internet and try again.'); });
}
function loadLeaflet() {
  if (window.L && L.map) return Promise.resolve();
  if (leafP) return leafP;
  leafP = new Promise(function (res, rej) {
    if (!q('link[data-ccleaf]')) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LEAF + 'leaflet.min.css'; l.setAttribute('data-ccleaf', '1'); document.head.appendChild(l); }
    var s = document.createElement('script'); s.src = LEAF + 'leaflet.min.js';
    s.onload = function () { if (window.L && L.map) res(); else { leafP = null; rej(new Error('The map could not start. Try again.')); } };
    s.onerror = function () { leafP = null; rej(new Error('Could not load the map. Check your internet and try again.')); };
    document.head.appendChild(s);
  });
  return leafP;
}
function locate(fresh) {
  return new Promise(function (res, rej) {
    if (!navigator.geolocation) return rej(new Error('Location is not available here. Use your phone.'));
    navigator.geolocation.getCurrentPosition(function (p) {
      var la = p.coords.latitude, ln = p.coords.longitude;
      if (!okLL(la, ln)) return rej(new Error('Could not read your location. Try again.'));
      ME = { lat: la, lng: ln, acc: Math.round(p.coords.accuracy || 0) }; res(ME);
    }, function (e) { rej(new Error(e && e.code === 1 ? 'Location is blocked. Allow location for Comrade Connect in your phone settings.' : 'Could not get your location. Switch on GPS and try again.')); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: fresh ? 0 : 30000 });
  });
}
function hav(a, b) { var x = (b.lat - a.lat) * RAD, y = (b.lng - a.lng) * RAD, h = Math.sin(x / 2) * Math.sin(x / 2) + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(y / 2) * Math.sin(y / 2); return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
function bearing(a, b) { var y = Math.sin((b.lng - a.lng) * RAD) * Math.cos(b.lat * RAD), x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lng - a.lng) * RAD); return (Math.atan2(y, x) / RAD + 360) % 360; }
var DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
function dtxt(km) { return km < 1 ? Math.max(10, Math.round(km * 100) * 10) + ' m' : km.toFixed(1) + ' km'; }
function trace(p) { if (!ME || !okLL(p.lat, p.lng)) return ''; var km = hav(ME, p); return dtxt(km) + ' ' + DIRS[Math.round(bearing(ME, p) / 45) % 8] + (km < 5 ? ' · about ' + Math.max(1, Math.round(km * 12)) + ' min walk' : ''); }
function dir(la, ln) { window.open('https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=' + la + ',' + ln, '_blank', 'noopener'); }
function mbpsOf(w) {
  if (w && typeof w.mbps === 'number') return w.mbps;
  var m = /(\d+(?:\.\d+)?)\s*mbps/i.exec((w && w.speed_note) || ''); if (m) return Math.min(1000, parseFloat(m[1]));
  if (w && w.packages && w.packages.length) return w.packages.reduce(function (a, p) { return Math.max(a, +p.mbps || 0); }, 0) || null;
  return null;
}
function pinIcon(k) {
  return L.divIcon({ className: 'ccpw', html: '<div class="ccp ' + (k.cls || '') + (k.on ? ' on' : '') + '"><span>' + (k.glyph ? icon(k.glyph) : '') + '</span></div>' + (k.tag ? '<em>' + esc(k.tag) + '</em>' : ''), iconSize: [46, 58], iconAnchor: [23, 54] });
}

/* ---------- the map controller ---------- */
function makeMap(el, o) {
  o = o || {};
  var c = { map: null, markers: {}, pins: {}, sel: null, meMark: null, meCirc: null, line: null, watch: null, onPick: o.onPick, onTrace: null };
  c.ready = loadLeaflet().then(function () {
    var st = !!o.still;
    var map = L.map(el, { zoomControl: false, dragging: !st, touchZoom: !st, doubleClickZoom: !st, scrollWheelZoom: !st, boxZoom: false, keyboard: !st }).setView(o.center || (ME ? [ME.lat, ME.lng] : HOME), o.zoom || (ME ? 15 : 13));
    if (!st) L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer(TILE, { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    c.map = map; setTimeout(function () { try { map.invalidateSize(); } catch (e) {} }, 120);
    if (ME) c.drawMe();
    return c;
  });
  c.setPins = function (pins, selId) {
    return c.ready.then(function () {
      Object.keys(c.markers).forEach(function (k) { c.map.removeLayer(c.markers[k]); }); c.markers = {}; c.pins = {};
      pins.forEach(function (p) {
        if (!okLL(p.lat, p.lng)) return; c.pins[p.id] = p;
        var mk = L.marker([p.lat, p.lng], { icon: pinIcon(Object.assign({}, p, { on: String(p.id) === String(selId) })), keyboard: false, title: p.title || '' }).addTo(c.map);
        mk.on('click', function () { c.pick(p.id, true); }); c.markers[p.id] = mk;
      });
      c.sel = selId != null && c.pins[selId] ? String(selId) : null; return c;
    });
  };
  c.pick = function (id, fire) {
    var old = c.sel; c.sel = id == null ? null : String(id);
    [old, c.sel].forEach(function (k) { if (k != null && c.markers[k]) c.markers[k].setIcon(pinIcon(Object.assign({}, c.pins[k], { on: k === c.sel }))); });
    if (c.sel && c.pins[c.sel]) c.map.panTo([c.pins[c.sel].lat, c.pins[c.sel].lng]);
    if (fire && c.onPick) c.onPick(c.sel ? c.pins[c.sel] : null);
  };
  c.fit = function (mz) {
    return c.ready.then(function () {
      var pts = Object.keys(c.pins).map(function (k) { return [c.pins[k].lat, c.pins[k].lng]; }); if (ME) pts.push([ME.lat, ME.lng]);
      if (!pts.length) return; if (pts.length === 1) c.map.setView(pts[0], mz || 16); else c.map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: mz || 17 });
    });
  };
  c.drawMe = function () {
    if (!ME || !c.map) return; var ll = [ME.lat, ME.lng];
    if (c.meMark) c.meMark.setLatLng(ll); else c.meMark = L.marker(ll, { icon: L.divIcon({ className: 'ccpw', html: '<div class="ccme"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false }).addTo(c.map);
    if (ME.acc && ME.acc < 500) { if (c.meCirc) { c.meCirc.setLatLng(ll); c.meCirc.setRadius(ME.acc); } else c.meCirc = L.circle(ll, { radius: ME.acc, color: '#5c6d56', weight: 1, fillColor: '#5c6d56', fillOpacity: .12, interactive: false }).addTo(c.map); }
  };
  c.goMe = function () { return locate(true).then(function () { return c.ready; }).then(function () { c.drawMe(); c.map.setView([ME.lat, ME.lng], Math.max(c.map.getZoom(), 16)); return ME; }); };
  c.traceTo = function (p, on) {
    if (c.line && c.map) { c.map.removeLayer(c.line); } c.line = null;
    if (c.watch != null) { try { navigator.geolocation.clearWatch(c.watch); } catch (e) {} c.watch = null; }
    if (!on || !p || !c.map) return;
    function draw() { var pts = [[ME.lat, ME.lng], [p.lat, p.lng]]; if (c.line) c.line.setLatLngs(pts); else c.line = L.polyline(pts, { color: '#5c6d56', weight: 4, dashArray: '2 9', lineCap: 'round' }).addTo(c.map); c.drawMe(); if (c.onTrace) c.onTrace(p); }
    draw(); c.map.fitBounds(L.latLngBounds([[ME.lat, ME.lng], [p.lat, p.lng]]).pad(0.35), { maxZoom: 18 });
    c.watch = navigator.geolocation.watchPosition(function (g) { if (okLL(g.coords.latitude, g.coords.longitude)) { ME = { lat: g.coords.latitude, lng: g.coords.longitude, acc: Math.round(g.coords.accuracy || 0) }; draw(); } }, function () {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  };
  c.destroy = function () { c.traceTo(null, false); try { if (c.map) c.map.remove(); } catch (e) {} c.map = null; };
  return c;
}

/* ---------- full-screen map (used by Wi-Fi, hostels, a single place, and the pin picker) ---------- */
function closeOverlay() { if (!OV) return; try { OV.ctl.destroy(); } catch (e) {} if (OV.el.parentNode) OV.el.parentNode.removeChild(OV.el); OV = null; document.removeEventListener('keydown', onKey); }
function onKey(e) { if (e.key === 'Escape') closeOverlay(); }
function shell(title, mid) {
  var el = document.createElement('div'); el.className = 'ccm-ov'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', title);
  el.innerHTML = '<div class="ccm-top"><div><b>' + esc(title) + '</b><span class="ccm-n"></span></div><button type="button" class="rb sm" data-cc="close" aria-label="Close">' + icon('x') + '</button></div>' + mid;
  (q('.phone') || document.body).appendChild(el); document.addEventListener('keydown', onKey); return el;
}
function openOverlay(cfg) {
  closeOverlay();
  var chips = function (cls, arr) { return '<div class="chips ' + cls + '">' + arr.map(function (c, i) { return '<button type="button" class="chip' + (i === 0 ? ' on' : '') + '" data-cc="' + (cls === 'ccm-k' ? 'kind' : 'spdf') + '" data-k="' + esc(c[0]) + '">' + esc(c[1]) + '</button>'; }).join('') + '</div>'; };
  var el = shell(cfg.title, (cfg.kinds ? chips('ccm-k', cfg.kinds) : '') + (cfg.speeds ? chips('ccm-s', [['0', 'Any speed'], ['10', '10+ Mbps'], ['25', '25+ Mbps'], ['50', '50+ Mbps'], ['100', '100 Mbps']]) : '') + '<div class="ccm-body"><div class="ccm-map"></div><button type="button" class="ccm-me" data-cc="me">' + icon('pin') + ' Near me</button><div class="ccm-card" hidden></div></div>');
  OV = { el: el, cfg: cfg, all: [], kind: cfg.kinds ? cfg.kinds[0][0] : '', minSpd: 0, sel: null, tracing: null, shown: {}, focus: cfg.focus != null ? String(cfg.focus) : null };
  OV.ctl = makeMap(q('.ccm-map', el), { onPick: function (p) { OV.sel = p ? String(p.id) : null; stopTrace(); showCard(p); } });
  OV.ctl.ready.then(function (c) { c.map.on('click', function () { if (OV) { c.pick(null); OV.sel = null; stopTrace(); showCard(null); } }); }, function (e) { say(e.message); closeOverlay(); });
  ovLoad();
  if (navigator.permissions && navigator.permissions.query) { try { navigator.permissions.query({ name: 'geolocation' }).then(function (s) { if (s.state === 'granted' && OV && !ME) locate().then(function () { if (OV) { OV.ctl.ready.then(function (c) { c.drawMe(); }); if (OV.sel) showCard(OV.ctl.pins[OV.sel]); } }, function () {}); }); } catch (e) {} }
}
function ovLoad() {
  var o = OV, n = q('.ccm-n', o.el); n.textContent = ' · Loading...';
  Promise.resolve(o.cfg.load(o.kind)).then(function (pins) { if (OV !== o) return; o.all = pins.filter(function (p) { return okLL(p.lat, p.lng); }); ovShow(true); }, function (e) { if (OV === o) n.textContent = ''; say(e.message || 'Could not load the map'); });
}
function ovShow(first) {
  var o = OV, list = o.all.filter(function (p) { return !o.minSpd || (p.mbps != null && p.mbps >= o.minSpd); });
  q('.ccm-n', o.el).textContent = list.length ? ' · ' + list.length + (list.length === 1 ? ' place' : ' places') : ' · none here yet';
  var want = first && o.focus && list.filter(function (p) { return String(p.id) === o.focus; })[0] ? o.focus : (o.sel && list.filter(function (p) { return String(p.id) === o.sel; })[0] ? o.sel : null);
  o.ctl.setPins(list, want).then(function (c) {
    if (OV !== o) return; o.sel = want;
    if (first && want && o.focus) { c.map.setView([c.pins[want].lat, c.pins[want].lng], 17); o.focus = null; } else if (first) c.fit();
    showCard(want ? c.pins[want] : null);
  });
}
function stopTrace() { if (OV) { OV.tracing = null; OV.ctl.traceTo(null, false); } }
function showCard(p) {
  if (!OV) return; var c = q('.ccm-card', OV.el); if (!c) return;
  if (!p) { c.hidden = true; c.innerHTML = ''; return; }
  c.innerHTML = OV.cfg.card(p, { tr: trace(p), tracing: OV.tracing === String(p.id), shown: !!OV.shown[p.id] }); c.hidden = false;
}
function top(bd) { return '<div class="ccm-ch">' + bd.filter(Boolean).map(function (b) { return '<span class="badge">' + esc(b) + '</span>'; }).join('') + '<button type="button" class="rb sm" data-cc="x" aria-label="Close">' + icon('x') + '</button></div>'; }
function acts(p, cx, extra) {
  return '<div class="ccm-act">' + (extra || '') + '<button type="button" class="btn k sm" data-cc="trace">' + icon('pin') + (cx.tracing ? ' Stop tracing' : ' Trace it') + '</button><button type="button" class="btn w sm" data-cc="dir" data-lat="' + p.lat + '" data-lng="' + p.lng + '">Directions</button></div>';
}
function trLine(cx) { return cx.tr ? '<p class="ccm-tr">' + icon('pin') + esc(cx.tr) + '</p>' : '<p class="note" style="margin:10px 0 0">Tap Near me to see how far it is.</p>'; }

/* a single place (item meeting spot, order, any "Map pin") */
function openPoint(t) {
  var pin = { id: 'p', lat: t.lat, lng: t.lng, cls: t.cls || 'it', glyph: t.glyph || 'pin', title: t.title };
  openOverlay({ title: t.title, focus: 'p', load: function () { return [pin]; }, card: function (p, cx) { return top([t.badge || 'Place']) + '<b class="ccm-t">' + esc(t.title) + '</b>' + (t.sub ? '<span class="ccm-s">' + esc(t.sub) + '</span>' : '') + trLine(cx) + acts(p, cx); } });
}
function openPoints(title, pins) {
  openOverlay({ title: title, load: function () { return pins; }, card: function (p, cx) { return top([title]) + '<b class="ccm-t">' + esc(p.title) + '</b>' + (p.sub ? '<span class="ccm-s">' + esc(p.sub) + '</span>' : '') + trLine(cx) + acts(p, cx); } });
}

/* ---------- Wi-Fi ---------- */
function wifiPins(items) {
  return items.filter(function (w) { return okLL(w.lat, w.lng); }).map(function (w) {
    var mb = mbpsOf(w); return { id: w.id, lat: w.lat, lng: w.lng, glyph: 'wifi', cls: w.kind === 'reseller' ? 'rs' : 'wf', tag: mb ? Math.round(mb) + ' Mbps' : '', title: w.ssid || w.place, mbps: mb, w: w };
  });
}
function wifiCard(p, cx) {
  var w = p.w, rs = w.kind === 'reseller', mb = p.mbps, up = Math.round(((w.votes || 0) + (w.score || 0)) / 2), dn = Math.max(0, (w.votes || 0) - up);
  var h = top([rs ? 'Plans and installation' : 'Free to join', w.zone]) + '<b class="ccm-t">' + esc(rs ? (w.business || w.place) : (w.ssid || w.place)) + '</b><span class="ccm-s">' + esc(rs ? (w.tech || '') : [w.place, w.business].filter(Boolean).join(' · ')) + '</span>';
  h += mb ? '<div class="ccspd"><div class="ccspd-h"><b>' + (mb % 1 ? mb.toFixed(1) : mb) + ' Mbps</b><small>' + (rs ? 'fastest plan' : 'set by the owner') + '</small></div><i><u style="width:' + Math.min(100, Math.max(4, mb)) + '%"></u></i></div>' : '<p class="note" style="margin:10px 0 0">The owner did not state a speed.</p>';
  if (rs) {
    (w.packages || []).slice(0, 3).forEach(function (k) { h += '<div class="ccm-row"><div><b>' + esc(k.mbps) + ' Mbps</b><small>' + esc(k.name) + '</small></div><b>KES ' + Number(k.price).toLocaleString('en-KE') + '</b></div>'; });
  } else {
    h += '<div class="ccm-row"><div><small>Wi-Fi name</small><b>' + esc(w.ssid || '') + '</b></div><button type="button" data-cc="copy" data-t="' + esc(w.ssid || '') + '">Copy</button></div>';
    if (w.has_password === false) h += '<div class="ccm-row"><div><small>Password</small><b>Open network, no password</b></div></div>';
    else if (w.locked || w.password == null) h += '<div class="ccm-row"><div><small>Password</small><b>Hidden</b></div><button type="button" data-cc="signin">Sign in to see it</button></div>';
    else h += '<div class="ccm-row"><div><small>Password</small><b>' + (cx.shown ? esc(w.password) : '&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;') + '</b></div><span><button type="button" data-cc="show">' + (cx.shown ? 'Hide' : 'Show') + '</button> <button type="button" data-cc="copy" data-t="' + esc(w.password) + '">Copy</button></span></div>';
  }
  h += trLine(cx);
  if (w.votes) h += '<p class="note" style="margin:6px 0 0">Works ' + up + ' · Not working ' + dn + '</p>';
  return h + acts(p, cx, '') + '<div class="ccm-act"><button type="button" class="btn w sm" data-cc="vote" data-v="1">' + icon('up') + ' Works</button><button type="button" class="btn w sm" data-cc="vote" data-v="-1">' + icon('down') + ' Not working</button></div>';
}
function openWifiMap(focus) {
  openOverlay({ title: 'Wi-Fi map', kinds: [['', 'All'], ['share', 'Free Wi-Fi'], ['reseller', 'Plans']], speeds: true, focus: focus,
    load: function (k) { return call('GET', '/api/c/wifi/map' + (k ? '?kind=' + k : '')).then(function (d) { return wifiPins(d.items || []); }); }, card: wifiCard,
    act: function (a, p, b) {
      if (a === 'vote') { if (!signedIn()) return needAcct(); call('POST', '/api/c/wifi/' + p.id + '/vote', { value: +b.getAttribute('data-v') }).then(function () { OV.sel = String(p.id); OV.focus = String(p.id); ovLoad(); say('Thanks for the feedback'); }, function (e) { say(e.message); }); }
      if (a === 'signin') needAcct();
      if (a === 'show') { OV.shown[p.id] = !OV.shown[p.id]; showCard(p); }
      if (a === 'copy') { try { navigator.clipboard.writeText(b.getAttribute('data-t')); say('Copied'); } catch (e) { say('Could not copy. Select the text and copy it.'); } }
    } });
}
var HS = null;
function openHostelMap(focus) {
  openOverlay({ title: 'Hostel map', kinds: [['', 'All'], ['Single', 'Single'], ['Shared', 'Shared'], ['Bedsitter', 'Bedsitter']], focus: focus,
    load: function (k) {
      return (HS ? Promise.resolve(HS) : call('GET', '/api/c/hostels?limit=60').then(function (d) { HS = (d.items || []).filter(function (x) { return x.kind !== 'review' && okLL(x.lat, x.lng); }); setTimeout(function () { HS = null; }, 60000); return HS; })).then(function (a) {
        return a.filter(function (x) { return !k || String(x.room_types || '').indexOf(k) >= 0; }).map(function (x) { return { id: x.id, lat: x.lat, lng: x.lng, glyph: 'bed', cls: 'hs', tag: x.rent ? 'KES ' + (x.rent >= 1000 ? (x.rent / 1000).toFixed(1).replace('.0', '') + 'k' : x.rent) : '', title: x.name, h: x }; });
      });
    },
    card: function (p, cx) { var x = p.h; return top(['Hostel', x.zone]) + '<b class="ccm-t">' + esc(x.name) + '</b><span class="ccm-s">' + esc([x.rent ? 'KES ' + Number(x.rent).toLocaleString('en-KE') + ' per month' : '', x.vacancies > 0 ? x.vacancies + (x.vacancies === 1 ? ' room left' : ' rooms left') : 'Full', x.room_types, x.address].filter(Boolean).join(' · ')) + '</span>' + trLine(cx) + acts(p, cx); } });
}
function shareWifi() {
  if (!signedIn()) return needAcct();
  var st = { loc: null }, zones = typeof ZONES !== 'undefined' ? ZONES : [];
  var fld = function (l, i) { return '<div class="fld"><label>' + l + '</label>' + i + '</div>'; };
  openSheet('Share a Wi-Fi network',
    fld('Place, e.g. Library 2nd floor', '<input class="in" id="cwf-pl" maxlength="60" autocomplete="off">') + fld('Wi-Fi name (SSID)', '<input class="in" id="cwf-ss" maxlength="32" autocomplete="off">')
    + '<label class="ccchk"><input type="checkbox" id="cwf-op"> Open network (no password)</label><div id="cwf-pwf">' + fld('Password (8 or more characters)', '<input class="in" id="cwf-pw" maxlength="63" autocomplete="off">') + '</div>'
    + fld('Zone', '<select class="in" id="cwf-zn">' + zones.map(function (z) { return '<option>' + esc(z) + '</option>'; }).join('') + '</select>')
    + '<div class="fld"><label>Speed you give: <b id="cwf-mbl">10 Mbps</b></label><input type="range" class="ccrange" id="cwf-mb" min="1" max="100" step="1" value="10"><div class="ccrng"><span>1</span><span>25</span><span>50</span><span>100 Mbps</span></div><div class="chips" style="margin-top:8px">' + [2, 5, 10, 20, 50, 100].map(function (n) { return '<button type="button" class="chip" data-cc="spd" data-v="' + n + '">' + n + '</button>'; }).join('') + '</div><p class="note">You decide. Pick what your network really gives people, up to 100 Mbps.</p></div>'
    + '<div class="fld"><label>Location</label><button type="button" class="btn w" id="cwf-lb">' + icon('pin') + ' Use my real location</button><p class="note" id="cwf-ls">Stand next to the router, switch on GPS, then tap.</p><div class="ccmini-map" id="cwf-map" hidden></div></div>'
    + '<label class="ccchk"><input type="checkbox" id="cwf-ok"> I own this network or have permission to share it</label><button type="button" class="btn o" id="cwf-go">Share this Wi-Fi</button><p class="note">Comrades see the password only when signed in. You can remove it any time.</p>',
    function (sh) {
      var $ = function (s) { return q(s, sh); }, rg = $('#cwf-mb');
      rg.oninput = function () { $('#cwf-mbl').textContent = rg.value + ' Mbps'; };
      $('#cwf-op').onchange = function () { $('#cwf-pwf').hidden = this.checked; };
      $('#cwf-lb').onclick = function () {
        var b = this; b.disabled = true; $('#cwf-ls').textContent = 'Finding you...';
        locate(true).then(function (m) {
          b.disabled = false; st.loc = m.acc > 300 ? null : m;
          $('#cwf-ls').textContent = m.acc > 300 ? 'Not accurate enough (' + m.acc + ' m). Stand next to the router, switch on GPS and try again.' : 'Location saved, accurate to ' + m.acc + ' m.';
          if (st.loc) { var mp = $('#cwf-map'); mp.hidden = false; mp.removeAttribute('data-done'); mp.setAttribute('data-lat', m.lat); mp.setAttribute('data-lng', m.lng); mp.innerHTML = ''; mountMini(mp); }
        }, function (e) { b.disabled = false; $('#cwf-ls').textContent = e.message; });
      };
      $('#cwf-go').onclick = function () {
        var place = $('#cwf-pl').value.trim(), ssid = $('#cwf-ss').value.trim(), open = $('#cwf-op').checked, pw = $('#cwf-pw').value;
        if (place.length < 2) return say('Add the place name');
        if (!ssid) return say('Add the Wi-Fi name (SSID)');
        if (!open && pw.length < 8) return say('The password needs 8 or more characters. Tick Open network if it has none.');
        if (!st.loc) return say('Tap Use my real location while you are at the network');
        if (!$('#cwf-ok').checked) return say('Tick the box to confirm you own this network or may share it');
        var mb = parseInt(rg.value, 10), go = this; go.disabled = true;
        call('POST', '/api/c/wifi', { kind: 'share', place: place, ssid: ssid, open: open, password: open ? null : pw, zone: $('#cwf-zn').value, mbps: mb, speed_note: mb + ' Mbps', lat: st.loc.lat, lng: st.loc.lng, accuracy: st.loc.acc, consent: true }).then(function () {
          closeSheet(); say('Wi-Fi shared. Thank you!');
          var t = S.stack[S.stack.length - 1]; if (t && t.name === 'sec' && t.arg === 'wifi') S.stack.pop(); A.sec('wifi');
        }, function (e) { go.disabled = false; say(e.message); });
      };
    });
}

/* ---------- Market ---------- */
function prodOf(id) { return typeof PRODS === 'undefined' ? null : PRODS.filter(function (p) { return String(p.id) === String(id); })[0] || null; }
var MK = { host: null, ctl: null, key: '' };
function mountMarket(ph) {
  var ids = (ph.getAttribute('data-ids') || '').split(',').filter(Boolean), sel = ph.getAttribute('data-sel') || '';
  if (!MK.host) {
    MK.host = document.createElement('div'); MK.host.className = 'mmap ccmk';
    MK.host.innerHTML = '<div class="ccm-map"></div><div class="ccm-hint" hidden></div><button type="button" class="ccm-me" data-cc="mkme">' + icon('pin') + ' Near me</button>';
  }
  ph.parentNode.replaceChild(MK.host, ph);
  if (!MK.ctl) MK.ctl = makeMap(q('.ccm-map', MK.host), { onPick: function (p) { if (p && typeof A.mkpin === 'function') A.mkpin(String(p.id)); } });
  var items = ids.map(prodOf).filter(function (p) { return p && okLL(p.lat, p.lng); });
  var pins = items.map(function (p) { return { id: p.id, lat: p.lat, lng: p.lng, cls: 'it', title: p.t }; });
  var hint = q('.ccm-hint', MK.host), miss = ids.length - pins.length;
  hint.hidden = !miss; hint.textContent = miss ? miss + (miss === 1 ? ' item has' : ' items have') + ' no pin yet. See them under Near you or Grid.' : '';
  var key = pins.map(function (p) { return p.id; }).join(',');
  MK.ctl.setPins(pins, sel).then(function (c) {
    try { c.map.invalidateSize(); } catch (e) {}
    if (key !== MK.key) { MK.key = key; c.fit(16); } else if (c.sel && c.pins[c.sel]) c.map.panTo([c.pins[c.sel].lat, c.pins[c.sel].lng]);
  });
  var card = MK.host.nextElementSibling, p = prodOf(sel);
  if (card && /\bmcard\b/.test(card.className) && p && !q('.ccmk-a', card)) card.insertAdjacentHTML('beforeend', okLL(p.lat, p.lng) ? '<div class="ccm-act ccmk-a"><button type="button" class="btn w sm" data-cc="dir" data-lat="' + p.lat + '" data-lng="' + p.lng + '">' + icon('pin') + ' Directions</button></div>' : '<p class="note ccmk-a">The seller has not pinned a place. Ask in chat where to meet.</p>');
}
function mountMini(el) {
  if (el.getAttribute('data-done')) return; el.setAttribute('data-done', '1');
  var la = parseFloat(el.getAttribute('data-lat')), ln = parseFloat(el.getAttribute('data-lng')); if (!okLL(la, ln)) return;
  var c = makeMap(el, { still: true, center: [la, ln], zoom: 16 }); c.setPins([{ id: 'x', lat: la, lng: ln, cls: 'it', glyph: 'pin' }], null);
}
function miniBlock(p, head, note) {
  if (!okLL(p.lat, p.lng)) return '<div class="ccmini"><div class="ccmini-h"><b>' + head + '</b></div><p class="note">The seller has not pinned a place. Ask in chat where to meet, and keep it public.</p></div>';
  var d = 'data-lat="' + p.lat + '" data-lng="' + p.lng + '" data-t="' + esc(p.t || 'Meeting place') + '"';
  return '<div class="ccmini"><div class="ccmini-h"><b>' + head + '</b><span>' + esc(trace(p)) + '</span></div><div class="ccmini-map" data-ccmini data-cc="mini" ' + d + ' data-lat="' + p.lat + '" data-lng="' + p.lng + '"></div><div class="ccm-act"><button type="button" class="btn w sm" data-cc="dir" ' + d + '>' + icon('pin') + ' Directions</button><button type="button" class="btn w sm" data-cc="mini" ' + d + '>Open map</button></div><p class="note">' + note + '</p></div>';
}
function picker(done) {
  closeOverlay();
  var el = shell('Pin your meeting place', '<div class="ccm-body"><div class="ccm-map"></div><div class="ccm-cross"><svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="#43302a" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg></div><button type="button" class="ccm-me" data-cc="pme">' + icon('pin') + ' Use my location</button></div><div class="ccm-foot"><p class="note" style="margin:0">Move the map so the pin sits on the place. Pick somewhere public. Your location stays on your phone until you confirm.</p><button type="button" class="btn o" data-cc="pok">Confirm this place</button></div>');
  OV = { el: el, picker: done, ctl: makeMap(q('.ccm-map', el), { center: PIN ? [PIN.lat, PIN.lng] : undefined, zoom: PIN ? 17 : (ME ? 16 : 14) }) };
  OV.ctl.ready.then(null, function (e) { say(e.message); closeOverlay(); });
}
function pickUi() {
  var l = q('#ccpk-l'), s = q('#ccpk-s'), x = q('#ccpk-x'); if (!l) return;
  l.textContent = PIN ? 'Change place' : 'Pin a place'; x.hidden = !PIN;
  s.textContent = PIN ? 'Pinned (' + PIN.lat.toFixed(4) + ', ' + PIN.lng.toFixed(4) + '). Buyers see it on the item.' : 'Buyers see it on a map. Pick a public place on campus. Do not pin your hostel room.';
}
var ORD = { t: 0, list: [] };
function orderScan() {
  if (typeof S === 'undefined' || S.tab !== 'market' || S.mkTab !== 'orders' || S.stack.length) return;
  var found = [];
  qa('#v-market [data-arg]').forEach(function (b) { var id = b.getAttribute('data-arg'), c = b.closest('.card'); if (/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id) && c && !c.getAttribute('data-ccord') && !found.some(function (f) { return f.c === c; })) found.push({ c: c, id: id }); });
  if (!found.length) return;
  found.forEach(function (f) { f.c.setAttribute('data-ccord', '1'); });
  var get = Date.now() - ORD.t < 20000 && found.every(function (f) { return ORD.list.some(function (o) { return o.id === f.id; }); }) ? Promise.resolve(ORD.list) : call('GET', '/api/orders/mine').then(function (d) { ORD = { t: Date.now(), list: d.orders || [] }; return ORD.list; });
  get.then(function (list) {
    found.forEach(function (f) {
      var o = list.filter(function (x) { return x.id === f.id; })[0];
      if (!o || !okLL(o.lat, o.lng) || ['held', 'handed', 'disputed'].indexOf(o.status) < 0 || q('.ccord', f.c)) return;
      var d = 'data-lat="' + o.lat + '" data-lng="' + o.lng + '" data-t="' + esc(o.title) + '"';
      f.c.insertAdjacentHTML('beforeend', '<div class="ccm-act ccord"><button type="button" class="btn w sm" data-cc="mini" ' + d + '>' + icon('pin') + ' Where to meet</button><button type="button" class="btn w sm" data-cc="dir" ' + d + '>Directions</button></div>');
    });
  }, function () {});
}
function payScan() {
  var sh = q('#sheet'); if (!PAY || !PAY.length || !sh || !sh.classList.contains('on') || !q('#pgo', sh) || q('.ccmini', sh)) return;
  var pinned = PAY.filter(function (p) { return okLL(p.lat, p.lng); }), card = q('.card', sh); if (!card) return;
  if (!pinned.length) return;
  if (pinned.length === 1) card.insertAdjacentHTML('afterend', miniBlock(pinned[0], 'Where you will pick it up', 'Meet in a public place. The seller is paid only after you confirm.'));
  else card.insertAdjacentHTML('afterend', '<div class="ccmini"><div class="ccmini-h"><b>' + pinned.length + ' pickup places</b></div><div class="ccm-act"><button type="button" class="btn w sm" data-cc="pts">' + icon('pin') + ' See them on the map</button></div></div>');
}

/* ---------- hooks (every one wraps the existing action) ---------- */
var _rm = R.market;
R.market = function () {
  var out = _rm.apply(this, arguments);
  if (typeof out !== 'string' || out.indexOf('class="mmap"') < 0) return out;
  var ids = [], re = /data-act="mkpin" data-arg="(\d+)"/g, m; while ((m = re.exec(out))) ids.push(m[1]);
  var on = /class="pin gb [^"]*\bon\b[^"]*"[^>]*data-arg="(\d+)"/.exec(out);
  return out.replace(/<div class="mmap">[\s\S]*?<\/div><div class="mcard">/, '<div class="ccmk-ph" data-ccmap="market" data-ids="' + ids.join(',') + '" data-sel="' + (on ? on[1] : '') + '"></div><div class="mcard">');
};
var _sell = A.sell;
A.sell = function () {
  PIN = null; var r = _sell.apply(this, arguments);
  var sh = q('#sheet'), go = sh && q('#sg', sh);
  if (go && !q('#ccpk', sh)) { go.insertAdjacentHTML('beforebegin', '<div class="fld" id="ccpk"><label>Where will you meet the buyer? (optional)</label><div class="two"><button type="button" class="btn w" data-cc="pk">' + icon('pin') + ' <span id="ccpk-l">Pin a place</span></button><button type="button" class="btn w" id="ccpk-x" data-cc="pkx" hidden>Remove pin</button></div><p class="note" id="ccpk-s"></p></div>'); pickUi(); }
  return r;
};
var _fetch = window.fetch;
window.fetch = function (u, o) {
  try { if (PIN && typeof u === 'string' && /\/api\/market\/listings$/.test(u.split('?')[0]) && o && o.method === 'POST' && typeof o.body === 'string') { var b = JSON.parse(o.body); if (b && b.lat == null) { b.lat = PIN.lat; b.lng = PIN.lng; o = Object.assign({}, o, { body: JSON.stringify(b) }); } } } catch (e) {}
  return _fetch.call(this, u, o);
};
var _prod = A.prod;
A.prod = function (a) {
  var r = _prod.apply(this, arguments), p = prodOf(a), sp = p && q('#sheet .specs');
  if (sp) sp.insertAdjacentHTML('afterend', miniBlock(p, 'Where to meet', 'Meet in a public place on campus. Your money stays in escrow until you confirm.'));
  return r;
};
var _pf = A.payflow;
A.payflow = function (amount, label, done, opt) {
  var c = opt && opt.ctx; PAY = null;
  if (c && c.purpose === 'order') PAY = (c.listing_ids || (c.listing_id ? [c.listing_id] : [])).map(function (u) { return PRODS.filter(function (p) { return p.uid === u; })[0]; }).filter(Boolean);
  return _pf.apply(this, arguments);
};
var _ia = A.iact;
A.iact = function (a) {
  var p = String(a).split('|'), it = p[2] === 'map' && typeof SEC !== 'undefined' && SEC[p[0]] && SEC[p[0]].items[+p[1]];
  if (it) {
    if (!okLL(it.lat, it.lng)) return say('This one has no map pin');
    if (p[0] === 'wifi' && it.uid) return openWifiMap(it.uid);
    if (p[0] === 'hostels' && it.uid) return openHostelMap(it.uid);
    return openPoint({ title: it.t || 'Place', sub: it.m || '', lat: it.lat, lng: it.lng, badge: it.tag, cls: p[0] === 'spots' ? 'hs' : 'it' });
  }
  return _ia.apply(this, arguments);
};
var _sf = A.secform;
A.secform = function (id) { if (id === 'wifi') return shareWifi(); return _sf.apply(this, arguments); };
var BAN = { wifi: ['Wi-Fi map', 'Find free Wi-Fi near you, see its speed and trace it', 'wifi', 'wifi'], hostels: ['Hostel map', 'See vacant rooms on the map', 'bed', 'hostels'] };
var _ss = SUB.sec;
SUB.sec = function (id) {
  var out = _ss.apply(this, arguments), b = BAN[id], tag = '<div class="rt"></div></div>';
  if (!b || typeof out !== 'string' || out.indexOf(tag) < 0) return out;
  var i = out.indexOf(tag) + tag.length;
  return out.slice(0, i) + '<button type="button" class="row ccban" data-cc="open-' + b[3] + '"><span class="ri">' + icon(b[2]) + '</span><span class="rx"><b>' + b[0] + '</b><small>' + b[1] + '</small></span><span class="rr">' + icon('arrow') + '</span></button>' + out.slice(i);
};

/* ---------- clicks ---------- */
function ovClick(a, b) {
  var o = OV, p = o.sel && o.ctl.pins ? o.ctl.pins[o.sel] : null;
  if (a === 'close') return closeOverlay();
  if (a === 'x') { o.ctl.pick(null); o.sel = null; stopTrace(); return showCard(null); }
  if (a === 'pme') { b.disabled = true; return o.ctl.goMe().then(function () { b.disabled = false; }, function (e) { b.disabled = false; say(e.message); }); }
  if (a === 'pok') { if (!o.ctl.map) return; var ct = o.ctl.map.getCenter(), v = { lat: r5(ct.lat), lng: r5(ct.lng) }, fn = o.picker; closeOverlay(); return fn(v); }
  if (a === 'kind') { qa('.ccm-k .chip', o.el).forEach(function (x) { x.classList.toggle('on', x === b); }); o.kind = b.getAttribute('data-k'); o.sel = null; stopTrace(); return ovLoad(); }
  if (a === 'spdf') { qa('.ccm-s .chip', o.el).forEach(function (x) { x.classList.toggle('on', x === b); }); o.minSpd = +b.getAttribute('data-k'); o.sel = null; stopTrace(); return ovShow(false); }
  if (a === 'me') { b.disabled = true; return o.ctl.goMe().then(function () { b.disabled = false; if (OV === o && o.sel) showCard(o.ctl.pins[o.sel]); }, function (e) { b.disabled = false; say(e.message); }); }
  if (a === 'dir') return dir(b.getAttribute('data-lat'), b.getAttribute('data-lng'));
  if (!p) return;
  if (a === 'trace') {
    if (o.tracing === o.sel) { stopTrace(); return showCard(p); }
    b.disabled = true;
    return locate(true).then(function () { if (OV !== o) return; o.tracing = o.sel; o.ctl.onTrace = function (pp) { if (OV === o && o.sel === String(pp.id)) showCard(pp); }; o.ctl.traceTo(p, true); showCard(p); }, function (e) { b.disabled = false; say(e.message); });
  }
  if (o.cfg && o.cfg.act) o.cfg.act(a, p, b);
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-cc]'); if (!b) return;
  var a = b.getAttribute('data-cc');
  if (OV && OV.el.contains(b)) return ovClick(a, b);
  if (a === 'dir') return dir(b.getAttribute('data-lat'), b.getAttribute('data-lng'));
  if (a === 'mini') { var la = parseFloat(b.getAttribute('data-lat')), ln = parseFloat(b.getAttribute('data-lng')); return okLL(la, ln) ? openPoint({ title: b.getAttribute('data-t') || 'Meeting place', lat: la, lng: ln, badge: 'Meeting place' }) : undefined; }
  if (a === 'pk') return picker(function (v) { PIN = v; pickUi(); });
  if (a === 'pkx') { PIN = null; return pickUi(); }
  if (a === 'pts') return openPoints('Pickup places', (PAY || []).filter(function (p) { return okLL(p.lat, p.lng); }).map(function (p) { return { id: p.id, lat: p.lat, lng: p.lng, cls: 'it', glyph: 'bag', title: p.t, sub: p.z }; }));
  if (a === 'open-wifi') return openWifiMap();
  if (a === 'open-hostels') return openHostelMap();
  if (a === 'spd') { var r = q('#cwf-mb'); if (r) { r.value = b.getAttribute('data-v'); r.oninput && r.oninput(); } return; }
  if (a === 'mkme') { b.disabled = true; return MK.ctl.goMe().then(function () { b.disabled = false; refresh(); }, function (er) { b.disabled = false; say(er.message); }); }
}, false);

var raf = 0;
function scan() { raf = 0; qa('[data-ccmap="market"]').forEach(mountMarket); qa('[data-ccmini]:not([data-done])').forEach(mountMini); payScan(); orderScan(); }
new MutationObserver(function (ms) {
  if (raf) return;
  for (var i = 0; i < ms.length; i++) { var t = ms[i].target; if (!(t && t.closest && t.closest('.leaflet-container'))) { raf = requestAnimationFrame(scan); return; } }
}).observe(document.body, { childList: true, subtree: true });

window.ccMaps = { realKm: function (p) { return ME && p && okLL(p.lat, p.lng) ? Math.max(0.1, Math.round(hav(ME, p) * 10) / 10) : null; }, locate: locate, openPoint: openPoint, openWifiMap: openWifiMap, openHostelMap: openHostelMap, shareWifi: shareWifi, scan: scan };
scan();
})();
