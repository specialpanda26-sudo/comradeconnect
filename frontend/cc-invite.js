/* cc-invite.js: the invite-a-friend dashboard on the Rewards screen.
   Who joined with your link, who bought, what you have earned and what is coming, plus how active you have been.
   Friends show under the username they chose, or a made-up name. Text uses textContent only. */
(function () {
'use strict';
if (window.__ccInvite) return; window.__ccInvite = 1;
var view = document.getElementById('v-rewards'); if (!view) return;
var D = null, card = null, at = 0, busy = false, err = '';

function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
function connected() { return typeof CC_API === 'string' && CC_API.indexOf('YOUR-SUBDOMAIN') < 0; }
function kes(n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); }
function when(ms) { return new Date(ms).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }); }

var css = el('style');
css.textContent =
'#ccinv h3{margin:0}#ccinv h4{margin:22px 0 4px;font-size:14px;font-weight:600}#ccinv .iv-sub{margin:4px 0 0;font-size:12px;line-height:1.6;color:var(--mut,var(--mut))}' +
'#ccinv .iv-st{display:grid;grid-template-columns:repeat(3,1fr);margin-top:16px;border:1px solid var(--line,rgba(255,255,255,.14));border-radius:16px}' +
'#ccinv .iv-st div{padding:14px 12px;text-align:center}#ccinv .iv-st div+div{border-left:1px solid var(--line,rgba(255,255,255,.14))}' +
'#ccinv .iv-st b{display:block;font-size:22px;font-weight:600;letter-spacing:-.02em}#ccinv .iv-st small{display:block;margin-top:2px;font-size:12px;color:var(--mut,var(--mut))}' +
'#ccinv .iv-f{margin-top:16px;display:grid;gap:10px}#ccinv .iv-f div{display:grid;grid-template-columns:96px 1fr 28px;align-items:center;gap:10px;font-size:12px;color:var(--mut,var(--mut))}#ccinv .iv-f i{display:block;height:6px;border-radius:3px;background:var(--line,rgba(255,255,255,.14));overflow:hidden}#ccinv .iv-f i s{display:block;height:100%;background:var(--fg,#fff);text-decoration:none}#ccinv .iv-f em{font-style:normal;text-align:right;color:var(--fg,#fff);font-weight:600}' +
'#ccinv .iv-r{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line,rgba(255,255,255,.14))}#ccinv .iv-r:last-child{border-bottom:0}#ccinv .iv-r span{min-width:0;font-size:14px;overflow-wrap:anywhere}#ccinv .iv-r small{display:block;margin-top:2px;font-size:12px;line-height:1.5;color:var(--mut,var(--mut))}#ccinv .iv-r b{flex:none;font-size:13px;font-weight:600;text-align:right}' +
'#ccinv .iv-ch{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:500;border:1px solid var(--line,rgba(255,255,255,.3));color:var(--mut,var(--mut));vertical-align:1px}#ccinv .iv-ch.on{background:var(--fg,#fff);border-color:var(--fg,#fff);color:var(--bg,#101422)}' +
'#ccinv .iv-sc{display:flex;align-items:baseline;gap:10px;margin-top:6px}#ccinv .iv-sc b{font-size:30px;font-weight:600;letter-spacing:-.03em}#ccinv .iv-sc span{font-size:13px;color:var(--mut,var(--mut))}' +
'#ccinv .iv-bar{height:6px;border-radius:3px;background:var(--line,rgba(255,255,255,.14));margin-top:10px;overflow:hidden}#ccinv .iv-bar i{display:block;height:100%;background:var(--fg,#fff)}' +
'#ccinv .iv-sp{display:flex;align-items:flex-end;gap:4px;height:44px;margin-top:16px}#ccinv .iv-sp i{flex:1;min-height:3px;border-radius:2px 2px 0 0;background:var(--fg,#fff)}#ccinv .iv-sp i.z{background:var(--line,rgba(255,255,255,.2))}' +
'#ccinv .iv-tip{margin:12px 0 0;font-size:13px;line-height:1.6;color:var(--mut,var(--mut))}#ccinv .iv-re{all:unset;cursor:pointer;color:var(--fg,#fff);font-size:13px;font-weight:600;text-decoration:underline}';
document.head.appendChild(css);

