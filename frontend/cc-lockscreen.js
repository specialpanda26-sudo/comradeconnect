/* cc-lockscreen.js: fills in the fingerprint lock screen (#lk in index.html): name, picture, buttons.
   Picture and greeting come from Admin > Site editor > App look. */
(function () {
  'use strict';
  var lk = document.getElementById('lk'); if (!lk) return;
  var hero = document.getElementById('lkhero');
  function saved() { try { return JSON.parse(localStorage.getItem('cc_site_v1') || '{}') || {}; } catch (e) { return {}; } }
  function name() {
    try { var me = JSON.parse(localStorage.getItem('cs_me') || 'null'); var h = me && me.handle ? String(me.handle) : ''; return h ? h.replace(/_/g, ' ').replace(/\d+$/, '').trim() : ''; } catch (e) { return ''; }
  }
  function paint(C) {
    C = C || saved();
    var img = /^https:\/\/[^\s<>"']+$/i.test(C.lock_image || '') ? C.lock_image : 'media/bg-poster.webp';
    hero.style.backgroundImage = 'url("' + img.replace(/"/g, '%22') + '")';
    var n = name(), hi = document.getElementById('lkhi'); if (hi) hi.textContent = 'Hi, ' + (n ? n.toUpperCase() : 'COMRADE');
  }
  paint();
  document.addEventListener('cc-site', function (e) { paint(e.detail); });
  var pw = document.getElementById('lkpw');
  if (pw) pw.onclick = function () { lk.classList.add('rec'); var c = document.getElementById('lkc'); if (c) c.focus(); };
  var sw = document.getElementById('lksw');
  if (sw) sw.onclick = function (e) { e.preventDefault(); lk.classList.remove('on'); if (window.ccSignOut) window.ccSignOut(); };
  new MutationObserver(function () { if (lk.classList.contains('on')) paint(); }).observe(lk, { attributes: true, attributeFilter: ['class'] });
})();
