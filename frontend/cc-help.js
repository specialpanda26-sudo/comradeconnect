/* Notification bell + AI support bot. Text is always inserted with textContent, never as HTML.
   Bell shows what the admin sets in admin.html > Site editor (Notification bell, Maintenance, Announcement banner). */
(function () {
'use strict';
var API = (typeof CC_API !== 'undefined' ? CC_API : '').replace(/\/$/, ''), SEEN = 'cc_notice_seen', C = {}, hist = [], busy = false, open = null;
function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function https(u) { return /^https:\/\/[^\s<>"']+$/i.test(u || ''); }
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
var st = el('style'); st.textContent =
'#cch{position:fixed;inset:0;z-index:950;pointer-events:none}' +
'#cch .ccb{all:unset;box-sizing:border-box;cursor:pointer;pointer-events:auto;position:fixed;right:20px;bottom:calc(154px + env(safe-area-inset-bottom,0px));width:50px;height:50px;border-radius:50%;display:grid;place-items:center;background:var(--g,rgba(255,255,255,.07));border:1px solid var(--gb,rgba(255,255,255,.22));-webkit-backdrop-filter:blur(14px) saturate(160%);backdrop-filter:blur(14px) saturate(160%);box-shadow:var(--sh,0 10px 30px rgba(14,15,11,.6)),inset 0 1px 0 var(--gh,rgba(255,255,255,.12));color:var(--mut,#bdbdbd);transition:all .3s}' +
'#cch .ccb svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
'#cch .ccb:hover,#cch .ccb.on{background:var(--ink,#fff);color:var(--inkfg,#0E0F0B)}' +
'#cch .ccb:focus-visible{outline:2px solid var(--fg,#fff);outline-offset:2px}#cch i{position:absolute;top:8px;right:9px;width:9px;height:9px;border-radius:50%;background:#BC656A;box-shadow:0 0 0 2px var(--bg,#0E0F0B)}' +
'html[data-lay="desktop"] #cch .ccb{bottom:92px;right:28px}' +
'/* cc-glass-panel */' +
'#cchp{position:fixed;inset:0;z-index:960;display:grid;place-items:end center;background:rgba(14,15,11,.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);padding:16px;color:var(--fg,#fff)}' +
'#cchp .bx{width:min(520px,100%);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;border-radius:26px;padding:26px;background:color-mix(in srgb,var(--bg,#0E0F0B) 84%,transparent);border:1px solid var(--gb,rgba(255,255,255,.16));-webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);animation:ccpop .4s cubic-bezier(.2,.9,.3,1.2)}' +
':root[data-theme="light"] #cchp .bx{background:color-mix(in srgb,#fff 88%,transparent)}' +
'@keyframes ccpop{from{opacity:0;transform:translateY(40px) scale(.96)}}' +
'#cchp .h{display:flex;justify-content:space-between;align-items:center;flex-shrink:0}#cchp .h h2{font-size:22px;font-weight:600;letter-spacing:-.02em;margin:0}' +
'#cchp .ht{display:flex;gap:6px;padding:14px 0 4px;flex-shrink:0}#cchp .ht button{all:unset;cursor:pointer;flex:1;text-align:center;padding:9px 8px;border-radius:14px;font-size:13px;color:var(--mut,#bdbdbd);background:var(--g,rgba(255,255,255,.07));border:1px solid var(--gb,rgba(255,255,255,.22))}#cchp .ht .on{background:var(--ink,#fff);color:var(--inkfg,#0E0F0B);border-color:var(--ink,#fff);font-weight:600}' +
'#cchp .b{overflow:auto;flex:1;min-height:0;padding:6px 0 2px;font-size:14px;line-height:1.7;color:var(--mut,#bdbdbd)}' +
'#cchp .n{border:1px solid var(--gb,rgba(255,255,255,.22));background:var(--g,rgba(255,255,255,.07));border-radius:18px;padding:14px 16px;margin:10px 0;font-size:13px}#cchp .n b{display:block;color:var(--fg,#fff);font-weight:600;font-size:14px}#cchp .n a{color:var(--fg,#fff)}' +
'#cchp .m{margin:8px 0;padding:10px 14px;border-radius:18px;max-width:88%;white-space:pre-wrap;word-wrap:break-word;color:var(--fg,#fff);background:var(--g,rgba(255,255,255,.07));border:1px solid var(--gb,rgba(255,255,255,.22))}#cchp .m.u{margin-left:auto;background:var(--ink,#fff);color:var(--inkfg,#0E0F0B);border-color:var(--ink,#fff)}' +
'#cchp .f{display:flex;gap:8px;padding-top:14px;flex-shrink:0}#cchp .f input{flex:1;min-width:0;font:inherit;font-size:16px;padding:11px 16px;border-radius:999px;border:1px solid var(--gb,rgba(255,255,255,.22));background:var(--g,rgba(255,255,255,.07));color:var(--fg,#fff)}' +
'#cchp .f button{all:unset;cursor:pointer;padding:0 20px;border-radius:999px;font-weight:600;background:var(--ink,#fff);color:var(--inkfg,#0E0F0B);display:grid;place-items:center}' +
'#cchp details{border-bottom:1px solid var(--line,rgba(255,255,255,.14));padding:12px 0}#cchp summary{cursor:pointer;font-weight:600;color:var(--fg,#fff)}#cchp details p{margin:6px 0 0}' +
'#cchp a.r{display:block;padding:14px 0;color:var(--fg,#fff);text-decoration:none;border-bottom:1px solid var(--line,rgba(255,255,255,.14))}';
st.textContent +=
'/* cc-bell-topbar */' +
'.ib.ccb{position:relative;flex-shrink:0}' +
'.ib.ccb svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
'.ib.ccb.on{background:var(--ink,#fff);color:var(--inkfg,#0E0F0B)}' +
'.ib.ccb i{position:absolute;top:7px;right:8px;width:9px;height:9px;border-radius:50%;background:#BC656A;box-shadow:0 0 0 2px var(--bg,#0E0F0B)}';
document.head.appendChild(st);

var box = el('div'); box.id = 'cch';
var bell = el('button', 'ccb');
bell.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
bell.type = 'button'; bell.setAttribute('aria-label', 'Notifications');
box.appendChild(bell);

function notices() {
  var a = [];
  if (C.notice_on && C.notice_text) a.push({ t: C.notice_title || 'Notice', x: C.notice_text });
  if (C.maintenance_on) a.push({ t: 'Maintenance', x: C.maintenance_text || 'We are fixing something. Please check again in a little while.' });
  if (C.banner_on && C.banner_text) a.push({ t: 'Announcement', x: C.banner_text, l: C.banner_link });
  return a;
}
function key(a) { return a.map(function (n) { return n.t + n.x; }).join('|'); }
function dot() {
  var a = notices(), old = bell.querySelector('i'); if (old) old.remove();
  if (a.length && ls(SEEN) !== key(a)) bell.appendChild(el('i'));
}
function close() { if (open) { open.remove(); open = null; } bell.classList.remove('on'); }
function sheet(title, tabs, on) {
  close();
  var o = el('div'); o.id = 'cchp'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', title);
  o.onclick = function (e) { if (e.target === o) close(); };
  var p = el('div', 'bx g');
  var h = el('div', 'h'); h.appendChild(el('h2', '', title));
  var x = el('button', 'ib'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
  x.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  x.onclick = close; h.appendChild(x); p.appendChild(h);
  var body = el('div', 'b');
  if (tabs) {
    var t = el('div', 'ht');
    tabs.forEach(function (n, i) { var b = el('button', i === on ? 'on' : '', n); b.type = 'button'; b.onclick = function () { bots(i); }; t.appendChild(b); });
    p.appendChild(t);
  }
  p.appendChild(body); o.appendChild(p); document.body.appendChild(o); open = o; return { p: p, body: body };
}

function showBell() {
  var a = notices(), s = sheet('Notifications');
  if (!a.length) s.body.appendChild(el('p', '', 'No new notifications. You are all caught up.'));
  a.forEach(function (n) {
    var d = el('div', 'n'); d.appendChild(el('b', '', n.t)); d.appendChild(el('span', '', n.x));
    if (https(n.l)) { var l = el('a', '', ' Read more'); l.href = n.l; l.target = '_blank'; l.rel = 'noopener noreferrer'; d.appendChild(l); }
    s.body.appendChild(d);
  });
  bell.classList.add('on'); ls(SEEN, key(a)); dot();
}

var HELP = [
  ['I lost my phone', 'Open Comrade Connect on the new phone, go to Me, tap Restore an account, and enter your account ID and recovery code.'],
  ['How does escrow work?', 'Your payment is held, not sent to the seller. After you get the item, give the seller your 6-digit code and they are paid. Never share the code before you have checked the item.'],
  ['Something went wrong with an order', 'Open the order in Market and tap Report a problem before you give the code. An admin reviews both sides and either refunds you or pays the seller.'],
  ['My post was blocked', 'Posts with phone numbers, links, social handles or requests to pay outside the app are blocked. Remove them and post again.'],
  ['How do I get verified?', 'Go to Me, then Verification, and follow the steps. Only admins see your ID photos.'],
  ['Who runs Comrade Connect?', 'Comrade Connect was founded by Henry O. Odhiambo, Founder and CEO of Ogolla Tech. Christian N. and Peter M. are the developers. Write to support@comradeconnect.co.ke for help.']
];
function bots(tab) {
  var s = sheet('Support', ['Ask AI', 'Help', 'Contact'], tab || 0), b = s.body;
  if (!tab) {
    b.style.minHeight = '240px';
    var log = el('div'); b.appendChild(log);
    function say(t, u) { var m = el('div', 'm' + (u ? ' u' : ''), t); log.appendChild(m); b.scrollTop = b.scrollHeight; return m; }
    say('Hi! I am the Comrade Connect AI helper. Ask me about escrow, refunds, your account or the app. I cannot see your account or move money.');
    hist.slice(-6).forEach(function (h) { say(h.t, h.r === 'u'); });
    var f = el('form', 'f'), inp = el('input'); inp.placeholder = 'Type your question'; inp.maxLength = 500; inp.setAttribute('aria-label', 'Your question');
    var go = el('button', '', 'Send'); go.type = 'submit'; f.appendChild(inp); f.appendChild(go); s.p.appendChild(f);
    f.onsubmit = function (e) {
      e.preventDefault(); var q = inp.value.trim(); if (!q || busy) return; inp.value = ''; busy = true; say(q, true);
      var w = say('Thinking...'), ctl = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 70000);
      fetch(API + '/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl ? ctl.signal : undefined, body: JSON.stringify({ prompt: q, mode: 'support', history: hist.slice(-6) }) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) { var t = d.text || d.error || 'I could not answer that. Please use the Contact tab.'; w.textContent = t; hist.push({ r: 'u', t: q }, { r: 'a', t: t }); })
        .catch(function () { w.textContent = 'The helper is not reachable right now. Please try again in a minute or use the Contact tab.'; })
        .then(function () { clearTimeout(to); busy = false; b.scrollTop = b.scrollHeight; });
    };
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 50);
  } else if (tab === 1) {
    HELP.forEach(function (h) { var d = el('details'); d.appendChild(el('summary', '', h[0])); d.appendChild(el('p', '', h[1])); b.appendChild(d); });
  } else {
    [['Refunds and disputes', '/refunds.html'], ['Safety and verification', '/safety.html'], ['Contact us', '/contact.html']].forEach(function (r) { var a = el('a', 'r', r[0]); a.href = r[1]; b.appendChild(a); });
    if (C.contact_email) { var m = el('a', 'r', 'Email ' + C.contact_email); m.href = 'mailto:' + C.contact_email; b.appendChild(m); }
    if (https(C.social_whatsapp)) { var w = el('a', 'r', 'Chat on WhatsApp'); w.href = C.social_whatsapp; w.target = '_blank'; w.rel = 'noopener noreferrer'; b.appendChild(w); }
  }
}
bell.onclick = function () { open && open.getAttribute('aria-label') === 'Notifications' ? close() : showBell(); };
document.addEventListener('cc-open-support', function () { bots(0); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

function load() {
  if (!API) return;
  fetch(API + '/api/site-content', { headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { if (d && d.content) { C = d.content; dot(); } }).catch(function () {});
}
function boot() {
  try { C = JSON.parse(ls('cc_site_v1') || '{}') || {}; } catch (e) { C = {}; }
  var lay = document.getElementById('lay'), bar = lay && lay.parentNode;
  if (bar) { bell.className = 'ib ccb'; bar.insertBefore(bell, lay); }
  else document.body.appendChild(box);
  dot(); load();
  setInterval(function () { if (!document.hidden) load(); }, 300000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
