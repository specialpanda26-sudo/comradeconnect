/* cc-blend-item.js v1 (needs cc-blend.js): the item view takes on the colour of the product photo too.
   When a listing opens, the photo's main colour tints the whole item panel (#mvb) and the photo fades into it,
   the same look as the cards in the Browse grid. A listing with no photo is left plain. */
(function () {
  'use strict';
  if (window.__ccBlendItem) return; window.__ccBlendItem = 1;

  var st = document.createElement('style');
  st.textContent =
    '#mvb.cb{--pa:var(--pad,.5);margin:0 0 14px;padding-bottom:16px;border-radius:26px;overflow:hidden;border:1px solid rgba(var(--pc),.4);box-shadow:0 18px 40px -22px rgba(var(--pc),.85);' +
    'background-image:linear-gradient(180deg,rgba(var(--pc),var(--pa)) 0%,rgba(var(--pc),calc(var(--pa)*.9)) 60%,rgba(var(--pc),calc(var(--pa)*.6)) 100%)}' +
    'html[data-theme="light"] #mvb.cb{--pa:var(--pal,.4)}' +
    '#mvb.cb>img.mm{display:block;width:100%;max-height:360px;object-fit:cover;border-radius:0;' +
    '-webkit-mask-image:linear-gradient(180deg,#000 0,#000 66%,rgba(0,0,0,.5) 84%,transparent 100%);mask-image:linear-gradient(180deg,#000 0,#000 66%,rgba(0,0,0,.5) 84%,transparent 100%)}' +
    '#mvb.cb>:not(img){padding-left:16px;padding-right:16px}';
  document.head.appendChild(st);

  var mo = null;
  function run() {
    var v = document.getElementById('mvb'); if (!v) return;
    v.classList.remove('cb');
    var img = v.querySelector('img.mm'); if (!img || !window.ccBlend) return;
    var u = img.currentSrc || img.src;
    window.ccBlend.color(u, function (c) {
      var now = v.querySelector('img.mm');            // the panel may have moved on to another listing
      if (now && (now.currentSrc || now.src) === u) window.ccBlend.paint(v, c);
    });
  }
  function start() {
    var v = document.getElementById('mvb'); if (!v) return;
    mo = new MutationObserver(function () { mo.disconnect(); run(); mo.observe(v, { childList: true }); });
    mo.observe(v, { childList: true }); run();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
