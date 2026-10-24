/* cc-faceid.js v6: routes the lock buttons to the phone's REAL biometric screen (app only).
   Every lock button opens the one banking-style screen in cc-fingerprint.js, where the person picks Fingerprint or Face ID,
   and that screen opens the phone's own prompt through ccNativeBio.verify(). Nothing is staged: no tick without Android saying yes.
   In a plain web browser nothing is intercepted: the site's own WebAuthn lock (index.html bioEnable / bioCheck) runs as is. */
(function () {
'use strict';
if (window.__ccFaceId) return; window.__ccFaceId = 1;
var $ = function (s, r) { return (r || document).querySelector(s); };
var hasBio = function () { try { return !!ME.bio; } catch (e) { return false; } };

function flow(mode, kind) {
  if (!window.ccNativeBio) return Promise.resolve(false);
  var why = mode === 'enable' ? 'Turn on the lock' : 'Confirm it is really you';
  return window.ccFp ? window.ccFp.scan(why, mode, kind) : window.ccNativeBio.verify(why);
}
var bypass = null;
// after the screen says yes, click the real button again; the site's own handler then runs and finds the fresh yes (used once)
function intercept(sel, modeFor, kindFor, target) {
  document.addEventListener('click', function (e) {
    if (!window.ccNativeBio) return;                       // web: let the site's own real check run
    var b = e.target.closest && e.target.closest(sel); if (!b) return;
    if (bypass === b) { bypass = null; return; }
    var mode = modeFor(b); if (!mode) return;
    e.preventDefault(); e.stopImmediatePropagation();
    flow(mode, kindFor ? kindFor(b) : undefined).then(function (ok) {
      if (!ok) { if (mode === 'enable') { var n = $('#secN'); if (b.id === 'secY' && n) n.click(); } return; }
      var go = target ? target(b) : b; bypass = go; go.click();
    });
  }, true);
}
intercept('#secY', function () { return 'enable'; });
intercept('#sgo', function () { return hasBio() ? 'verify' : 'enable'; });
intercept('#lku', function () { return 'verify'; });
intercept('#lkf', function () { return 'verify'; }, function () { return 'face'; }, function () { return $('#lku'); });   // the Face ID button on the lock screen
intercept('#wd', function () { return hasBio() ? 'verify' : null; });
window.ccFaceId = { scan: flow };
})();
