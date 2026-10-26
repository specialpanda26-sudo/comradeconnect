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
var css = "/*mu2*/\n#v-market{padding:4px 0 26px;margin-top:6px;color:var(--fg)}\n#v-market>.ph,#v-market>.sub:first-of-type{display:none}\n.mu-top{display:flex;align-items:center;gap:12px;margin-bottom:14px}\n.mu-pin,.mu-bell{width:44px;height:44px;border-radius:50%;background:var(--g);border:1px solid var(--gb);display:grid;place-items:center;flex:none;color:var(--fg);cursor:pointer;padding:0}\n.mu-pin svg,.mu-bell svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}\n.mu-loc{flex:1;min-width:0}.mu-loc small{display:block;font-size:11px;color:var(--mut)}.mu-loc b{display:block;font:700 15px var(--disp);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--fg)}\n.mu-cats{display:flex;gap:8px;overflow-x:auto;padding:2px 0 8px;margin:0 0 10px;scrollbar-width:none}.mu-cats::-webkit-scrollbar{display:none}\n.mu-cat{all:unset;cursor:pointer;flex:none;display:inline-flex;align-items:center;padding:10px 18px;border-radius:999px;background:var(--g);border:1px solid var(--gb);color:var(--mut);font:600 12.5px Poppins,sans-serif;white-space:nowrap}\n.mu-cat.on{background:var(--ink);color:var(--inkfg);border-color:var(--ink)}\n.mu-ci{width:18px;height:18px;object-fit:contain;margin-right:8px}\n#v-market #mbrowse>.fld{display:flex;align-items:center;background:var(--soft);border-radius:999px;padding:0 18px;margin-bottom:14px}\n#v-market #mkq{flex:1;border:0;background:transparent;color:var(--fg);padding:14px 0;font-size:14px;outline:none;border-radius:0}\n.mu-ban{position:relative;overflow:hidden;border-radius:28px;padding:20px;min-height:160px;background:var(--aq);color:var(--nt);margin-bottom:14px}\n.mu-ban .tag{display:inline-flex;font-size:10.5px;font-weight:600;padding:4px 12px;border-radius:999px;background:var(--nt);color:var(--aq)}\n.mu-ban h4{margin:12px 0 4px;font:700 20px/1.2 var(--disp);color:var(--nt);max-width:58%}\n.mu-ban p{margin:0 0 14px;font-size:12px;color:rgba(16,20,34,.7);max-width:56%;line-height:1.45}\n.mu-ban button{all:unset;cursor:pointer;background:var(--nt);color:var(--aq);font-size:13px;font-weight:600;padding:10px 20px;border-radius:999px}\n.mu-ban .art{position:absolute;right:8px;bottom:0;height:86%;width:auto;max-width:44%;object-fit:contain}\n.mu-h{display:flex;justify-content:space-between;align-items:baseline;margin:6px 2px 10px}.mu-h b{font:700 15px var(--disp)}.mu-h span{font-size:12px;color:var(--mut);cursor:pointer}\n#v-market .mgrid{gap:12px}\n#v-market .mgrid .mc{position:relative;background:var(--g)!important;border:1px solid var(--gb);border-radius:28px;box-shadow:none;padding:10px 10px 12px;overflow:hidden;color:var(--fg)}\n#v-market .mgrid .mc::before,#v-market .mgrid .mc::after{display:none!important}\n#v-market .mgrid .mc .mm{position:relative;width:100%;aspect-ratio:1/1!important;object-fit:cover;border-radius:20px;background:var(--soft)!important}\n#v-market .mgrid .mc .mm.poster{background:var(--soft)!important;color:var(--mut);align-content:center;text-align:center}\n#v-market .mgrid .mc .mb{position:static;background:none!important;border:0;-webkit-backdrop-filter:none;backdrop-filter:none;padding:10px 2px 0;color:var(--fg);display:block;min-height:76px}\n#v-market .mgrid .mc .mb b{color:var(--fg);font-size:14px;font-weight:600;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}\n#v-market .mgrid .mc .mb small{color:var(--mut);font-size:10.5px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}\n#v-market .mgrid .mc .mb small.mtl{display:none!important}\n#v-market .mgrid .mc .mb .ccrt{color:var(--fg);font-size:11px}\n#v-market .mgrid .mc .mb em{position:absolute;left:14px;bottom:14px;font-style:normal;font:700 16px var(--disp);color:var(--fg);margin:0}\n#v-market .mgrid .mc .ccpr,#v-market .mgrid .mc .badge{background:var(--aq);color:var(--nt);border:0;font-size:9.5px}\n.mu-heart,.mu-add{position:absolute;z-index:4;border:0;cursor:pointer;display:grid;place-items:center;padding:0}\n.mu-heart{top:16px;left:16px;width:32px;height:32px;border-radius:50%;background:rgba(16,20,34,.6);color:#FFFFFF}\n.mu-heart svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}\n.mu-heart.on{background:var(--aq);color:var(--nt)}.mu-heart.on svg{fill:currentColor}\n.mu-add{right:12px;bottom:12px;width:40px;height:40px;border-radius:50%;background:var(--ink);color:var(--inkfg);font-size:24px;line-height:1;transition:transform .12s}.mu-add:active{transform:scale(.88)}\n#v-market .mgrid .mc.mu-hide{display:none!important}\nhtml[data-lay=\"desktop\"] #v-market{padding:24px 22px 30px}\n";
var st = el('style'); st.id = 'mu-css'; st.textContent = css; document.head.appendChild(st);

