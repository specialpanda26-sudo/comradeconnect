/* cc-wallet-top.js: one wallet card at the top of Me. Tap it to see money received and spent as a line graph, by place. */
(function () {
'use strict';
var BAL = null, DATA = null, busy = false, range = 30;
var AQ = 'var(--aq,#A8DCE7)';
function $(s, r) { return (r || document).querySelector(s); }
function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function kes(n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); }
function call() { return window.CC.call.apply(null, arguments); }
function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
function key(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function short(d) { return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }); }

/* where the money came from / went to */
function inName(r) { if (r.kind === 'sale') return /^Ticket sold/i.test(r.note || '') ? 'Event tickets' : 'Market sales'; return { gift: 'Gifts', referral: 'Invite rewards', topup: 'Deposits', refund: 'Refunds' }[r.kind] || 'Other'; }
function outName(r) { return { purchase: 'Market purchases', withdrawal: 'Withdrawals', wholesale_fee: 'Wholesaler plan' }[r.kind] || 'Other'; }

function build(days) {
  var start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
  var pts = [], idx = {}, i;
  for (i = 0; i < days; i++) { var d = new Date(start); d.setDate(start.getDate() + i); idx[key(d)] = i; pts.push({ d: d, inn: 0, out: 0 }); }
  var inSrc = {}, outSrc = {}, tin = 0, tout = 0;
  (DATA.ledger || []).forEach(function (r) {
    var t = new Date(r.created_at), k = idx[key(t)]; if (k == null) return;
    var v = Number(r.delta) || 0;
    if (v > 0) { pts[k].inn += v; tin += v; var a = inName(r); inSrc[a] = (inSrc[a] || 0) + v; }
    else if (v < 0) { pts[k].out += -v; tout += -v; var b = outName(r); outSrc[b] = (outSrc[b] || 0) + -v; }
  });
  return { pts: pts, inSrc: inSrc, outSrc: outSrc, tin: tin, tout: tout };
}
function niceMax(m) { if (m <= 10) return 10; var p = Math.pow(10, Math.floor(Math.log(m) / Math.LN10)), f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }

function chart(B, readout) {
  var W = 340, H = 200, L = 44, R = 10, T = 12, Bt = 26, n = B.pts.length;
  var max = niceMax(Math.max.apply(null, B.pts.map(function (p) { return Math.max(p.inn, p.out); })));
  var X = function (i) { return L + (n === 1 ? 0 : i * (W - L - R) / (n - 1)); };
  var Y = function (v) { return T + (H - T - Bt) * (1 - v / max); };
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Money received and spent" style="display:block;touch-action:pan-y">';
  s += '<defs><linearGradient id="cwtg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A8DCE7" stop-opacity=".45"/><stop offset="1" stop-color="#A8DCE7" stop-opacity="0"/></linearGradient></defs>';
  for (var g = 0; g <= 4; g++) {
    var v = max * g / 4, y = Y(v);
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="currentColor" stroke-opacity=".12"/>';
    s += '<text x="' + (L - 6) + '" y="' + (y + 3.5) + '" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity=".6">' + (v >= 1000 ? (v / 1000) + 'k' : Math.round(v)) + '</text>';
  }
  var line = function (f) { return B.pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p[f]).toFixed(1); }).join(' '); };
  s += '<path d="' + line('inn') + ' L' + X(n - 1).toFixed(1) + ' ' + Y(0) + ' L' + X(0).toFixed(1) + ' ' + Y(0) + ' Z" fill="url(#cwtg)"/>';
  s += '<path d="' + line('out') + '" fill="none" stroke="currentColor" stroke-opacity=".55" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round" stroke-linejoin="round"/>';
  s += '<path d="' + line('inn') + '" fill="none" stroke="#A8DCE7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  [0, Math.floor((n - 1) / 2), n - 1].forEach(function (i, k) {
    s += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="' + (k === 0 ? 'start' : k === 2 ? 'end' : 'middle') + '" font-size="9.5" fill="currentColor" fill-opacity=".6">' + short(B.pts[i].d) + '</text>';
  });
  s += '<line id="cwt-mk" x1="0" x2="0" y1="' + T + '" y2="' + (H - Bt) + '" stroke="#A8DCE7" stroke-opacity=".8" visibility="hidden"/><circle id="cwt-dot" r="4.5" fill="#A8DCE7" stroke="#101422" stroke-width="2" visibility="hidden"/>';
  s += '<rect id="cwt-hit" x="' + L + '" y="0" width="' + (W - L - R) + '" height="' + H + '" fill="transparent"/></svg>';
  var box = el('div'); box.innerHTML = s;
  var svg = box.firstChild, hit = svg.querySelector('#cwt-hit'), mk = svg.querySelector('#cwt-mk'), dot = svg.querySelector('#cwt-dot');
  function move(ev) {
    var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * W / r.width;
    var i = Math.max(0, Math.min(n - 1, Math.round((x - L) / ((W - L - R) / Math.max(1, n - 1)))));
    var p = B.pts[i]; mk.setAttribute('x1', X(i)); mk.setAttribute('x2', X(i)); mk.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', X(i)); dot.setAttribute('cy', Y(p.inn)); dot.setAttribute('visibility', 'visible');
    readout.textContent = short(p.d) + ': received ' + kes(p.inn) + ', spent ' + kes(p.out);
  }
  hit.addEventListener('pointerdown', move); hit.addEventListener('pointermove', move);
  return box;
}

