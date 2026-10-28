/* cc-places.js v1: real maps for Land spots, Lost & Found and Events. Loaded after cc-maps.js.
   Land spots and Lost & Found now load from and post to the server (they were demo-only before).
   Each page gets a map button; posting has a "Pin on the map" step; every "Map pin" opens the in-app map.
   It only wraps existing actions. Nothing is removed. */
(function () {
'use strict';
if (window.ccPlaces) return;
var M = window.ccMaps && window.ccMaps.x;
if (!M || typeof A === 'undefined' || typeof SEC === 'undefined') return;
var q = function (s, r) { return (r || document).querySelector(s); };
var esc = M.esc, say = M.say, call = M.call, icon = M.icon, okLL = M.okLL;
var SPOT_CATS = ['Food', 'Study', 'Hangout', 'Safety', 'Printing', 'Wi-Fi', 'Laundry', 'Worship', 'Transport'];
var LF_CATS = ['National ID', 'Student ID', 'Phone', 'ATM card', 'Wallet or bag', 'Keys', 'Laptop', 'Books or notes', 'Other'];
var LF_PLACES = ['Kerugoya town', 'Kutus', 'Campus main gate', 'Library', 'Lecture halls', 'Cafeteria', 'Hostels', 'Matatu stage', 'Market', 'Other'];
var EVST = { pin: null };

function fld(l, i) { return '<div class="fld"><label>' + l + '</label>' + i + '</div>'; }
function opts(list) { return list.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join(''); }
function reopen(id) { var t = S.stack[S.stack.length - 1]; if (t && t.name === 'sec' && t.arg === id) S.stack.pop(); A.sec(id); }
function short(d) { var x = new Date(d + 'T00:00:00'); return isNaN(x) ? '' : x.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }); }
function kes(n) { return 'KES ' + Number(n || 0).toLocaleString('en-KE'); }

/* ---------- the "Pin on the map" field used by every form ---------- */
function pinHtml(id, label, note) {
  return '<div class="fld" id="' + id + '" data-note="' + esc(note) + '"><label>' + label + '</label><div class="two"><button type="button" class="btn w" data-p="pick">' + icon('pin') + ' <span data-p="lbl">Pin on the map</span></button><button type="button" class="btn w" data-p="clear" hidden>Remove pin</button></div><p class="note" data-p="st">' + esc(note) + '</p><div data-p="map" hidden></div></div>';
}
function wirePin(root, st, o) {
  var $ = function (k) { return q('[data-p="' + k + '"]', root); };
  function paint() {
    var has = !!st.pin, box = $('map');
    $('lbl').textContent = has ? 'Change place' : 'Pin on the map'; $('clear').hidden = !has;
    $('st').textContent = has ? 'Pinned (' + st.pin.lat.toFixed(4) + ', ' + st.pin.lng.toFixed(4) + ').' : root.getAttribute('data-note');
    if (has) { box.hidden = false; box.innerHTML = '<div class="ccmini-map" data-lat="' + st.pin.lat + '" data-lng="' + st.pin.lng + '"></div>'; M.mountMini(box.firstChild); }
    else { box.hidden = true; box.innerHTML = ''; }
  }
  $('pick').onclick = function () { M.picker(function (v) { st.pin = v; paint(); }, { title: o.title, hint: o.hint, ok: o.ok, start: st.pin }); };
  $('clear').onclick = function () { st.pin = null; paint(); };
  paint();
}

