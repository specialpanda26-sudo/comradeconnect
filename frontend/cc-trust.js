/* Fills the legal pages with the live numbers from /api/trust, so the words never disagree with what the server does.
   Everything is inserted with textContent (never as HTML). If the server cannot be reached, the standard text already on the page stays. */
(function () {
'use strict';
var API = (typeof CC_API !== 'undefined' ? CC_API : '').replace(/\/$/, '');
function get(o, p) { return String(p).split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
function kes(n) { return 'KSh ' + Number(n).toLocaleString('en-KE'); }
function fill(d) {
  document.querySelectorAll('[data-t]').forEach(function (e) {
    var v = get(d, e.getAttribute('data-t'));
    if (v === null || v === undefined || v === '') return;
    var fmt = e.getAttribute('data-fmt');
    e.textContent = (e.getAttribute('data-pre') || '') + (fmt === 'kes' ? kes(v) : v) + (e.getAttribute('data-suf') || '');
  });
  document.querySelectorAll('[data-list]').forEach(function (e) {
    var a = get(d, e.getAttribute('data-list')); if (!Array.isArray(a)) return;
    e.textContent = '';
    a.forEach(function (x) { var li = document.createElement('li'); li.textContent = (e.getAttribute('data-pre') || '') + x; e.appendChild(li); });
  });
  document.querySelectorAll('[data-mode]').forEach(function (e) { e.hidden = e.getAttribute('data-mode') !== d.payments.mode; });
  document.querySelectorAll('[data-show-if]').forEach(function (e) { e.hidden = !get(d, e.getAttribute('data-show-if')); });
  document.querySelectorAll('[data-hide-if]').forEach(function (e) { e.hidden = !!get(d, e.getAttribute('data-hide-if')); });
  var live = document.getElementById('live');
  if (live) live.textContent = 'These figures are read live from our server. Last updated ' + d.updated + '.';
  var f = d.fees && d.fees.example, o = document.getElementById('calcOut');
  if (f && o) {
    o.textContent = '';
    [['Item price (buyer pays this)', kes(f.sale)], ['Marketplace fee (kept from the seller)', '- ' + kes(f.fee)], ['Added to the seller wallet', kes(f.seller_receives)],
     ['Withdrawal fee, if you cash out all of it', '- ' + kes(f.withdrawal_fee)], ['Seller receives on M-Pesa', kes(f.seller_net_to_mpesa)]].forEach(function (r, i, all) {
      var p = document.createElement('p'), b = document.createElement('b'); b.textContent = r[1]; p.textContent = r[0] + ': '; p.appendChild(b);
      if (i === all.length - 1) p.style.borderTop = '1px solid var(--line)', p.style.paddingTop = '6px'; o.appendChild(p);
    });
  }
}
function load(amount) {
  if (!API) return Promise.resolve();
  return fetch(API + '/api/trust' + (amount ? '?amount=' + amount : '')).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d) fill(d); }).catch(function () {});
}
var inp = document.getElementById('calcAmt'), t = null;
if (inp) inp.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { var n = Math.floor(Number(inp.value)); if (n >= 1 && n <= 150000) load(n); }, 350); });
load();
})();
