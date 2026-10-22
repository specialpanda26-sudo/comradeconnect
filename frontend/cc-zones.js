/* cc-zones.js: comrades can add their OWN zone (hostel, plot, estate) anywhere a zone is picked.
   - Every zone drop-down (Drop your tea, Market, roommates, Hearts, Wi-Fi, hostels, services, zone rating) ends with "+ Add my own zone".
   - The zone filter chips (Feed and Explore) end with a "+ Zone" chip.
   - A small popup lets them type the name, and lists the zones they added so they can remove them again.
   Custom zones live on this phone (localStorage 'cc_zones') and are merged into the shared ZONES list, so they show up in every picker and filter.
   Colours come from the theme variables, so the popup is right in both light and dark mode. Also keeps the browser chrome (theme-color, native controls) in step with the theme. */
(function () {
  'use strict';
  if (window.__ccZones) return; window.__ccZones = 1;

  var KEY = 'cc_zones', MAX = 12, ADD = '__ccaddzone';
  var Z = (typeof ZONES !== 'undefined' && Array.isArray(ZONES)) ? ZONES : null;
  if (!Z) return;
  var BASE = Z.slice();                                  // the list from the app / server, without our additions
  var SKIP_IDS = { cdz: 1 };                             // delivery zone: sellers really deliver there, keep it to the real list
  var IDS = { sz: 1, mzo: 1, rmz: 1, htz: 1, rz: 1, wz: 1, x_wz: 1, x_hz: 1, x_sz: 1, hs_z: 1, wf_zn: 1, wf_zn2: 1 };

  function load() { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(function (n) { return typeof n === 'string' && n; }) : []; } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  var C = load();
  var same = function (a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(t) { try { if (typeof toast === 'function') toast(t); } catch (e) {} }

  /* keep the shared list = server/base zones + my zones (the server list replaces ZONES after the app loads, then calls ccDrawZones) */
  function merge() {
    var out = BASE.slice();
    C.forEach(function (c) { if (!out.some(function (z) { return same(z, c); })) out.push(c); });
    Z.splice(0, Z.length); out.forEach(function (z) { Z.push(z); });
  }
  merge();
  var draw0 = window.ccDrawZones;
  window.ccDrawZones = function () { BASE = Z.slice(); merge(); if (typeof draw0 === 'function') draw0.apply(this, arguments); queue(); };
  window.ccCustomZones = function () { return C.slice(); };

  /* ---------- styles (theme variables only) ---------- */
  var st = document.createElement('style');
  st.textContent = [
    ':root{color-scheme:dark}:root[data-theme="light"]{color-scheme:light}',
    '.cczo{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);overflow:auto}',
    ':root[data-theme="light"] .cczo{background:rgba(255,255,255,.55)}',
    '.cczb{width:min(380px,100%);max-height:90vh;overflow:auto;border-radius:22px;padding:22px;background:var(--bg,#000);color:var(--fg,#fff);border:1px solid var(--gb,rgba(255,255,255,.22));box-shadow:var(--sh,0 10px 30px rgba(0,0,0,.6));text-align:left}',
    '.cczb h3{margin:0 0 6px;font-size:18px}.cczb p{margin:0 0 12px;font-size:13px;line-height:1.5;color:var(--mut,#bdbdbd)}',
    '.cczb input{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:14px;border:1px solid var(--gb,rgba(255,255,255,.22));background:var(--g,rgba(255,255,255,.07));color:var(--fg,#fff);font:500 15px Poppins,system-ui,sans-serif;outline:none}',
    '.cczb input:focus{border-color:var(--fg,#fff)}.cczb input::placeholder{color:var(--mut,#bdbdbd);opacity:.8}',
    '.cczr{display:flex;gap:10px;margin-top:12px}.cczr button{flex:1;padding:13px;border-radius:14px;font:600 14px Poppins,system-ui,sans-serif;cursor:pointer;border:1px solid var(--gb,rgba(255,255,255,.22))}',
    '.cczr .go{background:var(--ink,#fff);color:var(--inkfg,#000);border-color:var(--ink,#fff)}.cczr .no{background:var(--g,rgba(255,255,255,.07));color:var(--fg,#fff)}',
    '.cczr button:disabled{opacity:.5}.ccze{min-height:18px;margin:8px 0 0!important;color:#f87171!important;font-size:12px!important}',
    '.cczl{margin-top:14px;border-top:1px solid var(--line,rgba(255,255,255,.14));padding-top:12px}.cczl small{display:block;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--mut,#bdbdbd);margin-bottom:6px}',
    '.cczi{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;font-size:14px}.cczi button{border:1px solid var(--gb,rgba(255,255,255,.22));background:var(--g,rgba(255,255,255,.07));color:var(--fg,#fff);border-radius:999px;padding:5px 14px;font:500 12px Poppins,system-ui,sans-serif;cursor:pointer}',
    '.tab.cczadd{border-style:dashed}'
  ].join('');
  document.head.appendChild(st);

  /* ---------- the popup ---------- */
  var open = null;
  function valid(n) {
    if (n.length < 2 || n.length > 30 || !/^[A-Za-z0-9][A-Za-z0-9 '&.-]*$/.test(n)) return 'Use 2 to 30 letters or numbers.';
    if (/\d{4,}/.test(n)) return 'Please do not put phone numbers in a zone name.';
    return '';
  }
  function add(name) {
    var n = name.trim().replace(/\s+/g, ' '), bad = valid(n); if (bad) return { error: bad };
    var ex = Z.find(function (z) { return same(z, n); });
    if (ex) return { name: ex, existed: true };
    if (C.length >= MAX) return { error: 'You can add up to ' + MAX + ' zones. Remove one first.' };
    C.push(n); save(C); merge(); redraw(); return { name: n };
  }
  function remove(n) {
    C = C.filter(function (c) { return !same(c, n); }); save(C); merge(); redraw(n);
  }
  function redraw(removed) {
    try { if (typeof draw0 === 'function') draw0(); } catch (e) {}
    [].forEach.call(document.querySelectorAll('select'), function (s) {
      if (!isZoneSel(s)) return;
      if (removed) [].slice.call(s.options).forEach(function (o) { if (same(o.value || o.text, removed)) { var was = o.selected; o.remove(); if (was) s.selectedIndex = 0; } });
      sync(s);
    });
    chips();
  }
  function ask(done) {
    if (open) return;
    var ov = document.createElement('div'); ov.className = 'cczo'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Add your zone');
    function list() {
      return C.length ? '<div class="cczl"><small>Zones you added</small>' + C.map(function (c) { return '<div class="cczi"><span>@' + esc(c) + '</span><button type="button" data-rm="' + esc(c) + '">Remove</button></div>'; }).join('') + '</div>' : '';
    }
    function paint() {
      var keep = ov.querySelector('input'), v = keep ? keep.value : '';
      ov.innerHTML = '<div class="cczb"><h3>Add your zone</h3><p>Not on the list? Type your hostel, plot or estate. It shows up for you in every zone list and filter.</p>'
        + '<input id="cczi" maxlength="30" autocomplete="off" placeholder="e.g. Sunrise Hostel" aria-label="Your zone name">'
        + '<p class="ccze" id="ccze" role="alert"></p>'
        + '<div class="cczr"><button type="button" class="no" data-no>Cancel</button><button type="button" class="go" data-go>Add zone</button></div>' + list() + '</div>';
      var i = ov.querySelector('input'); i.value = v; if (keep) i.focus();
    }
    function shut(name) { ov.remove(); open = null; document.removeEventListener('keydown', esc2, true); if (done) done(name); }
    function esc2(e) { if (e.key === 'Escape') { e.stopPropagation(); shut(null); } }
    function go() {
      var i = ov.querySelector('#cczi'), r = add(i.value);
      if (r.error) { ov.querySelector('#ccze').textContent = r.error; return; }
      say(r.existed ? 'Already listed, selected for you' : 'Zone added'); shut(r.name);
    }
    ov.addEventListener('click', function (e) {
      var t = e.target;
      if (t === ov || (t.closest && t.closest('[data-no]'))) return shut(null);
      if (t.closest && t.closest('[data-go]')) return go();
      var rm = t.closest && t.closest('[data-rm]'); if (rm) { remove(rm.getAttribute('data-rm')); paint(); }
    });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'cczi') { e.preventDefault(); go(); } });
    document.addEventListener('keydown', esc2, true);
    paint(); document.body.appendChild(ov); open = ov;
    setTimeout(function () { var i = ov.querySelector('#cczi'); if (i) i.focus(); }, 30);
  }
  window.ccAskZone = ask;

  /* ---------- drop-downs ---------- */
  function isZoneSel(s) {
    if (!s || s.tagName !== 'SELECT' || SKIP_IDS[s.id]) return false;
    if (IDS[s.id] || /zone/i.test(s.getAttribute('aria-label') || '')) return true;
    var o = [].map.call(s.options, function (x) { return x.value || x.text; });
    return BASE.length > 1 && BASE.slice(0, 2).every(function (b) { return o.some(function (x) { return same(x, b); }); });
  }
  function needs(s) {
    if (!s.querySelector('option[value="' + ADD + '"]')) return true;
    return C.some(function (c) { return ![].some.call(s.options, function (o) { return same(o.value || o.text, c); }); });
  }
  function sync(s) {
    var cur = s.value, last = s.querySelector('option[value="' + ADD + '"]');
    C.forEach(function (c) {
      if ([].some.call(s.options, function (o) { return same(o.value || o.text, c); })) return;
      var o = new Option(c, c); if (last) s.insertBefore(o, last); else s.appendChild(o);
    });
    if (!last) s.appendChild(new Option('+ Add my own zone', ADD));
    if (cur && cur !== ADD && s.value !== cur) s.value = cur;
  }
  document.addEventListener('change', function (e) {
    var s = e.target; if (!s || s.tagName !== 'SELECT') return;
    if (s.value !== ADD) { s.__ccprev = s.value; return; }
    e.stopPropagation(); e.stopImmediatePropagation();
    var prev = s.__ccprev || (s.options[0] ? s.options[0].value : '');
    s.value = prev;
    ask(function (name) {
      if (name) { sync(s); s.value = name; s.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  }, true);
  document.addEventListener('focusin', function (e) { var s = e.target; if (s && s.tagName === 'SELECT' && s.value !== ADD) s.__ccprev = s.value; }, true);

  /* ---------- filter chips: a "+ Zone" chip at the end ---------- */
  function chips() {
    [].forEach.call(document.querySelectorAll('#zones, .tabs.z'), function (box) {
      if (!box.querySelector('.tab')) return;
      var add = box.querySelector('.cczadd');
      if (!add) { add = document.createElement('button'); add.type = 'button'; add.className = 'tab g cczadd'; add.setAttribute('aria-label', 'Add my own zone'); add.textContent = '+ Zone'; box.appendChild(add); }
      /* Explore builds its chips only when it draws; make sure my zones are there */
      if (box.querySelector('[data-xz]')) C.forEach(function (c) {
        if ([].some.call(box.querySelectorAll('[data-xz]'), function (t) { return same(t.dataset.xz, c); })) return;
        var t = document.createElement('button'); t.type = 'button'; t.className = 'tab g'; t.setAttribute('data-xz', c); t.textContent = c; box.insertBefore(t, add);
      });
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.cczadd'); if (!b) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    ask(function (name) { if (name) { var t = [].find.call(document.querySelectorAll('#zones .tab, .tabs.z .tab'), function (x) { return x.dataset.z === name || x.dataset.xz === name; }); if (t) t.click(); } });
  }, true);

  var q = 0;
  function queue() { if (q) return; q = requestAnimationFrame(function () { q = 0; scan(); }); }
  function scan() {
    [].forEach.call(document.querySelectorAll('select'), function (s) { if (isZoneSel(s) && needs(s)) sync(s); });
    chips();
  }
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  queue();

  /* ---------- theme: keep the browser chrome and native controls in step ---------- */
  var meta = document.querySelector('meta[name="theme-color"]');
  function theme() {
    var light = document.documentElement.dataset.theme === 'light';
    if (meta) meta.setAttribute('content', light ? '#ffffff' : '#0E0F0B');
  }
  theme();
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
