/* cc-ludo.js: a "Play Ludo" card at the top of Explore. Opens the offline game or the online lobby.
   Added the same way as the other cc-*.js features; remove this file and its <script> tag to take it out. */
(function () {
'use strict';
function mount() {
  var v = document.getElementById('v-explore'); if (!v || document.getElementById('ccludo')) return;
  var anchor = v.querySelector('p.sub'); if (!anchor) return;
  var box = document.createElement('div'); box.id = 'ccludo'; box.className = 'box g'; box.style.cssText = 'margin:12px 0;display:flex;align-items:center;gap:12px;flex-wrap:wrap';
  box.innerHTML = '<div style="flex:1 1 160px"><b>Play Ludo</b><div class="sub" style="margin-top:2px">Play offline, or join a room with other comrades.</div></div>'
    + '<div style="display:flex;gap:8px;flex:1 1 220px">'   /* cc-phase6: one row, both buttons share the width */
    + '<a class="btn p" href="/ludo-online.html" style="flex:1;text-decoration:none;text-align:center">Play online</a>'
    + '<a class="btn g" href="/ludo.html" style="flex:1;text-decoration:none;text-align:center">Offline</a></div>';
  anchor.after(box);
}
setInterval(function () { if (!document.hidden) mount(); }, 1500);
mount();
})();