/* ---------- loading (Land spots and Lost & Found come from the server) ---------- */
function mapSpot(x) {
  return { uid: x.id, tag: x.category || 'Spot', t: x.name, det: x.details || '', m: (x.details || '') + (x.likes ? ' · ' + x.likes + ' good' : ''), k: x.category, u: x.likes || 0, d: 0, lat: x.lat, lng: x.lng, mine: x.mine };
}
function mapLost(x) {
  var lost = x.kind === 'lost';
  return { uid: x.id, tag: (lost ? 'Lost' : 'Found') + (x.place ? ' · ' + x.place : ''), t: x.title, m: [x.details, x.category, x.happenedOn ? short(x.happenedOn) : ''].filter(Boolean).join(' · '), k: lost ? 'Lost' : 'Found', vf: x.verified, b: x.category ? [x.category] : null, lat: x.lat, lng: x.lng, mine: x.mine };
}
function fill(id, list) { var a = SEC[id].items; a.length = 0; list.forEach(function (x) { a.push(x); }); try { refresh(); } catch (e) {} }
function loadSpots() { return call('GET', '/api/spots').then(function (d) { fill('spots', (d.spots || []).map(mapSpot)); }, function (e) { say(e.message); }); }
function loadLost() { return call('GET', '/api/lostfound').then(function (d) { fill('lostfound', (d.items || []).map(mapLost)); }, function (e) { say(e.message); }); }
var _sec = A.sec;
A.sec = function (a) { var r = _sec.apply(this, arguments); if (a === 'spots') loadSpots(); else if (a === 'lostfound') loadLost(); return r; };
SEC.spots.acts = [['Good spot', 'up'], ['Map pin', 'map'], ['Report', 'report']];

/* ---------- owner cards ---------- */
function ownCard(title, items, kind) {
  if (!items.length) return '';
  return '<div class="card" style="margin:12px 0"><b>' + title + '</b>' + items.map(function (x) {
    return '<div class="cchv-o"><div><b>' + esc(x.t) + '</b><small>' + esc(x.tag) + '</small></div><div class="cchv-b">'
      + (kind === 'lf' ? '<button type="button" class="btn w sm" data-act="plown" data-arg="' + esc(x.uid) + '|lf|returned">Mark returned</button>' : '')
      + '<button type="button" class="btn w sm" data-act="plown" data-arg="' + esc(x.uid) + '|' + kind + '|remove">Remove</button></div></div>';
  }).join('') + '</div>';
}
var _lfpre = SEC.lostfound.pre;
SEC.lostfound.pre = function () { return (_lfpre ? _lfpre.apply(this, arguments) : '') + ownCard('Your reports', SEC.lostfound.items.filter(function (i) { return i.mine && i.uid; }), 'lf'); };
SEC.spots.pre = function () { return ownCard('Your spots', SEC.spots.items.filter(function (i) { return i.mine && i.uid; }), 'sp'); };
A.plown = function (a) {
  var p = String(a).split('|'), id = p[0], kind = p[1], op = p[2];
  if (!M.signedIn()) return M.needAcct();
  if (op === 'remove' && !window.confirm('Remove this?')) return;
  var url = kind === 'sp' ? '/api/spots/' + id + '/remove' : '/api/lostfound/' + id + '/' + op;
  call('POST', url, {}).then(function () { say(op === 'returned' ? 'Marked as returned. Glad it found its owner.' : 'Removed'); reopen(kind === 'sp' ? 'spots' : 'lostfound'); }, function (e) { say(e.message); });
};

/* ---------- posting: Land spots ---------- */
function spotForm() {
  if (!M.signedIn()) return M.needAcct();
  var st = { pin: null };
  openSheet('Add a land spot',
    fld('Spot name', '<input class="in" id="sp-n" maxlength="60" autocomplete="off" placeholder="Mama Njeri chips">')
    + fld('Category', '<select class="in" id="sp-c">' + opts(SPOT_CATS) + '</select>')
    + fld('Why it is good', '<textarea class="in" id="sp-d" maxlength="300"></textarea>')
    + pinHtml('sp-pin', 'Where is it?', 'Pin the spot so comrades can find it. Move the map, or tap Use my location while you are there.')
    + '<button type="button" class="btn o" id="sp-go">Add this spot</button><p class="note">No phone numbers, handles or links. Spots you add show on the Land spots map.</p>',
    function (sh) {
      wirePin(q('#sp-pin', sh), st, { title: 'Pin the spot', hint: 'Move the map so the pin sits on the spot. Your location stays on your phone until you confirm.', ok: 'Confirm this spot' });
      q('#sp-go', sh).onclick = function () {
        var name = q('#sp-n', sh).value.trim();
        if (name.length < 3) return say('Give the spot a name');
        if (!st.pin) return say('Pin the spot on the map');
        var go = this; go.disabled = true;
        call('POST', '/api/spots', { name: name, category: q('#sp-c', sh).value, details: q('#sp-d', sh).value.trim(), lat: st.pin.lat, lng: st.pin.lng }).then(function () {
          closeSheet(); say('Spot added. Thank you!'); reopen('spots');
        }, function (e) { go.disabled = false; say(e.message); });
      };
    });
}

