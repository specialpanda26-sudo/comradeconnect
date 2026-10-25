/* cc-settings.js v1: a Settings button on the Me page.
   Campus, security, recovery code, restore, safety and help move out of the long Me menu into one Settings sheet.
   Each entry opens the same card the Me menu opened before (window.ccOpenMe), so no card is rebuilt or moved. */
(function () {
  'use strict';
  if (window.__ccSettings) return; window.__ccSettings = 1;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  var ICON = function (p) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var GEAR = ICON('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>');
  var SHARE = ICON('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>');
  /* Share the app link: phone share sheet (WhatsApp, DMs, anything installed), WhatsApp link as the fallback */
  window.ccShareApp = function () {
    var link = '';
    try { var c = window.ccRef && window.ccRef.code; link = c ? window.ccOrigin() + '/?ref=' + c : (window.ccOrigin ? window.ccOrigin() : location.origin) + '/'; } catch (e) { link = location.origin + '/'; }
    var text = 'Join me on Comrade Connect: the campus app for Kenyan comrades. Feed, marketplace, hostels and more.';
    if (navigator.share) { navigator.share({ title: 'Comrade Connect', text: text, url: link }).catch(function () {}); return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + link), '_blank', 'noopener');
  };
  var CHEV = ICON('<path d="M9 6l6 6-6 6"/>');
  var PIN = ICON('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>');
  var SUN = ICON('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>');

  var css = el('style');
  css.textContent = [
    '#v-me>.ph{display:flex;align-items:center;justify-content:space-between;gap:12px}',
    '#ccsetbtn{flex:none;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;padding:0;cursor:pointer;color:inherit;border:0;background:none;-webkit-tap-highlight-color:transparent}',
    '#ccsetbtn:active{transform:scale(.94)}#ccsetbtn svg{width:26px;height:26px}',
    '.ccset-box{max-width:460px;width:100%}',
    '.ccset-h{display:flex;align-items:center;gap:10px;margin-bottom:6px}.ccset-h h3{margin:0;flex:1}',
    '.ccset-x{width:38px;height:38px;border-radius:50%;border:1px solid var(--line,rgba(255,255,255,.2));background:none;color:inherit;display:grid;place-items:center;cursor:pointer;padding:0}',
    '.ccset-sec{margin:18px 2px 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);font-weight:600}',
    '.ccset-row{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;margin-top:8px;border-radius:16px;border:1px solid var(--line,rgba(255,255,255,.14));background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}',
    '.ccset-row .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:none;background:color-mix(in srgb,var(--aq,#A8DCE7) 22%,transparent)}',
    '.ccset-row .tx{flex:1;min-width:0}.ccset-row .tx b{display:block;font-size:14px}.ccset-row .tx small{display:block;color:var(--mut);font-size:12px;margin-top:1px;overflow-wrap:anywhere}',
    '.ccset-row .go{font-size:13px;font-weight:600;color:var(--aq,#A8DCE7);flex:none}',
    '.ccset-body .zz{background:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;padding:14px 2px!important;margin:0!important;border-top:1px solid var(--line,rgba(255,255,255,.12))!important}',
    '.ccset-body .zz{}'
  ].join('');
  document.head.appendChild(css);

  /* The Me page already has a menu that opens one card at a time (window.ccOpenMe). Settings reuses it:
     these entries leave the Me menu and live here instead, so the Me page is shorter. Nothing is moved or rebuilt. */
  var ITEMS = [
    ['Secure my account', 'Security', 'Fingerprint or Face ID lock', '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'],
    ['Recovery code', 'Recovery code', 'Your way back in on a new phone', '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l3 3M14 9l2 2"/>'],
    ['Restore an account', 'Restore an account', 'Use your account ID and recovery code', '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>'],
    ['Safety', 'Safety and privacy', 'Blocked posters and safety tools', '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>'],
    ['Documentation', 'Help and documentation', 'How Comrade Connect works', '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>']
  ];
  function ttl(b) { var h = b.querySelector('h3'); return h ? h.textContent.trim() : ''; }
  function hasCard(t) { var me = $('#v-me'); if (!me) return false; return Array.prototype.some.call(me.querySelectorAll('.box'), function (b) { return ttl(b) === t; }); }
  function slim() {                                           // take the settings entries out of the Me menu
    var menu = $('#ccmenu'); if (!menu) return;
    ITEMS.forEach(function (it) { var r = menu.querySelector('.mit[data-t="' + it[0] + '"]'); if (r) r.remove(); });
    Array.prototype.forEach.call(menu.querySelectorAll('.mgrp'), function (g) { if (!g.querySelector('.mit')) g.remove(); });
  }

  function campusName() { try { return localStorage.getItem('cc_campus_name') || 'Kirinyaga University'; } catch (e) { return 'Kirinyaga University'; } }
  function isAll() { try { return localStorage.getItem('cc_campus') === 'all'; } catch (e) { return false; } }

  function row(icon, title, sub, goText, fn) {
    var b = el('button', 'ccset-row'); b.type = 'button';
    b.innerHTML = '<span class="ic">' + icon + '</span><span class="tx"></span>' + (goText ? '<span class="go"></span>' : '');
    b.querySelector('.tx').appendChild(el('b', '', title)); b.querySelector('.tx').appendChild(el('small', '', sub));
    if (goText) b.querySelector('.go').textContent = goText;
    b.onclick = fn; return b;
  }

  var openSheet = null;
  function open() {
    if (openSheet) return;
    var m = el('div', 'ccm-sh'); m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Settings');
    var box = el('div', 'box g ccset-box');
    var h = el('div', 'ccset-h'); h.appendChild(el('h3', '', 'Settings'));
    var x = el('button', 'ccset-x'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.innerHTML = ICON('<path d="M6 6l12 12M18 6L6 18"/>');
    h.appendChild(x); box.appendChild(h);
    box.appendChild(el('p', 'sub', 'Everything you set once and rarely change lives here.'));
    var body = el('div', 'ccset-body'); box.appendChild(body);

    body.appendChild(el('div', 'ccset-sec', 'Invite comrades'));
    body.appendChild(row(SHARE, 'Share Comrade Connect', 'Send the app link to a WhatsApp group or a friend. If you are signed in, your invite link is used.', 'Share', window.ccShareApp));

    body.appendChild(el('div', 'ccset-sec', 'Your campus'));
    body.appendChild(row(PIN, isAll() ? 'All universities' : campusName(), isAll() ? 'You see the feed from every university. Your posts go under your own one.' : 'Your feed, events and hostels follow this university.', 'Change', function () { close(); if (window.ccChangeCampus) ccChangeCampus(); }));

    body.appendChild(el('div', 'ccset-sec', 'Account and safety'));
    ITEMS.forEach(function (it) {
      if (!hasCard(it[0])) return;
      body.appendChild(row('<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + it[3] + '</svg>', it[1], it[2], '', function () { close(); if (window.ccOpenMe) ccOpenMe(it[0]); }));
    });

    m.appendChild(box); document.body.appendChild(m); openSheet = m;
    function close() {
      if (!openSheet) return;
      var s = openSheet; openSheet = null; Element.prototype.remove.call(s);
    }
    m.remove = close; m.close = close; x.onclick = close;
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    window.__ccSetClose = close;
  }
  function close() { if (window.__ccSetClose) window.__ccSetClose(); }

  function mount() {
    var card = $('#mecard'); if (!card) return;
    slim();
    if ($('#ccsetbtn')) return;
    var ph = $('#v-me > .ph'); if (!ph) return;
    var b = el('button'); b.id = 'ccsetbtn'; b.type = 'button'; b.setAttribute('aria-label', 'Settings'); b.title = 'Settings';
    b.innerHTML = GEAR; b.onclick = open; ph.appendChild(b);
  }
  window.ccOpenSettings = open;
  mount();
  new MutationObserver(function () { mount(); }).observe(document.body, { childList: true, subtree: true });
  /* Settings tab in the bottom bar: opens the same sheet, never switches the page underneath */
  window.ccSettingsOpen = open;
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#ccsettab');
    if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault();
    open();
  }, true);
})();
