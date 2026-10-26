/* cc-topsales.js: "Top sales this month" at the top of the Market. Top sellers, what is selling, and what just sold.
   Sellers are shown by a made-up name, never by their real one. Text uses textContent only. */
(function () {
'use strict';
if (window.__ccTop) return; window.__ccTop = 1;
var view = document.getElementById('v-market'), host = document.getElementById('mbrowse'); if (!view || !host) return;
var D = null, card = null, tab = 's', open = true, at = 0, busy = false;

function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function connected() { return typeof CC_API === 'string' && CC_API.indexOf('YOUR-SUBDOMAIN') < 0; }
function kes(n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); }
function ago(ms) { var s = Math.max(1, Math.round((Date.now() - ms) / 1000)); return s < 3600 ? Math.max(1, Math.round(s / 60)) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago'; }

var css = el('style');
css.textContent =
'#cctop .tp-h{all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--fg,#fff)}#cctop .tp-h:focus-visible{outline:2px solid var(--fg,#fff);outline-offset:4px;border-radius:8px}' +
'#cctop h3{margin:0}#cctop .tp-s{display:block;margin-top:3px;font-size:12px;font-weight:400;color:var(--mut,var(--mut))}#cctop .tp-c{flex:none;transition:transform .2s}#cctop .tp-c svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;display:block}' +
'#cctop.shut .tp-c{transform:rotate(-90deg)}#cctop.shut .tp-b{display:none}' +
'#cctop .tp-t{display:flex;gap:6px;margin:14px 0 4px}#cctop .tp-t button{all:unset;cursor:pointer;padding:7px 13px;border-radius:999px;font-size:12px;color:var(--mut,var(--mut));border:1px solid var(--gb,rgba(255,255,255,.22))}#cctop .tp-t button.on{background:var(--ink,#fff);color:var(--inkfg,#101422);border-color:var(--ink,#fff);font-weight:600}#cctop .tp-t button:focus-visible{outline:2px solid var(--fg,#fff);outline-offset:2px}' +
'#cctop .tp-r{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line,rgba(255,255,255,.14))}#cctop .tp-r:last-child{border-bottom:0}' +
'#cctop .tp-k{flex:none;width:22px;font-size:13px;font-weight:600;color:var(--mut,var(--mut))}#cctop .tp-x{flex:1;min-width:0}#cctop .tp-x b{display:block;font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#cctop .tp-x small{display:block;margin-top:2px;font-size:12px;color:var(--mut,var(--mut))}' +
'#cctop .tp-v{flex:none;font-size:13px;font-weight:600}#cctop .me b{text-decoration:underline;text-underline-offset:3px}' +
'#cctop .tp-bar{height:3px;border-radius:2px;background:var(--line,rgba(255,255,255,.18));margin-top:7px;overflow:hidden}#cctop .tp-bar i{display:block;height:100%;background:var(--fg,#fff)}';
document.head.appendChild(css);

function stars(s) { return s.rating ? s.rating.toFixed(1) + ' from ' + s.ratings + (s.ratings === 1 ? ' rating' : ' ratings') : 'No ratings yet'; }
function body() {
  var b = el('div', 'tp-b'), t = el('div', 'tp-t'); t.setAttribute('role', 'tablist');
  [['s', 'Top sellers'], ['c', 'Trending'], ['r', 'Just sold']].forEach(function (x) { var k = el('button', x[0] === tab ? 'on' : '', x[1]); k.type = 'button'; k.setAttribute('role', 'tab'); k.onclick = function () { tab = x[0]; draw(); }; t.appendChild(k); });
  b.appendChild(t);
  var list = el('div');
  if (tab === 's') D.sellers.forEach(function (s, i) {
    var r = el('div', 'tp-r' + (s.mine ? ' me' : '')), x = el('div', 'tp-x'), n = el('b', '', s.alias); if (s.verified && window.ccVerified) n.insertAdjacentHTML('beforeend', window.ccVerified(15, s.kind)); x.appendChild(n); x.appendChild(el('small', '', stars(s)));
    r.appendChild(el('span', 'tp-k', String(i + 1))); r.appendChild(x); r.appendChild(el('span', 'tp-v', s.sales + (s.sales === 1 ? ' sale' : ' sales'))); list.appendChild(r);
  });
  if (tab === 'c') { var max = D.categories.reduce(function (m, c) { return Math.max(m, c.sales); }, 1); D.categories.forEach(function (c) {
    var r = el('div', 'tp-r'), x = el('div', 'tp-x'); x.appendChild(el('b', '', c.category)); var bar = el('div', 'tp-bar'), i = el('i'); i.style.width = Math.round(c.sales / max * 100) + '%'; bar.appendChild(i); x.appendChild(bar);
    r.appendChild(x); r.appendChild(el('span', 'tp-v', c.sales + (c.sales === 1 ? ' sale' : ' sales'))); list.appendChild(r); }); }
  if (tab === 'r') D.recent.forEach(function (s) {
    var r = el('div', 'tp-r'), x = el('div', 'tp-x'); x.appendChild(el('b', '', s.title)); x.appendChild(el('small', '', ago(s.at))); r.appendChild(x); r.appendChild(el('span', 'tp-v', kes(s.price))); list.appendChild(r);
  });
  b.appendChild(list); return b;
}
function draw() {
  if (!card || !D) return;
  if (!D.total_sales) { card.hidden = true; return; }
  card.hidden = false; card.className = 'box g' + (open ? '' : ' shut'); card.textContent = '';
  var h = el('button', 'tp-h'); h.type = 'button'; h.setAttribute('aria-expanded', open ? 'true' : 'false');
  var tt = el('div'), h3 = el('h3', '', 'Top sales this month'); tt.appendChild(h3); tt.appendChild(el('span', 'tp-s', D.total_sales + (D.total_sales === 1 ? ' item' : ' items') + ' sold in the last ' + D.days + ' days'));
  var c = el('span', 'tp-c'); c.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  h.appendChild(tt); h.appendChild(c); h.onclick = function () { open = !open; draw(); }; card.appendChild(h);
  if (open) card.appendChild(body());
}
function load() {
  if (!connected() || busy) return; busy = true;
  if (!card) { card = el('div', 'box g'); card.id = 'cctop'; card.hidden = true; host.insertBefore(card, host.firstChild); }
  window.ccCall('/api/market/top', { auth: false }).then(function (d) { D = d; at = Date.now(); draw(); }).catch(function () {}).then(function () { busy = false; });
}
function onView() { if (document.body.dataset.view === 'market' && Date.now() - at > 60000) load(); }
new MutationObserver(onView).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
onView();
})();