var STAGE = { joined: 'Joined', bought: 'Bought', rewarded: 'Reward paid', void: 'Not counted' };
function row(name, stage, sub, val) {
  var r = el('div', 'iv-r'), l = el('span'); l.appendChild(document.createTextNode(name));
  if (stage) l.appendChild(el('span', 'iv-ch' + (stage === 'rewarded' ? ' on' : ''), STAGE[stage]));
  if (sub) l.appendChild(el('small', '', sub)); r.appendChild(l); if (val) r.appendChild(el('b', '', val)); return r;
}
function draw() {
  if (!card) return;
  card.textContent = '';
  card.appendChild(el('h3', '', 'Your invites'));
  if (!D) {
    var p = el('p', 'iv-sub', !signedIn() ? 'Sign in to see who you invited and what you have earned.' : err || 'Loading your numbers...'); card.appendChild(p);
    if (err) { var b = el('button', 'iv-re', 'Try again'); b.type = 'button'; b.onclick = function () { at = 0; load(); }; p.appendChild(document.createTextNode(' ')); p.appendChild(b); }
    return;
  }
  var f = D.funnel, e = D.earnings;
  var st = el('div', 'iv-st'); [[f.invited, 'Invited'], [f.bought, 'Bought'], [kes(e.earned), 'Earned']].forEach(function (x) { var d = el('div'); d.appendChild(el('b', '', String(x[0]))); d.appendChild(el('small', '', x[1])); st.appendChild(d); });
  card.appendChild(st);
  if (!f.invited) card.appendChild(el('p', 'iv-sub', 'Nobody has joined with your link yet. Share it above. You earn ' + kes(D.reward) + ' when a friend buys their first item and the ' + D.unlock_days + ' day refund window ends.'));
  else {
    var fn = el('div', 'iv-f'); [['Joined', f.invited], ['Bought', f.bought], ['Reward paid', f.rewarded]].forEach(function (x) {
      var d = el('div'); d.appendChild(el('span', '', x[0])); var bar = el('i'), s = el('s'); s.style.display = 'block'; s.style.width = Math.round(x[1] / f.invited * 100) + '%'; bar.appendChild(s); d.appendChild(bar); d.appendChild(el('em', '', String(x[1]))); fn.appendChild(d);
    }); card.appendChild(fn);
    card.appendChild(el('h4', '', 'Earnings'));
    card.appendChild(row('In your wallet', null, 'Rewards already paid', kes(e.earned)));
    card.appendChild(row('On the way', null, 'Friends who bought. Paid after the refund window.', kes(e.coming)));
    card.appendChild(row('Still possible', null, e.possible ? 'If every friend who has not bought yet does. We would expect about ' + kes(e.expected) + '.' : 'Everyone you invited has bought.', kes(e.possible)));
    if (e.conversion !== null) card.appendChild(el('p', 'iv-sub', e.conversion + '% of the friends you invited have bought something.'));
    card.appendChild(el('h4', '', 'People you invited'));
    D.people.slice(0, 10).forEach(function (x) {
      var sub = x.stage === 'joined' ? 'Joined ' + when(x.at) : x.stage === 'bought' ? 'Bought. ' + (x.unlock_at ? 'Reward unlocks ' + when(x.unlock_at) : 'Reward on the way') : x.stage === 'rewarded' ? 'Joined ' + when(x.at) : 'Their purchase was refunded or cancelled';
      card.appendChild(row(x.name, x.stage, sub, x.stage === 'rewarded' ? '+' + kes(x.reward) : ''));
    });
    if (D.people.length > 10) card.appendChild(el('p', 'iv-sub', 'and ' + (D.people.length - 10) + ' more'));
  }
  var a = D.activity; card.appendChild(el('h4', '', 'Your activity'));
  card.appendChild(el('p', 'iv-sub', 'Active people earn more because friends see them and join. This is your last 30 days.'));
  var sc = el('div', 'iv-sc'); sc.appendChild(el('b', '', String(a.score))); sc.appendChild(el('span', '', 'out of 100, ' + a.level)); card.appendChild(sc);
  var bar = el('div', 'iv-bar'), fill = el('i'); fill.style.width = a.score + '%'; bar.appendChild(fill); bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', 'Activity score ' + a.score + ' out of 100'); card.appendChild(bar);
  var mx = a.last14.reduce(function (m, d) { return Math.max(m, d.n); }, 1), sp = el('div', 'iv-sp'); sp.setAttribute('role', 'img'); sp.setAttribute('aria-label', 'Your activity over the last 14 days');
  a.last14.forEach(function (d) { var i = el('i', d.n ? '' : 'z'); i.style.height = d.n ? Math.max(12, Math.round(d.n / mx * 100)) + '%' : '3px'; i.title = when(Date.parse(d.day)) + ': ' + d.n; sp.appendChild(i); }); card.appendChild(sp);
  card.appendChild(el('p', 'iv-tip', a.tip));
}
function mount() {
  if (card) return;
  var rl = document.getElementById('rlk'), box = rl && rl.closest('.box'); if (!box) return;
  card = el('div', 'box g'); card.id = 'ccinv'; box.parentNode.insertBefore(card, box.nextSibling); draw();
}
function load() {
  mount(); if (!card || !connected() || !signedIn() || busy) return; busy = true; err = '';
  window.ccCall('/api/referral/dashboard', { auth: false }).then(function (d) { D = d; at = Date.now(); })
    .catch(function (e) { if (!D) err = 'Could not load your invites.'; }).then(function () { busy = false; draw(); });
}
function onView() { if (document.body.dataset.view === 'rewards' && Date.now() - at > 20000) load(); }
new MutationObserver(onView).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
onView();
})();