function list(title, src, total, bar) {
  var wrap = el('div'); wrap.style.marginTop = '20px';
  var h = el('b', '', title); h.style.cssText = 'display:block;font-size:15px;margin-bottom:6px'; wrap.appendChild(h);
  var names = Object.keys(src).sort(function (a, b) { return src[b] - src[a]; });
  if (!names.length) { var e = el('p', 'sub', 'Nothing in this period.'); wrap.appendChild(e); return wrap; }
  names.forEach(function (nm) {
    var pct = total ? Math.round(src[nm] * 100 / total) : 0;
    var row = el('div'); row.style.cssText = 'margin-top:12px';
    var top = el('div'); top.style.cssText = 'display:flex;justify-content:space-between;gap:10px;font-size:14px';
    top.appendChild(el('span', '', nm)); top.appendChild(el('b', '', kes(src[nm]) + ' \u00b7 ' + pct + '%')); row.appendChild(top);
    var tr = el('div'); tr.style.cssText = 'height:8px;border-radius:99px;background:rgba(168,220,231,.16);margin-top:6px;overflow:hidden';
    var fl = el('div'); fl.style.cssText = 'height:100%;width:' + Math.max(3, pct) + '%;border-radius:99px;background:' + bar; tr.appendChild(fl); row.appendChild(tr); wrap.appendChild(row);
  });
  return wrap;
}

function openSheet() {
  if ($('#ccwsheet')) return;
  var ov = el('div'); ov.id = 'ccwsheet'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'My wallet');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(16,20,34,.85);display:flex;justify-content:center;overflow:auto;padding:16px';
  var box = el('div', 'box g'); box.style.cssText = 'max-width:460px;width:100%;margin:auto 0;align-self:flex-start';
  ov.appendChild(box); document.body.appendChild(ov);
  var close = function () { ov.remove(); document.removeEventListener('keydown', onKey); };
  var onKey = function (e) { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  function paint() {
    box.textContent = '';
    var hd = el('div'); hd.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px';
    hd.appendChild(el('b', '', 'My wallet')); var x = el('button', 'btn g', 'Close'); x.type = 'button'; x.onclick = close; hd.appendChild(x); box.appendChild(hd);
    var big = el('div', 'big', kes(DATA ? DATA.balance : BAL)); big.style.marginTop = '8px'; box.appendChild(big);
    box.appendChild(el('div', 'sub', 'Available balance'));
    if (!DATA) { var l = el('p', 'sub', 'Loading your activity...'); l.style.marginTop = '16px'; box.appendChild(l); return; }
    var chips = el('div'); chips.style.cssText = 'display:flex;gap:8px;margin-top:16px';
    [7, 30, 90].forEach(function (d) {
      var c = el('button', 'btn ' + (d === range ? 'p' : 'g'), d + ' days'); c.type = 'button'; c.style.flex = '1'; c.onclick = function () { range = d; paint(); }; chips.appendChild(c);
    });
    box.appendChild(chips);
    var B = build(range);
    if (!B.tin && !B.tout) { var z = el('p', 'sub', 'No money activity in the last ' + range + ' days. When you receive or spend money it shows here as a graph.'); z.style.marginTop = '18px'; box.appendChild(z); return; }
    var sum = el('div'); sum.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px';
    var a = el('div'); a.appendChild(el('div', 'sub', 'Received')); var av = el('b', '', kes(B.tin)); av.style.cssText = 'font-size:20px;color:' + AQ; a.appendChild(av);
    var b = el('div'); b.appendChild(el('div', 'sub', 'Spent')); var bv = el('b', '', kes(B.tout)); bv.style.fontSize = '20px'; b.appendChild(bv);
    sum.appendChild(a); sum.appendChild(b); box.appendChild(sum);
    var ro = el('p', 'note', 'Touch the graph to see a day.'); ro.style.cssText = 'margin:14px 0 4px;min-height:20px'; box.appendChild(ro);
    box.appendChild(chart(B, ro));
    var lg = el('div'); lg.style.cssText = 'display:flex;gap:16px;font-size:12.5px;margin-top:6px';
    lg.innerHTML = '<span><i style="display:inline-block;width:16px;height:3px;border-radius:2px;background:#A8DCE7;vertical-align:middle;margin-right:6px"></i>Received</span><span><i style="display:inline-block;width:16px;border-top:2px dashed currentColor;opacity:.6;vertical-align:middle;margin-right:6px"></i>Spent</span>';
    box.appendChild(lg);
    box.appendChild(list('Where your money came from', B.inSrc, B.tin, '#A8DCE7'));
    box.appendChild(list('Where your money went', B.outSrc, B.tout, 'rgba(168,220,231,.55)'));
    var acts = el('div', 'two'); acts.style.marginTop = '22px';
    var dp = el('button', 'btn p', 'Deposit'); dp.type = 'button'; dp.onclick = function () { close(); act('ccWalletDeposit')(); };
    var wd = el('button', 'btn g', 'Withdraw'); wd.type = 'button'; wd.onclick = function () { close(); act('ccWalletWithdraw')(); };
    acts.appendChild(dp); acts.appendChild(wd); box.appendChild(acts);
  }
  paint();
  call('/api/wallet/stats').then(function (d) { DATA = d; BAL = d.balance; paintCard(); if ($('#ccwsheet')) paint(); }, function (e) { DATA = { balance: BAL, ledger: [] }; if ($('#ccwsheet')) paint(); });
}

