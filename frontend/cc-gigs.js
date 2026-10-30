/* cc-gigs.js: "Need a hand" gigs board. A card at the top of Market opens a full screen with Browse, My gigs and Post.
   Comrades earn from tutoring, printing, braiding, deliveries and graphics. The poster's money is held safely until the job is done.
   Text uses textContent only. */
(function () {
'use strict';
if (window.__ccGigs) return; window.__ccGigs = 1;
var market = document.getElementById('v-market'); if (!market) return;
var ov = null, tab = 'browse', B = null, M = null, FEE = 0, CATS = ['Other'], busy = false, msg = '';

function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
function connected() { return typeof CC_API === 'string' && CC_API.indexOf('YOUR-SUBDOMAIN') < 0; }
function kes(n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); }
function toast(t) { try { if (window.toast) window.toast(t); } catch (e) {} }
function when(ms) { return new Date(ms).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }); }
function call(path, body) { return window.ccCall(path, body ? { body: body } : { auth: false }); }

var css = el('style');
css.textContent =
'#ccg-card{max-width:680px;margin:10px auto 0;padding:0 6vw}#ccg-card .g{border:1px solid var(--line,rgba(255,255,255,.14));border-radius:20px;padding:16px;display:flex;align-items:center;gap:14px}' +
'#ccg-card h3{margin:0;font-size:16px}#ccg-card p{margin:2px 0 0;font-size:12px;line-height:1.5;color:var(--mut,#999)}#ccg-card .t{flex:1;min-width:0}' +
'.ccg-b{all:unset;cursor:pointer;padding:10px 16px;border-radius:12px;font:600 13px system-ui,sans-serif;border:1px solid var(--fg,#fff);color:var(--fg,#fff);text-align:center}.ccg-b.s{background:var(--fg,#fff);color:var(--bg,#101422)}.ccg-b.x{opacity:.7}' +
'#ccg{position:fixed;inset:0;z-index:1000;background:var(--bg,#101422);color:var(--fg,#fff);overflow-y:auto;-webkit-overflow-scrolling:touch}#ccg .in{max-width:680px;margin:0 auto;padding:16px 6vw 90px}' +
'#ccg .hd{display:flex;align-items:center;justify-content:space-between;gap:10px}#ccg h2{margin:0;font-size:22px}' +
'#ccg .tabs{display:flex;gap:8px;margin:14px 0}#ccg .tabs .ccg-b{flex:1}' +
'#ccg .it{border:1px solid var(--line,rgba(255,255,255,.14));border-radius:18px;padding:14px;margin-bottom:12px}#ccg .it h4{margin:0;font-size:15px;overflow-wrap:anywhere}' +
'#ccg .it p{margin:6px 0 0;font-size:13px;line-height:1.55;color:var(--mut,#999);overflow-wrap:anywhere}#ccg .it .pr{margin-top:8px;font-size:14px;font-weight:600}' +
'#ccg .ch{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;font-size:11px;border:1px solid var(--line,rgba(255,255,255,.3));color:var(--mut,#999);vertical-align:1px}' +
'#ccg .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}' +
'#ccg input,#ccg textarea,#ccg select{width:100%;box-sizing:border-box;margin:6px 0;padding:12px;border-radius:12px;border:1px solid var(--line,rgba(255,255,255,.25));background:transparent;color:inherit;font:inherit}';
document.head.appendChild(css);

