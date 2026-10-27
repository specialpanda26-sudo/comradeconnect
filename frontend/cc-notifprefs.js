/* cc-notifprefs.js: choose which alerts reach your phone's notification bar.
   One switch for everything, plus one per kind: Live, Comments, Events, Messages, Orders, Gifts and rewards, Updates.
   Saved on the server, because the server is what sends the alert. Everything is on until you switch it off.
   Opens from the "Alerts" button in the bell panel and from Me > Notifications. Text goes in with textContent only. */
(function () {
  'use strict';
  if (window.__ccNotifPrefs) return; window.__ccNotifPrefs = 1;

  var KINDS = [
    ['live', 'Live', 'When someone goes live'],
    ['comments', 'Comments', 'On your stories, clips and reels'],
    ['events', 'Events', 'When a new event is posted'],
    ['messages', 'Messages', 'New anonymous messages'],
    ['orders', 'Market orders', 'New orders on your items'],
    ['wallet', 'Gifts and rewards', 'Gifts, referrals and wallet money'],
    ['updates', 'Updates', 'Notices from the Comrade Connect team']
  ];
  var P = {}, sheet = null, note = null, loaded = false;
  KINDS.forEach(function (k) { P[k[0]] = true; });

  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
  function call(path, body) {
    if (!window.ccCall) return Promise.reject(new Error('not ready'));
    return window.ccCall(path, body ? { body: body, auth: false } : { auth: false });
  }

  var css = el('style');
  css.textContent =
    '.pf-row{display:flex;align-items:center;gap:14px;padding:14px 16px;box-sizing:border-box}' +
    '.pf-t{flex:1;min-width:0}.pf-t b{display:block;font:800 15px/1.25 Manrope,system-ui,sans-serif;color:var(--fg)}' +
    '.pf-t span{display:block;margin-top:2px;font:600 12.5px/1.4 Manrope,system-ui,sans-serif;color:var(--mut)}' +
    '.pf-sw{all:unset;box-sizing:border-box;flex:none;position:relative;width:52px;height:32px;border-radius:999px;background:rgba(120,110,100,.32);cursor:pointer;transition:background-color .28s cubic-bezier(.32,.72,0,1);-webkit-tap-highlight-color:transparent}' +
    '.pf-sw::before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,#ffa05a,#ee7a4f);opacity:0;transition:opacity .28s}' +
    '.pf-sw::after{content:"";position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.28);transition:transform .28s cubic-bezier(.32,.72,0,1)}' +
    '.pf-sw[aria-checked="true"]::before{opacity:1}.pf-sw[aria-checked="true"]::after{transform:translateX(20px)}' +
    '.pf-sw:focus-visible{outline:2px solid var(--fg);outline-offset:3px}' +
    '.ccn-pf .pf-sub{margin:8px 2px 14px;font:600 13px/1.5 Manrope,system-ui,sans-serif;color:var(--mut)}' +
    '.ccn-pf .ls{display:flex;flex-direction:column;gap:10px;overflow:visible}' +
    '.ccn-pf .pf-st{min-height:18px;margin:10px 2px 0;font:700 12.5px Manrope,system-ui,sans-serif;color:var(--mut)}' +
    '.ccn-pf .pf-in{padding:18px 16px;font:600 14px/1.5 Manrope,system-ui,sans-serif;color:var(--mut)}' +
    '.ccn-pf .pf-in button{all:unset;cursor:pointer;color:var(--fg);font-weight:800;text-decoration:underline}' +
    '@media (prefers-reduced-motion:reduce){.pf-sw,.pf-sw::before,.pf-sw::after{transition:none}}';
  document.head.appendChild(css);

  function allOn() { return KINDS.every(function (k) { return P[k[0]]; }); }
  function save(prev) {
    if (!signedIn()) return;
    call('/api/notifications/prefs', { prefs: P }).then(function (d) { if (note) note.textContent = ''; if (d && d.prefs) { P = d.prefs; } })
      .catch(function () { P = prev; paint(); if (note) note.textContent = 'Could not save. Check your connection and try again.'; });
  }
  function change(fn) { var prev = JSON.parse(JSON.stringify(P)); fn(); paint(); save(prev); }
  function sw(on, label, fn) {
    var b = el('button', 'pf-sw'); b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.setAttribute('aria-label', label); b.onclick = fn; return b;
  }
  function row(title, sub, on, fn) {
    var r = el('div', 'pf-row'), t = el('div', 'pf-t'); t.appendChild(el('b', '', title)); if (sub) t.appendChild(el('span', '', sub));
    r.appendChild(t); r.appendChild(sw(on, title, fn)); return r;
  }
  function paint() {
    if (!sheet) return;
    var list = sheet.querySelector('.ls'); list.textContent = '';
    if (!signedIn()) {
      var g = el('div', 'pf-in'); g.appendChild(document.createTextNode('Sign in to choose which alerts reach your phone. '));
      var gb = el('button', '', 'Sign in'); gb.type = 'button'; gb.onclick = function () { close(); if (window.CC && CC.signIn) CC.signIn(); }; g.appendChild(gb); list.appendChild(g); return;
    }
    list.appendChild(row('All notifications', 'Turn everything on or off in one go', allOn(), function () { var to = !allOn(); change(function () { KINDS.forEach(function (k) { P[k[0]] = to; }); }); }));
    KINDS.forEach(function (k) { list.appendChild(row(k[1], k[2], !!P[k[0]], function () { change(function () { P[k[0]] = !P[k[0]]; }); })); });
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function close() { if (sheet) { sheet.remove(); sheet = null; } document.removeEventListener('keydown', onKey); }
  function open() {
    close();
    sheet = el('div', 'ccn ccn-pf'); sheet.style.zIndex = '10120'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Alerts');
    sheet.onclick = function (e) { if (e.target === sheet) close(); };
    var bx = el('div', 'bx'), hd = el('div', 'hd'); hd.appendChild(el('h2', '', 'Alerts'));
    var x = el('button', 'ib'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'; x.onclick = close; hd.appendChild(x);
    bx.appendChild(hd);
    bx.appendChild(el('p', 'pf-sub', 'Pick what shows up in your phone\u2019s notification bar. Nothing pops up on the website.'));
    bx.appendChild(el('div', 'ls')); note = el('div', 'pf-st'); note.setAttribute('role', 'status'); bx.appendChild(note);
    sheet.appendChild(bx); document.body.appendChild(sheet); document.addEventListener('keydown', onKey);
    paint();
    if (signedIn()) call('/api/notifications/prefs').then(function (d) { if (d && d.prefs) { P = d.prefs; loaded = true; paint(); } }).catch(function () {});
  }
  window.ccNotifPrefs = { open: open };

  /* the Alerts button in the bell panel, where the On/Off switch used to be */
  function addButton() {
    var hd = document.querySelector('.ccn:not(.ccn-ev):not(.ccn-pf) .hd > div');
    if (!hd || hd.querySelector('.pf-open')) return;
    var b = el('button', 'pf-open', 'Alerts'); b.type = 'button'; b.setAttribute('aria-label', 'Choose which alerts you get'); b.onclick = open;
    hd.insertBefore(b, hd.firstChild);
  }
  new MutationObserver(addButton).observe(document.body, { childList: true, subtree: true });

  /* Me > Notifications: the old switches only lived on this phone and did nothing now, so one button replaces them */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#nen'); if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation(); open();
  }, true);
  function tidySettings() {
    var nen = document.getElementById('nen'); if (!nen) return;
    if (nen.textContent !== 'Choose your alerts') nen.textContent = 'Choose your alerts';
    var nts = document.getElementById('nts'); if (nts) nts.style.display = 'none';
    ['n1', 'n2', 'n3'].forEach(function (id) { var i = document.getElementById(id), r = i && i.closest('.rw'); if (r) r.style.display = 'none'; });
    var st = document.getElementById('nst'); if (st && st.textContent.indexOf('notification bar') < 0) st.textContent = 'Alerts arrive in your phone\u2019s notification bar. Choose which ones you want.';
  }
  setInterval(tidySettings, 2500); setTimeout(tidySettings, 1500);
})();
