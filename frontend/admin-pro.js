/* admin-pro.js v1: sidebar + top search + dashboard like the e-commerce reference, and a Joins section where the admin
   can remove a join (Kura entry, club member, study-group member). Loaded last by admin.html, after admin-dash.js.
   Uses api, load, render, tab, SECTIONS, LABEL, Q, act, esc, kes, when, toast, $ from the scripts before it. */
(function () {
'use strict';
const num = (n) => Number(n || 0).toLocaleString('en-KE');
const get = async (p) => { try { return await api(p); } catch (e) { return null; } };
const P = { stats: null, earn: null, audit: [] }, J = { club: [], groups: [], kura: [], k: 'kura', ok: false };
const ICON = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2.2.7 3.5 2.6 3.5 5.6"/>',
  inbox: '<path d="M4 13l3-8h10l3 8v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9-4.3-4.1 5.9-.8z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  wallet: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', out: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2.5l2.2 11h10.3l2-8H7"/>',
  shield: '<path d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>', chev: '<path d="M9 6l6 6-6 6"/>',
};
const svg = (k, s) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:' + (s || 20) + 'px;height:' + (s || 20) + 'px" aria-hidden="true">' + ICON[k] + '</svg>';

/* ---------- the sections (same tabs as before, plus Joins) ---------- */
const GROUPS = [
  { n: 'Overview', icon: 'grid', h: 'Dashboard', lead: 'Track your users, money and what needs a decision, live.', tabs: ['dashboard'] },
  { n: 'Users', icon: 'users', h: 'Users', lead: 'Find anyone and control their account.', tabs: ['users', 'phones', 'grant'] },
  { n: 'Review', icon: 'inbox', h: 'Waiting for you', lead: 'Everything that needs a decision from you.', tabs: ['listings', 'confirm', 'withdrawals', 'verifications', 'disputes', 'reports', 'payments', 'support'] },
  { n: 'Market', icon: 'bag', h: 'Market and campus', lead: 'Items, events, notices, sponsors and the club shop.', tabs: ['live', 'events', 'notices', 'sponsors', 'club', 'services', 'push'] },
  { n: 'Kura', icon: 'star', h: 'Kura', lead: 'Contestants, votes and the season.', tabs: ['kura'] },
  { n: 'Joins', icon: 'link', h: 'Joins', lead: 'See who joined what, and remove a join when you need to.', tabs: ['joins'] },
  { n: 'Money', icon: 'wallet', h: 'Money', lead: 'Earnings, fees and payouts.', tabs: ['txns', 'settings', 'payouts'] },
  { n: 'Site', icon: 'sliders', h: 'Site', lead: 'Change the words and switches on the public site, and read the log.', tabs: ['site', 'landing', 'zones', 'postrules', 'audit', 'sql'] },
];
const EXTRA = { joins: 'Joins', services: 'Services', push: 'Phone alerts', landing: 'Landing and backgrounds', sql: 'SQL' };
Object.keys(EXTRA).forEach((k) => { if (!LABEL[k]) LABEL[k] = EXTRA[k]; });
const has = (k) => typeof SECTIONS[k] === 'function';
const groupOf = (t) => Math.max(0, GROUPS.findIndex((g) => g.tabs.indexOf(t) > -1));

/* ---------- data ---------- */
async function loadPro() {
  const r = await Promise.all([get('/api/admin/stats'), get('/api/admin/earnings'), get('/api/admin/audit?limit=6'), get('/api/admin/joins')]);
  P.stats = r[0]; P.earn = r[1]; P.audit = (r[2] && r[2].log) || [];
  if (r[3]) { J.club = r[3].club || []; J.groups = r[3].groups || []; J.kura = r[3].kura || []; J.ok = true; } else J.ok = false;
}
const _load = load;
load = async function () { await _load(); await loadPro(); render(); };

/* ---------- small chart helpers ---------- */
const COLORS = ['#101422', '#06b6d4', '#60a5fa', '#8b5cf6', '#f59e0b', '#ec4899'];
function area(series) {
  const W = 640, H = 230, L = 34, R = 10, T = 16, B = 28, n = series.length;
  const mx = Math.max(1, ...series.map((s) => s.n)), step = mx <= 4 ? 1 : Math.ceil(mx / 4), top = step * Math.ceil(mx / step) || 1;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, n - 1), y = (v) => T + (H - T - B) * (1 - v / top);
  const p = series.map((s, i) => [x(i), y(s.n)]);
  let d = 'M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1);
  for (let i = 0; i < n - 1; i++) {
    const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], e = p[Math.min(n - 1, i + 2)];
    d += ' C' + (b[0] + (c[0] - a[0]) / 6).toFixed(1) + ' ' + (b[1] + (c[1] - a[1]) / 6).toFixed(1) + ',' + (c[0] - (e[0] - b[0]) / 6).toFixed(1) + ' ' + (c[1] - (e[1] - b[1]) / 6).toFixed(1) + ',' + c[0].toFixed(1) + ' ' + c[1].toFixed(1);
  }
  const fill = d + ' L' + p[n - 1][0].toFixed(1) + ' ' + (H - B) + ' L' + p[0][0].toFixed(1) + ' ' + (H - B) + ' Z';
  const lab = (s) => new Date(s.day + 'T00:00:00Z').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  let grid = ''; for (let v = 0; v <= top; v += step) grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="var(--pl)"/><text x="' + (L - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + '</text>';
  const xs = [0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round(((n - 1) * 3) / 4), n - 1].map((i) => '<text x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '">' + esc(lab(series[i])) + '</text>').join('');
  let pk = 0; series.forEach((s, i) => { if (s.n >= series[pk].n) pk = i; });
  const tx = Math.min(W - 70, Math.max(L, p[pk][0] - 38)), ty = Math.max(2, p[pk][1] - 46);
  const tip = series[pk].n ? '<line x1="' + p[pk][0].toFixed(1) + '" x2="' + p[pk][0].toFixed(1) + '" y1="' + p[pk][1].toFixed(1) + '" y2="' + (H - B) + '" stroke="var(--pa)" stroke-opacity=".35"/><circle cx="' + p[pk][0].toFixed(1) + '" cy="' + p[pk][1].toFixed(1) + '" r="5" fill="var(--pa)" stroke="var(--pc)" stroke-width="2"/>'
    + '<rect x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" width="76" height="36" rx="8" fill="#101422"/><text x="' + (tx + 38).toFixed(1) + '" y="' + (ty + 15).toFixed(1) + '" text-anchor="middle" style="fill:#fff;font-weight:600;font-size:12px">' + series[pk].n + ' joined</text><text x="' + (tx + 38).toFixed(1) + '" y="' + (ty + 28).toFixed(1) + '" text-anchor="middle" style="fill:#cbd5e1;font-size:10px">' + esc(lab(series[pk])) + '</text>' : '';
  const hits = series.map((s, i) => '<rect x="' + (x(i) - 8).toFixed(1) + '" y="' + T + '" width="16" height="' + (H - T - B) + '" fill="transparent"><title>' + esc(lab(s)) + ': ' + s.n + ' joined</title></rect>').join('');
  return '<svg class="pc" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="New users per day, last 30 days"><defs><linearGradient id="pgf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--pa)" stop-opacity=".28"/><stop offset="1" stop-color="var(--pa)" stop-opacity="0"/></linearGradient></defs>'
    + grid + xs + '<path d="' + fill + '" fill="url(#pgf)"/><path d="' + d + '" fill="none" stroke="var(--pa)" stroke-width="2.5" stroke-linecap="round"/>' + hits + tip + '</svg>';
}
function donut(obj, names, label) {
  const keys = Object.keys(obj || {}).filter((k) => obj[k] > 0).sort((a, b) => obj[b] - obj[a]), tot = keys.reduce((s, k) => s + obj[k], 0);
  if (!tot) return '<p class="sub">Nothing to show yet.</p>';
  const r = 52, C = 2 * Math.PI * r; let acc = 0;
  const arcs = keys.map((k, i) => { const len = (obj[k] / tot) * C, s = '<circle cx="75" cy="75" r="' + r + '" fill="none" stroke="' + COLORS[i % COLORS.length] + '" stroke-width="20" stroke-dasharray="' + Math.max(0, len - 2).toFixed(2) + ' ' + (C - Math.max(0, len - 2)).toFixed(2) + '" stroke-dashoffset="' + (-acc).toFixed(2) + '" transform="rotate(-90 75 75)"/>'; acc += len; return s; }).join('');
  return '<div class="dn-w"><svg viewBox="0 0 150 150" role="img" aria-label="' + esc(label) + '">' + arcs + '<text x="75" y="76" text-anchor="middle" font-size="22" font-weight="700" fill="var(--pt)">' + num(tot) + '</text><text x="75" y="94" text-anchor="middle" font-size="10" fill="var(--pm)">' + esc(label) + '</text></svg>'
    + '<div class="lg2">' + keys.map((k, i) => '<div><i style="background:' + COLORS[i % COLORS.length] + '"></i>' + esc(names[k] || k) + '<b>' + Math.round((obj[k] * 100) / tot) + '%</b></div>').join('') + '</div></div>';
}
const TYPE = { google: 'Google', password: 'Password', guest: 'Recovery code' }, ROLE = { user: 'User', seller: 'Seller', club_admin: 'Club admin', admin: 'Admin' };
const since = (t) => { const s = (Date.now() - Date.parse(t)) / 1000; if (!(s >= 0)) return ''; if (s < 90) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; return Math.round(s / 86400) + ' d ago'; };
const NICE = { login: 'Signed in', 'site.update': 'Edited the site', 'settings.update': 'Changed money settings', 'wallet.grant': 'Sent money to a wallet', 'user.ban': 'Banned a user', 'user.unban': 'Unbanned a user', 'user.mute': 'Muted a user', 'user.role': 'Changed a role', 'user.create': 'Created an account', 'user.delete': 'Deleted an account', 'join.remove': 'Removed a join' };