function mountCard() {
  if (document.getElementById('ccg-card')) return;
  var c = el('section'); c.id = 'ccg-card'; var g = el('div', 'g'), t = el('div', 't');
  t.appendChild(el('h3', '', 'Need a hand? Earn a hand.')); t.appendChild(el('p', '', 'Tutoring, printing, braiding, deliveries, graphics. Pay a comrade safely or earn from your skills.'));
  var b = el('button', 'ccg-b s', 'Gigs'); b.type = 'button'; b.onclick = open; g.appendChild(t); g.appendChild(b); c.appendChild(g);
  market.insertBefore(c, market.firstChild);
}
function open() { if (!ov) { ov = el('div'); ov.id = 'ccg'; document.body.appendChild(ov); } ov.style.display = ''; document.body.style.overflow = 'hidden'; tab = 'browse'; msg = ''; draw(); loadAll(); }
function close() { if (ov) ov.style.display = 'none'; document.body.style.overflow = ''; }
function loadAll() {
  if (!connected()) return;
  call('/api/gigs').then(function (d) { B = d.gigs; if (d.categories) CATS = d.categories; FEE = d.fee_percent || 0; draw(); }, function () { B = null; draw(); });
  if (signedIn()) call('/api/gigs?mine=1').then(function (d) { M = d.gigs; draw(); }, function () {});
}
function run(path, body, ok) { if (busy) return; busy = true; call(path, body || {}).then(function () { toast(ok); }, function (e) { toast(e && e.message || 'Something went wrong'); }).then(function () { busy = false; loadAll(); }); }
function btn(label, fn, cls) { var b = el('button', 'ccg-b' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.onclick = fn; return b; }

function item(g, mine) {
  var d = el('div', 'it'), h = el('h4', '', g.title); h.appendChild(el('span', 'ch', g.category)); if (mine) h.appendChild(el('span', 'ch', g.status)); d.appendChild(h);
  if (g.details) d.appendChild(el('p', '', g.details));
  d.appendChild(el('div', 'pr', mine && g.role === 'worker' ? 'You earn ' + kes(g.pay) : kes(g.price) + (FEE ? '  ·  worker gets ' + kes(g.pay) : '')));
  d.appendChild(el('p', '', (mine ? (g.role === 'poster' ? 'You posted this' + (g.worker ? '. Worker ' + g.worker : '') : 'Posted by ' + g.by) : 'Posted by ' + g.by) + ' · ' + when(g.at) + (g.campus ? ' · ' + g.campus : '')));
  var r = el('div', 'row');
  if (!mine) {
    r.appendChild(btn('I can do this', function () { if (!signedIn()) return toast('Sign in to accept gigs'); if (confirm('Accept "' + g.title + '"? You will earn ' + kes(g.pay) + ' when it is done.')) { run('/api/gigs/' + g.id + '/accept', {}, 'Accepted. Message the poster to agree where to meet.'); tab = 'mine'; } }, 's'));
  } else if (g.role === 'poster') {
    if (g.status === 'open') r.appendChild(btn('Cancel and refund', function () { if (confirm('Cancel this gig? ' + kes(g.price) + ' goes back to your wallet.')) run('/api/gigs/' + g.id + '/cancel', {}, 'Refunded to your wallet'); }, 'x'));
    if (g.status === 'accepted' || g.status === 'delivered') {
      r.appendChild(btn('Confirm and pay', function () { if (confirm('Pay ' + kes(g.pay) + ' to the worker now?')) run('/api/gigs/' + g.id + '/confirm', {}, 'Paid. Thank you!'); }, 's'));
      r.appendChild(btn('Report a problem', function () { var w = prompt('What went wrong?'); if (w && w.trim().length >= 5) run('/api/gigs/' + g.id + '/dispute', { reason: w.trim() }, 'Reported. An admin will decide.'); }, 'x'));
    }
    if (g.status === 'delivered' && g.auto_at) d.appendChild(el('p', '', 'Marked done. Pays the worker automatically on ' + when(g.auto_at) + ' unless you report a problem.'));
    if (g.status === 'disputed') d.appendChild(el('p', '', 'An admin is looking at this.'));
  } else if (g.role === 'worker') {
    if (g.status === 'accepted') { r.appendChild(btn('Mark as done', function () { run('/api/gigs/' + g.id + '/deliver', {}, 'Marked done. Waiting for the poster.'); }, 's')); r.appendChild(btn('Drop this gig', function () { if (confirm('Drop this gig?')) run('/api/gigs/' + g.id + '/drop', {}, 'Dropped'); }, 'x')); }
    if (g.status === 'delivered') d.appendChild(el('p', '', 'Waiting for the poster to confirm. You are paid automatically on ' + (g.auto_at ? when(g.auto_at) : 'the auto-pay date') + '.'));
    if (g.status === 'disputed') d.appendChild(el('p', '', 'The poster reported a problem. An admin will decide.'));
    if (g.status === 'released') d.appendChild(el('p', '', 'Paid to your wallet.'));
  }
  if (g.status === 'open' && window.ccShareCard) r.appendChild(btn('Share', function () { window.ccShareCard({ tag: 'Gig · Money held safely', title: g.title, line: kes(g.price) + '   ' + g.category + (g.campus ? '   @' + g.campus : ''), cta: 'Find gigs on Comrade Connect', hash: '#gigs', filename: 'comrade-gig', share: 'Need a hand? ' + g.title + ' on Comrade Connect:' }); }, 'x'));
  if (r.childNodes.length) d.appendChild(r);
  return d;
}
function postForm() {
  var f = el('div');
  if (!signedIn()) { f.appendChild(el('p', '', 'Sign in to post a gig.')); return f; }
  f.appendChild(el('p', '', 'The price is held from your wallet and only paid to the comrade when the job is done. Cancel any time before someone accepts and you get it all back.'));
  var t = el('input'); t.placeholder = 'What do you need? e.g. Print and bind 30 pages'; t.maxLength = 60;
  var dd = el('textarea'); dd.rows = 3; dd.placeholder = 'Details: when, where on campus (no phone numbers or links)'; dd.maxLength = 400;
  var c = el('select'); CATS.forEach(function (x) { var o = el('option', '', x); o.value = x; c.appendChild(o); });
  var p = el('input'); p.placeholder = 'Price in KSh (50 to 5,000)'; p.inputMode = 'numeric'; p.maxLength = 4;
  var go2 = btn('Post and hold the money', function () {
    var price = Number(p.value.trim()); if (!t.value.trim() || !Number.isInteger(price)) return toast('Fill in the job and a whole-number price');
    if (!confirm('Hold ' + kes(price) + ' from your wallet for this gig?')) return;
    if (busy) return; busy = true;
    call('/api/gigs', { title: t.value.trim(), details: dd.value.trim(), category: c.value, price: price }).then(function () { toast('Posted'); tab = 'mine'; }, function (e) { msg = e && e.message || 'Could not post'; toast(msg); }).then(function () { busy = false; loadAll(); draw(); });
  }, 's');
  [t, dd, c, p].forEach(function (x) { f.appendChild(x); }); var r = el('div', 'row'); r.appendChild(go2); f.appendChild(r);
  if (msg) f.appendChild(el('p', '', msg));
  return f;
}
function draw() {
  if (!ov) return; ov.textContent = '';
  var in_ = el('div', 'in'), hd = el('div', 'hd'); hd.appendChild(el('h2', '', 'Gigs')); hd.appendChild(btn('Close', close, 'x')); in_.appendChild(hd);
  var tabs = el('div', 'tabs'); [['browse', 'Browse'], ['mine', 'My gigs'], ['post', 'Post']].forEach(function (x) { var b = btn(x[1], function () { tab = x[0]; msg = ''; draw(); }, tab === x[0] ? 's' : ''); tabs.appendChild(b); }); in_.appendChild(tabs);
  if (tab === 'browse') {
    if (B === null) in_.appendChild(el('p', '', connected() ? 'Loading gigs... If this stays empty, the admin must run gigs.sql first.' : 'Not connected.'));
    else if (!B.length) in_.appendChild(el('p', '', 'No open gigs right now. Post one, or check back soon.'));
    else B.forEach(function (g) { in_.appendChild(item(g, false)); });
  } else if (tab === 'mine') {
    if (!signedIn()) in_.appendChild(el('p', '', 'Sign in to see your gigs.'));
    else if (!M) in_.appendChild(el('p', '', 'Loading...'));
    else if (!M.length) in_.appendChild(el('p', '', 'You have no gigs yet.'));
    else M.forEach(function (g) { in_.appendChild(item(g, true)); });
  } else in_.appendChild(postForm());
  ov.appendChild(in_);
}
function init() { mountCard(); if (location.hash === '#gigs') setTimeout(function () { try { if (typeof go === 'function') go('market'); } catch (e) {} open(); }, 800); }
new MutationObserver(function () { if (!document.getElementById('ccg-card')) mountCard(); }).observe(market, { childList: true });
init();
})();
