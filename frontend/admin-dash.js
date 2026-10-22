/* Admin dashboard v1: a real Dashboard (numbers + chart), a Users manager (search, ban, mute, role, password, money, delete, create account),
   and a bottom bar that groups the 20 old tabs into 6 clear sections. Loaded last by admin.html.
   Uses api, load, render, tab, SECTIONS, LABEL, Q, esc, kes, when, toast, $ from admin.html and the scripts before it. */
(function () {
'use strict';
const D = { stats: null, earn: null, audit: [], users: [], total: 0, q: '', f: 'all', seq: 0, busy: false };
const num = (n) => Number(n || 0).toLocaleString('en-KE');
const get = async (p) => { try { return await api(p); } catch (e) { return null; } };
const since = (t) => { const s = (Date.now() - Date.parse(t)) / 1000; if (!(s >= 0)) return ''; if (s < 90) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; if (s < 86400 * 30) return Math.round(s / 86400) + ' d ago'; return when(t); };
const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch (e) { toast('Select the text and copy it'); } };
const TYPE = { google: 'Google', password: 'Password', guest: 'Recovery code' };
const ROLE = { user: 'User', seller: 'Seller', club_admin: 'Club admin', admin: 'Admin' };
const ICON = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2.2.7 3.5 2.6 3.5 5.6"/>',
  inbox: '<path d="M4 13l3-8h10l3 8v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  wallet: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9-4.3-4.1 5.9-.8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>', arrow: '<path d="M9 6l6 6-6 6"/>',
};
const svg = (k, s) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:' + (s || 20) + 'px;height:' + (s || 20) + 'px" aria-hidden="true">' + ICON[k] + '</svg>';

/* ---------- the six sections ---------- */
const GROUPS = [
  { n: 'Overview', icon: 'grid', h: 'Dashboard', lead: 'How Comrade Connect is doing right now.', tabs: ['dashboard'] },
  { n: 'Users', icon: 'users', h: 'Users', lead: 'Find anyone and control their account.', tabs: ['users', 'grant'] },
  { n: 'Review', icon: 'inbox', h: 'Waiting for you', lead: 'Everything that needs a decision from you.', tabs: ['listings', 'confirm', 'withdrawals', 'verifications', 'disputes', 'reports', 'payments'] },
  { n: 'Market', icon: 'bag', h: 'Market and campus', lead: 'Items, events, notices, sponsors and the club shop.', tabs: ['live', 'events', 'notices', 'sponsors', 'club'] },
  { n: 'Kura', icon: 'star', h: 'Kura', lead: 'Contestants, votes and the season.', tabs: ['kura'] },
  { n: 'Money', icon: 'wallet', h: 'Money', lead: 'Earnings, fees and payouts.', tabs: ['settings', 'payouts'] },
  { n: 'Site', icon: 'sliders', h: 'Site', lead: 'Change the words and switches on the public site, and read the log.', tabs: ['site', 'zones', 'postrules', 'audit'] },
];
const groupOf = (t) => Math.max(0, GROUPS.findIndex((g) => g.tabs.indexOf(t) > -1));
const oldLabel = Object.assign({}, LABEL); Object.keys(LABEL).forEach((k) => delete LABEL[k]);
LABEL.dashboard = 'Dashboard'; LABEL.users = 'Users';
GROUPS.forEach((g) => g.tabs.forEach((k) => { if (!LABEL[k]) LABEL[k] = oldLabel[k] || k; }));
LABEL.zones = 'Zones'; LABEL.grant = 'Send money'; LABEL.live = 'Live items'; LABEL.settings = 'Fees and earnings';
tab = 'dashboard';

