/* cc-fix4.js: no more pop-up banners and no Alerts On/Off switch.
   Notifications now arrive in the phone's own notification bar (the Android app). Which kinds you get is chosen
   with the Alerts button in the bell panel (cc-notifprefs.js). This file only opens the right place when a notification is tapped. */
(function () {
  'use strict';
  if (window.__ccFix4) return; window.__ccFix4 = 1;
  function openView(v) {
    if (v === 'live' && typeof window.go === 'function') { try { window.go('videos'); } catch (e) {} return; }
    var b = document.querySelector('.ccb'); if (b) b.click();
  }
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.ccOpen !== undefined) openView(e.data.ccOpen); });
  /* clean up anything an older copy of the app left on screen */
  ['ccfx-b', 'ccbn', 'ccal'].forEach(function (id) { var n = document.getElementById(id); if (n) n.remove(); });
})();
