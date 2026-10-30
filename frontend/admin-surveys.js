/* Admin: Paid surveys. Approve or reject surveys that comrades paid for, set the "Presented by" sponsor, read flagged answers and decide them,
   make a survey that a sponsor paid you for outside the app, and read the monthly billing summary (rewards paid out, fee earned, money held).
   Loaded before admin-dash.js. Uses api, load, render, SECTIONS, LABEL, esc, kv, kes, when, act, ask, toast, X, Q from admin.html. */
(function () {
'use strict';
const D = { items: [], bill: null, ready: true, view: 'pending', month: new Date().toISOString().slice(0, 7), loaded: false, msg: '', open: null, res: null, form: false };
const get = async (p) => { try { return await api(p); } catch (e) { return { __err: e.message }; } };
async function loadSurveys() {
  const d = await get('/api/admin/surveys?status=' + D.view);
  if (d && !d.__err) { D.items = d.surveys || []; D.ready = d.ready !== false; D.msg = ''; } else D.msg = (d && d.__err) || '';
  const b = await get('/api/admin/surveys/billing?month=' + D.month);
  D.bill = b && !b.__err ? b : null;
  if (D.ready) { const p = await get('/api/admin/surveys?status=pending'); if (p && !p.__err && typeof Q !== 'undefined' && Q) { Q.counts = Q.counts || {}; Q.counts.surveys = (p.surveys || []).length; } }
  D.loaded = true;
}
const _load = load;
load = async function () { await _load(); await loadSurveys(); if (D.open) { const r = await get('/api/admin/surveys/' + D.open + '/results'); D.res = r && !r.__err ? r : null; } render(); };
LABEL.surveys = 'Surveys';
const CHIP = { unpaid: ['Not paid', ''], pending: ['Waiting', ''], live: ['Live', 'go'], ended: ['Ended', ''], rejected: ['Rejected', 'no'] };
const card = (x) => {
  const c = CHIP[x.status] || ['', ''], sps = (typeof X !== 'undefined' && X.sponsors) || [];
  return '<div class="card" data-id="' + esc(x.id) + '"><h3>' + esc(x.title) + ' <span class="cr-chip ' + c[1] + '">' + esc(c[0]) + (x.hidden ? ', hidden' : '') + '</span></h3>'
    + (x.intro ? '<p class="sub" style="overflow-wrap:anywhere">' + esc(x.intro) + '</p>' : '')
    + '<p class="sub" style="margin:6px 0">' + (x.questions || []).map((q, i) => (i + 1) + '. ' + esc(q.text) + ' <i>(' + q.type + (q.options ? ': ' + q.options.map(esc).join(', ') : '') + ')</i>').join('<br>') + '</p>'
    + kv([['Maker', x.funding === 'offline' ? 'Admin (sponsor paid offline)' : x.aid], ['Campus', x.campus], ['Places', x.answers + ' of ' + x.wanted + ' answered'], ['Reward each', kes(x.reward)], ['Budget', kes(x.budget)], ['Fee', x.funding === 'offline' ? 'none' : kes(x.fee)], ['Paid in', kes(x.paid)], ['Returned', x.refunded ? kes(x.refunded) : ''], ['Open until', x.endsOn], ['Flagged answers', x.flagged ? String(x.flagged) : ''], ['Ended because', x.endReason], ['Reject note', x.note], ['Made', when(x.createdAt)]])
    + '<div class="row"><select data-svsp aria-label="Presented by"><option value="">No sponsor line</option>' + sps.map((s) => '<option value="' + esc(s.id) + '"' + (x.sponsorId === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select><button data-sv="sponsor">Save sponsor</button></div>'
    + '<div class="row">' + (x.status === 'pending' ? '<button class="ok" data-sv="approve">Approve</button><button class="bad" data-sv="reject">Reject and refund</button>' : '')
    + (x.status === 'live' || x.status === 'pending' ? '<button class="bad" data-sv="stop">Stop and refund unused</button>' : '')
    + (x.status === 'live' ? '<button data-sv="' + (x.hidden ? 'show' : 'hide') + '">' + (x.hidden ? 'Show again' : 'Hide') + '</button>' : '')
    + (x.status !== 'unpaid' && x.status !== 'rejected' ? '<button data-sv="results">' + (D.open === x.id ? 'Hide answers' : 'Answers') + '</button>' : '') + '</div>'
    + (D.open === x.id ? answers() : '') + '</div>';
};
const answers = () => {
  if (!D.res) return '<p class="sub">Loading answers...</p>';
  if (!D.res.list.length) return '<p class="sub">No answers yet.</p>';
  return '<div style="margin-top:10px">' + D.res.list.map((a) => '<div class="kv" data-rid="' + esc(a.id) + '" style="align-items:flex-start;gap:8px"><span class="sub" style="overflow-wrap:anywhere;flex:1">#' + a.n + (a.flagged ? ' FLAGGED' + (a.flagNote ? ' (' + esc(a.flagNote) + ')' : '') : '') + ' · ' + esc(a.aid) + '<br>' + esc(Object.keys(a.answers).map((k) => a.answers[k]).join(' | ')) + '</span>'
    + (a.status === 'done' || a.flagged ? '<span class="row" style="margin:0"><button class="ok" data-svr="ok">Keep</button><button class="bad" data-svr="junk">Junk</button></span>' : '') + '</div>').join('') + '</div>';
};
const form = () => '<div class="card"><h3>Make a survey a sponsor paid for</h3><p class="sub">Use this when a business paid you the reward budget outside the app. It goes live straight away, with no fee. Rewards come from that money. Write one question per line as <b>Question | single or multi or text | answer 1; answer 2</b>.</p>'
  + '<input id="sv_t" placeholder="Title" maxlength="90" aria-label="Title"><input id="sv_i" placeholder="Short intro (optional)" maxlength="300" aria-label="Intro">'
  + '<textarea id="sv_q" rows="5" placeholder="Where do you buy lunch? | single | Cafeteria; Kiosk; Cook&#10;What do you want cheaper? | multi | Food; Data; Rent&#10;Any idea for campus? | text" aria-label="Questions"></textarea>'
  + '<div class="row"><input id="sv_w" type="number" placeholder="Responses wanted" min="1" aria-label="Responses wanted"><input id="sv_r" type="number" placeholder="KSh each" min="1" aria-label="Reward each"><input id="sv_d" type="date" aria-label="Last day"></div>'
  + '<div class="row"><select id="sv_s" aria-label="Presented by"><option value="">No sponsor line</option>' + ((typeof X !== 'undefined' && X.sponsors) || []).map((s) => '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>').join('') + '</select>'
  + '<select id="sv_c" aria-label="Campus"><option value="all">All campuses</option>' + ((window.CAMPUSES || []).map((c) => '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>').join('')) + '</select></div>'
  + '<label class="sub" style="display:flex;gap:8px;align-items:center;margin:8px 0"><input id="sv_ok" type="checkbox"> I confirm the sponsor has already paid me the full reward budget.</label>'
  + '<div class="row"><button class="p" data-sv="create">Publish survey</button><button data-sv="cancel">Cancel</button></div></div>';
const parseQs = (t) => t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const p = l.split('|').map((s) => s.trim()); const ty = (p[1] || 'text').toLowerCase(); return { text: p[0], type: ty, options: ty === 'text' ? undefined : (p[2] || '').split(';').map((s) => s.trim()).filter(Boolean) }; });
const billing = () => {
  const b = D.bill; if (!b) return '';
  if (b.ready === false) return '<div class="card"><h3>Billing not ready</h3><p class="sub">Run surveys.sql in Supabase (Site > SQL), then tap Refresh.</p></div>';
  return '<div class="card"><h3>Billing, ' + esc(D.month) + '</h3><p class="sub">What survey makers paid out in rewards this month and the fee you earned on it. Money held is what makers have paid in for surveys still running.</p>'
    + '<div class="row"><button data-svm="-1">Previous month</button><button data-svm="0">This month</button></div>'
    + '<div class="kv"><span class="sub">Rewards paid to comrades</span><b>' + kes(b.paidOut) + '</b></div><div class="kv"><span class="sub">Fee earned</span><b>' + kes(b.fees) + '</b></div><div class="kv"><span class="sub">Responses</span><b>' + (b.responses || 0) + '</b></div><div class="kv"><span class="sub">Money held right now</span><b>' + kes(b.held) + '</b></div></div>'
    + (b.makers || []).map((o) => '<div class="card"><h3>' + esc(o.aid === 'admin' ? 'Admin (offline funded)' : o.aid) + '</h3>' + kv([['Rewards paid', kes(o.rewards)], ['Fee earned', kes(o.fee)], ['Responses', String(o.responses)], ['Surveys', String(o.surveys)]]) + '</div>').join('');
};
SECTIONS.surveys = () => {
  if (!D.loaded) loadSurveys().then(render);
  const head = '<div class="card"><h3>Paid surveys</h3><p class="sub">Surveys that comrades paid for. Approve the real ones, reject anything misleading or unsafe: rejected surveys refund the maker in full. The fee percent is in Money > Settings.</p>'
    + '<div class="row">' + [['pending', 'Waiting' + (typeof Q !== 'undefined' && Q && Q.counts && Q.counts.surveys ? ' (' + Q.counts.surveys + ')' : '')], ['live', 'Live'], ['ended', 'Ended'], ['rejected', 'Rejected'], ['unpaid', 'Not paid'], ['all', 'All']].map((v) => '<button data-svv="' + v[0] + '" class="' + (D.view === v[0] ? 'p' : '') + '">' + v[1] + '</button>').join('') + '<button data-sv="new">Make a sponsor survey</button></div></div>';
  if (!D.ready) return [head, '<div class="card"><h3>Not switched on yet</h3><p class="sub">' + esc(D.msg || 'Run surveys.sql in Supabase (Site > SQL), then tap Refresh.') + '</p></div>'];
  return [head].concat(D.form ? [form()] : []).concat(D.items.length ? D.items.map(card) : ['<div class="card"><p class="sub" style="text-align:center;padding:20px 0">' + (D.loaded ? 'No surveys here yet.' : 'Loading...') + '</p></div>']).concat([billing()]);
};
document.addEventListener('click', async (e) => {
  const v = e.target.closest('[data-svv]');
  if (v) { D.view = v.dataset.svv; D.open = null; await loadSurveys(); return render(); }
  const m = e.target.closest('[data-svm]');
  if (m) { const t = new Date(D.month + '-01T00:00:00Z'); t.setUTCMonth(m.dataset.svm === '0' ? new Date().getUTCMonth() : t.getUTCMonth() - 1, 1); if (m.dataset.svm === '0') t.setUTCFullYear(new Date().getUTCFullYear()); D.month = t.toISOString().slice(0, 7); await loadSurveys(); return render(); }
  const r = e.target.closest('[data-svr]');
  if (r) {
    const row = r.closest('[data-rid]'), a = r.dataset.svr;
    if (a === 'junk' && !confirm('Mark this answer as junk? No reward is paid and the money goes back to the maker.')) return;
    return act(r, () => api('/api/admin/surveys/responses/' + row.dataset.rid, { action: a }), 'Saved');
  }
  const b = e.target.closest('[data-sv]'); if (!b) return;
  const a = b.dataset.sv;
  if (a === 'new') { D.form = true; return render(); }
  if (a === 'cancel') { D.form = false; return render(); }
  if (a === 'create') {
    const val = (id) => (document.getElementById(id) || {}).value || '';
    const body = { title: val('sv_t'), intro: val('sv_i'), questions: parseQs(val('sv_q')), wanted: +val('sv_w'), reward: +val('sv_r'), ends_on: val('sv_d'), campus: val('sv_c') || 'all', sponsor_id: val('sv_s') || undefined, confirm_received: !!(document.getElementById('sv_ok') || {}).checked };
    return act(b, async () => { await api('/api/admin/surveys', body); D.form = false; D.view = 'live'; }, 'Published');
  }
  const card = b.closest('[data-id]'), id = card && card.dataset.id; if (!id) return;
  if (a === 'results') { D.open = D.open === id ? null : id; D.res = null; render(); if (D.open) { const res = await get('/api/admin/surveys/' + id + '/results'); D.res = res && !res.__err ? res : null; render(); } return; }
  if (a === 'sponsor') { const sel = card.querySelector('[data-svsp]'); return act(b, () => api('/api/admin/surveys/' + id, { action: 'sponsor', sponsor_id: sel ? sel.value : '' }), 'Saved'); }
  let note = '';
  if (a === 'reject') { const n = ask('Why is it rejected? (the maker will see this)', ''); if (n === null) return; note = n; }
  if (a === 'stop' && !confirm('Stop this survey? Unused money returns to the maker.')) return;
  act(b, () => api('/api/admin/surveys/' + id, { action: a, note }), 'Saved');
});
})();
