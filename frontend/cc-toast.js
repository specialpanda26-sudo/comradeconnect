/* cc-toast.js v1: ONE pop-up message system for the whole site, the admin panel and the Ludo/gift/scan pages.
   A small message slides in at the TOP of the screen, above every sheet and dialog, then disappears by itself:
   green tick = success, red mark = failure, dark = info. Tap it to dismiss.
   Use:  toast('Saved')   ccToast('Saved')   ccToast.ok('Saved')   ccToast.err('Could not save')
   The colour is picked from the message when you do not say (words like "could not", "invalid" = red; "saved", "sent" = green).
   Safety net: if a button press makes a request that fails and nothing else showed a message, a red message appears.
   If it succeeds and nothing else showed a message, a small "Done" appears. Turn that off with: window.CC_TOAST_AUTO = false */
(function () {
'use strict';
if (window.ccToast && window.ccToast.v === 1) return;

var ERR = /\b(fail|failed|failure|error|could not|couldn't|can't|cannot|unable|invalid|incorrect|wrong|denied|expired|not (enough|allowed|found|available|valid|verified|signed)|no internet|offline|too (short|long|many|big|large|small)|already|must|required|please (enter|add|choose|select|try|sign|log)|something went|blocked|limit|insufficient|declined|rejected|missing|need to|enter (a|the|your)|add (a|the)|try again|timed out|not possible)\b/i;
var OK = /\b(saved|done|success|successful|copied|sent|updated|added|approved|paid|removed|deleted|created|published|posted|thanks|thank you|welcome|liked|joined|unlocked|verified|refunded|released|turned (on|off)|ready|completed|confirmed|shared|registered|cashed out|received|submitted|booked|bought|withdrawn|restored|cleared|changed|set)\b/i;
function kindOf(m) {
  var s = String(m || '');
  if (/(\.\.\.|\u2026)\s*$/.test(s)) return 'info';
  if (ERR.test(s)) return 'error';
  if (OK.test(s)) return 'ok';
  return 'info';
}

var box = null, shown = [], lastAt = 0, lastMsg = '', lastEl = null, gestureAt = 0;
function css() {
  if (document.getElementById('cc-toast-css')) return;
  var s = document.createElement('style'); s.id = 'cc-toast-css';
  s.textContent =
    '#cc-toasts{position:fixed;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + 12px);display:flex;flex-direction:column;align-items:center;gap:8px;z-index:2147483647;pointer-events:none;padding:0 14px;box-sizing:border-box}' +
    '.ccto{pointer-events:auto;cursor:pointer;display:flex;align-items:center;gap:10px;max-width:min(92vw,420px);box-sizing:border-box;padding:8px 18px 8px 8px;border-radius:24px;background:var(--g,rgba(255,255,255,.94));color:var(--fg,#16130f);border:1px solid var(--gb,rgba(22,19,15,.06));font:700 14px/1.35 Manrope,Poppins,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:var(--sh,0 10px 28px rgba(140,80,50,.18));-webkit-backdrop-filter:blur(14px) saturate(160%);backdrop-filter:blur(14px) saturate(160%);opacity:0;transform:translateY(-12px) scale(.97);transition:opacity .22s ease,transform .22s ease}' +
    '.ccto.on{opacity:1;transform:none}' +
    '.ccto i{flex:0 0 28px;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center}' +
    '.ccto.ok i{background:linear-gradient(145deg,#7fae8a,#5b9470)}.ccto.error i{background:linear-gradient(145deg,#d97b86,#c0485a)}.ccto.info i{background:linear-gradient(145deg,#ff8a3d,#e8744f)}' +
    '.ccto i svg{width:16px;height:16px;fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}' +
    '.ccto span{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}' +
    '@media (prefers-reduced-motion:reduce){.ccto{transition:opacity .1s}}';
  (document.head || document.documentElement).appendChild(s);
}
var ICON = {
  ok: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  error: '<svg viewBox="0 0 24 24"><path d="M12 6v7M12 17.5v.5"/></svg>',
  info: '<svg viewBox="0 0 24 24"><path d="M12 11v6M12 7v.5"/></svg>'
};
function ensure() {
  css();
  if (box && document.body && document.body.contains(box)) return box;
  box = document.getElementById('cc-toasts');
  if (!box) {
    box = document.createElement('div'); box.id = 'cc-toasts'; box.setAttribute('aria-live', 'polite');
    (document.body || document.documentElement).appendChild(box);
  }
  return box;
}
function drop(el) {
  if (!el || el.__gone) return; el.__gone = 1; clearTimeout(el.__t);
  el.classList.remove('on');
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
  var i = shown.indexOf(el); if (i > -1) shown.splice(i, 1);
}
function show(msg, type, ms) {
  try {
    msg = String(msg == null ? '' : msg).trim(); if (!msg) return;
    if (msg.length > 220) msg = msg.slice(0, 217) + '...';
    var kind = type === 'ok' || type === 'success' ? 'ok' : type === 'error' || type === 'err' || type === 'fail' ? 'error' : type === 'info' ? 'info' : kindOf(msg);
    var now = Date.now();
    lastAt = now;
    if (lastEl && !lastEl.__gone && msg === lastMsg && now - lastEl.__at < 2500) {      // same message again: keep one, restart its timer
      clearTimeout(lastEl.__t); lastEl.__at = now;
      lastEl.__t = setTimeout(function (e) { return function () { drop(e); }; }(lastEl), lastEl.__ms); return lastEl;
    }
    var host = ensure(), el = document.createElement('div');
    /* cc-toast-below-nav */ try { var nv = document.querySelector('body>nav.g:not(#tb)'), nr = nv && nv.getBoundingClientRect(); host.style.top = nr && nr.height && nr.bottom < 200 ? (nr.bottom + 10) + 'px' : ''; } catch (e) {}
    el.className = 'ccto ' + kind; el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    var ic = document.createElement('i'); ic.innerHTML = ICON[kind]; var tx = document.createElement('span'); tx.textContent = msg;
    el.appendChild(ic); el.appendChild(tx);
    el.onclick = function () { drop(el); };
    host.appendChild(el); shown.push(el);
    while (shown.length > 3) drop(shown[0]);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('on'); }); });
    var dur = ms || (kind === 'error' ? 4800 : kind === 'ok' ? 2600 : 3200); if (!ms && msg.length > 50) dur += Math.min(3000, (msg.length - 50) * 40);
    el.__ms = dur; el.__at = now; el.__t = setTimeout(function () { drop(el); }, dur);
    lastMsg = msg; lastEl = el; return el;
  } catch (e) {}
}
window.ccToast = function (m, t, ms) { return show(m, t, ms); };
window.ccToast.ok = function (m, ms) { return show(m, 'ok', ms); };
window.ccToast.err = function (m, ms) { return show(m, 'error', ms); };
window.ccToast.info = function (m, ms) { return show(m, 'info', ms); };
window.ccToast.v = 1;
if (typeof window.toast !== 'function') window.toast = function (m, t) { return show(m, t); };   // pages that call window.toast(...) used to get nothing

