/* cc-sheetx.js: payment and withdrawal progress sheets get a close (X) button and close on Escape or a tap outside.
   Closing never cancels a payment: the server keeps confirming it, and the wallet shows it when it lands. */
(function () {
  'use strict';
  if (window.__ccSheetX) return; window.__ccSheetX = 1;
  var st = document.createElement('style');
  st.textContent = '.ccsx{position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:50%;border:1px solid var(--line,#444);background:transparent;color:var(--fg,#fff);font-size:20px;line-height:1;display:grid;place-items:center;cursor:pointer;z-index:2}.ccsx+*{margin-top:0}.ccsxn{margin:12px 0 0;font-size:12px;color:var(--mut,#aaa);text-align:center}';
  (document.head || document.documentElement).appendChild(st);

  function wire(ov) {
    if (ov.__ccsx) return;
    var box = ov.firstElementChild; if (!box || !box.querySelector('.cs-l')) return;      // only the payment / withdrawal progress sheets
    ov.__ccsx = 1;
    box.style.position = 'relative';
    var close = function () { ov.remove(); document.removeEventListener('keydown', esc); };
    var esc = function (e) { if (e.key === 'Escape') close(); };
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ccsx'; b.setAttribute('aria-label', 'Close'); b.textContent = '\u00d7'; b.onclick = close;
    box.insertBefore(b, box.firstChild);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', esc);
  }
  function scan(root) {
    var list = root.querySelectorAll ? root.querySelectorAll('body > div') : [];
    for (var i = 0; i < list.length; i++) if (list[i].style && list[i].style.zIndex === '9999') wire(list[i]);
    if (root.style && root.style.zIndex === '9999') wire(root);
  }
  new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) {
      var t = ms[i].target;
      if (t.nodeType === 1) { var ov = t.closest && t.closest('body > div'); if (ov && ov.style.zIndex === '9999') wire(ov); }
      for (var j = 0; j < ms[i].addedNodes.length; j++) if (ms[i].addedNodes[j].nodeType === 1) scan(ms[i].addedNodes[j]);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