var CHART = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/></svg>';
function act(name) { return function () { var f = window[name]; if (f) f(); else { try { toast('Please try again in a moment'); } catch (e) {} } }; }
function paintCard() {
  var c = $('#ccwtop'); if (!c) return;
  c.textContent = '';
  var top = el('div'); top.setAttribute('role', 'button'); top.tabIndex = 0; top.setAttribute('aria-label', 'See my money activity');
  top.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer';
  top.onclick = openSheet; top.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(); } };
  var left = el('div'); left.appendChild(el('div', 'sub', 'Wallet balance'));
  var big = el('div', 'big', BAL == null ? '...' : kes(BAL)); big.style.marginTop = '2px'; left.appendChild(big);
  var hint = el('div', 'sub', 'Tap to see how your money moves'); hint.style.cssText = 'font-size:12px;margin-top:2px'; left.appendChild(hint);
  var ic = el('span'); ic.setAttribute('aria-hidden', 'true'); ic.innerHTML = CHART;
  ic.style.cssText = 'width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:var(--aq,#A8DCE7);color:var(--nt,#101422);flex:none';
  top.appendChild(left); top.appendChild(ic); c.appendChild(top);
  var two = el('div', 'two'); two.style.marginTop = '16px';
  var d = el('button', 'btn p', 'Deposit'); d.type = 'button'; d.onclick = act('ccWalletDeposit');
  var w = el('button', 'btn g', 'Withdraw'); w.type = 'button'; w.onclick = act('ccWalletWithdraw');
  two.appendChild(d); two.appendChild(w); c.appendChild(two);
  var n = el('p', 'sub', 'Deposit with M-Pesa to pay for items and your wholesaler plan. Sales money lands here too.'); n.style.cssText = 'font-size:12px;margin:10px 0 0'; c.appendChild(n);
}
function load() {
  if (busy || !signedIn()) return; busy = true;
  call('/api/wallet').then(function (w) { BAL = w.balance; DATA = null; paintCard(); busy = false; }, function () { busy = false; });
}
function mount() {
  var me = $('#mecard'); if (!me) return;
  if (!signedIn()) { var old = $('#ccwtop'); if (old) old.remove(); BAL = null; DATA = null; return; }
  if ($('#ccwtop')) return;
  var c = el('div', 'box g'); c.id = 'ccwtop';
  me.before(c); paintCard(); load();
}
window.ccWalletTopLoad = load;
document.addEventListener('click', function (ev) { var t = ev.target.closest && ev.target.closest('#tb button'); if (t && t.dataset.v === 'me') setTimeout(function () { mount(); load(); }, 60); });
setInterval(function () { if (!document.hidden) mount(); }, 1500);
mount();
})();
