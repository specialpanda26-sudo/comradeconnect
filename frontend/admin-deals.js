/* Admin: Local deals. Approve or reject the offers businesses post, see how many comrades claimed and used each one,
   and read the monthly billing summary (what each business owes for confirmed redemptions; the fee is set in Money > Settings).
   Loaded before admin-dash.js. Uses api, load, render, SECTIONS, LABEL, esc, kv, kes, when, act, ask, toast from admin.html. */
(function () {
'use strict';
const D = { items: [], bill: null, ready: true, view: 'pending', month: new Date().toISOString().slice(0, 7), loaded: false, msg: '' };
const get = async (p) => { try { return await api(p); } catch (e) { return { __err: e.message }; } };
async function loadDeals() {
  const d = await get('/api/admin/deals?status=' + D.view);
  if (d && !d.__err) { D.items = d.deals || []; D.ready = d.ready !== false; D.msg = ''; } else D.msg = (d && d.__err) || '';
  const b = await get('/api/admin/deals/billing?month=' + D.month);
  D.bill = b && !b.__err ? b : null;
  if (D.ready) { const p = await get('/api/admin/deals?status=pending'); if (p && !p.__err && typeof Q !== 'undefined' && Q) { Q.counts = Q.counts || {}; Q.counts.deals = (p.deals || []).length; } }
  D.loaded = true;
}
const _load = load;
load = async function () { await _load(); await loadDeals(); render(); };
LABEL.deals = 'Deals';
const CHIP = { pending: ['Waiting', ''], approved: ['Live', 'go'], rejected: ['Rejected', 'no'], ended: ['Ended', ''] };
const card = (x) => {
  const c = CHIP[x.status] || ['', ''];
  return '<div class="card" data-id="' + esc(x.id) + '"><h3>' + esc(x.business) + ' <span class="cr-chip ' + c[1] + '">' + esc(c[0]) + (x.hidden ? ', hidden' : '') + '</span></h3>'
    + '<p style="overflow-wrap:anywhere;margin:4px 0 8px"><b>' + esc(x.title) + '</b></p>'
    + kv([['Details', x.details], ['Type', x.category], ['Where', x.place], ['Campus', x.campus], ['Valid until', x.validUntil], ['Claimed (active)', x.status === 'approved' ? String(x.claims) : ''], ['Confirmed', x.status === 'approved' ? String(x.redeemed) : ''], ['Account', x.aid], ['Posted', when(x.createdAt)], ['Reject note', x.note]])
    + '<div class="row"><a class="btn p" style="text-decoration:none" target="_blank" rel="noopener noreferrer" href="https://wa.me/' + esc(x.phone) + '">WhatsApp</a>'
    + (x.status === 'pending' ? '<button class="ok" data-deal="approve">Approve</button><button class="bad" data-deal="reject">Reject</button>' : '')
    + (x.status === 'approved' ? '<button class="bad" data-deal="' + (x.hidden ? 'show' : 'hide') + '">' + (x.hidden ? 'Show again' : 'Hide') + '</button>' : '') + '</div></div>';
};
const billing = () => {
  const b = D.bill; if (!b) return '';
  if (b.ready === false) return '<div class="card"><h3>Billing not ready</h3><p class="sub">Run deals.sql in Supabase (Site > SQL), then tap Refresh.</p></div>';
  return '<div class="card"><h3>Billing, ' + esc(D.month) + '</h3><p class="sub">What businesses owe for confirmed redemptions this month. Send the total on WhatsApp and collect it by M-Pesa.</p>'
    + '<div class="row"><button data-dealm="-1">Previous month</button><button data-dealm="0">This month</button></div>'
    + '<div class="kv"><span class="sub">Total owed</span><b>' + kes(b.total) + '</b></div><div class="kv"><span class="sub">Confirmed redemptions</span><b>' + (b.redemptions || 0) + '</b></div></div>'
    + (b.businesses || []).map((o) => '<div class="card"><h3>' + esc(o.business) + '</h3>' + kv([['Owes', kes(o.owed)], ['Redemptions', String(o.redemptions)], ['Deals', String(o.deals)], ['Account', o.aid]])
      + '<div class="row"><a class="btn p" style="text-decoration:none" target="_blank" rel="noopener noreferrer" href="https://wa.me/' + esc(o.phone) + '?text=' + encodeURIComponent('Hello ' + o.business + ', your Comrade Connect deals bill for ' + D.month + ' is ' + kes(o.owed) + ' for ' + o.redemptions + ' confirmed redemptions. Thank you!') + '">Send bill on WhatsApp</a></div></div>').join('');
};
SECTIONS.deals = () => {
  if (!D.loaded) loadDeals().then(render);
  const head = '<div class="card"><h3>Local deals</h3><p class="sub">Student offers from food spots, salons and cyber cafes. Approve the real ones, reject anything fake. The fee per confirmed redemption is in Money > Settings.</p>'
    + '<div class="row">' + [['pending', 'Waiting' + (typeof Q !== 'undefined' && Q && Q.counts && Q.counts.deals ? ' (' + Q.counts.deals + ')' : '')], ['approved', 'Live'], ['rejected', 'Rejected'], ['ended', 'Ended'], ['all', 'All']].map((v) => '<button data-dealv="' + v[0] + '" class="' + (D.view === v[0] ? 'p' : '') + '">' + v[1] + '</button>').join('') + '</div></div>';
  if (!D.ready) return [head, '<div class="card"><h3>Not switched on yet</h3><p class="sub">' + esc(D.msg || 'Run deals.sql in Supabase (Site > SQL), then tap Refresh.') + '</p></div>'];
  return [head].concat(D.items.length ? D.items.map(card) : ['<div class="card"><p class="sub" style="text-align:center;padding:20px 0">' + (D.loaded ? 'No deals here yet.' : 'Loading...') + '</p></div>']).concat([billing()]);
};
document.addEventListener('click', async (e) => {
  const v = e.target.closest('[data-dealv]');
  if (v) { D.view = v.dataset.dealv; await loadDeals(); return render(); }
  const m = e.target.closest('[data-dealm]');
  if (m) { const t = new Date(D.month + '-01T00:00:00Z'); t.setUTCMonth(m.dataset.dealm === '0' ? new Date().getUTCMonth() : t.getUTCMonth() - 1, 1); if (m.dataset.dealm === '0') t.setUTCFullYear(new Date().getUTCFullYear()); D.month = t.toISOString().slice(0, 7); await loadDeals(); return render(); }
  const b = e.target.closest('[data-deal]'); if (!b) return;
  const card = b.closest('[data-id]'), id = card && card.dataset.id, a = b.dataset.deal; if (!id) return;
  let note = '';
  if (a === 'reject') { const n = ask('Why is it rejected? (the business will see this)', ''); if (n === null) return; note = n; }
  act(b, () => api('/api/admin/deals/' + id, { action: a, note }), 'Saved');
});
})();
