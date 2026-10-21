/* cc-card.js: "M-Pesa | Card" choice on every pay sheet. Card payments run on IntaSend's own secure page
   (Visa / Mastercard), so card numbers never reach Comrade Connect. The option only appears when the server says cards are on. */
(function () {
'use strict';
if (window.__ccCard) return; window.__ccCard = 1;
var native = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
var DUMMY = '0712345678';                      // lets each sheet's phone check pass; the server ignores it for cards
var cardOn = false, states = [], pre = null, queued = false;
var api = function () { return typeof CC_API !== 'undefined' ? CC_API : ''; };

function load() {
  try { localStorage.removeItem('cc_phone'); } catch (e) {}                 // old remembered number: forget it
  if (!api()) return;
  fetch(api() + '/api/pay/methods', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { cardOn = !!(j && j.card); queue(); }).catch(function () {});
}
window.addEventListener('online', load);

var st = document.createElement('style');
st.textContent = '.ccm-sw{display:flex;gap:6px;margin:12px 0 4px;padding:4px;border-radius:999px;border:1px solid var(--line,rgba(255,255,255,.18));background:var(--g,rgba(255,255,255,.06))}'
  + '.ccm-sw button{flex:1;min-height:38px;border:0;border-radius:999px;background:none;color:inherit;font:600 13px Poppins,system-ui,sans-serif;cursor:pointer}'
  + '.ccm-sw button.on{background:var(--fg,#fff);color:var(--bg,#000)}'
  + '.ccm-note{margin:6px 2px 0;font-size:12px;opacity:.75}';
document.head.appendChild(st);

function rootOf(el) { var r = el; while (r.parentElement && r.parentElement !== document.body) r = r.parentElement; return r; }
function payButtons(root) {
  return Array.prototype.filter.call(root.querySelectorAll('button'), function (b) {
    var t = (b.dataset.ccTxt || b.textContent || '').trim();
    return /\bpay\b/i.test(t) && !/withdraw|payout|receive|send|cancel/i.test(t) && t.length < 40;
  });
}
function mount(input) {
  if (input.dataset.ccCard) return; input.dataset.ccCard = '1';
  var root = rootOf(input);
  if (/withdraw|cash ?out|receive money/i.test(root.textContent.slice(0, 600))) return;     // money going out, not in
  var btns = payButtons(root); if (!btns.length) return;
  var wrap = input.closest('.fld') || input, s = { input: input, on: false, prev: input.value };
  var sw = document.createElement('div'); sw.className = 'ccm-sw'; sw.setAttribute('role', 'group');
  sw.innerHTML = '<button type="button" class="on" data-m="mpesa">M-Pesa</button><button type="button" data-m="card">Card</button>';
  var note = document.createElement('p'); note.className = 'ccm-note'; note.hidden = true;
  note.textContent = 'Pay with Visa or Mastercard on a secure page. Your card details never reach Comrade Connect.';
  wrap.parentNode.insertBefore(sw, wrap); wrap.parentNode.insertBefore(note, wrap);
  function set(on) {
    s.on = on; wrap.hidden = on; note.hidden = !on;
    Array.prototype.forEach.call(sw.querySelectorAll('button'), function (b) { b.classList.toggle('on', (b.dataset.m === 'card') === on); });
    if (on) { s.prev = input.value; input.value = DUMMY; } else { input.value = s.prev === DUMMY ? '' : s.prev; }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    payButtons(root).forEach(function (b) {
      if (on) { if (!b.dataset.ccTxt) b.dataset.ccTxt = b.textContent; b.dataset.ccCard = '1'; b.textContent = 'Pay with card'; }
      else if (b.dataset.ccTxt) { b.textContent = b.dataset.ccTxt; delete b.dataset.ccCard; delete b.dataset.ccTxt; }
    });
  }
  sw.addEventListener('click', function (e) { var b = e.target.closest('button[data-m]'); if (b) set(b.dataset.m === 'card'); });
  states.push(s);
}
function scan() {
  queued = false;
  states = states.filter(function (s) { return s.input.isConnected; });
  Array.prototype.forEach.call(document.querySelectorAll('#ccpp,#bph,#ph,#fph,#hs_rph,#ccwp'), function (i) { i.setAttribute('autocomplete', 'off'); });
  if (!cardOn) return;
  Array.prototype.forEach.call(document.querySelectorAll('input[placeholder*="M-Pesa" i],input[aria-label*="M-Pesa" i],#ccpp,#bph,#ph,#fph,#hs_rph'), mount);
}
function queue() { if (!queued) { queued = true; requestAnimationFrame(scan); } }
new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true });

var isCard = function () { return states.some(function (s) { return s.on && s.input.isConnected; }); };
window.ccCardMode = isCard;

// open the card page without losing the sheet that is waiting for the result
var closePre = function () { try { if (pre && !pre.closed) pre.close(); } catch (e) {} pre = null; };
document.addEventListener('click', function (e) {
  if (native || !isCard()) return;
  var b = e.target.closest && e.target.closest('button[data-cc-card]'); if (!b) return;
  closePre();
  try { pre = window.open('', '_blank'); } catch (x) { pre = null; }
  if (pre) {
    try { pre.document.write('<meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#000;color:#fff;font:16px system-ui;padding:24px"><p>Opening the secure card page...</p>'); } catch (x) {}
    // the server can take a while to wake up, so wait a full 90 seconds before giving up on the blank tab
    setTimeout(function () { try { if (pre && !pre.closed) { var h = ''; try { h = pre.location.href; } catch (c) { h = 'x'; } if (h === 'about:blank') pre.close(); } } catch (y) {} }, 90000);
  }
}, true);
function openCard(url) {
  if (!/^https:\/\//.test(url)) return closePre();
  if (native) {                                                    // inside the app: the phone's secure browser tab
    var A = window.ccApp;
    if (A && A.open) { A.open(url).then(function (ok) { if (!ok) location.href = url; }); return; }
    var B = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Browser;
    if (B) { try { B.open({ url: url }); return; } catch (e) {} }
    location.href = url; return;
  }
  if (pre && !pre.closed) { try { pre.location.href = url; pre = null; return; } catch (e) {} }
  closePre();
  var w = null; try { w = window.open(url, '_blank'); } catch (e) {}
  if (!w) location.href = url;                                     // pop-up blocked: open the card page in this tab
}
function cardFailed() { closePre(); }

var realFetch = window.fetch.bind(window);
window.fetch = function (input, init) {
  var want = false;
  try {
    var url = typeof input === 'string' ? input : ((input && input.url) || '');
    if (isCard() && init && /^POST$/i.test(init.method || '') && typeof init.body === 'string' && url.indexOf('/api/') > -1 && url.indexOf('/api/pay/status') < 0) {
      var o = JSON.parse(init.body);
      if (o && Object.prototype.hasOwnProperty.call(o, 'phone')) { o.method = 'card'; o.phone = ''; init = Object.assign({}, init, { body: JSON.stringify(o) }); want = true; }
    }
  } catch (e) {}
  var p = realFetch(input, init);
  if (!want) return p;
  return p.then(function (res) {
    res.clone().json().then(function (j) { if (j && j.url) openCard(String(j.url)); else cardFailed(); }, cardFailed);
    return res;
  }, function (e) { cardFailed(); throw e; });
};
load();
})();
