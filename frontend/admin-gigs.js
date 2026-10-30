/* Admin: Gigs. Gigs the poster reported. Pay the worker or refund the poster. Loaded before admin-dash.js. */
(function () {
'use strict';
let gigs = null;
const _load = load;
load = async function () { await _load(); try { gigs = (await api('/api/admin/gigs')).gigs; } catch (e) { gigs = null; } render(); };
LABEL.gigs = 'Gigs';
SECTIONS.gigs = () => {
  if (!gigs) return ['<div class="card"><p class="sub">Gigs could not load. Run gigs.sql in Supabase (Site > SQL), then tap Refresh.</p></div>'];
  if (!gigs.length) return ['<div class="card"><p class="sub">No gigs in dispute.</p></div>'];
  return gigs.map((g) => '<div class="card" data-gid="' + esc(g.id) + '"><h3>' + esc(g.title) + '</h3><b>' + kes(g.price) + '</b> <span class="sub">worker gets ' + kes(g.pay) + '</span>'
    + '<p class="sub">Poster ' + esc(g.poster) + ' · Worker ' + esc(g.worker) + '</p><p style="overflow-wrap:anywhere">' + esc(g.details || '') + '</p><p><b>Problem reported:</b> ' + esc(g.reason) + '</p>'
    + '<div class="row"><button class="ok" data-gdo="release">Pay the worker</button><button class="bad" data-gdo="refund">Refund the poster</button></div></div>');
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-gdo]'); if (!b) return;
  const id = b.closest('[data-gid]').dataset.gid, a = b.dataset.gdo;
  if (!confirm(a === 'release' ? 'Pay the worker?' : 'Refund the poster?')) return;
  act(b, () => api('/api/admin/gigs/' + id, { action: a }), a === 'release' ? 'Worker paid' : 'Poster refunded');
});
})();