/* ---------- posting: Lost & Found ---------- */
function lostForm() {
  if (!M.signedIn()) return M.needAcct();
  var st = { pin: null }, today = new Date().toISOString().slice(0, 10), min = new Date(Date.now() - 59 * 864e5).toISOString().slice(0, 10);
  openSheet('Report lost or found',
    fld('I have', '<select class="in" id="lf-k"><option value="lost">Lost something</option><option value="found">Found something</option></select>')
    + fld('What was it? (short title)', '<input class="in" id="lf-t" maxlength="80" autocomplete="off" placeholder="Black Tecno phone">')
    + '<div class="two">' + fld('Type', '<select class="in" id="lf-c">' + opts(LF_CATS) + '</select>') + fld('Date', '<input class="in" id="lf-dt" type="date" min="' + min + '" max="' + today + '" value="' + today + '">') + '</div>'
    + fld('Area', '<select class="in" id="lf-p">' + opts(LF_PLACES) + '</select>')
    + fld('Details. No full ID numbers.', '<textarea class="in" id="lf-d" maxlength="300"></textarea>')
    + pinHtml('lf-pin', 'Where? (optional)', 'Pin the place on the map, or leave it. For something you found, say where you left it.')
    + '<button type="button" class="btn o" id="lf-go">Post</button><p class="note">Never post ID, card or serial numbers. The owner proves it is theirs in the chat. Hand over at the gate or security office.</p>',
    function (sh) {
      wirePin(q('#lf-pin', sh), st, { title: 'Pin the place', hint: 'Move the map so the pin sits where it was lost or found. Your location stays on your phone until you confirm.', ok: 'Confirm this place' });
      q('#lf-go', sh).onclick = function () {
        var t = q('#lf-t', sh).value.trim();
        if (t.length < 3) return say('Add a short title, like Black Tecno phone');
        var go = this; go.disabled = true;
        var body = { kind: q('#lf-k', sh).value, title: t, category: q('#lf-c', sh).value, place: q('#lf-p', sh).value, details: q('#lf-d', sh).value.trim(), happened_on: q('#lf-dt', sh).value || today };
        if (st.pin) { body.lat = st.pin.lat; body.lng = st.pin.lng; }
        call('POST', '/api/lostfound', body).then(function () { closeSheet(); say('Posted. Check back for messages.'); reopen('lostfound'); }, function (e) { go.disabled = false; say(e.message); });
      };
    });
}

/* ---------- posting: Events (adds a venue pin to the existing Host an event form) ---------- */
var _sf = A.secform;
A.secform = function (id) {
  if (id === 'spots') return spotForm();
  if (id === 'lostfound') return lostForm();
  if (id !== 'events') return _sf.apply(this, arguments);
  EVST = { pin: null };
  var r = _sf.apply(this, arguments), sh = q('#sheet'), go = sh && q('#hgo', sh);
  if (go && !q('#cp-evpin', sh)) {
    go.insertAdjacentHTML('beforebegin', pinHtml('cp-evpin', 'Pin the venue on the map (optional)', 'Comrades can then see where it is and get directions.'));
    wirePin(q('#cp-evpin', sh), EVST, { title: 'Pin the venue', hint: 'Move the map so the pin sits on the venue. Your location stays on your phone until you confirm.', ok: 'Confirm the venue' });
  }
  return r;
};
var _fetch = window.fetch;
window.fetch = function (u, o) {
  try {
    if (EVST.pin && typeof u === 'string' && /\/api\/my\/events$/.test(u.split('?')[0]) && o && o.method === 'POST' && typeof o.body === 'string') {
      var b = JSON.parse(o.body); if (b && b.lat == null) { b.lat = EVST.pin.lat; b.lng = EVST.pin.lng; o = Object.assign({}, o, { body: JSON.stringify(b) }); }
    }
  } catch (e) {}
  return _fetch.call(this, u, o);
};

