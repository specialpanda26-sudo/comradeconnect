/* Wallet and wholesaler card on the Me page, deposits, the wholesaler plan, and "Pay from wallet" in the buy sheet.
   Loaded after cc-core.js (uses window.CC.call / CC.waitPaid and the page's toast, shut, idOK, needId). */
(function () {
'use strict';
var API = (typeof CC_API !== 'undefined' ? CC_API : '');
function $(s, r) { return (r || document).querySelector(s); }
function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function say(m) { try { toast(m); } catch (e) { alert(m); } }
var kes = function (n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); };
var W = null, busy = false;
var call = function () { return window.CC.call.apply(null, arguments); };
var phone = function () { try { return localStorage.getItem('cc_phone') || ''; } catch (e) { return ''; } };
var savePhone = function (v) { try { localStorage.setItem('cc_phone', v); } catch (e) {} };
var okPhone = function (v) { return /^(07|01)\d{8}$/.test(v); };

function sheet(title, intro) {
  var m = el('div'); m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto';
  var b = el('div', 'box g'); b.style.cssText = 'max-width:360px;width:100%';
  b.appendChild(el('h3', '', title)); var p = el('p', 'sub', intro); p.style.marginTop = '6px'; b.appendChild(p);
  m.appendChild(b); document.body.appendChild(m); m.box = b; m.close = function () { m.remove(); }; return m;
}
function field(m, ph, val, mode) {
  var f = el('div', 'fld'); f.style.marginTop = '10px'; var i = el('input'); i.placeholder = ph; i.value = val || ''; i.setAttribute('aria-label', ph);
  if (mode) i.inputMode = mode; f.appendChild(i); m.box.appendChild(f); return i;
}
function errLine(m) { var e = el('p', 'sub'); e.style.cssText = 'color:#f87171;min-height:18px'; m.box.appendChild(e); return e; }
function btn(label, cls, fn) { var b = el('button', 'btn ' + cls, label); b.onclick = fn; return b; }
function row2(m, a, b) { var d = el('div', 'two'); d.appendChild(a); d.appendChild(b); m.box.appendChild(d); }

async function load() {
  try { var r = await Promise.all([call('/api/wholesale/me'), call('/api/wallet')]); W = r[0]; W.wallet = r[1]; window.ccPhotoCap = W.active ? W.photos : 5; draw(); }
  catch (e) { }
}
function days(until) { return Math.max(0, Math.ceil((Date.parse(until) - Date.now()) / 86400e3)); }
function draw() {
  var host = $('#ccw'); if (!host || !W) return;
  host.textContent = '';
  host.appendChild(el('div', 'sub', 'Wallet balance'));
  var big = el('div', 'big', kes(W.balance)); big.id = 'ccw-bal'; host.appendChild(big);
  var two = el('div', 'two'); two.style.marginTop = '12px';
  two.appendChild(btn('Deposit', 'btn p', deposit)); two.appendChild(btn('Withdraw', 'btn g', withdraw)); host.appendChild(two);
  var n = el('p', 'note', 'Deposit with M-Pesa, then pay for items and your wholesaler plan straight from your wallet. Sales money lands here too.'); n.style.marginTop = '8px'; host.appendChild(n);
  var hr = el('div'); hr.style.cssText = 'height:1px;background:rgba(255,255,255,.12);margin:14px 0'; host.appendChild(hr);
  if (W.active) {
    host.appendChild(el('b', '', 'Wholesaler \u2713'));
    var s = el('p', 'sub', 'Active for ' + days(W.until) + ' more day' + (days(W.until) === 1 ? '' : 's') + '. Post as many items as you want, up to ' + W.photos + ' photos each.'); s.style.marginTop = '4px'; host.appendChild(s);
    var rb = btn('Renew for ' + kes(W.fee) + ' (+' + W.days + ' days)', 'btn g', join); rb.style.cssText = 'width:100%;margin-top:10px'; host.appendChild(rb);
  } else {
    host.appendChild(el('b', '', 'Become a wholesaler'));
    var t = el('p', 'sub', 'Selling many items? Join for ' + kes(W.fee) + ' every ' + W.days + ' days and post as many items as you want, with up to ' + W.photos + ' photos each. Free sellers can have ' + W.free_limit + ' items posted at once (you have ' + W.used + ').'); t.style.marginTop = '4px'; host.appendChild(t);
    var jb = btn(W.until ? 'Renew for ' + kes(W.fee) : 'Join for ' + kes(W.fee), 'btn p', join); jb.style.cssText = 'width:100%;margin-top:10px'; host.appendChild(jb);
    if (W.until) host.appendChild(el('p', 'note', 'Your last membership ended. Your items stay up, but you cannot post new ones beyond the free limit until you renew.'));
  }
}
function mount() {
  var me = $('#mecard'); if (!me || $('#ccw')) return;
  var box = el('div', 'box g'); box.id = 'ccw'; me.after(box); load();
}

function deposit() {
  var m = sheet('Deposit to wallet', 'Add money with M-Pesa. You can then buy items and pay your wholesaler plan from your wallet.');
  var a = field(m, 'Amount in KSh', '', 'numeric'), p = field(m, 'M-Pesa number, e.g. 0712345678', phone(), 'numeric'), e = errLine(m);
  var go = btn('Deposit', 'btn p', async function () {
    var amt = Math.floor(+a.value), ph = p.value.replace(/\s/g, '');
    if (!(amt >= 1 && amt <= 150000)) return (e.textContent = 'Enter an amount from KSh 1 to KSh 150,000.');
    if (!okPhone(ph)) return (e.textContent = 'Enter a Safaricom or Airtel number like 0712345678.');
    go.disabled = true; e.textContent = ''; go.textContent = 'Check your phone...';
    try { var d = await call('/api/pay', { body: { purpose: 'topup', amount: amt, phone: ph } }); savePhone(ph); await window.CC.waitPaid(d.id); m.close(); say(kes(amt) + ' added to your wallet.'); load(); }
    catch (x) { e.textContent = x.message; go.disabled = false; go.textContent = 'Deposit'; if (x.pending) { m.close(); say(x.message); load(); } }
  });
  row2(m, btn('Cancel', 'btn g', function () { m.close(); }), go);
}
async function withdraw() {
  var bal = W ? W.balance : 0; if (!bal) return say('Your wallet is empty.');
  try { if (typeof idOK === 'function' && !idOK()) return needId(); } catch (x) {}
  var cfg = {}; try { cfg = await (await fetch(API + '/api/config')).json(); } catch (x) {}
  var min = cfg.withdraw_min || 1, max = Math.min(bal, cfg.withdraw_max || 150000);
  var m = sheet('Withdraw to M-Pesa', 'Available: ' + kes(bal) + '. Smallest ' + kes(min) + '.' + (cfg.withdraw_fee_percent || cfg.withdraw_fee_flat ? ' A withdrawal fee applies.' : ''));
  var a = field(m, 'Amount in KSh', String(max), 'numeric'), p = field(m, 'M-Pesa number', phone(), 'numeric'), e = errLine(m);
  var go = btn('Request', 'btn p', async function () {
    var amt = Math.floor(+a.value), ph = p.value.replace(/\s/g, '');
    if (!(amt >= min && amt <= max)) return (e.textContent = 'Enter an amount from ' + kes(min) + ' up to ' + kes(max) + '.');
    if (!okPhone(ph)) return (e.textContent = 'Enter a Safaricom or Airtel number like 0712345678.');
    go.disabled = true;
    try { var r = await call('/api/wallet/withdraw', { body: { amount: amt, phone: ph } }); savePhone(ph); m.close(); say(r.status === 'sending' ? 'Sending to your M-Pesa now.' : 'Request sent. An admin will pay it out.'); load(); }
    catch (x) { e.textContent = x.message; go.disabled = false; }
  });
  row2(m, btn('Cancel', 'btn g', function () { m.close(); }), go);
}
function join() {
  if (!W) return;
  var enough = W.balance >= W.fee;
  var m = sheet(W.active ? 'Renew wholesaler plan' : 'Join wholesalers', kes(W.fee) + ' for ' + W.days + ' days' + (W.active ? ', added after your current end date.' : '. Post as many items as you want, up to ' + W.photos + ' photos each.'));
  var e = errLine(m);
  var wb = btn(enough ? 'Pay ' + kes(W.fee) + ' from wallet (' + kes(W.balance) + ')' : 'Wallet too low (' + kes(W.balance) + ')', 'btn p', async function () {
    wb.disabled = true;
    try { await call('/api/wholesale/join', { body: { method: 'wallet' } }); m.close(); say('Wholesaler plan active.'); load(); }
    catch (x) { e.textContent = x.message; wb.disabled = !enough; }
  });
  wb.disabled = !enough; wb.style.cssText = 'width:100%;margin-top:10px'; m.box.appendChild(wb);
  var p = field(m, 'M-Pesa number, e.g. 0712345678', phone(), 'numeric');
  var mb = btn('Pay ' + kes(W.fee) + ' with M-Pesa', 'btn g', async function () {
    var ph = p.value.replace(/\s/g, ''); if (!okPhone(ph)) return (e.textContent = 'Enter a Safaricom or Airtel number like 0712345678.');
    mb.disabled = true; e.textContent = ''; mb.textContent = 'Check your phone...';
    try { var d = await call('/api/wholesale/join', { body: { method: 'mpesa', phone: ph } }); savePhone(ph); await window.CC.waitPaid(d.id); m.close(); say('Wholesaler plan active.'); load(); }
    catch (x) { e.textContent = x.message; mb.disabled = false; mb.textContent = 'Pay ' + kes(W.fee) + ' with M-Pesa'; if (x.pending) { m.close(); say(x.message); load(); } }
  });
  mb.style.cssText = 'width:100%;margin-top:10px'; m.box.appendChild(mb);
  var c = btn('Close', 'btn g', function () { m.close(); }); c.style.cssText = 'width:100%;margin-top:10px'; m.box.appendChild(c);
}

function addWalletPay() {
  var bgo = $('#bgo'); if (!bgo || $('#ccw-pay')) return;
  var b = el('button', 'btn g', 'Pay from wallet'); b.id = 'ccw-pay'; b.style.cssText = 'width:100%;margin-top:8px'; bgo.after(b);
  b.onclick = async function () {
    if (busy) return; var id = ($('#mvbuy') || {}).dataset && $('#mvbuy').dataset.id; if (!id) return;
    var pts = $('#bpts input'), usePts = !!(pts && pts.checked);
    busy = true; b.disabled = true; b.textContent = 'Paying...';
    try {
      var d = await call('/api/market/buy', { body: { listing_id: id, pay_with: 'wallet', use_points: usePts } });
      try { shut(); } catch (x) {} say('Paid ' + kes(d.amount) + ' from your wallet. Your order is under Market > Orders.');
      var o = document.querySelector('#mseg [data-s="orders"]'); if (o) o.click(); load();
    } catch (x) { say(x.message); }
    busy = false; b.disabled = false; b.textContent = 'Pay from wallet';
  };
}
document.addEventListener('click', function (ev) { if (ev.target.closest && ev.target.closest('#mvbuy')) setTimeout(addWalletPay, 0); });
document.addEventListener('click', function (ev) { var t = ev.target.closest && ev.target.closest('#tb button'); if (t && t.dataset.v === 'me') setTimeout(function () { mount(); if ($('#ccw')) load(); }, 50); });
if (document.readyState !== 'loading') mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
