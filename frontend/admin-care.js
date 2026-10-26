/* admin-care.js v1: three new admin pages.
   Support      : "Request a review" and withdrawal-support requests from the app, with the person's M-Pesa number. Mark fixed and the person is told.
                  Also a "Check the SQL" button that says which SQL file is still missing in Supabase (for example mbogi.sql).
   Transactions : EVERY money movement on the site in one list: payments, wallet movements, withdrawals. Search by name, account, number or M-Pesa code.
   Phone numbers: every account that saved an M-Pesa number, so a payout that failed can be sent by hand.
   Loaded by admin.html before admin-dash.js. Uses api, load, render, tab, SECTIONS, LABEL, Q, kv, esc, kes, when, toast, ask, act from admin.html. */
(function () {
'use strict';
const C = { sup: [], view: 'open', open: 0, ready: true, msg: '', supLoaded: false, health: null, healthBusy: false,
  tx: [], txTotal: 0, txTotals: null, txType: 'all', txQ: '', txLoaded: false, txBusy: false, ph: [], phQ: '', phReady: true, phLoaded: false };
const get = async (p) => { try { return await api(p); } catch (e) { return { __err: e.message }; } };
const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch (e) { toast('Select the number and copy it'); } };

const st = document.createElement('style');
st.textContent = '.cr-chip{display:inline-block;padding:1px 9px;border-radius:99px;font-size:11px;font-weight:600;border:1px solid var(--gb);background:var(--g)}'
  + '.cr-chip.go{background:var(--ink);color:var(--inkfg);border-color:var(--ink)}.cr-chip.no{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 50%,transparent)}'
  + '.cr-tx{padding:14px 18px!important;margin:8px 0!important}.cr-tx .top2{display:flex;justify-content:space-between;gap:10px;align-items:baseline}'
  + '.cr-tx .sub{margin-top:2px}.cr-tots{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:12px}.cr-tots div{border:1px solid var(--line);border-radius:14px;padding:10px 12px}'
  + '.cr-tots b{display:block;font-size:16px}.cr-tots span{font-size:11px;color:var(--mut)}.cr-fil{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.cr-fil button.p{background:var(--ink)!important}'
  + '.cr-sql{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}';
document.head.appendChild(st);

const STATUS = { paid: ['Paid', 'go'], pending: ['Waiting for payment', ''], submitted: ['Code sent, check M-Pesa', ''], failed: ['Failed', 'no'], expired: ['Expired', 'no'], underpaid: ['Underpaid', 'no'],
  requested: ['Waiting for admin', ''], sending: ['Sending to M-Pesa', ''], rejected: ['Rejected, money returned', 'no'], available: ['Done', 'go'], void: ['Cancelled', 'no'], refunded: ['Refunded', ''] };
const chip = (s) => { const x = STATUS[s] || [String(s || ''), '']; return '<span class="cr-chip ' + x[1] + '">' + esc(x[0]) + '</span>'; };
const whoOf = (x) => (x.handle ? '@' + x.handle + ' · ' : '') + (x.aid || 'not signed in');

/* ---------- data ---------- */
async function loadSup() {
  const d = await get('/api/admin/support?status=' + C.view);
  if (d && !d.__err) { C.sup = d.items || []; C.open = d.open || 0; C.ready = d.ready !== false; C.msg = d.message || ''; } else { C.msg = (d && d.__err) || ''; }
  C.supLoaded = true;
  if (typeof Q !== 'undefined' && Q) { Q.counts = Q.counts || {}; Q.counts.support = C.open; }
}
async function loadTx(more) {
  if (C.txBusy) return; C.txBusy = true;
  const off = more ? C.tx.length : 0;
  const d = await get('/api/admin/transactions?type=' + C.txType + '&q=' + encodeURIComponent(C.txQ) + '&limit=60&offset=' + off);
  C.txBusy = false; C.txLoaded = true;
  if (d && !d.__err) { C.tx = more ? C.tx.concat(d.items || []) : (d.items || []); C.txTotal = d.total || 0; C.txTotals = d.totals || null; } else { toast((d && d.__err) || 'Could not load transactions'); }
}
async function loadPh() {
  const d = await get('/api/admin/phones?q=' + encodeURIComponent(C.phQ));
  C.phLoaded = true;
  if (d && !d.__err) { C.ph = d.items || []; C.phReady = d.ready !== false; C.msg = d.message || ''; }
}
const _load = load;
load = async function () { await _load(); await loadSup(); render(); };

LABEL.support = 'Support'; LABEL.txns = 'Transactions'; LABEL.phones = 'Phone numbers';

/* ---------- Support ---------- */
const reqCard = (x) => {
  const wd = x.kind === 'withdrawal', phone = x.phone || x.account_phone;
  return '<div class="card" data-id="' + esc(x.id) + '"><h3>' + (wd ? 'Withdrawal support' : x.kind === 'other' ? 'Message' : 'Error report') + ' <span class="cr-chip ' + (x.status === 'fixed' ? 'go' : x.status === 'dismissed' ? 'no' : '') + '">' + (x.status === 'open' ? 'Waiting for you' : x.status === 'fixed' ? 'Fixed' : 'Dismissed') + '</span></h3>'
    + kv([['Account', whoOf(x)], ['M-Pesa number', phone], ['Amount', x.amount ? kes(x.amount) : ''], ['Screen', x.page], ['Error the person saw', x.message], ['Technical detail', x.detail], ['The person wrote', x.note], ['Reference', x.ref], ['Sent', when(x.created_at)], ['Your note', x.admin_note]])
    + (wd && x.status === 'open' ? '<p class="sub">Send the money to this number yourself (Transactions page shows the withdrawal), then mark this fixed. The person is told when you do.</p>' : '')
    + '<div class="row">' + (phone ? '<button data-care="copy" data-v="' + esc(phone) + '">Copy number</button>' : '')
    + (x.status === 'open' ? '<button class="ok" data-care="fix">Mark fixed</button><button class="bad" data-care="dismiss">Dismiss</button>' : '<button data-care="reopen">Reopen</button>') + '</div></div>';
};
const healthHtml = () => {
  if (C.healthBusy) return '<p class="sub cr-sql">Checking every table in Supabase...</p>';
  const h = C.health; if (!h) return '';
  if (h.__err) return '<p class="sub cr-sql">' + esc(h.__err) + '</p>';
  if (h.ok) return '<p class="sub cr-sql"><b>All good.</b> Every table from the ' + esc(h.checked) + ' checked exists in Supabase.' + (h.mail && !h.mail.to ? ' Tip: set ADMIN_EMAIL on Render to get an email for each request.' : '') + '</p>';
  return '<div class="cr-sql"><b>Run these SQL files in Supabase</b><p class="sub">Open Site &gt; SQL here, tap the file, copy it, paste it in Supabase &gt; SQL Editor and run it. It is safe to run again.</p>'
    + h.to_run.map((f) => '<div class="kv"><span>' + esc(f.file) + '</span><b>' + esc(f.missing.slice(0, 4).join(', ')) + (f.missing.length > 4 ? ' +' + (f.missing.length - 4) + ' more' : '') + '</b></div>').join('') + '</div>';
};
SECTIONS.support = () => {
  if (!C.supLoaded) { loadSup().then(render); }
  const head = '<div class="card"><h3>Review requests</h3><p class="sub">When someone sees an error in the app and taps <b>Request a review</b>, it shows up here with the screen, the error and their M-Pesa number. Fix the cause, mark it fixed, and they get a notification.</p>'
    + '<div class="cr-fil">' + [['open', 'Open' + (C.open ? ' (' + C.open + ')' : '')], ['done', 'Done'], ['all', 'All']].map((v) => '<button data-care="view" data-v="' + v[0] + '" class="' + (C.view === v[0] ? 'p' : '') + '">' + v[1] + '</button>').join('')
    + '<button data-care="health">Check the SQL</button></div>' + healthHtml() + '</div>';
  if (!C.ready) return [head, '<div class="card"><h3>Not switched on yet</h3><p class="sub">' + esc(C.msg || 'Run support.sql in Supabase (Site > SQL).') + '</p></div>'];
  return [head].concat(C.sup.length ? C.sup.map(reqCard) : ['<div class="card"><p class="sub" style="text-align:center;padding:20px 0">' + (C.supLoaded ? 'No requests here. Enjoy the quiet.' : 'Loading...') + '</p></div>']);
};

/* ---------- Transactions ---------- */
const txRow = (x) => {
  const neg = x.amount < 0, sign = x.amount > 0 ? '+' : neg ? '−' : '';
  return '<div class="card cr-tx"><div class="top2"><b>' + esc(x.title) + '</b><b>' + sign + esc(kes(Math.abs(x.amount))) + '</b></div>'
    + '<div class="sub">' + esc(whoOf(x)) + ' &middot; ' + esc(when(x.at)) + ' &middot; ' + chip(x.status) + '</div>'
    + (x.phone ? '<div class="sub">M-Pesa ' + esc(x.phone) + ' <button data-care="copy" data-v="' + esc(x.phone) + '" style="padding:2px 10px;font-size:11px">Copy</button></div>' : '')
    + (x.ref ? '<div class="sub">Ref ' + esc(x.ref) + '</div>' : '') + (x.note ? '<div class="sub">' + esc(x.note) + '</div>' : '') + '</div>';
};
const totsHtml = () => { const t = C.txTotals; return t ? '<div class="cr-tots"><div><b>' + esc(kes(t.paid_in)) + '</b><span>Paid in (shown below)</span></div><div><b>' + esc(kes(t.paid_out)) + '</b><span>Paid out to M-Pesa</span></div><div><b>' + esc(kes(t.waiting_out)) + '</b><span>Withdrawals waiting</span></div></div>' : ''; };
const txListHtml = () => (C.tx.length ? C.tx.map(txRow).join('') : '<div class="card"><p class="sub" style="text-align:center;padding:20px 0">' + (C.txLoaded ? 'Nothing matches.' : 'Loading...') + '</p></div>')
  + (C.tx.length < C.txTotal ? '<div class="row"><button data-care="more">Show more (' + (C.txTotal - C.tx.length) + ' left)</button></div>' : '');
function paintTx() { const l = $('#care_list'), t = $('#care_tot'), c = $('#care_cnt'); if (l) l.innerHTML = txListHtml(); if (t) t.innerHTML = totsHtml(); if (c) c.textContent = C.txTotal + (C.txTotal === 1 ? ' transaction' : ' transactions'); }
SECTIONS.txns = () => {
  if (!C.txLoaded) loadTx().then(paintTx);
  return ['<div class="card"><h3>Every transaction</h3><p class="sub">Payments from buyers, wallet movements and withdrawals, newest first. Search a name, account ID, phone number or M-Pesa code.</p>'
    + '<input id="care_q" type="search" placeholder="Search name, account, number or M-Pesa code" value="' + esc(C.txQ) + '" autocomplete="off" aria-label="Search transactions">'
    + '<div class="cr-fil">' + [['all', 'All'], ['payments', 'Payments in'], ['wallet', 'Wallet'], ['withdrawals', 'Withdrawals']].map((v) => '<button data-care="type" data-v="' + v[0] + '" class="' + (C.txType === v[0] ? 'p' : '') + '">' + v[1] + '</button>').join('') + '</div>'
    + '<div id="care_tot">' + totsHtml() + '</div><p class="sub" id="care_cnt" style="margin-top:10px">' + C.txTotal + (C.txTotal === 1 ? ' transaction' : ' transactions') + '</p></div>', '<div id="care_list">' + txListHtml() + '</div>'];
};

/* ---------- Phone numbers ---------- */
const phListHtml = () => !C.phReady ? '<div class="card"><p class="sub">' + esc(C.msg || 'Run support.sql in Supabase (Site > SQL).') + '</p></div>'
  : C.ph.length ? C.ph.map((x) => '<div class="card cr-tx"><div class="top2"><b>' + esc(x.phone) + '</b><button data-care="copy" data-v="' + esc(x.phone) + '" style="padding:4px 12px;font-size:11px">Copy</button></div><div class="sub">' + esc(whoOf(x)) + '</div></div>').join('')
  : '<div class="card"><p class="sub" style="text-align:center;padding:20px 0">' + (C.phLoaded ? 'No numbers yet. People add theirs in Edit profile and when they ask for withdrawal support.' : 'Loading...') + '</p></div>';
function paintPh() { const l = $('#care_plist'); if (l) l.innerHTML = phListHtml(); }
SECTIONS.phones = () => {
  if (!C.phLoaded) loadPh().then(paintPh);
  return ['<div class="card"><h3>M-Pesa numbers</h3><p class="sub">Numbers people saved in Edit profile. If a payout failed, send the money to the number shown here.</p><input id="care_pq" type="search" placeholder="Search name, account or number" value="' + esc(C.phQ) + '" autocomplete="off" aria-label="Search numbers"></div>', '<div id="care_plist">' + phListHtml() + '</div>'];
};

/* ---------- clicks and typing ---------- */
let t1 = 0, t2 = 0;
document.addEventListener('input', (e) => {
  if (e.target.id === 'care_q') { C.txQ = e.target.value.trim(); clearTimeout(t1); t1 = setTimeout(() => loadTx().then(paintTx), 280); }
  if (e.target.id === 'care_pq') { C.phQ = e.target.value.trim(); clearTimeout(t2); t2 = setTimeout(() => loadPh().then(paintPh), 280); }
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-care]'); if (!b) return;
  const a = b.dataset.care, card = b.closest('[data-id]'), id = card && card.dataset.id;
  if (a === 'copy') return copy(b.dataset.v);
  if (a === 'view') { C.view = b.dataset.v; await loadSup(); return render(); }
  if (a === 'type') { C.txType = b.dataset.v; C.txLoaded = false; C.tx = []; render(); return; }
  if (a === 'more') { b.disabled = true; await loadTx(true); return paintTx(); }
  if (a === 'health') { C.healthBusy = true; C.health = null; render(); C.health = await get('/api/admin/health'); C.healthBusy = false; return render(); }
  if (!id) return;
  if (a === 'fix') { const n = ask('Tell the person what you fixed (optional). They will see it as a notification.', ''); if (n === null) return; return act(b, () => api('/api/admin/support/' + id, { action: 'fixed', note: n }), 'Marked fixed. The person was told.'); }
  if (a === 'dismiss') { const n = ask('Why are you dismissing it? (optional)', ''); if (n === null) return; return act(b, () => api('/api/admin/support/' + id, { action: 'dismissed', note: n }), 'Dismissed'); }
  if (a === 'reopen') return act(b, () => api('/api/admin/support/' + id, { action: 'reopen' }), 'Reopened');
});
})();
