/* cc-pwfast.js v1: "Sign in with my password" goes straight to the glass password card, no flash of the fingerprint / Face ID card. */
(function () {
  'use strict';
  var st = document.createElement('style');
  st.textContent = '#lk.lkg.rec,#lk.lkg.rec *{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}';
  document.head.appendChild(st);
  function go() {
    var lk = document.getElementById('lk'); if (!lk) return;
    lk.classList.add('rec');
    var c = document.getElementById('lkc'); if (c) { try { c.focus({ preventScroll: true }); } catch (e) { c.focus(); } }
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#fpx-pw,#lkpw') : null;
    if (t) go();
  }, true);
})();
