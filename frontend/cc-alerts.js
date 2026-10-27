/* cc-alerts.js: the "Turn on alerts?" pop-up and the browser permission question are gone for good.
   Alerts arrive in the phone's notification bar (Android app). Choose which ones in the bell panel > Alerts (cc-notifprefs.js). */
(function () {
  'use strict';
  if (window.__ccAlerts) return; window.__ccAlerts = 1;
  var w = document.getElementById('ccal'); if (w) w.remove();
})();