var ICON = {
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.6"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg>'
};
var CATS = ['All', 'Electronics', 'Books', 'Clothes', 'Furniture', 'Food', 'Services', 'Saved'];

var browse = $('#mbrowse'), grid = $('#mgrid'), q = $('#mkq');
var cur = 'All', LM = {}, saved = {};
try { saved = JSON.parse(ls('cc_mu_saved') || '{}') || {}; } catch (e) { saved = {}; }

/* header: location + bell */
var top = el('div', 'mu-top'), pin = el('span', 'mu-pin'), loc = el('div', 'mu-loc'), bell = el('button', 'mu-bell');
pin.innerHTML = ICON.pin; bell.innerHTML = ICON.bell; bell.type = 'button'; bell.setAttribute('aria-label', 'Notifications');
loc.appendChild(el('small', '', 'Location')); loc.appendChild(el('b', '', 'Kirinyaga University'));
top.appendChild(pin); top.appendChild(loc);
V.insertBefore(top, V.firstChild);
bell.onclick = function () { var b = document.querySelector('#nb, #bellbtn, [data-v="notifs"], .nbell, #cc-bell'); if (b) b.click(); };

/* category tiles */
var cats = el('div', 'mu-cats'); cats.setAttribute('role', 'tablist');
CATS.forEach(function (c) {
  var b = el('button', 'mu-cat' + (c === 'All' ? ' on' : '')); b.type = 'button'; b.dataset.c = c;
  var im = document.createElement('img'); im.className = 'mu-ci'; im.alt = ''; im.onerror = function () { im.remove(); }; im.src = 'img/cat-' + c.toLowerCase() + '.webp'; b.appendChild(im); b.appendChild(document.createTextNode(c === 'Electronics' ? 'Tech' : c));
  cats.appendChild(b);
});
top.insertAdjacentElement('afterend', cats);

/* promo banner + section title, placed under the search box */
var fld = q && q.closest('.fld');
q.placeholder = 'Search beds, fridges, books...';
var ban = el('div', 'mu-ban');
var tg = el('span', 'tag', 'Campus picks'); ban.appendChild(tg);
ban.appendChild(el('h4', '', 'Back to routine')); ban.appendChild(el('p', '', 'Everything a comrade needs, from room basics to study gear.'));
var sn = el('button', '', 'Shop now'); sn.type = 'button'; ban.appendChild(sn);
var art = document.createElement('img'); art.className = 'art'; art.alt = ''; art.onerror = function () { art.remove(); }; art.src = 'img/market-banner.webp'; ban.appendChild(art);
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
