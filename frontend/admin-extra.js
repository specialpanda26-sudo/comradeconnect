/* Admin extras: Money and fees (earnings, fee %, advert prices, payout rules), payout history, sponsors with amounts, edit buttons.
   Loaded by admin.html after its own script, so it can use api, render, SECTIONS, LABEL, kv, kes, when, esc, act, ask, toast. */
(function () {
'use strict';
const Z = { settings: [], earn: null, payouts: [], sponsors: null, pstatus: 'paid' };
const get = async (p) => { try { return await api(p); } catch (e) { return null; } };
async function loadZ() {
  const r = await Promise.all([get('/api/admin/settings'), get('/api/admin/earnings'), get('/api/admin/payouts?status=' + Z.pstatus), get('/api/admin/sponsors')]);
  Z.settings = (r[0] && r[0].settings) || []; Z.earn = r[1]; Z.payouts = (r[2] && r[2].payouts) || []; Z.sponsors = r[3] && r[3].sponsors ? r[3].sponsors : null;   // null = use the public list
}
const _load = load;
load = async function () { await _load(); await loadZ(); render(); };

const old = Object.assign({}, LABEL); Object.keys(LABEL).forEach((k) => delete LABEL[k]);
LABEL.settings = 'Money and fees'; Object.assign(LABEL, old); LABEL.payouts = 'Payout history';

SECTIONS.settings = () => {
  const e = Z.earn;
  const earn = e ? '<div class="card"><h3>Company earnings</h3>' + kv([
    ['Marketplace fees (finished orders)', kes(e.market_fees.total)], ['Last 30 days', kes(e.market_fees.last30)], ['Fees still in escrow', kes(e.market_fees.in_escrow)],
    ['Advert boosts', kes(e.boosts.total)], ['Boosts, last 30 days', kes(e.boosts.last30)],
    ['Withdrawal fees kept', kes(e.withdrawal_fees.total)], ['TOTAL EARNED', kes(e.total_earned)],
    ['Owed to sellers (waiting payouts)', kes(e.owed_to_sellers)], ['Paid out so far', kes(e.paid_out)], ['Live sponsor deals', kes(e.sponsors_active)],
  ]) + '<p class="sub">Escrow fees become yours only when the order is released. Boost income counts only boosts you confirmed.</p></div>'
    : '<div class="card"><p class="sub">Earnings could not load. Run the newest SQL in Supabase, then tap Refresh.</p></div>';
  const form = '<div class="card"><h3>Fees and prices</h3><p class="sub">Changes apply to NEW orders, boosts and withdrawals. Anything already paid keeps its old rate.</p>'
    + Z.settings.map((s) => '<label class="sub" style="display:block;margin-top:12px">' + esc(s.label) + (s.unit ? ' (' + esc(s.unit) + ')' : '') + '<input data-set="' + esc(s.key) + '" inputmode="decimal" value="' + esc(s.value) + '"></label><p class="sub" style="margin:2px 0 0">' + esc(s.help || '') + ' Allowed: ' + esc(s.min) + ' to ' + esc(s.max) + '.</p>').join('')
    + '<div class="row"><button class="p" id="setsave">Save changes</button></div></div>';
  return [earn, form];
};

SECTIONS.payouts = () => ['<div class="row"><button data-x="pf" data-s="paid">Paid</button><button data-x="pf" data-s="rejected">Rejected or cancelled</button></div>']
  .concat(Z.payouts.map((w) => '<div class="card"><h3>' + kes(w.net == null ? w.amount : w.net) + ' ' + esc(w.status) + '</h3>'
    + kv([['Wallet debited', kes(w.amount)], ['Fee kept', w.fee ? kes(w.fee) : ''], ['Sent to', w.phone], ['Account', w.aid], ['M-Pesa code', w.payout_ref], ['Decided', when(w.decided_at)]]) + '</div>'));

SECTIONS.withdrawals = () => Q.withdrawals.map((w) => { const net = w.net == null ? w.amount : w.net;
  return '<div class="card" data-id="' + esc(w.id) + '"><h3>Send ' + kes(net) + '</h3>'
    + kv([['Wallet debited', kes(w.amount)], ['Fee kept', w.fee ? kes(w.fee) : ''], ['Send to', w.phone], ['Account', w.aid], ['Requested', when(w.created_at)]])
    + '<p class="sub">Send exactly ' + esc(kes(net)) + ' by M-Pesa first, then mark it paid with the M-Pesa code.</p><div class="row"><button data-do="copy" data-v="' + esc(w.phone) + '">Copy number</button><button class="ok" data-do="paid">I sent it</button><button class="bad" data-do="wreject">Reject and refund wallet</button></div></div>'; });

SECTIONS.sponsors = () => {
  const form = '<div class="card"><h3>New sponsor</h3><input id="sp_n" placeholder="Sponsor name" maxlength="80"><input id="sp_b" placeholder="One line about them" maxlength="200"><input id="sp_l" placeholder="Link, must start with https://" maxlength="200"><input id="sp_a" placeholder="Advert amount agreed, KSh" inputmode="numeric" maxlength="7"><input id="sp_e" placeholder="Ends on, YYYY-MM-DD (empty = no end)" maxlength="10"><div class="row"><button class="p" id="spadd2">Add sponsor</button></div></div>';
  return [form].concat((Z.sponsors || X.sponsors).map((x) => '<div class="card" data-id="' + esc(x.id) + '"><h3>' + esc(x.name) + '</h3>'
    + kv([['Status', x.active ? 'Live' : 'Paused'], ['About', x.blurb], ['Link', x.link], ['Advert amount', kes(x.amount || 0)], ['Ends', x.ends_at ? String(x.ends_at).slice(0, 10) : 'No end date']])
    + '<div class="row"><button data-x="spedit">Edit</button><button data-x="sptog">' + (x.active ? 'Pause' : 'Make live') + '</button><button class="bad" data-do="spdel">Delete</button></div></div>'));
};
const addEdit = (key, doName, xName, label) => { const o = SECTIONS[key]; SECTIONS[key] = () => o().map((h) => h.replace('<button class="bad" data-do="' + doName + '">', '<button data-x="' + xName + '">' + label + '</button><button class="bad" data-do="' + doName + '">')); };
addEdit('notices', 'ntdel', 'ntedit', 'Edit'); addEdit('events', 'evdel', 'evedit', 'Edit');

document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.closest('#setsave')) {
    const values = {}; document.querySelectorAll('[data-set]').forEach((i) => { values[i.dataset.set] = i.value.trim(); });
    return act(t, () => api('/api/admin/settings', { values }), 'Saved');
  }
  if (t.closest('#spadd2')) {
    const n = $('#sp_n').value.trim(), l = $('#sp_l').value.trim(), a = $('#sp_a').value.trim(), en = $('#sp_e').value.trim();
    if (n.length < 2) return toast('Add the sponsor name');
    if (l && !/^https:\/\//.test(l)) return toast('The link must start with https://');
    if (a && !/^\d+$/.test(a)) return toast('Amount must be a number');
    if (en && !/^\d{4}-\d{2}-\d{2}$/.test(en)) return toast('End date looks like 2026-12-31');
    return act(t, () => api('/api/admin/sponsors', { name: n, blurb: $('#sp_b').value.trim(), link: l, amount: a ? +a : 0, ends_on: en }), 'Sponsor added');
  }
  const b = t.closest('[data-x]'); if (!b) return;
  const card = b.closest('.card'), id = card && card.dataset.id, d = b.dataset.x;
  if (d === 'pf') { Z.pstatus = b.dataset.s; const p = await get('/api/admin/payouts?status=' + Z.pstatus); Z.payouts = (p && p.payouts) || []; return render(); }
  if (d === 'sptog') { const x = (Z.sponsors || X.sponsors).find((s) => s.id === id); return act(b, () => api('/api/admin/sponsors/' + id, { action: 'update', active: !x.active }), x.active ? 'Paused' : 'Live'); }
  if (d === 'spedit') {
    const x = (Z.sponsors || X.sponsors).find((s) => s.id === id); if (!x) return;
    const n = ask('Name:', x.name); if (n === null) return;
    const bl = ask('One line about them:', x.blurb || ''); if (bl === null) return;
    const l = ask('Link (https://, empty = none):', x.link || ''); if (l === null) return;
    const a = ask('Advert amount in KSh:', String(x.amount || 0)); if (a === null) return;
    const en = ask('Ends on (YYYY-MM-DD, empty = no end):', x.ends_at ? String(x.ends_at).slice(0, 10) : ''); if (en === null) return;
    return act(b, () => api('/api/admin/sponsors/' + id, { action: 'update', name: n, blurb: bl, link: l, amount: a, ends_on: en }), 'Sponsor updated');
  }
  if (d === 'ntedit') {
    const x = X.notices.find((s) => s.id === id); if (!x) return;
    const ti = ask('Title:', x.title); if (ti === null) return;
    const bo = ask('Details:', x.body || ''); if (bo === null) return;
    const dy = ask('Hide after how many days from now? (empty = leave as it is)', ''); if (dy === null) return;
    const body = { action: 'update', title: ti, body: bo, pinned: confirm('Pin to the top?') }; if (dy) body.expires_days = dy;
    return act(b, () => api('/api/admin/notices/' + id, body), 'Notice updated');
  }
  if (d === 'evedit') {
    const x = X.events.find((s) => s.id === id); if (!x) return;
    const ti = ask('Title:', x.title); if (ti === null) return;
    const dt = ask('Date (YYYY-MM-DD):', x.date); if (dt === null) return;
    const ve = ask('Venue:', x.venue || ''); if (ve === null) return;
    const de = ask('Details:', x.details || ''); if (de === null) return;
    const pr = ask('Ticket price in KSh (empty = no tickets):', x.ticket_price ? String(x.ticket_price) : ''); if (pr === null) return;
    return act(b, () => api('/api/admin/events/' + id, { action: 'update', title: ti, date: dt, venue: ve, details: de, ticket_price: pr }), 'Event updated');
  }
});
})();
