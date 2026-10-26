/* cc-market-layout.js v1: Market Browse page laid out like the redesign.
   Heading, tabs, search with a filter button, category chips, escrow banner, Swipe / Grid switch, then the items.
   Only moves and restyles what is already on the page (search, filters, chips, banner, cards). No distances are shown: listings have a zone, not a distance. */
(function () {
'use strict';
if (window.__ccMkLayout) return; window.__ccMkLayout = 1;
var V = '#v-market', B = 'html body #v-market.pg #mbrowse', R = B + ' #mgrid.rail';
var CSS =
'html body #v-market.pg>.mu-top{order:3!important}html body #v-market.pg>#mseg{order:4!important}' +
B + '>*{order:8}' + B + '>.fld{order:1}' + B + '>.ccf{order:2}' + B + '>.mu-cats{order:3}' + B + '>.mu-ban{order:4}' + B + '>.mkv{order:5}' + B + '>.mu-h{order:6}' + B + '>#mgrid{order:7}' + B + '>.mtrust{order:9}' +
B + '>.ccf:not(.open){display:none!important}' +
B + '>.mu-cats{margin:0 -20px!important}' +
B + '>.fld{padding-right:6px!important;gap:8px}' +
B + ' .mkf{all:unset;cursor:pointer;flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--ink);color:var(--inkfg)}' +
B + ' .mkf svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;display:block}' +
B + ' .mu-ban{padding:20px 100px 20px 20px!important;min-height:150px}' +
B + ' .mu-ban .tag,' + B + ' .mu-ban img.art{display:none!important}' +
B + ' .mkb-s{position:absolute;right:20px;top:50%;transform:translateY(-50%);width:68px;height:68px;border-radius:50%;background:rgba(255,255,255,.78);display:grid;place-items:center}' +
B + ' .mkb-s svg{width:28px;height:28px;fill:none;stroke:#16130f;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
B + ' .mkv{display:flex;gap:10px}' +
B + ' .mkv button{all:unset;cursor:pointer;height:38px;padding:0 18px;box-sizing:border-box;border-radius:999px;background:var(--g);box-shadow:var(--sh);color:var(--fg);font:700 13px/38px Manrope,sans-serif}' +
B + ' .mkv button.on{background:var(--ink);color:var(--inkfg)}' +
R + '{display:flex!important;overflow-x:auto;gap:14px;scroll-snap-type:x mandatory;margin:0 -20px;padding:0 20px 10px;scrollbar-width:none}' +
R + '::-webkit-scrollbar{display:none}' +
R + ' .mc{position:relative;flex:none;width:min(70vw,272px);height:300px;border-radius:32px!important;overflow:hidden;scroll-snap-align:start;color:#fff;text-align:left}' +
R + ' .mc .mm{position:absolute!important;inset:0;width:100%!important;height:100%!important;aspect-ratio:auto!important;border-radius:0!important}' +
R + ' .mc .mm img{width:100%;height:100%;object-fit:cover}' +
R + ' .mc::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(to top,rgba(10,12,20,.62),rgba(10,12,20,.06) 55%,rgba(10,12,20,.4))}' +
R + ' .mc .mb{position:absolute!important;inset:0;z-index:2;display:flex;flex-direction:column;padding:16px!important}' +
R + ' .mc .mb small{order:1;align-self:flex-start;max-width:70%;padding:7px 12px;border-radius:999px;background:rgba(10,12,20,.55);color:#fff!important;font:700 12px/1.1 Manrope,sans-serif!important;display:block!important}' +
R + ' .mc .mb b{order:2;margin-top:12px;color:#fff!important;font-size:17px!important;text-shadow:0 1px 8px rgba(0,0,0,.35)}' +
R + ' .mc .mb em{order:3;margin:auto 0 !important;color:#fff!important;opacity:.78;font-size:38px!important;font-weight:800!important;letter-spacing:-.04em;line-height:1.05}' +
R + ' .mc .mu-heart{z-index:3;left:auto!important;right:14px;top:14px!important}';
var st = document.createElement('style'); st.id = 'ccmklay-css'; st.textContent = CSS; document.head.appendChild(st);
function $(s, r) { return (r || document).querySelector(s); }
function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function run() {
  var mb = $('#mbrowse'); if (!mb) return;
  var cats = $(V + ' .mu-cats'), ban = $('.mu-ban', mb), fld = $('.fld', mb), grid = $('#mgrid'), trust = $(V + ' .mtrust');
  if (cats && cats.parentNode !== mb) mb.appendChild(cats);          // chips live under the search, only on Browse
  if (trust && trust.parentNode !== mb) mb.appendChild(trust);       // escrow explainer moves to the bottom of Browse
  if (fld && !$('.mkf', fld)) {
    var f = el('button', 'mkf'); f.type = 'button'; f.setAttribute('aria-label', 'Filters and sort'); f.setAttribute('aria-expanded', 'false');
    f.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/></svg>';
    f.onclick = function () { var bar = $('.ccf', mb); if (!bar) return; var o = bar.classList.toggle('open'); f.setAttribute('aria-expanded', o ? 'true' : 'false'); };
    fld.appendChild(f);
  }
  if (ban && !ban.dataset.mk) {
    ban.dataset.mk = 1;
    var h = $('h4', ban), p = $('p', ban); if (h) h.textContent = 'Pay safe, held in escrow'; if (p) p.textContent = 'The seller is paid after you confirm the item.';
    var s = el('span', 'mkb-s'); s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>'; ban.appendChild(s);
  }
  if (grid && !$('.mkv', mb)) {
    var v = el('div', 'mkv'), a = el('button', 'on', 'Swipe'), g = el('button', '', 'Grid'); a.type = g.type = 'button';
    function set(rail) { grid.classList.toggle('rail', rail); a.classList.toggle('on', rail); g.classList.toggle('on', !rail); }
    a.onclick = function () { set(true); }; g.onclick = function () { set(false); };
    v.appendChild(a); v.appendChild(g); grid.insertAdjacentElement('beforebegin', v); set(true);
  }
}
var t = 0; function queue() { clearTimeout(t); t = setTimeout(run, 50); }
function start() {
  run();
  var box = $(V) || document.body;
  try { new MutationObserver(queue).observe(box, { childList: true, subtree: true }); } catch (e) {}
  [400, 1200, 3000].forEach(function (ms) { setTimeout(run, ms); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
