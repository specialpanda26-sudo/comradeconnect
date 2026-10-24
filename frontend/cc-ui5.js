/* cc-ui5.js v1: safety net for the Tech robot.
   If a tap on the robot opens its small menu but the menu cannot be seen (hidden by another rule), open the Support panel instead. */
(function () {
  'use strict';
  if (window.__ccUi5) return; window.__ccUi5 = 1;
  function seen(n) {
    if (!n) return false;
    var cs = getComputedStyle(n), r = n.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05 && r.width > 0 && r.height > 0;
  }
  document.addEventListener('click', function (e) {
    if (!(e.target.closest && e.target.closest('#tkr'))) return;
    setTimeout(function () {
      var m = document.getElementById('tkb');
      if (m && m.classList.contains('on') && !seen(m)) {
        m.classList.remove('on');
        document.dispatchEvent(new CustomEvent('cc-open-support'));
      }
    }, 350);
  }, true);
})();
