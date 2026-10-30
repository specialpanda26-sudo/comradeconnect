/* Admin: Adverts. Every "Advertise with us" enquiry saved on the server. Call or WhatsApp them, then mark the result.
   Loaded before admin-dash.js. Uses api, load, render, SECTIONS, LABEL, esc, kv, when, act, ask, toast from admin.html. */
(function () {
'use strict';
const C = { items: [], open: 0, ready: true, msg: '', view: 'new', loaded: false };
const get = async (p) => { try { return await api(p); } catch (e) { return { __err: e.message }; } };
async function loadAds() {
  const d = await get('/api/admin/adverts?status=' + C.view);
  if (d && !d.__err) { C.items = d.items || []; C.open = d.open || 0; C.ready = d.ready !== false; C.msg = d.message || ''; } else { C.msg = (d && d.__err) || ''; }
  C.loaded = true;
  if (typeof Q !== 'undefined' && Q) { Q.counts = Q.counts || {}; Q.counts.adverts = C.open; }
}
const _load = load;
load = async function () { await _load(); await loadAds(); render(); };
LABEL.adverts = 'Adverts';
const CHIP = { new: ['New lead', ''], contacted: ['Contacted', ''], won: ['Won a deal', 'go'], dismissed: ['Dismissed', 'no'] };
const card = (x) => {
  const c = CHIP[x.status] || ['', ''];
  return '<div class="card" data-id="' + esc(x.id) + '"><h3>' + esc(x.business) + ' <span class="cr-chip ' + c[1] + '">' + esc(c[0]) + '</span></h3>'
    + kv([['WhatsApp', x.local], ['Package', x.package], ['They promote', x.note], ['Sent', when(x.created_at)], ['Your note', x.admin_note]])
    + '<div class="row"><a class="btn p" style="text-decoration:none" target="_blank" rel="noopener noreferrer" href="https://wa.me/' + esc(x.phone) + '">WhatsApp</a>'
    + (x.status === 'new' ? '<button class="ok" data-adv="contacted">Contacted</button><button class="ok" data-adv="won">Won</button><button class="bad" data-adv="dismissed">Dismiss</button>' : '<button data-adv="reopen">Reopen</button>') + '</div></div>';
};
SECTIONS.adverts = () => {
  if (!C.loaded) loadAds().then(render);
  const head = '<div class="card"><h3>Advertiser enquiries</h3><p class="sub">Businesses that filled in <b>Advertise with us</b> in the app. Reply on WhatsApp, then mark the result so nothing gets lost.</p>'
    + '<div class="row">' + [['new', 'New' + (C.open ? ' (' + C.open + ')' : '')], ['done', 'Done'], ['all', 'All']].map((v) => '<button data-advv="' + v[0] + '" class="' + (C.view === v[0] ? 'p' : '') + '">' + v[1] + '</button>').join('') + '</div></div>';
  if (!C.ready) return [head, '<div class="card"><h3>Not switched on yet</h3><p class="sub">' + esc(C.msg || 'Run advertisers.sql in Supabase (Site > SQL).') + '</p></div>'];
  return [head].concat(C.items.length ? C.items.map(card) : ['<div class="card"><p class="sub" style="text-align:center;padding:20px 0">' + (C.loaded ? 'No enquiries here yet.' : 'Loading...') + '</p></div>']);
};
document.addEventListener('click', async (e) => {
  const v = e.target.closest('[data-advv]');
  if (v) { C.view = v.dataset.advv; await loadAds(); return render(); }
  const b = e.target.closest('[data-adv]'); if (!b) return;
  const card = b.closest('[data-id]'), id = card && card.dataset.id, a = b.dataset.adv; if (!id) return;
  let note = '';
  if (a !== 'reopen') { const n = ask('Add a short note (optional)', ''); if (n === null) return; note = n; }
  act(b, () => api('/api/admin/adverts/' + id, { action: a, note }), 'Saved');
});
})();
