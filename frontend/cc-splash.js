/* cc-splash.js v1: the opening animation in the Android app only. Logo and name glide across a black screen, then the app opens.
   The website keeps its own loading screen. The loader used to wait a fixed 8 seconds; in the app it now waits about 3.3 seconds. */
(function () {
'use strict';
var L = document.getElementById('loader');
if (!L || !(window.ccApp && window.ccApp.native)) return;
var st = document.createElement('style'); st.id = 'ccsp-css';
st.textContent = [
'#loader.ccsp{background:#000}',
'#loader.ccsp .lw{gap:0}',
'#loader.ccsp .tw{gap:0;align-items:center}',
'#loader.ccsp .ln{display:none}',
'#loader.ccsp .lgo{width:64px;margin-bottom:18px;background:#fff;opacity:0;animation:ccspio 3s .1s cubic-bezier(.4,0,.2,1) both}',
'#loader.ccsp .wm{font:300 15px/1 Poppins,system-ui,sans-serif;letter-spacing:.34em;padding-left:.34em;text-transform:uppercase;color:#fff;-webkit-text-fill-color:#fff;background:none;opacity:0;animation:ccspio 3s .1s cubic-bezier(.4,0,.2,1) both}',
'#loader.ccsp .tl{font:400 10.5px/1 Poppins,system-ui,sans-serif;color:rgba(255,255,255,.55);margin-top:18px;opacity:0;animation:ccspio 3s .1s cubic-bezier(.4,0,.2,1) both}',
'@keyframes ccspio{0%{opacity:0;transform:translateX(-26px)}22%{opacity:1;transform:translateX(0)}65%{opacity:1;transform:translateX(14px)}100%{opacity:0;transform:translateX(190px)}}',
'@media(prefers-reduced-motion:reduce){#loader.ccsp .lgo,#loader.ccsp .wm,#loader.ccsp .tl{animation:none;opacity:1}}'
].join('');
document.head.appendChild(st);
L.classList.add('ccsp');
var tw = L.querySelector('.tw');
if (tw && !tw.querySelector('.tl')) { var tl = document.createElement('div'); tl.className = 'tl'; tl.textContent = 'Your campus. Your voice.'; tw.appendChild(tl); }
function fin() { L.classList.add('done'); setTimeout(function () { if (L.parentNode) L.parentNode.removeChild(L); }, 900); }
function ready() { setTimeout(fin, Math.max(0, 3300 - Math.round(performance.now()))); }
if (document.readyState === 'complete') ready(); else window.addEventListener('load', ready);
})();