/* ---------- styles ---------- */
const css = document.createElement('style');
css.textContent = [
  '.wrap{max-width:1040px;padding-bottom:140px}',
  '.dk{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:6px 0 0}',
  '.dk .card,.dpair .card{margin:0}',
  '.kpi{padding:18px!important;display:flex;flex-direction:column;gap:2px;cursor:default}.kpi[data-tab]{cursor:pointer}',
  '.kpi small{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--mut);font-weight:600}',
  '.kpi b{font:600 32px/1.15 Poppins,sans-serif;letter-spacing:-.03em;font-variant-numeric:tabular-nums}',
  '.kpi b.m{font-size:24px;line-height:1.5;white-space:nowrap}',
  '.kpi em{font-style:normal;font-size:11.5px;color:var(--mut);font-weight:300}',
  '.kpi.hot b::after{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--fg);margin-left:10px;vertical-align:middle;animation:pulse 1.8s ease-out infinite}',
  '.up{color:var(--ok)!important;font-weight:500!important}.dn{color:var(--bad)!important;font-weight:500!important}',
  '.dpair{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-top:14px}',
  '.ch{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}.ch h3{margin:0}',
  '.chart{width:100%;height:auto;display:block;margin-top:10px;overflow:visible}.chart text{fill:var(--mut);font:400 10px Poppins,sans-serif}',
  '.chart rect{transition:opacity .25s}.chart rect:hover{opacity:1!important}',
  '.br{margin-top:12px}.br div.t{display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px}.br div.t b{font-weight:600}',
  '.tr{height:8px;border-radius:99px;background:color-mix(in srgb,var(--fg) 12%,transparent);overflow:hidden}.tr i{display:block;height:100%;border-radius:99px;background:var(--fg);transition:width .9s cubic-bezier(.2,.8,.2,1)}',
  '.li{display:flex;align-items:center;gap:12px;cursor:pointer;width:100%;text-align:left;color:var(--fg)}',
  '.card button.li{border-radius:0;background:none;border:0;border-bottom:1px solid var(--line);padding:11px 0;justify-content:flex-start;gap:12px;transform:none;font:inherit;font-weight:400}.card button.li:hover{transform:none}',
  '.li:last-child{border-bottom:0!important}.li:hover .nm{text-decoration:underline;text-underline-offset:3px}.li .go{margin-left:auto;color:var(--mut);display:flex;align-items:center;gap:8px;font-size:12px}',
  '.av{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font:600 14px Poppins,sans-serif;text-transform:uppercase;background:color-mix(in srgb,var(--fg) 12%,transparent);border:1px solid var(--line)}',
  '.nm{font-weight:600;font-size:14px;overflow-wrap:anywhere;line-height:1.3}.mt{font-size:11.5px;color:var(--mut);font-weight:300;line-height:1.4;overflow-wrap:anywhere}',
  '.chip{display:inline-block;padding:2px 9px;border-radius:99px;border:1px solid var(--line);font-size:10.5px;font-weight:600;letter-spacing:.04em;color:var(--mut);margin:3px 4px 0 0;white-space:nowrap}',
  '.chip.bad{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 50%,transparent)}.chip.ok{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 45%,transparent)}.chip.ink{background:var(--ink);color:var(--inkfg);border-color:var(--ink)}',
  '.tb{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.tb input{flex:1 1 200px;margin:0}',
  '.fl2{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin-top:14px;padding-bottom:2px}.fl2::-webkit-scrollbar{display:none}',
  '.fl2 button{flex:none;padding:7px 14px!important;font-size:11.5px!important}.fl2 button.on{background:var(--ink)!important;color:var(--inkfg)!important;border-color:var(--ink)!important}',
  '.ul{margin-top:6px}.more{width:100%;margin-top:12px}',
  /* bottom bar */
  '.gbar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom,0px));width:min(560px,94vw);z-index:60;display:flex;gap:2px;padding:6px;border-radius:30px}',
  'body.out .gbar{display:none}',
  '.gbar button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 2px 7px;border-radius:24px;border:0;background:none;color:var(--mut);font:500 10px Poppins,sans-serif;cursor:pointer;position:relative;transition:background .3s,color .3s,transform .3s}',
  '.gbar button.on{background:var(--ink);color:var(--inkfg)}.gbar button:active{transform:scale(.93)}',
  '.gbar .b{position:absolute;top:2px;right:calc(50% - 22px);margin:0;min-width:17px;font-size:9.5px;line-height:17px;padding:0 4px}.gbar button.on .b{background:var(--inkfg);color:var(--ink)}',
  '.savebar{bottom:calc(86px + env(safe-area-inset-bottom,0px))!important}#toast{bottom:calc(96px + env(safe-area-inset-bottom,0px))!important}',
  /* sheets */
  '.dov{position:fixed;inset:0;z-index:200;background:rgba(16,20,34,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;animation:fadein .25s both}',
  '@keyframes fadein{from{opacity:0}}@keyframes sheetup{from{transform:translateY(40px);opacity:0}}',
  '.dsheet{width:min(560px,100%);max-height:92vh;overflow-y:auto;border-radius:28px 28px 0 0;padding:22px 20px calc(26px + env(safe-area-inset-bottom,0px));background:color-mix(in srgb,var(--bg) 94%,var(--fg));border:1px solid var(--gb);box-shadow:var(--sh);animation:sheetup .4s cubic-bezier(.2,.9,.3,1) both;position:relative}',
  '@media(min-width:700px){.dov{align-items:center}.dsheet{border-radius:28px}}',
  '.dsheet .x{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:none;border:0;color:var(--fg);cursor:pointer;padding:0}.dsheet .x:hover{background:color-mix(in srgb,var(--fg) 10%,transparent)}',
  '.dsheet h3{font-size:17px}.dsheet .hd{display:flex;gap:14px;align-items:center;padding-right:40px}.dsheet .av{width:54px;height:54px;font-size:19px}',
  '.dsheet h4{margin:22px 0 4px;font:600 11px Poppins,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}',
  '.dsheet button:not(.x){display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;border-radius:999px;font:600 12.5px Poppins,sans-serif;color:var(--fg);background:var(--g);border:1px solid var(--gb);cursor:pointer;transition:transform .3s,opacity .3s}',
  '.dsheet button:not(.x):hover{transform:translateY(-2px)}.dsheet button.p{background:var(--ink);color:var(--inkfg);border-color:var(--ink)}.dsheet button.bad{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 50%,transparent)}.dsheet button:disabled{opacity:.4;pointer-events:none}',
  '.ag{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.ag button{width:100%}',
  '.ar{display:flex;gap:8px;align-items:flex-end;margin-top:10px}.ar>*{margin:0}.ar input,.ar select{flex:1;min-width:0}.ar button{flex:none}',
  '.dz{margin-top:22px;padding:16px;border-radius:20px;border:1px solid color-mix(in srgb,var(--bad) 45%,transparent)}.dz p{margin-bottom:8px}',
  '.cred{margin-top:14px;padding:14px 16px;border-radius:18px;border:1px dashed var(--gb)}',
  '.lg{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:7px 0;border-bottom:1px solid var(--line)}.lg:last-child{border:0}.lg b{font-weight:600;font-variant-numeric:tabular-nums}',
].join('\n');
document.head.appendChild(css);

