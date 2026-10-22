/* cc-spots.js: "Land spots" tab in Explore, next to Wi-Fi, Hostels and Services.
   Places around YOUR campus that comrades know about: food, quiet study corners, stages, safe walks. Anyone signed in can add a spot
   (with an optional map pin), say "Good spot", or remove their own. Nobody is named. The list follows the campus picked in cc-campus.js. */
(function () {
'use strict';
var xt = document.getElementById('xt'), body = document.getElementById('xbody');
if (!xt || !body || window.__ccSpots) return; window.__ccSpots = 1;

var CATS = ['Food', 'Study', 'Hangout', 'Transport', 'Services', 'Worship', 'Safety', 'Other'];
var S = { cat: 'All', list: [], busy: false, err: '', loaded: false, campus: '' };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var say = function (t) { try { if (typeof toast === 'function') toast(t); } catch (e) {} };
var call = function (p, o) { return window.CC ? CC.call(p, o) : Promise.reject(new Error('Not ready yet. Reload the page and try again.')); };
var signedIn = function () { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); };
var on = function () { return xt.querySelector('.tab[data-x="ls"].on'); };

var css = document.createElement('style');
css.textContent = '.sp-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}.sp-top .btn{flex:none}' +
  '.sp-card .sp-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.sp-card h3{margin:0;font-size:16px;overflow-wrap:anywhere}' +
  '.sp-card p{margin:8px 0 0;font-size:14px;line-height:1.55;overflow-wrap:anywhere}.sp-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}' +
  '.sp-row .act{font-size:13px}.sp-form label{display:block;margin:12px 0 6px;font-size:12px;font-weight:600;opacity:.75}' +
  '.sp-form input,.sp-form textarea{width:100%;box-sizing:border-box;border-radius:14px;border:1px solid var(--gb,rgba(255,255,255,.28));background:rgba(127,127,127,.12);color:inherit;padding:12px 14px;font:500 15px Poppins,system-ui,sans-serif}' +
  '.sp-form textarea{min-height:84px;resize:vertical}.sp-err{margin:10px 0 0;font-size:13px;color:#ff6b6b}.sp-pin{font-size:12px;opacity:.7;margin-top:6px}';
document.head.appendChild(css);

if (!xt.querySelector('[data-x="ls"]')) xt.insertAdjacentHTML('beforeend', '<button class="tab g" data-x="ls">Land spots</button>');

function campusName() { return (window.ccCampus && ccCampus.name()) || 'your campus'; }
function maps(s) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.lat + ',' + s.lng); }