/* ---------- Dashboard ---------- */
SECTIONS.dashboard = () => {
  const s = P.stats;
  if (!s) return ['<div class="card"><h3>Dashboard</h3><p class="sub">The numbers could not load. Check that the server is running the newest code, then tap the refresh button.</p></div>'];
  const c = Q.counts, todo = c.listings + c.withdrawals + c.disputes + c.verifications + c.reports + c.confirm + c.underpaid, u = s.users, o = s.orders, e = P.earn;
  const l7 = s.signups.slice(23).reduce((t, x) => t + x.n, 0), p7 = s.signups.slice(16, 23).reduce((t, x) => t + x.n, 0);
  const delta = p7 ? '<i class="' + (l7 >= p7 ? '' : 'dn') + '">' + (l7 >= p7 ? '\u2191 +' : '\u2193 -') + Math.abs(Math.round(((l7 - p7) * 100) / p7)) + '%</i> vs last week' : num(u.last30d) + ' joined in 30 days';
  const kp = (ic, cl, label, val, sub, tabk) => '<div class="card pk"' + (tabk ? ' data-tab="' + tabk + '"' : '') + '><span class="ic ' + cl + '">' + svg(ic, 24) + '</span><div><small>' + label + '</small><b' + (typeof val === 'number' ? '>' + num(val) : ' class="m">' + val) + '</b></div><div class="dl">' + sub + '</div></div>';
  const earned = e ? e.market_fees.last30 + e.boosts.last30 + e.withdrawal_fees.last30 : 0;
  const k4 = '<div class="pg k4">' + kp('users', 'g', 'Total users', u.total, delta, 'users')
    + kp('cart', 'b', 'Orders', o.total, kes(o.gmv) + ' finished')
    + kp('bag', 'w', 'Items live', s.listings.approved || 0, num(s.listings.pending || 0) + ' waiting for approval', 'listings')
    + kp('wallet', 'b', 'Total earned', e ? kes(e.total_earned) : '-', e ? kes(earned) + ' in the last 30 days' : 'Not loaded', 'settings') + '</div>';
  const trend = '<div class="card"><div class="ph2"><h3>New users</h3><span class="pill">' + num(u.last30d) + ' in 30 days</span></div>' + area(s.signups) + '</div>';
  const how = '<div class="card"><div class="ph2"><h3>How people sign in</h3></div>' + donut(u.types, TYPE, 'Users') + '</div>';
  const att = [['listings', 'Items to approve', c.listings], ['confirm', 'M-Pesa to confirm', c.confirm], ['withdrawals', 'Withdrawals to send', c.withdrawals], ['verifications', 'ID checks', c.verifications], ['disputes', 'Disputes', c.disputes], ['reports', 'Reports', c.reports], ['payments', 'Underpaid', c.underpaid]].filter((x) => x[2] > 0);
  const attn = '<div class="card"><div class="ph2"><h3>Needs your attention</h3><span class="pill ' + (todo ? 'r' : '') + '">' + (todo ? todo + ' waiting' : 'All clear') + '</span></div>'
    + (att.length ? '<div class="pl">' + att.map((x, i) => '<button data-tab="' + x[0] + '"><span class="n">' + (i + 1) + '</span><span class="t">' + x[1] + '</span><span class="go"><span class="pill r">' + x[2] + '</span></span></button>').join('') + '</div>' : '<p class="sub" style="padding:18px 0">Nothing is waiting for you.</p>') + '</div>';
  const roles = '<div class="card"><div class="ph2"><h3>Roles</h3></div>' + donut(u.roles, ROLE, 'Accounts') + '</div>';
  const st = (u2) => u2.banned ? '<span class="pill r">Banned</span>' : (u2.muted_until && Date.parse(u2.muted_until) > Date.now()) ? '<span class="pill w">Muted</span>' : (u2.verified || u2.student_verified) ? '<span class="pill">Verified</span>' : '<span class="pill n">Active</span>';
  const rec = '<div class="card"><div class="ph2"><h3>Newest users</h3><button class="pro-link" data-tab="users">View all</button></div><div class="tbl"><div class="r h"><span>User</span><span>Sign-in</span><span>Role</span><span>Status</span><span>Joined</span></div>'
    + (s.recent.length ? s.recent.map((x) => '<div class="r" data-d="open" data-aid="' + esc(x.aid) + '"><span class="u"><i>' + esc(String(x.handle || x.aid.replace(/^u_/, '') || '?').charAt(0)) + '</i><span>' + (x.handle ? '@' + esc(x.handle) : 'No username') + '</span></span><span>' + esc(TYPE[x.type] || x.type || '') + '</span><span>' + esc(ROLE[x.role] || x.role || 'User') + '</span><span>' + st(x) + '</span><span class="sub">' + esc(since(x.created_at)) + '</span></div>').join('') : '<p class="sub" style="padding:14px">No one yet.</p>') + '</div></div>';
  const snap = '<div class="card"><div class="ph2"><h3>Community snapshot</h3><button class="pro-link" data-tab="joins">Joins</button></div><div class="snap">'
    + '<div><span class="pk"><span class="ic g" style="width:42px;height:42px">' + svg('shield', 22) + '</span></span><span><small>Verified</small><b>' + num(u.verified) + '</b></span></div>'
    + '<div><span class="pk"><span class="ic r" style="width:42px;height:42px">' + svg('ban', 22) + '</span></span><span><small>Banned</small><b>' + num(u.banned) + '</b></span></div>'
    + '<div><span class="pk"><span class="ic w" style="width:42px;height:42px">' + svg('clock', 22) + '</span></span><span><small>Muted</small><b>' + num(u.muted) + '</b></span></div>'
    + '<div><span class="pk"><span class="ic b" style="width:42px;height:42px">' + svg('users', 22) + '</span></span><span><small>New this week</small><b>' + num(u.last7d) + '</b></span></div></div>'
    + '<h3 style="margin:18px 0 4px;font-size:14px">Latest admin activity</h3>' + (P.audit.length ? P.audit.map((r) => '<div class="act2"><span>' + esc(NICE[r.action] || r.action) + '</span><span>' + esc(since(r.created_at)) + '</span></div>').join('') : '<p class="sub">Nothing yet.</p>') + '</div>';
  return [k4 + '<div class="pg w">' + trend + how + '</div><div class="pg e">' + attn + roles + '</div><div class="pg w">' + rec + snap + '</div>'];
};

