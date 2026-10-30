/* Admin: Sponsor slots. Pick which sponsor presents Today on campus, the Polls tab and Kura.
   Loaded before admin-dash.js. Uses api, load, render, SECTIONS, LABEL, esc, act, toast from admin.html. */
(function () {
'use strict';
const NAMES = [['today', 'Today on campus', 'The card at the top of the home feed.'], ['polls', 'Polls', 'The top of the Polls tab in Explore.'], ['kura', 'Kura', 'The top of the Kura home screen.']];
const Z = { sponsors: [], slots: {}, ready: true, loaded: false };
async function loadSlots() {
  try { const a = await api('/api/admin/sponsors'); Z.sponsors = (a && a.sponsors) || []; } catch (e) { Z.sponsors = []; }
  try { const d = await api('/api/admin/sponsor-slots'); Z.slots = d.slots || {}; Z.ready = d.ready !== false; } catch (e) { Z.ready = false; }
  Z.loaded = true;
}
const _load = load;
load = async function () { await _load(); await loadSlots(); render(); };
LABEL.slots = 'Sponsor slots';
SECTIONS.slots = () => {
  if (!Z.loaded) loadSlots().then(render);
  const head = '<div class="card"><h3>Sponsor slots</h3><p class="sub">Choose which sponsor shows <b>Presented by</b> on each screen. Add sponsors first in the Sponsors tab. Views and taps are counted on that sponsor.</p></div>';
  if (!Z.ready) return [head, '<div class="card"><h3>Not switched on yet</h3><p class="sub">Run sponsor-stats.sql and then sponsor-slots.sql in Supabase (Site > SQL), then tap Refresh.</p></div>'];
  const live = Z.sponsors.filter((s) => s.active);
  return [head].concat(NAMES.map((n) => '<div class="card"><h3>' + esc(n[1]) + '</h3><p class="sub">' + esc(n[2]) + '</p>'
    + '<select id="slot_' + n[0] + '"><option value="">No sponsor</option>' + live.map((s) => '<option value="' + esc(s.id) + '"' + (Z.slots[n[0]] === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select>'
    + '<div class="row"><button class="p" data-slotsave="' + n[0] + '">Save</button></div></div>'));
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-slotsave]'); if (!b) return;
  const slot = b.dataset.slotsave, sel = document.getElementById('slot_' + slot);
  act(b, () => api('/api/admin/sponsor-slots', { slot, sponsor_id: sel ? sel.value : '' }), 'Saved');
});
})();
