/* cc-today.js: the "Today on campus" card at the top of the home feed.
   One glance: today's poll, the Kura vote count, today's events and your streak check-in. A reason to open the app every day.
   Everything comes from existing endpoints. Text uses textContent only. */
(function () {
'use strict';
if (window.__ccToday) return; window.__ccToday = 1;
var feed = document.getElementById('v-feed'); if (!feed) return;
var card = null, busy = false, at = 0, P = null, K = null, E = null, S = null;

function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
function connected() { return typeof CC_API === 'string' && CC_API.indexOf('YOUR-SUBDOMAIN') < 0; }
function ke() { return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); }
function toast(t) { try { if (window.toast) window.toast(t); } catch (e) {} }
function n(x) { return Number(x || 0).toLocaleString('en-KE'); }

var css = el('style');
css.textContent =
'#cctoday{max-width:680px;margin:6px auto 0;padding:0 6vw}#cctoday .td{border:1px solid var(--line,rgba(255,255,255,.14));border-radius:20px;padding:18px 16px}' +
'#cctoday h3{margin:0;font-size:18px}#cctoday .td-d{margin:2px 0 6px;font-size:12px;color:var(--mut,#999)}' +
'#cctoday .td-r{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--line,rgba(255,255,255,.14))}' +
'#cctoday .td-r span{min-width:0;flex:1;font-size:14px;line-height:1.45;overflow-wrap:anywhere}#cctoday .td-r small{display:block;font-size:12px;color:var(--mut,#999)}' +
'#cctoday .td-b{all:unset;cursor:pointer;flex:none;padding:9px 14px;border-radius:12px;font-size:13px;font-weight:600;border:1px solid var(--fg,#fff);color:var(--fg,#fff)}#cctoday .td-b.s{background:var(--fg,#fff);color:var(--bg,#101422)}';
document.head.appendChild(css);

function row(title, sub, label, fn, solid) {
  var r = el('div', 'td-r'), s = el('span', '', title); if (sub) s.appendChild(el('small', '', sub)); r.appendChild(s);
  if (label) { var b = el('button', 'td-b' + (solid ? ' s' : ''), label); b.type = 'button'; b.onclick = fn; r.appendChild(b); }
  return r;
}
function goto(v) { try { if (typeof go === 'function') go(v); } catch (e) {} }
function draw() {
  if (!card) return;
  var box = card.firstChild; box.textContent = '';
  box.appendChild(el('h3', '', 'Today on campus'));
  box.appendChild(el('p', 'td-d', new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })));
  // poll
  var q = document.getElementById('pq'), votes = P && Array.isArray(P.counts) ? P.counts.reduce(function (a, c) { return a + c; }, 0) : 0, voted = P && P.mine !== null && P.mine !== undefined;
  box.appendChild(row(q && q.textContent ? q.textContent : "Today's question", voted ? 'You voted. ' + n(votes) + ' votes so far' : n(votes) + ' votes so far', voted ? 'See' : 'Vote', function () { var t = document.querySelector('#v-feed .pulse'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, !voted));
  // kura
  if (K && K.stats && K.stats.contestants) box.appendChild(row('Kura vote count: ' + n(K.stats.votes) + ' votes', K.top && K.top[0] ? 'Leading now: ' + K.top[0].name : K.stats.contestants + ' contestants', 'Vote', function () { goto('explore'); }));
  // events
  var ev = (E || []).filter(function (e) { return String(e.date).slice(0, 10) === ke(); });
  box.appendChild(row(ev.length ? ev.length + (ev.length === 1 ? ' event today' : ' events today') : 'No events today', ev.length ? ev.slice(0, 3).map(function (e) { return e.title; }).join(', ') : 'Check what is coming up', 'Open', function () { goto('explore'); }));
  // streak
  if (signedIn() && S) box.appendChild(row(S.checked_in ? 'Streak: ' + S.current + ' days. Checked in today' : 'Check in to keep your ' + (S.current || 0) + ' day streak', S.checked_in ? 'Come back tomorrow' : 'Takes one tap', S.checked_in ? '' : 'Check in', function () {
    window.ccCall('/api/points/checkin', { body: {} }).then(function () { at = 0; load(); }, function (e) { toast(e && e.message || 'Could not check in'); });
  }, true));
}
function mount() {
  if (card) return;
  var hero = feed.querySelector('.hero'); if (!hero) return;
  card = el('section'); card.id = 'cctoday'; card.setAttribute('aria-label', 'Today on campus'); card.appendChild(el('div', 'td'));
  hero.parentNode.insertBefore(card, hero.nextSibling); draw();
}
function load() {
  mount(); if (!card || !connected() || busy) return; busy = true;
  var c = function (p, fn) { return window.ccCall(p, { auth: false }).then(fn, function () {}); };
  var jobs = [c('/api/pulse', function (d) { P = d && d.poll; }), c('/api/kura/home', function (d) { K = d; }), c('/api/events', function (d) { E = d && d.events; })];
  if (signedIn()) jobs.push(c('/api/streak', function (d) { S = d; }));
  Promise.all(jobs).then(function () { at = Date.now(); busy = false; draw(); });
}
function tick() { if (!document.hidden && document.body.dataset.view === 'feed' && Date.now() - at > 60000) load(); }
setInterval(tick, 30000); window.addEventListener('cc-streak-checkin', function () { at = 0; setTimeout(load, 600); });
document.addEventListener('visibilitychange', tick); load();
})();
