/* cc-ui2.js v1: Section 2. Lock the app EVERY time you leave it and come back (when the lock is on).
   Leaving = Android app state change, pause, or the page being hidden. Coming back shows the lock screen (#lk) and asks the phone straight away.
   Not counted as leaving: Android's own fingerprint/face prompt, Google sign-in, and the photo/file picker or camera you opened yourself. */
(function () {
  'use strict';
  if (window.__ccUi2) return; window.__ccUi2 = 1;
  var lk = document.getElementById('lk'); if (!lk) return;
  var left = 0, openedAt = 0, picking = 0;

  function enabled() { try { return !!ME.bio; } catch (e) { return false; } }
  function busy() { var B = window.ccNativeBio; return !!(B && B.busy && B.busy()); }

  // a file picker or camera that YOU opened takes the app to the background: do not lock for it
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest('input[type=file]') || t.closest('label') && t.closest('label').querySelector('input[type=file]')) picking = Date.now();
  }, true);

  function away() {
    if (left || busy()) return;
    left = Date.now();
  }
  function back() {
    var t = left; left = 0; if (!t) return;
    if (!enabled() || window.ccAwayOK || busy()) return;
    if (picking && Date.now() - picking < 120000) { picking = 0; return; }
    if (lk.classList.contains('on') || Date.now() - openedAt < 1500) return;
    lk.classList.remove('rec'); lk.classList.add('on');
    setTimeout(function () {
      var u = document.getElementById('lku');
      if (u && lk.classList.contains('on') && window.ccNativeBio && !busy()) u.click();
    }, 350);
  }

  // remember when the lock was last opened or closed, so the prompt closing does not lock again
  new MutationObserver(function () { openedAt = Date.now(); }).observe(lk, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('visibilitychange', function () { if (document.hidden) away(); else back(); });
  document.addEventListener('pause', away);
  document.addEventListener('resume', back);
  try {
    var cap = window.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
      var A = (cap.Plugins && cap.Plugins.App) || (cap.registerPlugin ? cap.registerPlugin('App') : null);
      if (A && A.addListener) A.addListener('appStateChange', function (s) { if (s && s.isActive) back(); else away(); });
    }
  } catch (e) {}
})();
