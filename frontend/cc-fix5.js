/* cc-fix5.js: website push is switched off for good.
   This file no longer signs anyone up. It only removes a browser push sign-up an older version may have left on this phone. */
(function () {
  'use strict';
  if (window.__ccFix5) return; window.__ccFix5 = 1;
  function signed() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
  function call(p, body) { return window.ccCall(p, body ? { body: body, auth: false } : { auth: false }); }
  function clean() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) {
        if (!s) return;
        if (signed() && window.ccCall) call('/api/push/unsubscribe', { endpoint: s.endpoint }).catch(function () {});
        return s.unsubscribe();
      });
    }).catch(function () {});
  }
  setTimeout(clean, 6000);
})();