/* ---------- Joins ---------- */
const initial = (x) => esc(String(x || '?').replace(/^u_/, '').charAt(0));
const who = (x) => x.handle ? '@' + x.handle : x.aid;
const jrow = (av, title, meta, btn) => '<div class="jn" data-q="' + esc((title + ' ' + meta).toLowerCase()) + '"><span class="av">' + initial(av) + '</span><span class="jm"><b>' + esc(title) + '</b><small>' + esc(meta) + '</small></span>' + btn + '</div>';
SECTIONS.joins = () => {
  if (!J.ok) return ['<div class="card"><h3>Joins</h3><p class="sub">Joins could not load. Redeploy the API with the newest code, then tap the refresh button.</p></div>'];
  const tabs = [['kura', 'Kura entries', J.kura.length], ['club', 'Club members', J.club.length], ['groups', 'Study groups', J.groups.length]];
  let list;
  if (J.k === 'kura') list = J.kura.map((x) => jrow(x.name, x.name, [x.campus, x.category, x.status, (x.votes || 0) + ' votes'].filter(Boolean).join(' \u00b7 '), '<button class="bad" data-jn="rm" data-kind="kura" data-id="' + esc(x.id) + '" data-nm="' + esc(x.name) + '">Remove</button>'));
  else if (J.k === 'club') list = J.club.map((x) => jrow(x.handle || x.aid, who(x) + (x.name ? ' (' + x.name + ')' : ''), 'Joined ' + when(x.at), '<button class="bad" data-jn="rm" data-kind="club" data-aid="' + esc(x.aid) + '" data-nm="' + esc(who(x)) + '">Remove</button>'));
  else list = J.groups.map((x) => jrow(x.handle || x.aid, who(x), x.group + ' \u00b7 joined ' + when(x.at), '<button class="bad" data-jn="rm" data-kind="group" data-gid="' + esc(x.group_id) + '" data-aid="' + esc(x.aid) + '" data-nm="' + esc(who(x)) + '">Remove</button>'));
  const sub = '<div class="pro-sub" style="margin-bottom:12px">' + tabs.map((t) => '<button data-jn="tab" data-k="' + t[0] + '" class="' + (J.k === t[0] ? 'on' : '') + '">' + t[1] + ' (' + t[2] + ')</button>').join('') + '</div>';
  return ['<div class="card">' + sub + '<p class="sub">Removing a join is final. ' + (J.k === 'kura' ? 'A removed Kura entry loses all its votes.' : J.k === 'club' ? 'A removed club member cannot rejoin on their own.' : 'The person is taken out of the study group and gets a notice.') + ' Every removal is saved in the audit log.</p>'
    + '<div class="jtools"><input id="jn_q" placeholder="Search by name or username" autocomplete="off" aria-label="Search joins"></div><div id="jn_l">' + (list.length ? list.join('') : '<p class="sub" style="text-align:center;padding:24px 0">No one has joined here yet.</p>') + '</div></div>'];
};
document.addEventListener('input', (e) => {
  if (e.target.id !== 'jn_q') return;
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll('#jn_l .jn').forEach((r) => { r.style.display = !q || r.dataset.q.indexOf(q) > -1 ? '' : 'none'; });
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-jn]'); if (!b) return;
  if (b.dataset.jn === 'tab') { J.k = b.dataset.k; window.__rise = false; return render(); }
  if (b.dataset.jn !== 'rm') return;
  const d = b.dataset, what = d.kind === 'kura' ? 'Kura entry' : d.kind === 'club' ? 'club membership' : 'study group membership';
  if (!confirm('Remove ' + (d.nm || 'this person') + "'s " + what + '? This cannot be undone.')) return;
  act(b, () => api('/api/admin/joins/remove', { kind: d.kind, aid: d.aid, group_id: d.gid, id: d.id }), 'Removed');
});