/* ---------- loading ---------- */
const url = () => '/api/admin/users?limit=30&offset=' + (D.off || 0) + '&filter=' + encodeURIComponent(D.f) + '&q=' + encodeURIComponent(D.q);
async function fetchUsers(reset) {
  const my = ++D.seq; if (reset) D.off = 0; else D.off = D.users.length;
  const r = await get(url()); if (my !== D.seq) return;
  if (!r) { if (reset) { D.users = []; D.total = 0; } return; }
  D.users = reset ? r.users : D.users.concat(r.users); D.total = r.total;
}
async function loadD() {
  const r = await Promise.all([get('/api/admin/stats'), get('/api/admin/earnings'), get('/api/admin/audit?limit=8'), fetchUsers(true)]);
  D.stats = r[0]; D.earn = r[1]; D.audit = (r[2] && r[2].log) || [];
}
const _load = load;
load = async function () { await _load(); await loadD(); render(); };

/* ---------- small pieces ---------- */
const initial = (u) => String(u.handle || u.aid.replace(/^u_/, '') || '?').charAt(0);
const chips = (u) => (u.role && u.role !== 'user' ? '<span class="chip ink">' + esc(ROLE[u.role] || u.role) + '</span>' : '')
  + (u.banned ? '<span class="chip bad">Banned</span>' : '') + (u.muted_until && Date.parse(u.muted_until) > Date.now() ? '<span class="chip bad">Muted</span>' : '')
  + (u.verified || u.student_verified ? '<span class="chip ok">Verified</span>' : '') + '<span class="chip">' + esc(TYPE[u.type] || u.type) + '</span>';
const userRow = (u) => '<button class="li" data-d="open" data-aid="' + esc(u.aid) + '"><span class="av">' + esc(initial(u)) + '</span><span style="min-width:0"><span class="nm">' + (u.handle ? '@' + esc(u.handle) : 'No username') + '</span><br><span class="mt">' + esc(u.aid) + ' &middot; joined ' + esc(since(u.created_at)) + '</span><br>' + chips(u) + '</span><span class="go">' + svg('arrow', 16) + '</span></button>';
const bars = (obj, names) => { const keys = Object.keys(obj).filter((k) => obj[k] > 0).sort((a, b) => obj[b] - obj[a]), tot = keys.reduce((s, k) => s + obj[k], 0) || 1;
  return keys.length ? keys.map((k) => '<div class="br"><div class="t"><span>' + esc(names[k] || k) + '</span><b>' + num(obj[k]) + ' <span class="mt">' + Math.round((obj[k] * 100) / tot) + '%</span></b></div><div class="tr"><i style="width:' + Math.max(3, (obj[k] * 100) / tot) + '%"></i></div></div>').join('') : '<p class="sub" style="margin-top:10px">Nothing yet.</p>'; };
