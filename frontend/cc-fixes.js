/* cc-fixes.js v1: small fixes for things that stayed hidden until tapped.
1. Market product photos sat behind a dark #0E0F0B box and a blur layer, so they looked like a black sheet until you tapped them.
2. Feed cards start invisible and only appear when a scroll watcher fires; if it is late they stay hidden. This reveals them after a short wait no matter what. */
(function () {
'use strict';
if (window.__ccFixes) return; window.__ccFixes = 1;
var s = document.createElement('style'); s.id = 'cc-fixes-css';
s.textContent = [
'.mc.g{-webkit-backdrop-filter:none;backdrop-filter:none;transform:translateZ(0)}',
'.mc .mm,.mm{background:var(--g,rgba(255,255,255,.07))}',
'.mc .mm{opacity:1;animation:ccfx-img .35s ease both}',
'@keyframes ccfx-img{from{opacity:0}}',
'.card{animation:ccfx-show .01s 1.4s forwards}',
'@keyframes ccfx-show{to{opacity:1;transform:none;filter:none}}'
].join('\n');
document.head.appendChild(s);
function eager(root) { try { (root || document).querySelectorAll('img.mm[loading="lazy"]').forEach(function (i) { i.removeAttribute('loading'); i.decoding = 'async'; }); } catch (e) {} }
eager();
try { new MutationObserver(function () { eager(); }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
})();