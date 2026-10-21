/* cc-onewelcome.js v1: only one "Welcome to Comrade Connect" can be on the screen.
   If two welcome panels appear, the sign-in panel (#ccfrst) stays and the other one is removed. */
(function () {
  'use strict';
  if (window.__ccOneW) return; window.__ccOneW = 1;
  var RX = /welcome to comrade connect/i;
  function vis(el) {
    var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }
  function dedupe() {
    var found = [], list = document.querySelectorAll('body > *, [role=dialog], [aria-modal=true]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i]; if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || !vis(el)) continue;
      var cs = getComputedStyle(el); if (cs.position !== 'fixed' && el.getAttribute('role') !== 'dialog' && el.getAttribute('aria-modal') !== 'true') continue;
      var label = (el.getAttribute('aria-label') || '') + ' ' + ((el.textContent || '').slice(0, 600));
      if (RX.test(label)) found.push(el);
    }
    if (found.length < 2) return;
    var keep = found.filter(function (e) { return e.id === 'ccfrst'; })[0] || found[0];
    found.forEach(function (e) {
      if (e === keep || e.contains(keep) || keep.contains(e)) return;
      e.style.setProperty('display', 'none', 'important'); e.setAttribute('data-ccow', '1');
      setTimeout(function () { try { e.remove(); } catch (x) {} }, 50);
    });
  }
  var t = 0, queue = function () { clearTimeout(t); t = setTimeout(dedupe, 150); };
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  queue();
})();
