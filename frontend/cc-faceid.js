/* cc-faceid.js v2: routes the lock buttons to the phone's REAL biometric screen (app only).
   The old staged "face scan" animation was removed: it pretended to scan a face when the phone had not checked anything.
   In the Android app the phone's own fingerprint / face unlock / screen lock is used (cc-fingerprint.js -> ccNativeBio).
   In a plain web browser nothing is intercepted: the site's own WebAuthn lock (index.html bioEnable / bioCheck) runs as is. */
(function () {
'use strict';
if (window.__ccFaceId) return; window.__ccFaceId = 1;
var $ = function (s, r) { return (r || document).querySelector(s); };
var hasBio = function () { try { return !!ME.bio; } catch (e) { return false; } };

function flow(mode) {
  if (!window.ccNativeBio) return Promise.resolve(false);
  var why = mode === 'enable' ? 'Turn on the lock' : 'Confirm it is really you';
  return window.ccFp ? window.ccFp.scan(why, mode) : window.ccNativeBio.verify(why);
}
var bypass = null;
function intercept(sel, modeFor) {
  document.addEventListener('click', function (e) {
    if (!window.ccNativeBio) return;                       // web: let the site's own real check run
    var b = e.target.closest && e.target.closest(sel); if (!b) return;
    if (bypass === b) { bypass = null; return; }
    var mode = modeFor(b); if (!mode) return;
    e.preventDefault(); e.stopImmediatePropagation();
    flow(mode).then(function (ok) {
      if (!ok) { if (mode === 'enable') { var n = $('#secN'); if (b.id === 'secY' && n) n.click(); } return; }
      bypass = b; b.click();
    });
  }, true);
}
intercept('#secY', function () { return 'enable'; });
intercept('#sgo', function () { return hasBio() ? 'verify' : 'enable'; });
intercept('#lku', function () { return 'verify'; });
intercept('#wd', function () { return hasBio() ? 'verify' : null; });
window.ccFaceId = { scan: flow };
})();