/* ---- safety net: nothing happens silently ---- */
['pointerdown', 'keydown', 'touchstart', 'click'].forEach(function (ev) { addEventListener(ev, function () { gestureAt = Date.now(); }, { capture: true, passive: true }); });
var SILENT = /\/(view|views|seen|ping|heartbeat|track|vitals|log|logs|presence|typing|read|beacon|analytics|subscribe|device|stats|metrics|poll|events\/ping|sw)(\/|\?|$)/i;
function nice(m, status) {
  m = String(m || '');
  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(m)) return 'No connection. Check your internet and try again.';
  if (status === 429) return 'Too many tries. Wait a moment and try again.';
  if (status >= 500) return 'Server problem. Please try again in a moment.';
  if (!m || m.length > 160) return 'Something went wrong. Please try again.';
  return m;
}
(function wrapFetch() {
  var orig = window.fetch; if (typeof orig !== 'function' || orig.__cct) return;
  var w = function (input, init) {
    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase(), url = '';
    try { url = String(typeof input === 'string' ? input : (input && input.url) || ''); } catch (e) {}
    var hdr = (init && init.headers) || {}, quiet = false;
    try { quiet = !!(hdr['x-silent'] || hdr['X-Silent'] || (hdr.get && hdr.get('x-silent'))); } catch (e) {}
    var watch = method !== 'GET' && method !== 'HEAD' && !quiet && !SILENT.test(url.split('#')[0]) && /\/api\/|\/v2\//.test(url) && (Date.now() - gestureAt) < 2500;
    var started = Date.now();
    var p = orig.apply(this, arguments);
    if (!watch) return p;
    p.then(function (r) {
      setTimeout(function () {
        if (lastAt > started) return;                         // the page already said something
        if (r && r.ok) { if (window.CC_TOAST_AUTO !== false) show('Done', 'ok'); return; }
        var st = r && r.status;
        try { r.clone().json().then(function (d) { if (lastAt <= started) show(nice(d && (d.error || d.message), st), 'error'); }, function () { if (lastAt <= started) show(nice('', st), 'error'); }); }
        catch (e) { show(nice('', st), 'error'); }
      }, 1100);
    }, function (e) {
      setTimeout(function () { if (lastAt <= started) show(nice(e && e.message, 0), 'error'); }, 900);
    });
    return p;
  };
  w.__cct = 1; window.fetch = w;
})();
addEventListener('unhandledrejection', function (ev) {
  try {
    if (Date.now() - gestureAt > 4000 || Date.now() - lastAt < 1500) return;
    var r = ev && ev.reason, m = r && (r.message || r), n = r && r.name;
    if (n === 'AbortError' || n === 'NotAllowedError' || /play\(\)|ResizeObserver|AbortError|user denied|Share canceled|cancel/i.test(String(m))) return;
    show(nice(typeof m === 'string' ? m : '', 0), 'error');
  } catch (e) {}
});
})();
