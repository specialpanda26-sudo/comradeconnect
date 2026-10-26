/* cc-fix2.js: the glass upload bar ("Finishing up...") now ends when the work really ends.
   - ID verification: bar stays until the request is sent, then shows "Sent for verification" and goes away (or shows the error)
   - photo uploads: bar finishes when the server confirms the photo
   - safety: a bar left in "Finishing up" is cleared after 60 seconds or when you come back to the app */
(function () {
  'use strict';
  if (window.__ccFix2) return; window.__ccFix2 = 1;
  var finAt = 0, tm;
  function bar() { return document.getElementById('ccu'); }
  function clearFin() { var e = bar(); if (e && /\bfin\b/.test(e.className)) e.className = ''; }
  var n = 0, iv = setInterval(function () {
    var U = window.ccUpload, C = window.CC;
    if (U && !U.__f2) {
      U.__f2 = 1;
      var p = U.progress, d = U.done, f = U.fail;
      U.progress = function (v) {
        var r = p.apply(U, arguments); clearTimeout(tm);
        if (v >= 100) { finAt = Date.now(); tm = setTimeout(clearFin, 60000); }
        return r;
      };
      U.done = function () { clearTimeout(tm); finAt = 0; return d.apply(U, arguments); };
      U.fail = function () { clearTimeout(tm); finAt = 0; return f.apply(U, arguments); };
    }
    if (C && C.call && !C.__f2) {
      C.__f2 = 1; var c = C.call;
      C.call = function (path) {
        var pr = c.apply(this, arguments), U2 = window.ccUpload;
        try {
          if (pr && pr.then && U2 && typeof path === 'string') {
            if (/^\/api\/verify\/submit/.test(path)) pr.then(function () { U2.done('Sent for verification'); }, function (e) { U2.fail((e && e.message) || 'Could not send. Try again.'); });
            else if (/^\/api\/media\/[^/]+\/complete/.test(path)) pr.then(function () { U2.done('Upload finished'); }, function () { U2.fail('Upload failed. Try again.'); });
          }
        } catch (e) {}
        return pr;
      };
    }
    if ((U && C && U.__f2 && C.__f2) || ++n > 80) clearInterval(iv);
  }, 250);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && finAt && Date.now() - finAt > 8000) { finAt = 0; clearFin(); }
  });
})();