/* ---------- the maps ---------- */
function likeSpot(it) {
  if (!M.signedIn()) return M.needAcct();
  call('POST', '/api/spots/' + it.uid + '/like', {}).then(function (r) { it.u = r.likes; it.m = (it.det || '') + (r.likes ? ' · ' + r.likes + ' good' : ''); say(r.liked ? 'Thanks. Marked as a good spot.' : 'Removed your vote'); try { refresh(); } catch (e) {} }, function (e) { say(e.message); });
}
function openSpotsMap(focus) {
  M.openOverlay({ title: 'Land spots map', kinds: [['', 'All']].concat(SPOT_CATS.map(function (c) { return [c, c]; })), focus: focus,
    load: function (k) {
      return call('GET', '/api/spots' + (k ? '?category=' + encodeURIComponent(k) : '')).then(function (d) {
        return (d.spots || []).filter(function (x) { return okLL(x.lat, x.lng); }).map(function (x) { return { id: x.id, lat: x.lat, lng: x.lng, glyph: 'pin', cls: 'sp', tag: x.likes ? x.likes + ' good' : '', title: x.name, s: x }; });
      });
    },
    card: function (p, cx) {
      var x = p.s;
      return M.top(['Land spot', x.category]) + '<b class="ccm-t">' + esc(x.name) + '</b>' + (x.details ? '<span class="ccm-s">' + esc(x.details) + '</span>' : '') + M.trLine(cx)
        + M.acts(p, cx, '<button type="button" class="btn w sm" data-cc="like">' + icon('up') + ' Good spot · ' + (x.likes || 0) + '</button>');
    },
    act: function (a, p) {
      if (a !== 'like') return;
      if (!M.signedIn()) return M.needAcct();
      call('POST', '/api/spots/' + p.id + '/like', {}).then(function (r) { p.s.likes = r.likes; M.showCard(p); say(r.liked ? 'Thanks. Marked as a good spot.' : 'Removed your vote'); }, function (e) { say(e.message); });
    } });
}
function openLostMap(focus) {
  M.openOverlay({ title: 'Lost & Found map', kinds: [['', 'All'], ['lost', 'Lost'], ['found', 'Found']], focus: focus,
    load: function (k) {
      return call('GET', '/api/lostfound' + (k ? '?kind=' + k : '')).then(function (d) {
        return (d.items || []).filter(function (x) { return okLL(x.lat, x.lng); }).map(function (x) { return { id: x.id, lat: x.lat, lng: x.lng, glyph: 'lost', cls: x.kind === 'lost' ? 'lo' : 'fo', tag: x.kind === 'lost' ? 'Lost' : 'Found', title: x.title, s: x }; });
      });
    },
    card: function (p, cx) {
      var x = p.s;
      return M.top([x.kind === 'lost' ? 'Lost' : 'Found', x.category, x.verified ? 'Verified' : '']) + '<b class="ccm-t">' + esc(x.title) + '</b>'
        + '<span class="ccm-s">' + esc([x.place, x.happenedOn ? short(x.happenedOn) : ''].filter(Boolean).join(' · ')) + '</span>'
        + (x.details ? '<p class="note" style="margin:8px 0 0">' + esc(x.details) + '</p>' : '') + M.trLine(cx)
        + '<p class="note" style="margin:6px 0 0">Hand over at the gate or security office. Never share ID numbers in the open.</p>'
        + M.acts(p, cx, x.mine ? '' : '<button type="button" class="btn w sm" data-cc="dm">Message anonymously</button>');
    },
    act: function (a, p) { if (a === 'dm') { M.closeOverlay(); A.dm('lostfound:' + p.id); } } });
}
function openEventsMap(focus) {
  M.openOverlay({ title: 'Events map', focus: focus,
    load: function () {
      return call('GET', '/api/events').then(function (d) {
        return (d.events || []).filter(function (e) { return okLL(e.lat, e.lng); }).map(function (e) { return { id: e.id, lat: e.lat, lng: e.lng, glyph: 'ticket', cls: 'ev', tag: short(e.date), title: e.title, e: e }; });
      });
    },
    card: function (p, cx) {
      var e = p.e;
      return M.top(['Event', e.category, e.ticket_price ? kes(e.ticket_price) : 'Free']) + '<b class="ccm-t">' + esc(e.title) + '</b>'
        + '<span class="ccm-s">' + esc([short(e.date) + (e.time ? ' ' + e.time : ''), e.venue, e.left != null ? e.left + ' tickets left' : ''].filter(Boolean).join(' · ')) + '</span>' + M.trLine(cx)
        + M.acts(p, cx, '<button type="button" class="btn w sm" data-cc="tix">' + icon('ticket') + (e.ticket_price ? ' Tickets' : ' Details') + '</button>');
    },
    act: function (a, p) {
      if (a !== 'tix') return;
      var i = SEC.events.items.findIndex(function (x) { return x.uid === p.id; });
      if (i < 0) return say('Open Events to see the tickets');
      M.closeOverlay(); A.ticket(String(i));
    } });
}

