/* Market redesign: fresh-grocery-app look (light green, white product cards, heart + add buttons).
   PART 1: styles and layout (header, category tiles, search, promo banner, cards).
   PART 2: behaviour (category filter, saved hearts, quick-add button, Shop now).
   Sits on top of cc-core.js / cc-market-plus.js / cc-cards.js without changing them. Text goes in with textContent. */
(function () {
'use strict';
var API = (typeof CC_API !== 'undefined' ? CC_API : '').replace(/\/$/, '');
function $(s, r) { return (r || document).querySelector(s); }
function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
var V = $('#v-market'); if (!V) return;

/* ================= PART 1: LOOK ================= */
var css = [
'#v-market{--fg:#14281a;--mut:#5d6f60;--line:rgba(20,40,26,.1);--gb:rgba(20,40,26,.12);--ink:#245c2c;--inkfg:#fff;--g:#fff;--mg:#245c2c;',
' color:var(--fg);border-radius:34px;padding:18px 14px 26px;margin-top:6px;background:linear-gradient(180deg,#c9d9c3 0,#e6eee2 170px,#f6f8f4 420px);box-shadow:0 18px 50px rgba(0,0,0,.28),inset 0 1px 0 #fff}',
'#v-market>.ph,#v-market>.sub:first-of-type{display:none}',
'#v-market .g{background:#fff;border:0;box-shadow:0 6px 22px rgba(36,92,44,.08);-webkit-backdrop-filter:none;backdrop-filter:none;color:var(--fg)}',
'#v-market .sub,#v-market small{color:var(--mut)}',
'#v-market h3,#v-market b{color:var(--fg)}',
/* location row */
'.mu-top{display:flex;align-items:center;gap:12px;margin-bottom:16px}',
'.mu-pin,.mu-bell{width:44px;height:44px;border-radius:50%;background:#fff;display:grid;place-items:center;flex:none;box-shadow:0 4px 14px rgba(36,92,44,.12);border:0;color:var(--fg);cursor:pointer}',
'.mu-pin svg,.mu-bell svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
'.mu-loc{flex:1;min-width:0}.mu-loc small{display:block;font-size:11px;color:var(--mut)}.mu-loc b{display:block;font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
/* category tiles */
'.mu-cats{display:flex;gap:14px;overflow-x:auto;padding:2px 2px 6px;margin:0 -2px 14px;scrollbar-width:none}.mu-cats::-webkit-scrollbar{display:none}',
'.mu-cat{all:unset;cursor:pointer;flex:none;width:66px;text-align:center;font-size:12px;color:var(--fg)}',
'.mu-cat i{display:grid;place-items:center;width:62px;height:62px;margin:0 auto 6px;border-radius:20px;font-style:normal;font-size:28px;box-shadow:0 6px 16px rgba(36,92,44,.14);border:2px solid transparent;transition:transform .15s,border-color .15s}',
'.mu-cat.on i{border-color:var(--mg);transform:translateY(-2px)}.mu-cat.on{font-weight:600}',
/* search */
'#v-market #mbrowse>.fld{display:flex;align-items:center;gap:10px;background:#fff;border-radius:999px;padding:0 16px;box-shadow:0 4px 14px rgba(36,92,44,.08)}',
'#v-market #mbrowse>.fld::before{content:"\\2726";color:var(--mg);font-size:15px}',
'#v-market #mkq{flex:1;border:0;background:transparent;color:var(--fg);padding:14px 0;font-size:14px;outline:none}#v-market #mkq::placeholder{color:#8a9a8c}',
/* promo banner */
'.mu-ban{position:relative;overflow:hidden;border-radius:24px;padding:18px;min-height:150px;background:linear-gradient(135deg,#e9e7b9,#cfd9a0 60%,#b9cf8e);box-shadow:0 8px 24px rgba(36,92,44,.14)}',
'.mu-ban .tag{display:inline-flex;gap:6px;align-items:center;font-size:10.5px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.6);color:var(--mut)}',
'.mu-ban h4{margin:10px 0 4px;font-size:22px;font-weight:600;color:#14281a;max-width:60%}',
'.mu-ban p{margin:0 0 12px;font-size:12px;color:#4d5f50;max-width:58%;line-height:1.4}',
'.mu-ban button{all:unset;cursor:pointer;background:#101422;color:#fff;font-size:13px;font-weight:600;padding:9px 18px;border-radius:999px}',
'.mu-ban .art{position:absolute;right:10px;bottom:2px;font-size:62px;line-height:1;letter-spacing:-8px;filter:drop-shadow(0 6px 8px rgba(0,0,0,.18));transform:rotate(6deg)}',
'.mu-h{display:flex;justify-content:space-between;align-items:baseline;margin:4px 2px 0}.mu-h b{font-size:16px;font-weight:600}.mu-h span{font-size:12px;color:var(--mut)}',
/* escrow strip, filter bar, segmented */
'#v-market .mtrust{margin:0 0 12px;padding:12px 14px;border-radius:20px}#v-market .mtrust .mtb{display:none}#v-market .mtrust svg{stroke:var(--mg)}#v-market .mt-h b{font-size:14px}',
'#v-market .seg{background:#fff;box-shadow:0 4px 14px rgba(36,92,44,.08)}#v-market .seg button{color:var(--mut)}#v-market .seg button.on{background:var(--mg);color:#fff}',
'#v-market .ccf input,#v-market .ccf select{background:#fff;border:0;color:var(--fg);box-shadow:0 3px 10px rgba(36,92,44,.08)}',
'#v-market .cce{padding:12px 16px}',
'#v-market .btn.p{background:var(--mg);color:#fff;border:0}#v-market .btn.g{background:#fff;color:var(--fg);border:0}',
/* product cards */
'#v-market .mgrid{gap:12px}',
'#v-market .mgrid .mc{position:relative;background:#fff!important;border-radius:24px;box-shadow:0 6px 22px rgba(36,92,44,.1);padding:10px 10px 12px;overflow:hidden;isolation:auto;color:var(--fg)}',
'#v-market .mgrid .mc::before,#v-market .mgrid .mc::after{display:none!important}',
'#v-market .mgrid .mc .mm{position:relative;width:100%;aspect-ratio:1/1!important;object-fit:cover;border-radius:18px;background:#eef3ea!important}',
'#v-market .mgrid .mc .mm.poster{background:#eef3ea!important;color:var(--mut);align-content:center;text-align:center}',
'#v-market .mgrid .mc .mb{position:static;background:none!important;border:0;backdrop-filter:none;-webkit-backdrop-filter:none;padding:10px 2px 0;color:var(--fg);display:block;min-height:76px}',
'#v-market .mgrid .mc .mb b{color:var(--fg);font-size:14px;font-weight:600;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
'#v-market .mgrid .mc .mb small{color:var(--mut);font-size:10.5px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}',
'#v-market .mgrid .mc .mb small.mtl{display:none!important}',
'#v-market .mgrid .mc .mb .ccrt{color:#b7791f;font-size:11px}',
'#v-market .mgrid .mc .mb em{position:absolute;left:12px;bottom:12px;font-style:normal;font-size:16px;font-weight:700;color:var(--fg);margin:0}',
'#v-market .mgrid .mc .ccpr,#v-market .mgrid .mc .badge{background:var(--mg);color:#fff;border:0;font-size:9.5px}',
'.mu-heart,.mu-add{position:absolute;z-index:4;border:0;cursor:pointer;display:grid;place-items:center;padding:0}',
'.mu-heart{top:16px;left:16px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 2px 8px rgba(0,0,0,.12);color:#14281a}',
'.mu-heart svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}',
'.mu-heart.on{color:#d6335a}.mu-heart.on svg{fill:currentColor}',
'.mu-add{right:12px;bottom:12px;width:40px;height:40px;border-radius:50%;background:#101422;color:#fff;font-size:24px;line-height:1;transition:transform .12s}.mu-add:active{transform:scale(.88)}',
'#v-market .mgrid .mc.mu-hide{display:none!important}',
'html[data-lay="desktop"] #v-market{padding:24px 22px 30px}'
].join('\n');
var st = el('style'); st.id = 'mu-css'; st.textContent = css; document.head.appendChild(st);

var ICON = {
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg>'
};
var CATS = [['All', '\uD83D\uDECD\uFE0F', '#f6d6e4'], ['Electronics', '\uD83D\uDCF1', '#d4e6f7'], ['Books', '\uD83D\uDCDA', '#f6ecc9'], ['Clothes', '\uD83D\uDC55', '#e8dcf5'], ['Furniture', '\uD83D\uDECF\uFE0F', '#f9dfc9'], ['Food', '\uD83C\uDF72', '#d9efd2'], ['Services', '\uD83D\uDEE0\uFE0F', '#d3eeee'], ['Saved', '\u2764\uFE0F', '#fbd5d5']];

var browse = $('#mbrowse'), grid = $('#mgrid'), q = $('#mkq');
var cur = 'All', LM = {}, saved = {};
try { saved = JSON.parse(ls('cc_mu_saved') || '{}') || {}; } catch (e) { saved = {}; }

/* header: location + bell */
var top = el('div', 'mu-top'), pin = el('span', 'mu-pin'), loc = el('div', 'mu-loc'), bell = el('button', 'mu-bell');
pin.innerHTML = ICON.pin; bell.innerHTML = ICON.bell; bell.type = 'button'; bell.setAttribute('aria-label', 'Notifications');
loc.appendChild(el('small', '', 'Location')); loc.appendChild(el('b', '', 'Kirinyaga University'));
top.appendChild(pin); top.appendChild(loc); top.appendChild(bell);
V.insertBefore(top, V.firstChild);
bell.onclick = function () { var b = document.querySelector('#nb, #bellbtn, [data-v="notifs"], .nbell, #cc-bell'); if (b) b.click(); };

/* category tiles */
var cats = el('div', 'mu-cats'); cats.setAttribute('role', 'tablist');
CATS.forEach(function (c) {
  var b = el('button', 'mu-cat' + (c[0] === 'All' ? ' on' : '')); b.type = 'button'; b.dataset.c = c[0];
  var i = el('i', '', c[1]); i.style.background = c[2]; b.appendChild(i); b.appendChild(document.createTextNode(c[0] === 'Electronics' ? 'Tech' : c[0]));
  cats.appendChild(b);
});
top.insertAdjacentElement('afterend', cats);

/* promo banner + section title, placed under the search box */
var fld = q && q.closest('.fld');
q.placeholder = 'Search beds, fridges, books...';
var ban = el('div', 'mu-ban');
var tg = el('span', 'tag', '\u2726 Campus picks'); ban.appendChild(tg);
ban.appendChild(el('h4', '', 'Back to routine')); ban.appendChild(el('p', '', 'Everything a comrade needs, from room basics to study gear.'));
var sn = el('button', '', 'Shop now'); sn.type = 'button'; ban.appendChild(sn);
ban.appendChild(el('div', 'art', '\uD83D\uDECF\uFE0F\uD83D\uDCDA\uD83D\uDCF1'));
var hd = el('div', 'mu-h'); hd.appendChild(el('b', '', 'Top Picks For You')); var all = el('span', '', 'See All'); hd.appendChild(all);
if (fld) { fld.insertAdjacentElement('afterend', ban); ban.insertAdjacentElement('afterend', hd); }
function toGrid() { grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
sn.onclick = toGrid;
all.onclick = function () { setCat('All'); q.value = ''; q.dispatchEvent(new Event('input')); toGrid(); };

/* ================= PART 2: BEHAVIOUR ================= */
// remember listings (category, id) from the same responses the app already loads
var f0 = window.fetch;
window.fetch = function (u) {
  var p = f0.apply(this, arguments);
  try {
    if (typeof u === 'string' && API && u.indexOf(API) === 0 && /^\/api\/market\/(listings|mine)/.test(u.slice(API.length)))
      p.then(function (r) { return r.clone().json(); }).then(function (d) { (d.listings || [d]).forEach(function (l) { if (l && l.id) LM[l.id] = l; }); decorate(); }).catch(function () {});
  } catch (e) {}
  return p;
};

function setCat(c) {
  cur = c;
  [].forEach.call(cats.children, function (b) { b.classList.toggle('on', b.dataset.c === c); });
  decorate();
}
cats.onclick = function (e) { var b = e.target.closest('.mu-cat'); if (b) setCat(b.dataset.c); };

function persist() { ls('cc_mu_saved', JSON.stringify(saved)); }
var busy = false, obs = null, empty = el('p', 'sub', ''); empty.hidden = true;
grid.insertAdjacentElement('afterend', empty);

function decorate() {
  if (busy) return; busy = true;
  try {
    var shown = 0, cards = [].slice.call(grid.children).filter(function (c) { return c.classList.contains('mc'); });
    cards.forEach(function (c) {
      var id = c.dataset.id;
      if (!c.querySelector('.mu-heart')) {
        var h = el('button', 'mu-heart'); h.type = 'button'; h.innerHTML = ICON.heart; h.setAttribute('aria-label', 'Save item'); h.dataset.id = id; c.appendChild(h);
        var a = el('button', 'mu-add', '+'); a.type = 'button'; a.setAttribute('aria-label', 'View and buy'); c.appendChild(a);
      }
      c.querySelector('.mu-heart').classList.toggle('on', !!saved[id]);
      var l = LM[id], hide = false;
      if (cur === 'Saved') hide = !saved[id];
      else if (cur !== 'All') hide = !(l && String(l.category || 'General').toLowerCase() === cur.toLowerCase());
      c.classList.toggle('mu-hide', hide);
      if (!hide && c.style.display !== 'none') shown++;
    });
    empty.hidden = !(cards.length && !shown && (cur !== 'All'));
    empty.textContent = cur === 'Saved' ? 'No saved items yet. Tap the heart on an item to keep it here.' : 'No ' + cur.toLowerCase() + ' items yet.';
  } finally { if (obs) obs.takeRecords(); busy = false; }
}
// heart: toggle without opening the item; + button falls through to the card click (opens the item to buy)
grid.addEventListener('click', function (e) {
  var h = e.target.closest('.mu-heart'); if (!h) return;
  e.stopPropagation(); e.preventDefault();
  if (saved[h.dataset.id]) delete saved[h.dataset.id]; else saved[h.dataset.id] = 1;
  persist(); decorate();
  try { if (typeof toast === 'function') toast(saved[h.dataset.id] ? 'Saved' : 'Removed from saved'); } catch (x) {}
}, true);

obs = new MutationObserver(decorate); obs.observe(grid, { childList: true });
decorate();
})();