function chart(series) {
  const W = 640, H = 170, base = 140, top = 14, max = Math.max(1, ...series.map((s) => s.n)), slot = W / series.length, bw = Math.min(16, slot - 6);
  const lab = (s) => new Date(s.day + 'T00:00:00Z').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const rects = series.map((s, i) => { const h = s.n ? Math.max(5, (s.n / max) * (base - top)) : 3, x = i * slot + (slot - bw) / 2, last = i === series.length - 1;
    return '<rect x="' + x.toFixed(1) + '" y="' + (base - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + Math.min(5, bw / 2).toFixed(1) + '" style="fill:var(--fg)" opacity="' + (s.n ? (last ? 1 : .8) : .16) + '"><title>' + esc(lab(s)) + ': ' + s.n + ' new</title></rect>'; }).join('');
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="New users per day, last 30 days"><line x1="0" x2="' + W + '" y1="' + base + '" y2="' + base + '" style="stroke:var(--line)"/>'
    + '<text x="0" y="8">' + max + '</text>' + rects + '<text x="0" y="160">' + esc(lab(series[0])) + '</text><text x="' + W / 2 + '" y="160" text-anchor="middle">' + esc(lab(series[Math.floor(series.length / 2)])) + '</text><text x="' + W + '" y="160" text-anchor="end">Today</text></svg>';
}
const NICE = { login: 'Signed in', 'site.update': 'Edited the site', 'settings.update': 'Changed money settings', 'wallet.grant': 'Sent money to a wallet', 'user.ban': 'Banned a user', 'user.unban': 'Unbanned a user', 'user.mute': 'Muted a user', 'user.unmute': 'Unmuted a user',
  'user.role': 'Changed a role', 'user.create': 'Created an account', 'user.password': 'Set a new password', 'user.signout': 'Signed a user out', 'user.delete': 'Deleted an account' };

/* ---------- Dashboard ---------- */
SECTIONS.dashboard = () => {
  const s = D.stats;
  if (!s) return ['<div class="card"><h3>Dashboard</h3><p class="sub">The numbers could not load. Check that the server is running the newest code, then tap Refresh.</p></div>'];
  const c = Q.counts, todo = c.listings + c.withdrawals + c.disputes + c.verifications + c.reports + c.confirm + c.underpaid, u = s.users, o = s.orders, e = D.earn;
  const last7 = s.signups.slice(23).reduce((t, x) => t + x.n, 0), prev7 = s.signups.slice(16, 23).reduce((t, x) => t + x.n, 0);
  const trend = prev7 ? (last7 >= prev7 ? '<em class="up">up ' : '<em class="dn">down ') + Math.abs(Math.round(((last7 - prev7) * 100) / prev7)) + '% on last week</em>' : '<em>' + num(u.last30d) + ' in 30 days</em>';
  const tile = (label, val, sub, extra) => '<div class="card kpi g' + (extra || '') + '"><small>' + label + '</small><b' + (typeof val === 'number' ? ' data-n="' + val + '">0' : ' class="m">' + val) + '</b>' + (sub.indexOf('<em') === 0 ? sub : '<em>' + sub + '</em>') + '</div>';
  const earned = e ? e.market_fees.last30 + e.boosts.last30 + e.withdrawal_fees.last30 : null;
  const kpis = '<div class="dk">' + [
    tile('Total users', u.total, '+' + num(u.last24h) + ' today, +' + num(u.last7d) + ' this week'),
    tile('New this week', u.last7d, trend),
    tile('Verified', u.verified, (u.total ? Math.round((u.verified * 100) / u.total) : 0) + '% of everyone'),
    tile('Banned or muted', u.banned + u.muted, num(u.banned) + ' banned, ' + num(u.muted) + ' muted'),
    tile('Items live', s.listings.approved || 0, num(s.listings.pending || 0) + ' waiting for approval'),
    tile('Orders', o.total, kes(o.gmv) + ' finished'),
    tile('Earned', e ? kes(e.total_earned) : '-', e ? kes(earned) + ' in the last 30 days' : 'Not loaded'),
    '<div class="card kpi g' + (todo ? ' hot' : '') + '" data-tab="listings"><small>To do</small><b data-n="' + todo + '">0</b><em>' + (todo ? 'waiting for you. Tap to review' : 'all clear') + '</em></div>',
  ].join('') + '</div>';
  const chartCard = '<div class="card" style="margin-top:14px"><div class="ch"><h3>New users, last 30 days</h3><span class="sub">' + num(u.last30d) + ' joined</span></div>' + chart(s.signups) + '</div>';
  const att = [['listings', 'Items to approve', c.listings], ['confirm', 'M-Pesa to confirm', c.confirm], ['withdrawals', 'Withdrawals to send', c.withdrawals], ['verifications', 'ID checks', c.verifications], ['disputes', 'Disputes', c.disputes], ['reports', 'Reports', c.reports], ['payments', 'Underpaid payments', c.underpaid]].filter((x) => x[2] > 0);
  const attention = '<div class="card"><h3>Needs your attention</h3>' + (att.length ? att.map((x) => '<button class="li" data-tab="' + x[0] + '"><span class="nm">' + x[1] + '</span><span class="go"><span class="chip ink" style="margin:0">' + x[2] + '</span>' + svg('arrow', 16) + '</span></button>').join('') : '<p class="sub" style="margin-top:8px">Nothing is waiting. Enjoy the quiet.</p>') + '</div>';
  const who = '<div class="card"><h3>How people sign in</h3>' + bars(u.types, TYPE) + '<h3 style="margin-top:20px">Roles</h3>' + bars(u.roles, ROLE) + '</div>';
  const recent = '<div class="card"><div class="ch"><h3>Newest users</h3><button class="chip" style="background:none;cursor:pointer;color:var(--fg)" data-tab="users">See all</button></div>' + (s.recent.length ? s.recent.map(userRow).join('') : '<p class="sub" style="margin-top:8px">Nobody yet.</p>') + '</div>';
  const act = '<div class="card"><h3>Latest admin activity</h3>' + (D.audit.length ? D.audit.map((r) => '<div class="lg"><span>' + esc(NICE[r.action] || r.action) + '</span><span class="mt">' + esc(since(r.created_at)) + '</span></div>').join('') : '<p class="sub" style="margin-top:8px">No activity yet.</p>') + '</div>';
  return [kpis + chartCard + '<div class="dpair">' + attention + who + recent + act + '</div>'];
};

/* ---------- Users ---------- */
const FILTERS = [['all', 'Everyone'], ['banned', 'Banned'], ['muted', 'Muted'], ['verified', 'Verified'], ['seller', 'Sellers'], ['admin', 'Admins'], ['google', 'Google'], ['password', 'Password'], ['guest', 'Recovery code']];
const listHtml = () => (D.users.length ? D.users.map(userRow).join('') : '<p class="sub" style="text-align:center;padding:28px 0">No one matches.</p>') + (D.users.length < D.total ? '<button class="more" data-d="more" style="display:flex;align-items:center;justify-content:center;padding:12px;border-radius:999px;background:var(--g);border:1px solid var(--gb);color:var(--fg);font:600 12.5px Poppins;cursor:pointer">Show more (' + (D.total - D.users.length) + ' left)</button>' : '');
SECTIONS.users = () => ['<div class="card"><div class="tb"><input id="us_q" placeholder="Search a username or account ID" value="' + esc(D.q) + '" autocomplete="off" autocapitalize="off" aria-label="Search users"><button class="p" data-d="new">' + svg('plus', 16) + ' New account</button></div>'
  + '<div class="fl2">' + FILTERS.map((f) => '<button data-d="filter" data-f="' + f[0] + '" class="' + (D.f === f[0] ? 'on' : '') + '">' + f[1] + '</button>').join('') + '</div>'
  + '<p class="sub" style="margin-top:12px" id="ucount">' + num(D.total) + ' ' + (D.total === 1 ? 'user' : 'users') + '</p><div class="ul" id="ulist">' + listHtml() + '</div></div>'];
function paintList() { const l = $('#ulist'), c = $('#ucount'); if (c) c.textContent = num(D.total) + ' ' + (D.total === 1 ? 'user' : 'users'); if (l) l.innerHTML = listHtml(); }
let qt = null;
document.addEventListener('input', (e) => { if (e.target.id !== 'us_q') return; D.q = e.target.value.trim(); clearTimeout(qt); qt = setTimeout(() => fetchUsers(true).then(paintList), 260); });

/* ---------- bottom bar and group headings ---------- */
function decorate() {
  const app = $('#app'); if (!app || !Q || !store.get('k') || app.querySelector('.login')) return;
  const gi = groupOf(tab), g = GROUPS[gi];
  const nav = app.querySelector('nav.tabs');
  if (nav) { nav.querySelectorAll('button').forEach((b) => { b.style.display = g.tabs.indexOf(b.dataset.tab) > -1 ? '' : 'none'; }); if (g.tabs.length < 2) nav.style.display = 'none'; }
  const st = app.querySelector('section.stats'); if (st && g.n !== 'Review') st.style.display = 'none';
  const h = app.querySelector('h1'); if (h) h.textContent = g.h; const l = app.querySelector('p.lead'); if (l) l.textContent = g.lead;
  let bar = $('.gbar');
  if (!bar) { bar = document.createElement('nav'); bar.className = 'gbar g'; bar.setAttribute('aria-label', 'Sections'); document.body.appendChild(bar); }
  const c = Q.counts, review = c.listings + c.withdrawals + c.disputes + c.verifications + c.reports + c.confirm + c.underpaid;
  bar.innerHTML = GROUPS.map((x, i) => '<button data-tab="' + x.tabs[0] + '" class="' + (i === gi ? 'on' : '') + '" aria-label="' + x.n + '">' + svg(x.icon, 20) + x.n + (x.n === 'Review' && review ? '<span class="b">' + review + '</span>' : '') + '</button>').join('');
}
const _render = render;
render = function () { _render(); try { decorate(); } catch (e) { console.error('admin-dash', e); } };

/* ---------- one person ---------- */
const sheet = (html) => { const ov = document.createElement('div'); ov.className = 'dov'; ov.innerHTML = '<div class="dsheet" role="dialog" aria-modal="true">' + html + '</div>'; document.body.appendChild(ov);
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); }); return ov; };
const closeX = '<button class="x" data-d="close" aria-label="Close">' + svg('x', 18) + '</button>';
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.dov').forEach((o) => o.remove()); });
const row = (k, v) => v === undefined || v === null || v === '' ? '' : '<div class="kv"><span class="sub">' + esc(k) + '</span><b>' + esc(v) + '</b></div>';
function userHtml(d) {
  const u = d.user, muted = u.muted_until && Date.parse(u.muted_until) > Date.now(), name = u.handle ? '@' + u.handle : u.aid, label = u.handle || u.aid;
  return closeX + '<div class="hd"><span class="av">' + esc(initial(u)) + '</span><div style="min-width:0"><h3 style="overflow-wrap:anywhere">' + esc(name) + '</h3><div>' + chips(u) + '</div></div></div>'
    + '<div style="margin-top:14px">' + row('Account ID', u.aid) + row('Username', u.handle || 'None yet') + row('Joined', when(u.created_at)) + row('Signs in with', TYPE[u.type]) + row('Role', ROLE[u.role] || u.role) + row('Points', num(u.points))
    + row('Wallet', kes(d.balance)) + row('Items listed', d.listings.total + ' (' + d.listings.live + ' live)') + row('Orders', d.bought + ' bought, ' + d.sold + ' sold') + row('Orders in progress', d.open_orders) + row('Muted until', muted ? when(u.muted_until) : '') + '</div>'
    + '<div class="ag"><button data-d="copyid" data-v="' + esc(u.aid) + '">' + svg('copy', 15) + ' Copy ID</button>' + (u.banned ? '<button class="p" data-d="unban">Unban</button>' : '<button class="bad" data-d="ban">Ban</button>') + '</div>'
    + '<h4>Mute</h4><div class="ar"><select id="d_mh" aria-label="How long"><option value="1">1 hour</option><option value="24" selected>1 day</option><option value="72">3 days</option><option value="168">7 days</option><option value="720">30 days</option><option value="2160">90 days</option></select><button data-d="mute">Mute</button>' + (muted ? '<button data-d="unmute">Unmute</button>' : '') + '</div>'
    + '<h4>Role</h4><div class="ar"><select id="d_role" aria-label="Role">' + Object.keys(ROLE).map((k) => '<option value="' + k + '"' + (k === u.role ? ' selected' : '') + '>' + ROLE[k] + '</option>').join('') + '</select><button data-d="role">Save role</button></div>'
    + '<h4>Password</h4><p class="sub">Set a new password for this person. Every phone signed in to the account is signed out.</p><div class="ar"><input id="d_pw" type="text" placeholder="New password (8+ characters)" maxlength="100" autocomplete="off" autocapitalize="off"><button data-d="gen">Make one</button><button class="p" data-d="pw">Set</button></div>'
    + '<div class="ag"><button data-d="signout">Sign out everywhere</button></div>'
    + '<h4>Send money</h4><div class="ar"><input id="d_amt" placeholder="KSh" inputmode="numeric" maxlength="6" style="max-width:110px"><input id="d_note" placeholder="Reason (optional)" maxlength="80"><button class="p" data-d="grant">Send</button></div>'
    + (d.ledger.length ? '<h4>Recent wallet activity</h4>' + d.ledger.map((x) => '<div class="lg"><span>' + esc(x.note || x.kind) + ' <span class="mt">' + esc(since(x.created_at)) + '</span></span><b class="' + (x.delta < 0 ? 'dn' : 'up') + '">' + (x.delta > 0 ? '+' : '') + num(x.delta) + '</b></div>').join('') : '')
    + '<div class="dz"><h3 style="color:var(--bad)">Delete account</h3><p class="sub">The person can never sign in again, the username is freed and their items come down. Past orders and money records stay for your books. The wallet must be empty and no order in progress.</p>'
    + '<div class="ar"><input id="d_del" placeholder="Type DELETE to confirm" autocomplete="off" autocapitalize="characters" data-for="' + esc(label) + '"><button class="bad" data-d="del" id="d_delgo" disabled>Delete</button></div></div>';
}
async function paintUser(ov, aid) {
  const box = ov.querySelector('.dsheet');
  try { const d = await api('/api/admin/users/' + encodeURIComponent(aid)); box.innerHTML = userHtml(d); ov.dataset.aid = aid; ov.dataset.label = d.user.handle || d.user.aid; }
  catch (e) { box.innerHTML = closeX + '<h3>Could not open this account</h3><p class="sub" style="margin-top:8px">' + esc(e.message) + '</p>'; }
}
async function refreshLists() { const [s] = await Promise.all([get('/api/admin/stats'), fetchUsers(true)]); if (s) D.stats = s; paintList(); }
const PW = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makePw = () => { const a = crypto.getRandomValues(new Uint8Array(12)); let s = ''; a.forEach((x, i) => { s += PW[x % PW.length]; if (i === 3 || i === 7) s += '-'; }); return s; };