function paint() {
  if (!on()) return;
  var h = '<div class="sp-top"><div><h3 style="margin:0">Land spots at ' + esc(campusName()) + '</h3><p class="sub" style="margin:4px 0 0">Places comrades know about. Add yours.</p></div>'
    + '<button class="btn p" data-sp="add">Add a spot</button></div>'
    + '<div class="tabs z" style="padding:0;margin-top:12px">' + ['All'].concat(CATS).map(function (c) { return '<button class="tab g' + (c === S.cat ? ' on' : '') + '" data-spc="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>';
  if (S.busy && !S.list.length) h += '<p class="sub" style="margin-top:14px">Loading spots...</p>';
  else if (S.err && !S.list.length) h += '<p class="sub" style="margin-top:14px">' + esc(S.err) + '</p><button class="btn g" data-sp="retry">Try again</button>';
  else if (!S.list.length) h += '<article class="box g" style="margin-top:14px"><h3>No spots here yet</h3><p class="sub" style="margin-top:6px">Be the first. Add the best chips, a quiet study corner or the safest way home.</p></article>';
  else h += S.list.map(function (s) {
    return '<article class="box g sp-card" style="margin-top:12px"><div class="sp-h"><h3>' + esc(s.name) + '</h3><span class="badge">' + esc(s.category) + '</span></div>'
      + (s.details ? '<p>' + esc(s.details) + '</p>' : '')
      + '<div class="sp-row"><button class="act' + (s.liked ? ' liked' : '') + '" data-sp="like" data-id="' + esc(s.id) + '">Good spot' + (s.likes ? ' ' + s.likes : '') + '</button>'
      + (s.lat != null ? '<a class="act" style="text-decoration:none" target="_blank" rel="noopener" data-sp="dir" href="' + esc(maps(s)) + '">Directions</a>' : '')
      + (s.mine ? '<button class="act" data-sp="rm" data-id="' + esc(s.id) + '">Remove</button>' : '') + '</div></article>';
  }).join('');
  body.innerHTML = h;
}
function load(force) {
  if (S.busy) return; S.busy = true; S.err = ''; paint();
  var q = S.cat !== 'All' ? '?category=' + encodeURIComponent(S.cat) : '';
  call('/api/spots' + q, { auth: false }).then(function (d) { S.list = d.spots || []; S.loaded = true; })
    .catch(function (e) { S.err = e.message || 'Could not load spots. Check your connection.'; })
    .then(function () { S.busy = false; paint(); });
}
function show() {
  [].forEach.call(xt.querySelectorAll('.tab'), function (t) { t.classList.toggle('on', t.dataset.x === 'ls'); });
  if (!S.loaded) { paint(); load(); } else { paint(); load(true); }
}

/* the tab: handled before the page's own tab code so it never has to know about this one */
xt.addEventListener('click', function (e) {
  var t = e.target.closest && e.target.closest('.tab'); if (!t || t.dataset.x !== 'ls') return;
  e.stopPropagation(); e.preventDefault(); show();
}, true);

/* ---------- add a spot ---------- */
function addSheet() {
  if (!signedIn()) { say('Sign in to add a land spot'); try { if (window.ccAuthPanel) window.ccAuthPanel(); } catch (e) {} return; }
  var pin = null;
  var ov = document.createElement('div'); ov.className = 'cxm'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = '<div class="box g sp-form"><h3>Add a land spot</h3><p class="sub" style="margin-top:6px">At ' + esc(campusName()) + '. No phone numbers or links.</p>'
    + '<label for="spn">Name</label><input id="spn" maxlength="60" placeholder="e.g. Mama Oliech chips" autocomplete="off">'
    + '<label for="spc">Type (pick one or write your own)</label><input id="spc" list="spcl" maxlength="24" value="Hangout" autocomplete="off"><datalist id="spcl">' + CATS.map(function (c) { return '<option value="' + c + '">'; }).join('') + '</datalist>'
    + '<label for="spd">Why is it good? (optional)</label><textarea id="spd" maxlength="300" placeholder="What to order, when it is quiet, how to find it"></textarea>'
    + '<button type="button" class="btn g" id="spp" style="margin-top:12px;width:100%">Pin my location</button><p class="sp-pin" id="spt">Optional. Stand at the spot, then tap.</p>'
    + '<p class="sp-err" id="spe" role="alert" hidden></p>'
    + '<div class="cxr"><button class="btn p" id="spg">Add spot</button><button class="btn g" id="spx">Cancel</button></div></div>';
  var $ = function (s) { return ov.querySelector(s); };
  var err = function (t) { var n = $('#spe'); n.textContent = t || ''; n.hidden = !t; };
  ov.close = function () { ov.remove(); };
  ov.addEventListener('click', function (e) { if (e.target === ov) ov.close(); });
  $('#spx').onclick = ov.close;
  $('#spp').onclick = function () {
    var b = this; if (!navigator.geolocation) return err('Your phone did not share a location');
    b.disabled = true; $('#spt').textContent = 'Finding you...';
    navigator.geolocation.getCurrentPosition(function (p) { pin = { lat: p.coords.latitude, lng: p.coords.longitude }; $('#spt').textContent = 'Pinned (' + Math.round(p.coords.accuracy || 0) + ' m accuracy)'; b.disabled = false; b.textContent = 'Pin again'; },
      function () { $('#spt').textContent = 'Could not get your location. You can still add the spot without a pin.'; b.disabled = false; }, { enableHighAccuracy: true, timeout: 15000 });
  };
  $('#spg').onclick = function () {
    var b = this, name = $('#spn').value.trim(); err('');
    if (name.length < 3) return err('Give the spot a name');
    b.disabled = true;
    var o = { name: name, category: $('#spc').value.trim() || 'Other', details: $('#spd').value.trim() }; if (pin) { o.lat = pin.lat; o.lng = pin.lng; }
    call('/api/spots', { body: o }).then(function () { ov.close(); say('Spot added'); S.cat = 'All'; load(true); })
      .catch(function (e) { b.disabled = false; err(e.message || 'Could not add the spot'); });
  };
  document.body.appendChild(ov); setTimeout(function () { var n = $('#spn'); if (n) n.focus(); }, 80);
}

body.addEventListener('click', function (e) {
  if (!on()) return;
  var c = e.target.closest('[data-spc]'); if (c) { S.cat = c.dataset.spc; S.loaded = false; load(); return; }
  var b = e.target.closest('[data-sp]'); if (!b) return; var a = b.dataset.sp;
  if (a === 'dir') return;
  e.preventDefault();
  if (a === 'add') return addSheet();
  if (a === 'retry') return load();
  if (!signedIn()) { say('Sign in first'); try { if (window.ccAuthPanel) window.ccAuthPanel(); } catch (x) {} return; }
  var id = b.dataset.id;
  if (a === 'like') { b.disabled = true; call('/api/spots/' + id + '/like', { body: {} }).then(function (r) { var s = S.list.filter(function (x) { return x.id === id; })[0]; if (s) { s.likes = r.likes; s.liked = r.liked; } paint(); }).catch(function (x) { b.disabled = false; say(x.message); }); }
  if (a === 'rm') { if (!confirm('Remove this spot?')) return; call('/api/spots/' + id + '/remove', { body: {} }).then(function () { S.list = S.list.filter(function (x) { return x.id !== id; }); paint(); say('Removed'); }).catch(function (x) { say(x.message); }); }
});
})();