/* ---------- shell: sidebar, search, header ---------- */
function shell() {
  const body = document.body, app = $('#app');
  if (body.classList.contains('out') || !app || !Q || app.querySelector('.login')) { body.classList.remove('pro'); return; }
  body.classList.add('pro');
  const gi = groupOf(tab), g = GROUPS[gi], c = Q.counts || {}, review = (c.listings || 0) + (c.withdrawals || 0) + (c.disputes || 0) + (c.verifications || 0) + (c.reports || 0) + (c.confirm || 0) + (c.underpaid || 0);
  let sb = $('.pro-sb');
  if (!sb) {
    sb = document.createElement('aside'); sb.className = 'pro-sb'; sb.setAttribute('aria-label', 'Sections'); body.appendChild(sb);
    const sc = document.createElement('div'); sc.className = 'pro-scrim'; sc.onclick = () => body.classList.remove('sb-open'); body.appendChild(sc);
  }
  sb.innerHTML = '<div class="pro-brand"><i>CC</i><div><b>Comrade Connect</b><small>Admin console</small></div></div><nav>'
    + GROUPS.map((x, i) => '<button data-tab="' + x.tabs[0] + '" class="' + (i === gi ? 'on' : '') + '">' + svg(x.icon, 20) + '<span>' + x.n + '</span>' + (x.n === 'Review' && review ? '<span class="b">' + review + '</span>' : '') + '</button>').join('')
    + '</nav><div class="sp"></div><button class="pro-out" data-pro="out">' + svg('out', 20) + '<span>Sign out</span></button>';
  const top = $('header.top');
  if (top && !top.querySelector('.pro-search')) {
    const m = document.createElement('button'); m.className = 'pro-menu'; m.type = 'button'; m.setAttribute('aria-label', 'Menu'); m.innerHTML = svg('menu', 22); m.onclick = () => body.classList.toggle('sb-open'); top.insertBefore(m, top.firstChild);
    const f = document.createElement('label'); f.className = 'pro-search'; f.innerHTML = svg('search', 18) + '<input id="pro_q" type="search" placeholder="Search users" autocomplete="off" aria-label="Search users">';
    top.insertBefore(f, top.querySelector('.tools'));
    const me = document.createElement('div'); me.className = 'pro-me'; me.innerHTML = '<i>A</i><div><b>Admin</b><small>Owner</small></div>'; top.appendChild(me);
  }
  const wrap = app.firstElementChild; if (!wrap) return;
  const now = new Date(), hr = now.getHours(), hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const hd = document.createElement('div'); hd.className = 'pro-hd';
  hd.innerHTML = '<div>' + (g.n === 'Overview' ? '<small>' + hello + ',</small>' : '') + '<h1>' + (g.n === 'Overview' ? 'Here\u2019s what\u2019s happening on Comrade Connect' : esc(g.h)) + '</h1><p>' + esc(g.lead) + '</p></div>'
    + '<span class="pro-date">' + svg('cal', 18) + now.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) + '</span>';
  wrap.insertBefore(hd, wrap.firstChild);
  const ts = g.tabs.filter((k) => has(k));
  if (ts.length > 1) {
    const sub = document.createElement('div'); sub.className = 'pro-sub'; sub.setAttribute('role', 'tablist');
    sub.innerHTML = ts.map((k) => '<button data-tab="' + k + '" class="' + (k === tab ? 'on' : '') + '">' + esc(LABEL[k] || EXTRA[k] || k) + (c[k] ? ' (' + c[k] + ')' : '') + '</button>').join('');
    hd.after(sub);
  }
  document.body.classList.remove('sb-open');
}
const _render = render;
render = function () { _render(); try { shell(); } catch (e) { console.error('admin-pro', e); } };

document.addEventListener('click', (e) => { if (e.target.closest('[data-pro="out"]')) { const o = $('#out'); if (o) o.click(); } });
document.addEventListener('keydown', (e) => {
  if (e.target.id !== 'pro_q' || e.key !== 'Enter') return;
  const q = e.target.value.trim(); if (!q) return;
  const t = document.createElement('button'); t.dataset.tab = 'users'; document.body.appendChild(t); t.click(); t.remove();
  setTimeout(() => { const i = $('#us_q'); if (i) { i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); } }, 60);
});
if (typeof Q !== 'undefined' && Q) { loadPro().then(render); }
})();
