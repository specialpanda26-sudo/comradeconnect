/* cc-verified.js v1: the ONE verified badge (scalloped seal with a tick) used on every verified account.
   window.ccVerified(px) returns the badge as an HTML string. Loaded in <head> so every script can use it. */
(function () {
'use strict';
if (window.ccVerified) return;
var st = document.createElement('style');
st.textContent = '.ccvb{display:inline-block;vertical-align:-3px;margin-left:5px;flex:none;color:var(--vb,#4FB6CF)}' +
  '.ccvb .s{fill:color-mix(in srgb,currentColor 16%,transparent);stroke:currentColor;stroke-width:1.5;stroke-linejoin:round}' +
  '.ccvb .c{fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}';
document.head.appendChild(st);
window.ccVerified = function (px) {
  px = px || 16;
  return '<svg class="ccvb" viewBox="0 0 24 24" width="' + px + '" height="' + px + '" role="img" aria-label="Verified"><title>Verified</title>' +
    '<path class="s" d="M22.4 12.0 L22.3 12.7 L21.9 13.3 L21.3 13.9 L20.7 14.3 L20.2 14.8 L19.9 15.3 L19.8 15.8 L19.8 16.5 L19.9 17.3 L19.9 18.1 L19.8 18.8 L19.4 19.4 L18.8 19.8 L18.1 19.9 L17.3 19.9 L16.5 19.8 L15.8 19.8 L15.3 19.9 L14.8 20.2 L14.3 20.7 L13.9 21.3 L13.3 21.9 L12.7 22.3 L12.0 22.4 L11.3 22.3 L10.7 21.9 L10.1 21.3 L9.7 20.7 L9.2 20.2 L8.7 19.9 L8.2 19.8 L7.5 19.8 L6.7 19.9 L5.9 19.9 L5.2 19.8 L4.6 19.4 L4.2 18.8 L4.1 18.1 L4.1 17.3 L4.2 16.5 L4.2 15.8 L4.1 15.3 L3.8 14.8 L3.3 14.3 L2.7 13.9 L2.1 13.3 L1.7 12.7 L1.6 12.0 L1.7 11.3 L2.1 10.7 L2.7 10.1 L3.3 9.7 L3.8 9.2 L4.1 8.7 L4.2 8.2 L4.2 7.5 L4.1 6.7 L4.1 5.9 L4.2 5.2 L4.6 4.6 L5.2 4.2 L5.9 4.1 L6.7 4.1 L7.5 4.2 L8.2 4.2 L8.7 4.1 L9.2 3.8 L9.7 3.3 L10.1 2.7 L10.7 2.1 L11.3 1.7 L12.0 1.6 L12.7 1.7 L13.3 2.1 L13.9 2.7 L14.3 3.3 L14.8 3.8 L15.3 4.1 L15.8 4.2 L16.5 4.2 L17.3 4.1 L18.1 4.1 L18.8 4.2 L19.4 4.6 L19.8 5.2 L19.9 5.9 L19.9 6.7 L19.8 7.5 L19.8 8.2 L19.9 8.7 L20.2 9.2 L20.7 9.7 L21.3 10.1 L21.9 10.7 L22.3 11.3Z"/><path class="c" d="M8 12.6l2.6 2.6L16.2 9.4"/></svg>';
};
})();
