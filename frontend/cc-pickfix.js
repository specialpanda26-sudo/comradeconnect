/* cc-pickfix.js v1: dropdown lists (Choose one) open as a small bottom sheet again, not a full screen.
   cc-panels.js turns every pop-up into a full-screen panel and the dropdown list (#ccp) was one of them.
   These rules are stronger than the full-screen ones, so the list sits at the bottom with the dimmed page behind it. */
(function () {
  'use strict';
  if (window.__ccPickFix) return; window.__ccPickFix = 1;
  var st = document.createElement('style');
  st.textContent =
    'html body #ccp.ccp-ov,html body #ccp{padding:0!important;align-items:flex-end!important;justify-content:center!important;place-items:end center!important;' +
    'background:rgba(16,20,34,.5)!important;-webkit-backdrop-filter:blur(10px)!important;backdrop-filter:blur(10px)!important}' +
    'html body #ccp .sh,html body #ccp .sh.ccp-box{width:min(520px,100%)!important;max-width:520px!important;height:auto!important;min-height:0!important;max-height:72vh!important;' +
    'margin:0!important;box-sizing:border-box!important;overflow-y:auto!important;border-radius:26px 26px 0 0!important;' +
    'border:1px solid var(--gb)!important;border-bottom:0!important;box-shadow:0 -20px 60px rgba(0,0,0,.45)!important;' +
    'padding:20px 20px calc(18px + env(safe-area-inset-bottom,0px))!important;animation:ccu .35s cubic-bezier(.2,.8,.2,1)!important}' +
    'html body #ccp .ccpb,html body #ccp .ccpf,html body #ccp .ccx-b{display:none!important}';
  (document.head || document.documentElement).appendChild(st);
})();
