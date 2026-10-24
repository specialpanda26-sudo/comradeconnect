/* cc-ui4.js v1: unlock flow helpers (Android app).
   1. While Android's prompt is open, the scan picture gets class "scanning" (it fills in).
   2. On the lock screen the scan screen has no Cancel button: you unlock, use your password, or switch account.
   3. If the scan screen did not open (phone has no fingerprint/face/lock), show the password panel instead of a blank cover. */
(function () {
  'use strict';
  if (window.__ccUi4) return; window.__ccUi4 = 1;
  var lk = document.getElementById('lk');

  var B = window.ccNativeBio;
  if (B && B.verify && !B.__w) {
    B.__w = 1; var v = B.verify;
    B.verify = function () {
      var r = document.getElementById('ccfp'); if (r) r.classList.add('scanning');
      var off = function (x) { var q = document.getElementById('ccfp'); if (q) q.classList.remove('scanning'); return x; };
      var p; try { p = v.apply(B, arguments); } catch (e) { off(); throw e; }
      return p.then(off, function (e) { off(); throw e; });
    };
  }

  new MutationObserver(function () {
    var r = document.getElementById('ccfp'); if (!r || r.__c) return;
    r.__c = 1;
    if (r.querySelector('#fpx-pw')) { var c = r.querySelector('#fpx-cancel'); if (c) c.style.display = 'none'; }
  }).observe(document.body, { childList: true });

  var idle = 0;
  setInterval(function () {
    if (!lk) return;
    var on = lk.classList.contains('on');
    if (!on) { idle = 0; lk.classList.remove('cc-show'); return; }
    if (document.getElementById('ccfp') || lk.classList.contains('rec') || (B && B.busy && B.busy())) { idle = 0; lk.classList.remove('cc-show'); return; }
    if (++idle >= 4) lk.classList.add('cc-show');      // about 3 seconds with no scan screen: show the lock page so the app is never stuck
  }, 800);
})();
