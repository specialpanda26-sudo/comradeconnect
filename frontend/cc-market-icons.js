/* cc-market-icons.js v1: Market category chips (All, Tech, Books, Clothes, Furniture, Food, Services, Saved) get an outline icon in a round
   badge, in the same outline style as the bottom tabs. Light and dark follow the site theme. Only draws icons: filtering is untouched. */
(function () {
'use strict';
if (window.__ccMkIcons) return; window.__ccMkIcons = 1;
function s(d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }
var IC = {
  all: s('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8L3.5 9.7l5.9-.9z"/>'),
  electronics: s('<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>'),
  books: s('<path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h11"/>'),
  clothes: s('<path d="M8.5 3.5L3 6.5l2.5 4 2.5-1V20.5h8V9.5l2.5 1 2.5-4-5.5-3a3.5 3.5 0 0 1-7 0z"/>'),
  furniture: s('<path d="M5.5 11V8a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v3"/><path d="M3 13.5a2 2 0 0 1 4 0V16h10v-2.5a2 2 0 0 1 4 0v5H3z"/><path d="M5.5 18.5v2M18.5 18.5v2"/>'),
  food: s('<path d="M7 3v6a2 2 0 0 0 4 0V3M9 3v18"/><path d="M17 21V3c-2.2 1-3.5 3.6-3.5 7 0 2 1.4 3 3.5 3"/>'),
  services: s('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.5-.5-2.6z"/>'),
  saved: s('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>')
};
var CSS = 'html body #v-market .mu-cats .mu-cat .cct-i{display:none!important}' +
'html body #v-market .mu-cats .mu-cat{display:inline-flex!important;align-items:center;gap:9px;height:50px!important;padding:0 18px 0 7px!important}' +
'html body #v-market .mu-cats .mu-cat .cct-l{line-height:1!important;font-size:13.5px!important}' +
'html body #v-market .mu-cats .mu-cat .mci{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:var(--fg);background:rgba(127,127,127,.16)}' +
'html body #v-market .mu-cats .mu-cat .mci svg{width:19px;height:19px;display:block}' +
'html body #v-market .mu-cats .mu-cat.on .mci{color:var(--inkfg);background:rgba(127,127,127,.28)}' +
'html body #v-market{display:flex!important}html body #v-market>#mseg{order:3!important}html body #v-market>.mu-top{order:4!important}html body #v-market>.mtrust{order:5!important}';
var st = document.createElement('style'); st.id = 'ccmkic-css'; st.textContent = CSS; document.head.appendChild(st);
function run() {
  var list = document.querySelectorAll('#v-market .mu-cats .mu-cat');
  for (var i = 0; i < list.length; i++) {
    var b = list[i], k = (b.dataset.c || '').toLowerCase();
    if (!IC[k] || b.querySelector('.mci')) continue;
    var m = document.createElement('span'); m.className = 'mci'; m.innerHTML = IC[k];
    b.insertBefore(m, b.firstChild);
  }
}
var t = 0; function queue() { clearTimeout(t); t = setTimeout(run, 40); }
function start() {
  run();
  var box = document.querySelector('#v-market') || document.body;
  try { new MutationObserver(queue).observe(box, { childList: true, subtree: true }); } catch (e) {}
  [500, 1500, 3500].forEach(function (ms) { setTimeout(run, ms); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
