/* cc-paychoice.js v1: shared "Pay with wallet / Pay with M-Pesa" choice for in-app payment sheets.
   Usage: var wc = ccPayChoice.mount(hostEl, { need: function(){ return kshDue; }, onChange: function(mode){} });
   wc.mode() is 'wallet' or 'mpesa'. wc.repaint() after the price changes. wc.short() after a 402. ccPayChoice.paid() after a wallet payment. */
(function () {
'use strict';
if (window.ccPayChoice) return;
var cache = { bal: null, at: 0 }, uid = 0;
var kes = function (n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); };
function signedIn() { try { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); } catch (e) { return false; } }
function balance(force) {
  if (!signedIn() || !window.CC || !window.CC.call) return Promise.resolve(null);
  if (!force && cache.bal != null && Date.now() - cache.at < 20000) return Promise.resolve(cache.bal);
  return window.CC.call('/api/wallet').then(function (w) { cache.bal = Math.max(0, Number(w && w.balance) || 0); cache.at = Date.now(); return cache.bal; }, function () { return null; });
}
function mount(host, o) {
  o = o || {}; if (!host) return null;
  var nm = 'ccpc' + (++uid), mode = 'mpesa', bal = null, loaded = false;
  var need = function () { return Math.max(0, Math.floor(Number(typeof o.need === 'function' ? o.need() : o.need) || 0)); };
  var fire = function () { try { if (o.onChange) o.onChange(mode); } catch (e) {} };
  function row(v, on, off, label, sub) {
    return '<label style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;margin-top:8px;border-radius:16px;cursor:' + (off ? 'not-allowed' : 'pointer') + ';opacity:' + (off ? '.55' : '1') + ';border:1.5px solid ' + (on ? 'currentColor' : 'color-mix(in srgb,currentColor 22%,transparent)') + '">'
      + '<input type="radio" name="' + nm + '" value="' + v + '"' + (on ? ' checked' : '') + (off ? ' disabled' : '') + ' style="margin:0"><span style="flex:1;font-weight:700;font-size:14px">' + label + '</span>'
      + (sub ? '<small style="opacity:.75;font-size:12px;width:100%;padding-left:26px">' + sub + '</small>' : '') + '</label>';
  }
  function paint() {
    var ok = loaded && bal != null && bal >= need(), flipped = false;
    if (mode === 'wallet' && !ok) { mode = 'mpesa'; flipped = true; }
    var wl = bal == null ? 'Pay with wallet' : 'Pay with wallet (' + kes(bal) + ' available)';
    var sub = !loaded ? 'Checking your balance...' : bal == null ? 'Not available right now' : ok ? '' : 'Deposit first';
    host.innerHTML = '<div role="radiogroup" aria-label="How do you want to pay?">' + row('wallet', mode === 'wallet', !ok, wl, sub) + row('mpesa', mode === 'mpesa', false, 'Pay with M-Pesa', '') + '</div>';
    if (flipped) fire();
  }
  host.onchange = function (e) {
    var t = e && e.target; if (!t || t.name !== nm || t.disabled) return;
    mode = t.value === 'wallet' ? 'wallet' : 'mpesa'; paint(); fire();
  };
  paint();
  balance().then(function (b) { bal = b; loaded = true; paint(); });
  return {
    mode: function () { return mode; },
    repaint: function () { paint(); },
    refresh: function () { return balance(true).then(function (b) { bal = b; loaded = true; paint(); }); },
    short: function () { mode = 'mpesa'; cache.bal = null; balance(true).then(function (b) { bal = b; loaded = true; paint(); }); paint(); fire(); return 'Not enough wallet balance. Deposit first or pay with M-Pesa.'; },
  };
}
function paid() {
  cache.bal = null; cache.at = 0;
  try { if (window.ccMk && window.ccMk.S) window.ccMk.S.wallet = null; } catch (e) {}
  try { if (window.ccWalletTopLoad) window.ccWalletTopLoad(); } catch (e) {}
  try { if (window.ccWholesaleLoad) window.ccWholesaleLoad(); } catch (e) {}
}
window.ccPayChoice = { mount: mount, balance: balance, paid: paid, kes: kes };
})();
