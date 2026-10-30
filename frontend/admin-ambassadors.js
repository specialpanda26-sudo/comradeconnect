/* Admin: Ambassadors. Add one trusted comrade per hostel or club, watch the monthly leaderboard, pay the top ones to their wallets.
   Loaded before admin-dash.js. Uses api, load, render, SECTIONS, LABEL, esc, act, toast, $ from admin.html. */
(function () {
'use strict';
let amb = null, month = '', current = '';
const _load = load;
load = async function () {
  await _load();
  try { const d = await api('/api/admin/ambassadors' + (month ? '?month=' + month : '')); amb = d.ambassadors; month = d.month; current = d.current || current; } catch (e) { amb = null; }
  render();
};
LABEL.ambassadors = 'Ambassadors';
SECTIONS.ambassadors = () => {
  const add = '<div class="card"><h3>New ambassador</h3><p class="sub">One trusted comrade per hostel or club. Type their username or invite code. They are ranked by friends who bought, then friends who joined.</p>'
    + '<input id="am_w" placeholder="Their username or invite code" maxlength="40" autocomplete="off">'
    + '<input id="am_l" placeholder="Hostel or club, e.g. Sunrise Hostel" maxlength="60" autocomplete="off">'
    + '<input id="am_c" placeholder="Campus (optional)" maxlength="40" autocomplete="off"><div class="row"><button class="p" id="amadd">Make ambassador</button></div></div>';
  if (!amb) return [add, '<div class="card"><p class="sub">Ambassadors could not load. Run ambassadors.sql in Supabase (Site > SQL), then tap Refresh.</p></div>'];
  const board = '<div class="card"><h3>Leaderboard</h3><input id="am_m" type="month" value="' + esc(month) + '">'
    + (amb.length ? amb.map((a) => '<div data-amid="' + esc(a.aid) + '" style="padding:10px 0;border-top:1px solid var(--line,rgba(255,255,255,.14))"><b>#' + a.rank + ' ' + esc(a.label) + '</b> <small>' + (a.active ? '' : 'off') + '</small>'
      + '<p class="sub">' + esc(a.handle || a.aid) + (a.code ? ' · code ' + esc(a.code) : '') + (a.campus ? ' · ' + esc(a.campus) : '') + '<br>' + a.bought + ' bought, ' + a.joined + ' joined' + (a.paid ? ' · paid ' + kes(a.paid) : '') + '</p>'
      + '<div class="row"><button data-amtoggle="' + esc(a.aid) + '" data-on="' + (a.active ? 1 : 0) + '">' + (a.active ? 'Turn off' : 'Turn on') + '</button><button class="bad" data-amdel="' + esc(a.aid) + '">Remove</button></div></div>').join('') : '<p class="sub">No ambassadors yet.</p>') + '</div>';
  const past = month && current && month < current;
  const pay = '<div class="card"><h3>Pay the top ambassadors</h3><p class="sub">Pays prizes to the wallets of the top places for ' + esc(month) + '. Only comrades with at least one bought friend are paid. You can pay a month once, after it ends.' + (past ? '' : ' Pick a finished month above.') + '</p>'
    + '<input id="am_p1" inputmode="numeric" placeholder="1st place, KSh" maxlength="5"><input id="am_p2" inputmode="numeric" placeholder="2nd place, KSh" maxlength="5"><input id="am_p3" inputmode="numeric" placeholder="3rd place, KSh" maxlength="5">'
    + '<div class="row"><button class="p" id="ampay"' + (past ? '' : ' disabled') + '>Pay to wallets</button></div></div>';
  return [add, board, pay];
};
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'am_m' && e.target.value) { month = e.target.value; load(); } });
document.addEventListener('click', (e) => {
  const a = e.target.closest('#amadd');
  if (a) return act(a, () => api('/api/admin/ambassadors', { who: $('#am_w').value.trim(), label: $('#am_l').value.trim(), campus: $('#am_c').value.trim() }), 'Ambassador added');
  const p = e.target.closest('#ampay');
  if (p) {
    const amounts = ['#am_p1', '#am_p2', '#am_p3'].map((s) => Number(($(s).value || '0').trim() || 0));
    if (amounts.some((x) => !Number.isInteger(x) || x < 0)) return toast('Enter whole shillings');
    if (!confirm('Pay ' + amounts.map((x, i) => (i + 1) + ': KSh ' + x).join(', ') + ' for ' + month + '? This cannot be undone.')) return;
    return act(p, () => api('/api/admin/ambassadors/pay', { month, amounts }), 'Prizes paid');
  }
  const card = e.target.closest('[data-amid]'); if (!card) return;
  const id = card.dataset.amid, t = e.target.closest('[data-amtoggle]'), d = e.target.closest('[data-amdel]');
  if (t) return act(t, () => api('/api/admin/ambassadors/' + id, { active: t.dataset.on !== '1' }), t.dataset.on === '1' ? 'Turned off' : 'Turned on');
  if (d) { if (!confirm('Remove this ambassador?')) return; act(d, () => api('/api/admin/ambassadors/' + id, { action: 'remove' }), 'Removed'); }
});
})();
