/* Admin: Suggested zones. Adds a card to the Zones page: pick how far to look around the university (10 m to 20 km), see the places where most
   students live, tick the ones you want and add them all as zones in one tap. Loaded after admin-zones.js.
   Uses api, render, SECTIONS, esc, act, toast, $ from admin.html. */
(function () {
'use strict';
var S = { camp: '', radius: 2000, custom: '', res: null, sel: {}, names: {}, busy: false, err: '' };
var RAD = [[10, '10 m'], [100, '100 m'], [500, '500 m'], [1000, '1 km'], [2000, '2 km'], [5000, '5 km'], [10000, '10 km']];
var fmt = function (m) { return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m % 1000 ? 1 : 0) + ' km'; };
var camp = function () { var s = $('#zn_c'); return s ? s.value : (S.camp || 'kirinyaga'); };

function card() {
  var c = camp();
  if (S.camp && S.camp !== c) { S.res = null; S.sel = {}; S.names = {}; S.err = ''; }
  S.camp = c;
  var opts = RAD.map(function (r) { return '<option value="' + r[0] + '"' + (!S.custom && r[0] === S.radius ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('');
  var h = '<div class="card"><h3>Suggested zones near this university</h3><p class="sub">Finds the places around the university where most students live, from hostel and room posts, Wi-Fi, services and mapped homes. Tick the ones you want and add them in one tap.</p>'
    + '<div class="row"><select id="zs_r" aria-label="How far to look">' + opts + '</select><input id="zs_m" type="number" min="10" max="20000" step="10" inputmode="numeric" placeholder="or type metres" value="' + esc(S.custom) + '" style="max-width:140px"><button class="p" id="zs_go"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Finding...' : 'Find zones') + '</button></div>';
  if (S.err) h += '<p class="sub" style="color:#c0392b">' + esc(S.err) + '</p>';
  var d = S.res;
  if (d) {
    if (!d.zones.length) {
      h += '<p class="sub">No zones within ' + fmt(d.radius_m) + ' of ' + esc(d.campus.name) + '.' + (d.nearest_outside ? ' The closest is ' + esc(d.nearest_outside.name || 'an unnamed area') + ', ' + fmt(d.nearest_outside.distance_m) + ' away. Try a bigger distance.' : ' Try a bigger distance.') + '</p>';
    } else {
      h += '<p class="sub">' + d.zones.length + ' places within ' + fmt(d.radius_m) + ' of ' + esc(d.campus.name) + ', best first. The score (0 to 100) is an estimate, not a head-count.' + (d.sources && d.sources.map === 'unavailable' ? ' The map could not be reached, so this uses app activity only.' : '') + '</p>';
      h += d.zones.map(function (z, i) {
        var e = z.evidence || {}, bits = [];
        if (e.vacancies) bits.push(e.vacancies + ' vacancy posts'); if (e.hostel_reviews) bits.push(e.hostel_reviews + ' hostel reviews'); if (e.rooms) bits.push(e.rooms + ' room posts'); if (e.wifi) bits.push(e.wifi + ' Wi-Fi'); if (e.buildings) bits.push(e.buildings + ' mapped homes');
        var nm = z.name ? '<b style="text-align:left">@' + esc(z.name) + '</b>' : '<input data-zsn="' + i + '" placeholder="Name this area" maxlength="30" value="' + esc(S.names[i] || '') + '" style="max-width:160px">';
        return '<div class="kv" style="align-items:flex-start"><label style="display:flex;gap:10px;align-items:flex-start;flex:1;min-width:0"><input type="checkbox" data-zs="' + i + '"' + (S.sel[i] ? ' checked' : '') + (z.existing ? ' disabled' : '') + ' style="margin-top:4px">'
          + '<span style="min-width:0">' + nm + (z.existing ? ' <span class="sub">already a zone</span>' : '') + '<br><span class="sub">' + (z.distance_m != null ? fmt(z.distance_m) + (z.direction ? ' ' + esc(z.direction) : '') : 'distance unknown') + (bits.length ? ' \u00b7 ' + esc(bits.join(', ')) : '') + '</span></span></label>'
          + '<b>' + z.score + '</b></div>';
      }).join('');
      h += '<div class="row"><button class="ok" id="zs_add">Add selected zones</button></div>';
    }
    if (d.attribution) h += '<p class="sub">' + esc(d.attribution) + '.</p>';
  }
  return h + '</div>';
}

var _z = SECTIONS.zones;
SECTIONS.zones = function () { var a = _z(); return (Array.isArray(a) ? a : [a]).concat([card()]); };

document.addEventListener('change', function (e) {
  var t = e.target; if (!t) return;
  if (t.id === 'zs_r') { S.radius = Number(t.value); S.custom = ''; }
  if (t.dataset && t.dataset.zs != null) S.sel[t.dataset.zs] = t.checked;
});
document.addEventListener('input', function (e) {
  var t = e.target; if (!t) return;
  if (t.id === 'zs_m') S.custom = t.value;
  if (t.dataset && t.dataset.zsn != null) S.names[t.dataset.zsn] = t.value;
});
document.addEventListener('click', async function (e) {
  var go = e.target.closest && e.target.closest('#zs_go');
  if (go) {
    var r = S.custom ? Number(S.custom) : S.radius;
    if (!isFinite(r) || r < 10) { toast('Distance must be at least 10 metres'); return; }
    S.busy = true; S.err = ''; render();
    try {
      S.res = await api('/api/zones/suggest?campus=' + encodeURIComponent(camp()) + '&radius=' + Math.round(r) + '&limit=25');
      S.sel = {}; S.names = {};
      S.res.zones.slice(0, 8).forEach(function (z, i) { if (z.name && !z.existing) S.sel[i] = true; });   // the best eight new ones start ticked
    } catch (x) { S.err = x.message || 'Could not find zones'; S.res = null; }
    S.busy = false; render(); return;
  }
  var add = e.target.closest && e.target.closest('#zs_add');
  if (add && S.res) {
    var names = [];
    S.res.zones.forEach(function (z, i) { if (!S.sel[i] || z.existing) return; var n = (z.name || S.names[i] || '').trim(); if (n.length >= 2) names.push(n); });
    if (!names.length) { toast('Tick at least one zone (unnamed areas need a name first)'); return; }
    act(add, async function () {
      var d = await api('/api/admin/zones/suggest-apply', { campus: camp(), names: names });
      var done = (d.added || []).map(function (n) { return n.toLowerCase(); });
      S.res.zones.forEach(function (z, i) { var n = (z.name || S.names[i] || '').trim().toLowerCase(); if (done.indexOf(n) > -1 || (d.skipped || []).some(function (k) { return k.toLowerCase() === n; })) { z.existing = true; if (!z.name) z.name = S.names[i].trim(); S.sel[i] = false; } });
      if (d.skipped && d.skipped.length) toast(d.added.length + ' added, ' + d.skipped.length + ' skipped (already there or the list is full)');
    }, 'Zones added');
  }
});
})();
