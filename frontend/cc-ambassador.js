/* cc-ambassador.js: "Campus ambassadors" card on the Rewards screen.
   Everyone sees this month's top ambassadors. An ambassador also sees their own numbers and a one-tap share card.
   Text uses textContent only. */
(function () {
'use strict';
if (window.__ccAmb) return; window.__ccAmb = 1;
var view = document.getElementById('v-rewards'); if (!view) return;
var B = null, ME = null, card = null, at = 0, busy = false, err = '';

function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
function connected() { return typeof CC_API === 'string' && CC_API.indexOf('YOUR-SUBDOMAIN') < 0; }

var css = el('style');
css.textContent =
'#ccamb h3{margin:0}#ccamb h4{margin:18px 0 4px;font-size:14px;font-weight:600}#ccamb .am-sub{margin:4px 0 0;font-size:12px;line-height:1.6;color:var(--mut,#999)}' +
'#ccamb .am-st{display:grid;grid-template-columns:repeat(3,1fr);margin-top:14px;border:1px solid var(--line,rgba(255,255,255,.14));border-radius:16px}' +
'#ccamb .am-st div{padding:14px 10px;text-align:center}#ccamb .am-st div+div{border-left:1px solid var(--line,rgba(255,255,255,.14))}' +
'#ccamb .am-st b{display:block;font-size:22px;font-weight:600;letter-spacing:-.02em}#ccamb .am-st small{display:block;margin-top:2px;font-size:12px;color:var(--mut,#999)}' +
'#ccamb .am-r{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line,rgba(255,255,255,.14))}#ccamb .am-r:last-child{border-bottom:0}' +
'#ccamb .am-n{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:600;border:1px solid var(--line,rgba(255,255,255,.3))}#ccamb .am-n.t{background:var(--fg,#fff);color:var(--bg,#101422);border-color:var(--fg,#fff)}' +
'#ccamb .am-r span{min-width:0;flex:1;font-size:14px;overflow-wrap:anywhere}#ccamb .am-r small{display:block;font-size:12px;color:var(--mut,#999)}#ccamb .am-r b{flex:none;font-size:13px;font-weight:600}' +
'#ccamb .am-b{all:unset;cursor:pointer;margin-top:14px;padding:12px 18px;border-radius:14px;font-size:14px;font-weight:600;border:1px solid var(--fg,#fff);color:var(--fg,#fff)}';
document.head.appendChild(css);

function share() {
  if (!window.ccShareCard || !ME) return;
  window.ccShareCard({ tag: 'Campus ambassador', title: 'Join ' + ME.label + ' comrades on Comrade Connect', line: 'Buy, sell, vote and earn with students on your campus.', cta: 'Join me on Comrade Connect', filename: 'comrade-ambassador', share: 'Join us on Comrade Connect:' });
}
function draw() {
  if (!card) return;
  card.textContent = '';
  card.appendChild(el('h3', '', 'Campus ambassadors'));
  if (!B) { var p = el('p', 'am-sub', err || 'Loading...'); card.appendChild(p);
    if (err) { var rb = el('button', 'am-b', 'Try again'); rb.type = 'button'; rb.onclick = function () { at = 0; load(); }; card.appendChild(rb); }
    return; }
  if (ME && ME.is_ambassador) {
    card.appendChild(el('p', 'am-sub', 'You are the ambassador for ' + ME.label + '. Share your invite link. The top comrades get paid every month.'));
    var st = el('div', 'am-st');
    [[ME.joined, 'Joined'], [ME.bought, 'Bought'], [ME.rank ? '#' + ME.rank : '-', 'Rank']].forEach(function (x) { var d = el('div'); d.appendChild(el('b', '', String(x[0]))); d.appendChild(el('small', '', x[1])); st.appendChild(d); });
    card.appendChild(st);
    if (ME.earned > 0) card.appendChild(el('p', 'am-sub', 'You have won KSh ' + Number(ME.earned).toLocaleString('en-KE') + ' as an ambassador so far.'));
    var sb = el('button', 'am-b', 'Share my hostel card'); sb.type = 'button'; sb.onclick = share; card.appendChild(sb);
  } else {
    card.appendChild(el('p', 'am-sub', 'One trusted comrade per hostel or club. The top ambassadors win airtime or M-Pesa every month. Want to be yours? Message Support with your hostel or club name.'));
  }
  card.appendChild(el('h4', '', 'Top this month'));
  if (!B.board.length) card.appendChild(el('p', 'am-sub', 'No ambassadors yet.'));
  B.board.forEach(function (x) {
    var r = el('div', 'am-r'); r.appendChild(el('i', 'am-n' + (x.rank <= 3 ? ' t' : ''), String(x.rank)));
    var s = el('span', '', x.label); if (x.campus) s.appendChild(el('small', '', x.campus)); r.appendChild(s);
    r.appendChild(el('b', '', x.bought + ' bought · ' + x.joined + ' joined')); card.appendChild(r);
  });
}
function mount() {
  if (card) return;
  var inv = document.getElementById('ccinv'), rl = document.getElementById('rlk'), box = inv || (rl && rl.closest('.box')); if (!box) return;
  card = el('div', 'box g'); card.id = 'ccamb'; box.parentNode.insertBefore(card, box.nextSibling); draw();
}
function load() {
  mount(); if (!card || !connected() || busy) return; busy = true; err = '';
  var jobs = [window.ccCall('/api/ambassador/board', { auth: false }).then(function (d) { B = d; })];
  if (signedIn()) jobs.push(window.ccCall('/api/ambassador/me', { auth: false }).then(function (d) { ME = d; }, function () { ME = null; }));
  Promise.all(jobs).then(function () { at = Date.now(); }, function () { if (!B) err = 'Could not load ambassadors.'; }).then(function () { busy = false; draw(); });
}
function onView() { if (document.body.dataset.view === 'rewards' && Date.now() - at > 30000) load(); }
new MutationObserver(onView).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
onView();
})();
