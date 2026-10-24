/* cc-help v7: Notification bell + AI support bot (sheet restyled, own ccs-* classes). Text is always inserted with textContent, never as HTML.
   Bell shows what the admin sets in admin.html > Site editor (Notification bell, Maintenance, Announcement banner). */
(function () {
'use strict';
var API = (typeof CC_API !== 'undefined' ? CC_API : '').replace(/\/$/, ''), SEEN = 'cc_notice_seen', C = {}, hist = [], busy = false, open = null;
function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function https(u) { return /^https:\/\/[^\s<>"']+$/i.test(u || ''); }
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
var st = el('style'); st.textContent =
'#cch{position:fixed;inset:0;z-index:950;pointer-events:none}' +
'#cch .ccb{all:unset;box-sizing:border-box;cursor:pointer;pointer-events:auto;position:fixed;right:20px;bottom:calc(154px + env(safe-area-inset-bottom,0px));width:50px;height:50px;border-radius:50%;display:grid;place-items:center;background:var(--g,rgba(255,255,255,.07));border:1px solid var(--gb,rgba(255,255,255,.22));-webkit-backdrop-filter:blur(14px) saturate(160%);backdrop-filter:blur(14px) saturate(160%);box-shadow:var(--sh,0 10px 30px rgba(16,20,34,.6)),inset 0 1px 0 var(--gh,rgba(255,255,255,.12));color:var(--mut);transition:all .3s}' +
'#cch .ccb svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
'#cch .ccb:hover,#cch .ccb.on{background:var(--ink,#fff);color:var(--inkfg,#101422)}' +
'#cch .ccb:focus-visible{outline:2px solid var(--fg,#fff);outline-offset:2px}#cch i{position:absolute;top:8px;right:9px;width:9px;height:9px;border-radius:50%;background:#A8DCE7;box-shadow:0 0 0 2px var(--bg,#101422)}' +
'html[data-lay="desktop"] #cch .ccb{bottom:92px;right:28px}' +
'.ib.ccb{position:relative;flex-shrink:0}' +
'.ib.ccb svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
'.ib.ccb.on{background:var(--ink,#fff);color:var(--inkfg,#101422)}' +
'.ib.ccb i{position:absolute;top:7px;right:8px;width:9px;height:9px;border-radius:50%;background:#A8DCE7;box-shadow:0 0 0 2px var(--bg,#101422)}';
var lk = el('link'); lk.rel = 'stylesheet'; lk.href = 'cc-support.css?v=1'; document.head.appendChild(lk);
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
var P = {
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>'
};
function ico(p, c) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); if (c) s.setAttribute('class', c); s.innerHTML = p; return s; }
function sheet(title, tabs, on, sub) {
  close();
  var o = el('div'); o.id = 'ccsh'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', title);
  o.onclick = function (e) { if (e.target === o) close(); };
  var p = el('div', 'ccs-box');
  var h = el('div', 'ccs-hd'), tt = el('div'); tt.appendChild(el('h2', '', title)); if (sub) tt.appendChild(el('p', '', sub)); h.appendChild(tt);
  var x = el('button', 'ccs-x'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.appendChild(ico(P.x)); x.onclick = close; h.appendChild(x); p.appendChild(h);
  var body = el('div', 'ccs-body');
  if (tabs) {
    var t = el('div', 'ccs-tabs'); t.setAttribute('role', 'tablist');
    tabs.forEach(function (n, i) { var b = el('button', 'ccs-t' + (i === on ? ' act' : ''), n); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', i === on ? 'true' : 'false'); b.onclick = function () { bots(i); }; t.appendChild(b); });
    p.appendChild(t);
  }
  p.appendChild(body); o.appendChild(p); document.body.appendChild(o); open = o; return { p: p, body: body };
}

function showBell() {
  var a = notices(), s = sheet('Notifications');
  if (!a.length) s.body.appendChild(el('p', 'ccs-empty', 'No new notifications. You are all caught up.'));
  a.forEach(function (n) {
    var d = el('div', 'ccs-n'); d.appendChild(el('b', '', n.t)); d.appendChild(el('span', '', n.x));
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
  tab = tab || 0;
  var s = sheet('Support', ['Ask AI', 'Help', 'Contact'], tab, 'Ask, browse help, or reach us'), b = s.body;
  if (!tab) {
    var log = el('div', 'ccs-chat'); b.appendChild(log);
    function say(t, u) { var m = el('div', 'ccs-m' + (u ? ' u' : ''), t); log.appendChild(m); b.scrollTop = b.scrollHeight; return m; }
    say('Hi! I am the Comrade Connect AI helper. Ask me about escrow, refunds, your account or the app. I cannot see your account or move money.');
    hist.slice(-6).forEach(function (h) { say(h.t, h.r === 'u'); });
    var f = el('form', 'ccs-form'), inp = el('input'); inp.placeholder = 'Type your question'; inp.maxLength = 500; inp.setAttribute('aria-label', 'Your question');
    var go = el('button', 'ccs-go'); go.type = 'submit'; go.setAttribute('aria-label', 'Send'); go.appendChild(ico(P.send)); f.appendChild(inp); f.appendChild(go); s.p.appendChild(f);
    f.onsubmit = function (e) {
      e.preventDefault(); var q = inp.value.trim(); if (!q || busy) return; inp.value = ''; busy = true; say(q, true);
      var w = say(''), dots = el('span', 'ccs-dots'); dots.appendChild(el('i')); dots.appendChild(el('i')); dots.appendChild(el('i')); w.appendChild(dots);
      var ctl = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 70000);
      fetch(API + '/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl ? ctl.signal : undefined, body: JSON.stringify({ prompt: q, mode: 'support', history: hist.slice(-6) }) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) { var t = d.text || d.error || 'I could not answer that. Please use the Contact tab.'; w.textContent = t; hist.push({ r: 'u', t: q }, { r: 'a', t: t }); })
        .catch(function () { w.textContent = 'The helper is not reachable right now. Please try again in a minute or use the Contact tab.'; })
        .then(function () { clearTimeout(to); busy = false; b.scrollTop = b.scrollHeight; });
    };
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
  } else if (tab === 1) {
    HELP.forEach(function (h) {
      var d = el('details', 'ccs-acc'), sm = el('summary'); sm.appendChild(el('span', '', h[0])); sm.appendChild(ico(P.chev, 'ccs-chev'));
      d.appendChild(sm); d.appendChild(el('p', '', h[1])); b.appendChild(d);
    });
  } else {
    function row(icon, t, sub, href, ext) {
      var a = el('a', 'ccs-row'); a.href = href; if (ext) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      var i = el('span', 'ccs-ic'); i.appendChild(ico(icon)); var x = el('span', 'ccs-tx'); x.appendChild(el('b', '', t)); x.appendChild(el('span', '', sub));
      a.appendChild(i); a.appendChild(x); a.appendChild(ico(P.chev, 'ccs-chev')); b.appendChild(a);
    }
    row(P.doc, 'Refunds and disputes', 'How refunds are decided', '/refunds.html');
    row(P.shield, 'Safety and verification', 'Stay safe and get verified', '/safety.html');
    row(P.chat, 'Contact us', 'Reach the Comrade Connect team', '/contact.html');
    if (C.contact_email) row(P.mail, 'Email us', C.contact_email, 'mailto:' + C.contact_email);
    if (https(C.social_whatsapp)) row(P.chat, 'Chat on WhatsApp', 'Message us directly', C.social_whatsapp, true);
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