function newAccount() {
  const ov = sheet(closeX + '<h3>New anonymous account</h3><p class="sub" style="margin-top:6px">You choose the username and the password. No random code. The person signs in from Me, Restore an account, with these two.</p>'
    + '<input id="n_u" placeholder="Username (3 to 20 letters, numbers or _)" maxlength="20" autocomplete="off" autocapitalize="off">'
    + '<div class="ar"><input id="n_p" type="text" placeholder="Password (8+ characters)" maxlength="100" autocomplete="off" autocapitalize="off"><button data-d="gen2">Make one</button></div>'
    + '<select id="n_r" aria-label="Role"><option value="user">User</option><option value="seller">Seller</option><option value="club_admin">Club admin</option><option value="admin">Admin</option></select>'
    + '<p class="err" id="n_e"></p><div class="ar"><button class="p" data-d="create" style="flex:1">Create account</button></div><div id="n_out"></div>');
  ov.querySelector('#n_u').focus();
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-d]'); if (!b) return;
  const d = b.dataset.d, ov = b.closest('.dov'), aid = ov && ov.dataset.aid, A = (body) => api('/api/admin/users/' + encodeURIComponent(aid), body);
  const run = async (fn, ok, keep) => { b.disabled = true; try { await fn(); toast(ok); if (!keep) { await paintUser(ov, aid); refreshLists(); } } catch (x) { toast(x.message); } b.disabled = false; };
  if (d === 'close') return ov.remove();
  if (d === 'filter') { D.f = b.dataset.f; document.querySelectorAll('.fl2 button').forEach((x) => x.classList.toggle('on', x === b)); return fetchUsers(true).then(paintList); }
  if (d === 'more') { b.disabled = true; await fetchUsers(false); return paintList(); }
  if (d === 'open') return paintUser(sheet('<p class="sub">Loading...</p>'), b.dataset.aid);
  if (d === 'new') return newAccount();
  if (d === 'copyid') return copy(b.dataset.v);
  if (d === 'gen') { $('#d_pw').value = makePw(); return; }
  if (d === 'gen2') { $('#n_p').value = makePw(); return; }
  if (d === 'create') {
    const u = $('#n_u').value.trim(), p = $('#n_p').value, r = $('#n_r').value, er = $('#n_e'); er.textContent = '';
    if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) return er.textContent = 'Username: 3 to 20 letters, numbers or _';
    if (p.length < 8) return er.textContent = 'The password needs at least 8 characters';
    if (p.toLowerCase() === u.toLowerCase()) return er.textContent = 'The password cannot be the username';
    b.disabled = true;
    try {
      const r2 = await api('/api/admin/users/create', { handle: u, password: p, role: r });
      $('#n_out').innerHTML = '<div class="cred"><b>Account created</b><div class="kv"><span class="sub">Username</span><b>' + esc(u) + '</b></div><div class="kv"><span class="sub">Password</span><b>' + esc(p) + '</b></div><div class="kv"><span class="sub">Account ID</span><b>' + esc(r2.aid) + '</b></div>'
        + '<div class="ar"><button data-d="copycred" data-v="' + esc('Comrade Connect login\nUsername: ' + u + '\nPassword: ' + p) + '">' + svg('copy', 15) + ' Copy login details</button></div><p class="sub" style="margin-top:8px">Share these safely. This is the only time the password is shown.</p></div>';
      refreshLists(); toast('Account created');
    } catch (x) { er.textContent = x.message; b.disabled = false; }
    return;
  }
  if (d === 'copycred') return copy(b.dataset.v);
  if (!ov || !aid) return;
  if (d === 'ban') { if (!confirm('Ban ' + ov.dataset.label + '? They are signed out of posting and buying.')) return; return run(() => A({ action: 'ban' }), 'Banned'); }
  if (d === 'unban') return run(() => A({ action: 'unban' }), 'Unbanned');
  if (d === 'mute') return run(() => A({ action: 'mute', hours: +$('#d_mh', ov).value }), 'Muted');
  if (d === 'unmute') return run(() => A({ action: 'unmute' }), 'Unmuted');
  if (d === 'role') return run(() => A({ action: 'role', role: $('#d_role', ov).value }), 'Role saved');
  if (d === 'pw') { const p = $('#d_pw', ov).value; if (p.length < 8) return toast('The password needs at least 8 characters'); if (!confirm('Set this password? Every phone signed in to ' + ov.dataset.label + ' is signed out.')) return;
    return run(async () => { await A({ action: 'password', password: p }); $('#d_pw', ov).value = ''; copy('Comrade Connect login\nUsername: ' + ov.dataset.label + '\nPassword: ' + p); }, 'Password set and copied', false); }
  if (d === 'signout') { if (!confirm('Sign ' + ov.dataset.label + ' out on every phone?')) return; return run(() => A({ action: 'signout' }), 'Signed out everywhere'); }
  if (d === 'grant') { const amt = $('#d_amt', ov).value.trim(), note = $('#d_note', ov).value.trim();
    if (!/^\d{1,6}$/.test(amt) || +amt < 1 || +amt > 100000) return toast('Amount: KSh 1 to 100,000');
    if (!confirm('Send ' + kes(+amt) + ' to ' + ov.dataset.label + '? This cannot be undone.')) return;
    return run(() => api('/api/admin/wallet/grant', { to: aid, amount: +amt, note, key: Math.random().toString(36).slice(2) + Date.now().toString(36) }), 'Money sent'); }
  if (d === 'del') { if ($('#d_del', ov).value.trim().toUpperCase() !== 'DELETE') return;
    b.disabled = true; try { await A({ action: 'delete' }); ov.remove(); toast('Account deleted'); refreshLists(); } catch (x) { toast(x.message); b.disabled = false; } }
});
document.addEventListener('input', (e) => { if (e.target.id === 'd_del') { const g = document.getElementById('d_delgo'); if (g) g.disabled = e.target.value.trim().toUpperCase() !== 'DELETE'; } });
if (typeof Q !== 'undefined' && Q) render();
})();
