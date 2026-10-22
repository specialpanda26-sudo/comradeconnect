/* cc-streak.js: the daily streak card on the Rewards screen.
   Your check-in streak, the last 14 days, and how far you are from the next badge. Text uses textContent only. */
(function () {
'use strict';
if (window.__ccStreak) return; window.__ccStreak = 1;
var view = document.getElementById('v-rewards'); if (!view) return;
var D = null, card = null, at = 0, busy = false;

function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
function connected() { return typeof CC_API === 'string' && CC_API.indexOf('YOUR-SUBDOMAIN') < 0; }

var css = el('style');
css.textContent =
'#ccstk .sk-top{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}' +
'#ccstk .sk-n{font-size:44px;font-weight:600;letter-spacing:-.04em;line-height:1}#ccstk .sk-l{margin-left:8px;font-size:13px;color:var(--mut,var(--mut))}' +
'#ccstk .sk-b{font-size:12px;color:var(--mut,var(--mut));text-align:right;line-height:1.5}#ccstk .sk-b b{color:var(--fg,#fff);font-weight:600}' +
'#ccstk .sk-d{display:flex;justify-content:space-between;gap:4px;margin-top:16px}' +
'#ccstk .sk-d span{flex:1;max-width:22px;aspect-ratio:1;border-radius:50%;border:1.5px solid var(--line,rgba(255,255,255,.3));box-sizing:border-box}' +
'#ccstk .sk-d .on{background:var(--fg,#fff);border-color:var(--fg,#fff)}#ccstk .sk-d .td{border-color:var(--fg,#fff)}' +
'#ccstk .sk-t{margin:12px 0 0;font-size:13px;line-height:1.6;color:var(--mut,var(--mut))}' +
'#ccstk .sk-m{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}#ccstk .sk-m span{font-size:12px;padding:5px 11px;border-radius:999px;border:1px solid var(--line,rgba(255,255,255,.3));color:var(--mut,var(--mut))}' +
'#ccstk .sk-m .on{background:var(--fg,#fff);border-color:var(--fg,#fff);color:var(--bg,#101422);font-weight:600}';
document.head.appendChild(css);

function draw() {
  if (!card || !D) return;
  card.textContent = '';
  card.appendChild(el('h3', '', 'Daily streak'));
  var top = el('div', 'sk-top'), l = el('div'); l.style.marginTop = '12px';
  l.appendChild(el('span', 'sk-n', String(D.current))); l.appendChild(el('span', 'sk-l', D.current === 1 ? 'day in a row' : 'days in a row'));
  var r = el('div', 'sk-b'); r.appendChild(document.createTextNode('Best ')); r.appendChild(el('b', '', String(D.best)));
  top.appendChild(l); top.appendChild(r); card.appendChild(top);
  var dots = el('div', 'sk-d'); dots.setAttribute('role', 'img'); dots.setAttribute('aria-label', 'Check-ins over the last 14 days: ' + D.last14.filter(function (x) { return x.done; }).length + ' of 14');
  D.last14.forEach(function (x, i) { dots.appendChild(el('span', (x.done ? 'on' : '') + (i === 13 && !x.done ? ' td' : ''))); }); card.appendChild(dots);
  var msg = !D.checked_in ? (D.current ? 'Check in today to keep your streak.' : 'Check in today to start a streak.') : D.next ? D.to_next + (D.to_next === 1 ? ' more day' : ' more days') + ' to a ' + D.next + ' day streak.' : 'You have every badge. Keep it going.';
  card.appendChild(el('p', 'sk-t', msg));
  var m = el('div', 'sk-m'); D.milestones.slice(0, 5).forEach(function (x) { m.appendChild(el('span', x.reached ? 'on' : '', x.days + ' days')); }); card.appendChild(m);
}
function mount() {
  if (card) return;
  var first = view.querySelector('.box.g'); if (!first) return;
  card = el('div', 'box g'); card.id = 'ccstk'; first.parentNode.insertBefore(card, first.nextSibling);
}
function load() {
  if (!connected() || !signedIn() || busy) return; busy = true; mount();
  window.ccCall('/api/streak', { auth: false }).then(function (d) { D = d; at = Date.now(); draw(); }).catch(function () {}).then(function () { busy = false; });
}
function onView() { if (document.body.dataset.view === 'rewards' && Date.now() - at > 20000) load(); }
new MutationObserver(onView).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
var ci = document.getElementById('ci'); if (ci) ci.addEventListener('click', function () { setTimeout(function () { at = 0; load(); }, 900); });
onView();
})();
