/* cc-fixrows.js v1: layout fixes found in screenshots.
   1) Deals and Surveys: "My deals / Post a deal" and "My surveys / Make a survey" share the row evenly (the second button ran off the screen).
   2) The Play Ludo card only shows on the Explore home, not on top of Deals, Surveys and the other sections.
   3) Chip rows keep their shadow (it was cut off at the bottom, leaving a hard edge).
   4) On phones the robot rests half tucked in at the left edge so it does not sit on top of text; it comes fully out when you tap it. */
(function () {
  'use strict';
  if (window.__ccFixRows) return; window.__ccFixRows = 1;
  var st = document.createElement('style');
  st.textContent =
    'html body .dl-top>div:last-child,html body .sy-top>div:last-child{display:flex!important;gap:10px!important;width:100%!important;margin-top:6px!important}' +
    'html body .dl-top .btn,html body .sy-top .btn{flex:1 1 0!important;min-width:0!important;padding-left:12px!important;padding-right:12px!important;white-space:nowrap!important}' +
    'html body #v-explore.crd-in #ccludo{display:none!important}' +
    'html body .dl-chips,html body .lf-chips,html body .pp-chips,html body .sp-chips{padding:2px 2px 16px!important;margin-bottom:-10px!important}' +
    'html:not([data-lay="desktop"]) body #tkr{translate:-20px 0}' +
    'html:not([data-lay="desktop"]) body:has(#tkb.on) #tkr{translate:0 0}';
  (document.head || document.documentElement).appendChild(st);
})();
