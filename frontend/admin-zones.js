/* Admin: Zones. Add or remove the places comrades pick from (Feed filter, Market, Wi-Fi, hostels, services).
   Loaded before admin-dash.js. Uses api, load, render, SECTIONS, LABEL, esc, act, toast from admin.html. */
(function () {
'use strict';
let zones = null, zcamp = 'kirinyaga', zlist = [];
const _load = load;
load = async function () { await _load(); try { if (!zlist.length) zlist = (await api('/api/campuses')).campuses || []; } catch (e) {} try { zones = (await api('/api/admin/zones?campus=' + encodeURIComponent(zcamp))).zones; } catch (e) { zones = null; } render(); };
LABEL.zones = 'Zones';
SECTIONS.zones = () => {
  const add = '<div class="card"><h3>Add a zone</h3><p class="sub">A zone is a place students live or hang out, like Ngomongo or Diaspora. New zones show up for everyone straight away in the Feed filter, Market, Wi-Fi, hostels and services.</p>'
    + '<input id="zn_n" placeholder="Zone name, e.g. Ngomongo" maxlength="30" autocomplete="off"><div class="row"><button class="p" id="znadd">Add zone</button></div></div>';
  if (!zones) return [add, '<div class="card"><p class="sub">The zone list could not load. Run the newest SQL in Supabase (end of schema.sql), then tap Refresh.</p></div>'];
  return [add, '<div class="card"><h3>Current zones (' + zones.length + ')</h3><p class="sub">Removing a zone hides it from the pickers. Posts already made in that zone stay as they are.</p>'
    + zones.map((z) => '<div class="kv"><b style="text-align:left">@' + esc(z) + '</b><button class="bad" data-zr="' + esc(z) + '" style="padding:6px 14px">Remove</button></div>').join('') + '</div>'];
};
const _zs = SECTIONS.zones;
SECTIONS.zones = () => {
  const opts = (zlist.length ? zlist : [{ id: 'kirinyaga', name: 'Kirinyaga University' }]).map((c) => '<option value="' + esc(c.id) + '"' + (c.id === zcamp ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  return ['<div class="card"><h3>Which university?</h3><p class="sub">Every university has its own zones. Pick one, then add or remove its zones below.</p><select id="zn_c">' + opts + '</select></div>'].concat(_zs());
};
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'zn_c') { zcamp = e.target.value; load(); } });
document.addEventListener('click', (e) => {
  const a = e.target.closest('#znadd');
  if (a) {
    const name = $('#zn_n').value.trim();
    if (name.length < 2) return toast('Type the zone name');
    return act(a, () => api('/api/admin/zones', { action: 'add', name, campus: zcamp }), 'Zone added');
  }
  const r = e.target.closest('[data-zr]'); if (!r) return;
  const name = r.dataset.zr;
  if (!confirm('Remove the zone "' + name + '"? It disappears from the pickers. Existing posts keep it.')) return;
  act(r, () => api('/api/admin/zones', { action: 'remove', name, campus: zcamp }), 'Zone removed');
});
})();
