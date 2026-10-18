/* Market add-ons: escrow explainer card, price filter and sort, seller star ratings, "Report a scam" and order progress steps.
   Works on top of the Market screen (cc-core.js) without changing it. All text goes in with textContent, never as HTML. */
(function () {
'use strict';
var API = (typeof CC_API !== 'undefined' ? CC_API : '').replace(/\/$/, ''), L = {}, O = [], pend = {}, F = { min: null, max: null, sort: 'new' };
function $(s, r) { return (r || document).querySelector(s); }
function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function say(m) { try { if (typeof toast === 'function') return toast(m); } catch (e) {} alert(m); }
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
function stars(r) { return r && r.count ? '\u2605 ' + r.avg + ' (' + r.count + ')' : 'New seller'; }

var st = el('style'); st.textContent =
'.cce{padding:14px 16px}.cce summary{cursor:pointer;font-weight:700;font-size:14px}.cce ol{margin:10px 0 4px;padding-left:20px;font-size:13px;line-height:1.6;opacity:.9}.cce p{margin:6px 0 0;font-size:13px;font-weight:600}' +
'.ccf{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ccf input,.ccf select{font:inherit;font-size:16px;min-width:0;padding:11px 14px;border-radius:14px;border:1px solid var(--line,rgba(255,255,255,.25));background:transparent;color:inherit}.ccf select{grid-column:1/3}.ccf option{color:#000}' +
'.ccr{display:block;margin-top:2px;font-weight:600}.ccr2{margin:2px 0 8px;font-size:13px;font-weight:600}' +
'.cct{display:flex;align-items:center;gap:6px;margin:10px 0 2px;font-size:11px}.cct span{display:flex;align-items:center;gap:5px;white-space:nowrap;opacity:.5}.cct span:before{content:"";width:12px;height:12px;border-radius:50%;border:2px solid currentColor;flex:none}' +
'.cct span.on{opacity:1}.cct span.on:before{background:currentColor}.cct i{flex:1;height:2px;min-width:8px;background:var(--line,rgba(255,255,255,.25));border-radius:2px}' +
'.ccst{margin:10px 0 0;font-size:13px}.ccst button{all:unset;cursor:pointer;font-size:26px;padding:2px 3px;opacity:.35}.ccst button.on{opacity:1}.ccst .go{font-size:13px;font-weight:700;padding:7px 14px;margin-left:8px;border-radius:999px;background:var(--fg,#fff);color:var(--bg,#000);opacity:1}' +
'.ccrp{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:20px}.ccrp .box{max-width:360px;width:100%;display:grid;gap:10px}';
document.head.appendChild(st);

// ---- remember the last lists the app loaded (listing prices, ratings, order status) ----
var f0 = window.fetch;
window.fetch = function (u) {
  var p = f0.apply(this, arguments);
  try {
    if (typeof u === 'string' && API && u.indexOf(API) === 0) {
      var path = u.slice(API.length);
      if (/^\/api\/market\/(listings|mine)/.test(path)) p.then(function (r) { return r.clone().json(); }).then(function (d) { (d.listings || [d]).forEach(function (l) { if (l && l.id) L[l.id] = l; }); runGrid(); }).catch(function () {});
      else if (/^\/api\/orders\/mine/.test(path)) p.then(function (r) { return r.clone().json(); }).then(function (d) { O = d.orders || []; runOrders(); }).catch(function () {});
    }
  } catch (e) {}
  return p;
};

// ---- 1. escrow card and price controls on Browse ----
var grid = $('#mgrid'), browse = $('#mbrowse'), none = el('p', 'sub', 'No items in that price range. Clear the price boxes to see everything.');
none.hidden = true;
if (browse && grid) {
  var det = el('details', 'cce box g'), sum = el('summary', '', '\uD83D\uDEE1\uFE0F How escrow protects you');
  det.appendChild(sum);
  var ol = el('ol'); [
    'You pay on Comrade Connect. The seller does not get the money yet.',
    'Meet on campus in daytime and check the item.',
    'Give the seller your 6-digit code, or tap "I received it". Only then is the seller paid.',
    'Problem? Tap "Report a problem" on your order before you give the code. An admin decides.'
  ].forEach(function (t) { ol.appendChild(el('li', '', t)); });
  det.appendChild(ol); det.appendChild(el('p', '', 'Never pay outside the app.'));
  if (!ls('cc_esc_seen')) det.open = true;
  det.addEventListener('toggle', function () { ls('cc_esc_seen', '1'); });
  browse.insertBefore(det, browse.firstChild);

  var q = $('#mkq'), fld = q && q.closest('.fld'), bar = el('div', 'ccf');
  var mn = el('input'), mx = el('input'), so = el('select');
  [mn, mx].forEach(function (i, k) { i.type = 'number'; i.inputMode = 'numeric'; i.min = '0'; i.placeholder = k ? 'Max KSh' : 'Min KSh'; i.setAttribute('aria-label', k ? 'Maximum price' : 'Minimum price'); });
  [['new', 'Newest first'], ['lo', 'Price: low to high'], ['hi', 'Price: high to low']].forEach(function (o) { var op = el('option', '', o[1]); op.value = o[0]; so.appendChild(op); });
  so.setAttribute('aria-label', 'Sort items');
  bar.appendChild(mn); bar.appendChild(mx); bar.appendChild(so);
  if (fld) fld.insertAdjacentElement('afterend', bar); else browse.insertBefore(bar, det.nextSibling);
  grid.insertAdjacentElement('afterend', none);
  function num(v) { var n = parseInt(v, 10); return isFinite(n) && n >= 0 ? n : null; }
  function upd() { F.min = num(mn.value); F.max = num(mx.value); F.sort = so.value; runGrid(); }
  mn.oninput = mx.oninput = so.onchange = upd;
}

var busyG = false, obsG = null;
function runGrid() {
  if (!grid || busyG) return; busyG = true;
  try {
    var cards = [].slice.call(grid.children).filter(function (c) { return c.classList.contains('mc'); }), shown = 0;
    cards.forEach(function (c) {
      var l = L[c.dataset.id], m = c.querySelector('.mb');
      if (l && m && !m.querySelector('.ccr')) m.appendChild(el('small', 'ccr', stars(l.seller && l.seller.rating)));
      var hide = !!l && ((F.min != null && l.price < F.min) || (F.max != null && l.price > F.max));
      c.style.display = hide ? 'none' : ''; if (!hide) shown++;
    });
    var cmp = { new: function (a, b) { return ((L[b.dataset.id] || {}).createdAt || 0) - ((L[a.dataset.id] || {}).createdAt || 0); },
                lo: function (a, b) { return ((L[a.dataset.id] || {}).price || 0) - ((L[b.dataset.id] || {}).price || 0); },
                hi: function (a, b) { return ((L[b.dataset.id] || {}).price || 0) - ((L[a.dataset.id] || {}).price || 0); } }[F.sort];
    var sorted = cards.slice().sort(cmp), same = sorted.every(function (c, i) { return c === cards[i]; });
    if (!same) { var tail = grid.querySelector(':scope > :not(.mc)'); sorted.forEach(function (c) { grid.insertBefore(c, tail); }); }
    none.hidden = !(cards.length && !shown);
  } finally { if (obsG) obsG.takeRecords(); busyG = false; }
}
if (grid) { obsG = new MutationObserver(runGrid); obsG.observe(grid, { childList: true }); runGrid(); }

// ---- 2. listing details: seller rating and Report a scam ----
function reportSheet(id) {
  var w = el('div', 'ccrp'), b = el('div', 'box g'); w.appendChild(b);
  b.appendChild(el('h3', '', 'Report this listing'));
  b.appendChild(el('p', 'sub', 'An admin will check it. Why are you reporting it?'));
  ['Asks me to pay outside the app', 'Fake or stolen item', 'Price or description is wrong', 'Something else'].forEach(function (r) {
    var x = el('button', 'btn g', r); x.type = 'button';
    x.onclick = function () {
      x.disabled = true;
      fetch(API + '/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'listing', id: id, reason: r }) })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { return { ok: res.ok, d: d, s: res.status }; }); })
        .then(function (o) { w.remove(); say(o.ok ? 'Thanks. An admin will check this listing.' : (o.s === 401 ? 'Please sign in first, then report again.' : o.d.error || 'Could not send the report. Try again.')); })
        .catch(function () { w.remove(); say('Could not send the report. Check your connection.'); });
    };
    b.appendChild(x);
  });
  var c = el('button', 'btn', 'Cancel'); c.type = 'button'; c.onclick = function () { w.remove(); }; b.appendChild(c);
  w.onclick = function (e) { if (e.target === w) w.remove(); };
  document.body.appendChild(w);
}
function decorateModal(id) {
  var l = L[id], mvb = $('#mvb'), dm = $('#mvdm'); if (!mvb || !dm) return;
  var h = mvb.querySelector('h3');
  if (l && h && !mvb.querySelector('.ccr2')) h.insertAdjacentElement('afterend', el('p', 'ccr2', 'Seller rating: ' + (l.seller && l.seller.rating && l.seller.rating.count ? stars(l.seller.rating) + ' from completed orders' : 'new seller, no ratings yet')));
  var rep = $('#ccrep');
  if (!rep) { rep = el('button', 'btn g', 'Report a scam'); rep.id = 'ccrep'; rep.type = 'button'; rep.style.cssText = 'width:100%;margin-top:10px'; dm.insertAdjacentElement('afterend', rep); rep.onclick = function () { reportSheet(rep.dataset.id); }; }
  rep.dataset.id = id; rep.hidden = dm.hidden;
}
if (grid) grid.addEventListener('click', function (e) { var c = e.target.closest('.mc'); if (c) setTimeout(function () { decorateModal(c.dataset.id); }, 0); });

// ---- 3. orders: progress steps and rating ----
function flow(o) {
  if (o.status === 'refunded') return { l: ['Paid', 'Refunded'], d: 2 };
  if (o.status === 'disputed') return { l: ['Paid', 'Admin review', 'Decision'], d: 2 };
  return { l: ['Paid', 'Handed over', 'Confirmed'], d: o.status === 'released' ? 3 : o.status === 'handed' ? 2 : 1 };
}
function rateBox(o) {
  var b = el('div', 'ccst');
  if (o.my_rating) { b.textContent = 'You rated this seller ' + o.my_rating + ' of 5 \u2605'; return b; }
  b.appendChild(el('span', '', 'Rate the seller: '));
  var sel = pend[o.id] || 0, btns = [], go = el('button', 'go', 'Send rating'); go.type = 'button'; go.hidden = !sel;
  function paint() { btns.forEach(function (x, i) { x.className = i < sel ? 'on' : ''; }); go.hidden = !sel; }
  for (var i = 1; i <= 5; i++) (function (n) {
    var x = el('button', '', '\u2605'); x.type = 'button'; x.setAttribute('aria-label', n + ' star' + (n > 1 ? 's' : ''));
    x.onclick = function () { sel = pend[o.id] = n; paint(); }; btns.push(x); b.appendChild(x);
  })(i);
  go.onclick = function () {
    go.disabled = true;
    fetch(API + '/api/orders/' + o.id + '/rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stars: sel }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) { if (x.ok) { o.my_rating = sel; delete pend[o.id]; b.textContent = 'Thanks! You rated this seller ' + sel + ' of 5 \u2605'; } else { go.disabled = false; say(x.d.error || 'Could not save your rating.'); } })
      .catch(function () { go.disabled = false; say('Could not save your rating. Check your connection.'); });
  };
  b.appendChild(go); paint(); return b;
}
var ol = $('#olist'), busyO = false, obsO = null;
function runOrders() {
  if (!ol || busyO) return; busyO = true;
  try {
    var cards = [].slice.call(ol.children).filter(function (c) { return c.classList.contains('box'); });
    if (!O.length || cards.length !== O.length) return;
    cards.forEach(function (c, i) {
      var o = O[i], h = c.querySelector('h3'), amt = h && h.nextElementSibling;
      if (!amt || h.textContent !== o.title || c.querySelector('.cct') || !o.status) return;
      var f = flow(o), t = el('div', 'cct');
      f.l.forEach(function (name, k) { if (k) t.appendChild(el('i')); t.appendChild(el('span', k < f.d ? 'on' : '', name)); });
      t.setAttribute('role', 'img'); t.setAttribute('aria-label', 'Order progress: ' + f.l.slice(0, f.d).join(', then '));
      amt.insertAdjacentElement('afterend', t);
      if (o.role === 'buyer' && o.status === 'released') t.insertAdjacentElement('afterend', rateBox(o));
    });
  } finally { if (obsO) obsO.takeRecords(); busyO = false; }
}
if (ol) { obsO = new MutationObserver(runOrders); obsO.observe(ol, { childList: true }); runOrders(); }
})();
