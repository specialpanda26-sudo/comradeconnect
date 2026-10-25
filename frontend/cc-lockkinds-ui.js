/* cc-lockkinds-ui.js v1: Settings > Security shows one switch for Fingerprint and one for Face ID (section 2: the screen).
   Waits for the Settings sheet from cc-settings.js, then swaps its single "Face ID or fingerprint lock" switch for the two.
   Only the ways this phone really has are shown. Needs cc-lockkinds.js (section 1). */
(function () {
  'use strict';
  if (window.__ccLockKindsUI) return; window.__ccLockKindsUI = 1;
  var LK = window.ccLockKinds; if (!LK || !LK.native) return;
  var ic = function (p) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var ICON = {
    fingerprint: ic('<path d="M12 11v3a6 6 0 0 1-1 3.4"/><path d="M8.5 15.5c.3-1 .5-2.2.5-3.5a3 3 0 0 1 6 0c0 2.2-.4 4.2-1.3 6"/><path d="M5.6 17A12 12 0 0 0 6 12a6 6 0 0 1 12 0c0 1.4-.1 2.8-.4 4"/><path d="M4 8.5A9 9 0 0 1 12 3a9 9 0 0 1 8 5.5"/>'),
    face: ic('<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 10v1.5M15 10v1.5M12 10v3.5h-1"/><path d="M9 16c1.7 1.2 4.3 1.2 6 0"/>')
  };
  var TEXT = {
    fingerprint: ['Fingerprint', 'Unlock Comrade Connect by touching the sensor.'],
    face: ['Face ID', 'Unlock Comrade Connect by looking at your phone.']
  };
  var st = document.createElement('style');
  st.textContent = '.cclk-busy{opacity:.55;pointer-events:none}.cclk-note{margin:8px 4px 2px;font-size:12px;color:var(--mut);line-height:1.4}';
  document.head.appendChild(st);

  function paint(rows) {
    var k = LK.kinds();
    rows.forEach(function (r) {
      var on = !!k[r.kind]; r.el.setAttribute('aria-checked', on ? 'true' : 'false');
      r.el.querySelector('small').textContent = on ? 'On. ' + TEXT[r.kind][1] : 'Off. Tap to turn on.';
    });
  }
  function build(box) {
    if (box.__cclk) return;
    var old = box.querySelector('.ccset-row[role="switch"]'); if (!old) return;
    box.__cclk = 1;
    LK.supported().then(function (c) {
      if (!old.isConnected) return;
      var kinds = []; if (c.fingerprint) kinds.push('fingerprint'); if (c.face) kinds.push('face');
      if (!kinds.length) return;                                   // the phone only has a PIN or pattern: keep the single switch
      var host = old.parentNode, rows = [];
      kinds.forEach(function (kind) {
        var r = document.createElement('div'); r.className = 'ccset-row'; r.setAttribute('role', 'switch'); r.tabIndex = 0;
        r.innerHTML = '<span class="ic">' + ICON[kind] + '</span><span class="tx"><b></b><small></small></span><span class="ccset-sw"></span>';
        r.querySelector('b').textContent = TEXT[kind][0];
        var flip = function () {
          if (r.classList.contains('cclk-busy')) return;
          r.classList.add('cclk-busy');
          LK.toggle(kind, r.getAttribute('aria-checked') !== 'true').then(function () { paint(rows); }, function () {})
            .then(function () { r.classList.remove('cclk-busy'); });
        };
        r.onclick = flip; r.onkeydown = function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } };
        host.insertBefore(r, old); rows.push({ kind: kind, el: r });
      });
      old.remove();
      if (rows.length > 1) { var n = document.createElement('p'); n.className = 'cclk-note'; n.textContent = 'Turn both off to switch the lock off.'; host.parentNode.insertBefore(n, host.nextSibling); }
      paint(rows);
      window.addEventListener('cc-lockkinds', function () { if (rows[0].el.isConnected) paint(rows); });
    }, function () {});
  }
  new MutationObserver(function () { var b = document.querySelector('.ccset-box'); if (b) build(b); }).observe(document.body, { childList: true, subtree: true });
})();