/* ---------- hooks ---------- */
var _ia = A.iact;
A.iact = function (a) {
  var p = String(a).split('|'), id = p[0], act = p[2], it = SEC[id] && SEC[id].items[+p[1]];
  if (it && (id === 'spots' || id === 'lostfound')) {
    if (act === 'map') return okLL(it.lat, it.lng) ? (id === 'spots' ? openSpotsMap(it.uid) : openLostMap(it.uid)) : say('This one has no map pin');
    if (id === 'spots' && act === 'up') return likeSpot(it);
    if (id === 'lostfound' && act === 'dm') return A.dm('lostfound:' + it.uid);
    if (act === 'report') return A.report('item:' + (id === 'spots' ? 'spot' : 'lostfound') + ':' + (it.uid || ''));
  }
  return _ia.apply(this, arguments);
};
A.evplace = function (a) { var e = SEC.events.items[+a]; if (e && okLL(e.lat, e.lng)) openEventsMap(e.uid); else say('The host has not pinned the venue'); };

var BAN = { spots: ['Land spots map', 'See places comrades recommend and get directions', 'pin', 'spots'], lostfound: ['Lost & Found map', 'See where things were lost or found', 'lost', 'lost'], events: ['Events map', 'See where events happen and how to get there', 'ticket', 'events'] };
var _ss = SUB.sec;
SUB.sec = function (id) {
  var out = _ss.apply(this, arguments), b = BAN[id], tag = '<div class="rt"></div></div>';
  if (typeof out !== 'string') return out;
  if (id === 'events') {
    out = out.replace(/<button data-act="cal" data-arg="(\d+)">/g, function (m, n) {
      var e = SEC.events.items[+n]; return e && okLL(e.lat, e.lng) ? '<button data-act="evplace" data-arg="' + n + '">' + icon('pin') + ' Place</button>' + m : m;
    });
  }
  if (!b || out.indexOf(tag) < 0) return out;
  var i = out.indexOf(tag) + tag.length;
  return out.slice(0, i) + '<button type="button" class="row ccban" data-cp="open-' + b[3] + '"><span class="ri">' + icon(b[2]) + '</span><span class="rx"><b>' + b[0] + '</b><small>' + b[1] + '</small></span><span class="rr">' + icon('arrow') + '</span></button>' + out.slice(i);
};
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-cp]'); if (!b) return;
  var a = b.getAttribute('data-cp');
  if (a === 'open-spots') return openSpotsMap();
  if (a === 'open-lost') return openLostMap();
  if (a === 'open-events') return openEventsMap();
}, false);

window.ccPlaces = { openSpotsMap: openSpotsMap, openLostMap: openLostMap, openEventsMap: openEventsMap };
})();
