/* cc-zonesuggest.js: "Best zones" around your university.
   - A "Best zones" chip sits next to the university chip on the Feed ("Kirinyaga University . Change").
   - After you pick a university in the picker, this sheet opens once for that university.
   - Pick how far to look: 10 m up to 20 km, or type your own number of metres.
   - Asks the server (/api/zones/suggest), which ranks places by where students live: hostel and room posts, Wi-Fi, services and mapped homes.
   The score is a "student signal" from 0 to 100, an estimate, not a head-count. All words from the server are inserted with textContent, never as HTML. */
(function () {
  'use strict';
  var API = function () { return (typeof CC_API !== 'undefined' && CC_API) || ''; };
  var RADII = [[10, '10 m'], [100, '100 m'], [500, '500 m'], [1000, '1 km'], [2000, '2 km'], [5000, '5 km']];
  var STEPS = [100, 500, 1000, 2000, 5000, 10000, 20000];
  var open = false, here = null, radius = 2000, memo = {}, pushed = false, root = null;

  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function campus() { var c = ls('cc_campus'); if (!c || c === 'all') c = ls('cc_campus_home') || (c === 'all' ? '' : 'kirinyaga'); return c; }
  function fmt(m) { return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m % 1000 ? 1 : 0) + ' km'; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }

  var st = document.createElement('style');
  st.textContent = '#cczs{position:fixed;inset:0;z-index:99990;background:rgba(5,8,18,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:flex;align-items:flex-end;animation:cczsf .2s ease}'
    + '@keyframes cczsf{from{opacity:0}to{opacity:1}}@keyframes cczsu{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}'
    + '#cczs .sh{width:100%;max-height:92vh;display:flex;flex-direction:column;box-sizing:border-box;padding:6px 18px calc(18px + env(safe-area-inset-bottom,0px));border-radius:24px 24px 0 0;background:var(--bg,#101422);color:var(--fg,#fff);border-top:1px solid var(--line,rgba(255,255,255,.16));box-shadow:0 -12px 40px rgba(0,0,0,.35);animation:cczsu .26s cubic-bezier(.2,.8,.2,1)}'
    + '#cczs .hd{display:flex;align-items:flex-start;gap:6px;padding:10px 0 4px}#cczs .hd>div{flex:1;min-width:0}'
    + '#cczs h2{margin:0;font-size:19px;line-height:1.25}#cczs .sub{margin:3px 0 0;font-size:13px;opacity:.7;line-height:1.45}'
    + '#cczs .px{all:unset;box-sizing:border-box;cursor:pointer;font:400 30px/1 system-ui,sans-serif;padding:2px 8px;color:inherit;opacity:.8}#cczs .px:active{opacity:.4}'
    + '#cczs .rr{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 6px}'
    + '#cczs .ch{all:unset;box-sizing:border-box;cursor:pointer;padding:8px 11px;border-radius:999px;border:1px solid var(--line,rgba(255,255,255,.2));font:600 12.5px Poppins,system-ui,sans-serif;color:inherit}'
    + '#cczs .ch.on{background:var(--g,rgba(255,255,255,.14));border-color:currentColor}'
    + '#cczs .cu{display:flex;gap:8px;align-items:center;margin:4px 0 6px}#cczs .cu input{flex:1;min-width:0;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid var(--line,rgba(255,255,255,.2));background:transparent;color:inherit;font:15px Poppins,system-ui,sans-serif;outline:none}'
    + '#cczs .cu span{font-size:13px;opacity:.7}'
    + '#cczs .ls{overflow:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:10px;margin-top:8px;min-height:90px;padding-bottom:4px}'
    + '#cczs .it{display:grid;grid-template-columns:30px 1fr auto;gap:2px 10px;align-items:center;padding:12px 14px;border-radius:16px;border:1px solid var(--line,rgba(255,255,255,.14));background:var(--g,rgba(255,255,255,.05))}'
    + '#cczs .rk{grid-row:1/4;align-self:start;margin-top:2px;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;font:700 13px Poppins,system-ui,sans-serif;border:1px solid var(--line,rgba(255,255,255,.2))}'
    + '#cczs .nm{font-weight:700;font-size:15px;overflow-wrap:anywhere}#cczs .zmt{font-size:12px;opacity:.7;grid-column:2/4}'
    + '#cczs .bar{grid-column:2/4;height:6px;border-radius:6px;background:var(--line,rgba(255,255,255,.12));overflow:hidden;margin:6px 0 2px}#cczs .bar i{display:block;height:100%;border-radius:6px;background:currentColor;opacity:.85}'
    + '#cczs .tg{grid-column:2/4;display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}#cczs .tg b{font-weight:500;font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid var(--line,rgba(255,255,255,.18));opacity:.85}'
    + '#cczs .sc{font:700 15px Poppins,system-ui,sans-serif;text-align:right}#cczs .sc small{display:block;font:500 10px Poppins,system-ui,sans-serif;opacity:.6}'
    + '#cczs a.mp{grid-column:2/4;font-size:12px;color:inherit;opacity:.8;margin-top:6px;text-decoration:underline}'
    + '#cczs .msg{margin:14px 2px;font-size:14px;line-height:1.5;opacity:.85}#cczs .ft{margin:10px 2px 0;font-size:11px;opacity:.55;line-height:1.5}'
    + '#cczs .go{all:unset;box-sizing:border-box;cursor:pointer;padding:10px 16px;border-radius:12px;border:1px solid currentColor;font:600 13px Poppins,system-ui,sans-serif;text-align:center}'
    + '#cczs .wv{display:flex;gap:7px;justify-content:center;padding:26px 0}#cczs .wv i{width:9px;height:9px;border-radius:50%;background:currentColor;animation:cczsw 1.1s ease-in-out infinite}'
    + '#cczs .wv i:nth-child(2){animation-delay:.1s}#cczs .wv i:nth-child(3){animation-delay:.2s}#cczs .wv i:nth-child(4){animation-delay:.3s}#cczs .wv i:nth-child(5){animation-delay:.4s}'
    + '@keyframes cczsw{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-9px);opacity:1}}'
    + '@media (prefers-reduced-motion:reduce){#cczs,#cczs .sh,#cczs .wv i{animation:none}}'
    + '.ccc-zchip{margin-left:6px}';
  document.head.appendChild(st);

  function close(fromPop) {
    if (!open) return;
    open = false; if (root) { root.remove(); root = null; }
    if (pushed && !fromPop) { pushed = false; try { history.back(); } catch (e) {} } else pushed = false;
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  window.addEventListener('popstate', function () { if (open) { pushed = false; close(true); } });

  function show() {
    if (open) return; open = true;
    var id = campus(), name = ls('cc_campus_name') || 'your university';
    root = el('div'); root.id = 'cczs'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Best zones around your university');
    root.addEventListener('click', function (e) { if (e.target === root) close(); });
    var sh = el('div', 'sh'), hd = el('div', 'hd');
    var back = el('button', 'px', '\u2039'); back.type = 'button'; back.setAttribute('aria-label', 'Back'); back.onclick = function () { close(); };
    var mid = el('div'), h = el('h2', '', 'Best zones near ' + (ls('cc_campus_short') || name));
    var sub = el('p', 'sub', 'Where most students live around ' + name + '. Pick how far to look.');
    mid.appendChild(h); mid.appendChild(sub);
    var x = el('button', 'px', '\u00d7'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.onclick = function () { close(); };
    hd.appendChild(back); hd.appendChild(mid); hd.appendChild(x); sh.appendChild(hd);

    var rr = el('div', 'rr'), cu = el('div', 'cu'), list = el('div', 'ls'), foot = el('p', 'ft');
    var inp = el('input'); inp.type = 'number'; inp.min = '10'; inp.max = '20000'; inp.step = '10'; inp.inputMode = 'numeric'; inp.placeholder = 'Your own distance'; inp.setAttribute('aria-label', 'Distance in metres');
    var go = el('button', 'go', 'Show'); go.type = 'button';
    var lb = el('button', 'go', 'Use my exact location'); lb.type = 'button'; lb.style.margin = '10px 0 0'; lb.style.width = '100%';
    var lm = el('p', 'sub'); lm.hidden = true;
    lb.onclick = function () {
      if (here) { here = null; lb.textContent = 'Use my exact location'; lm.hidden = true; load(); return; }
      if (!navigator.geolocation) { lm.hidden = false; lm.textContent = 'This phone cannot share its location.'; return; }
      lm.hidden = false; lm.textContent = 'Finding where you are...';
      navigator.geolocation.getCurrentPosition(function (p) { here = { lat: p.coords.latitude, lng: p.coords.longitude }; lb.textContent = 'Back to the university'; lm.textContent = 'Scanning around you (about ' + Math.round(p.coords.accuracy || 0) + ' m accurate).'; load(); },
        function (e) { lm.textContent = e && e.code === 1 ? 'Location is blocked. Allow it in your browser settings.' : 'Could not get your location. Try again outside or near a window.'; }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    };
    cu.appendChild(inp); cu.appendChild(el('span', '', 'metres')); cu.appendChild(go);
    function chips() {
      rr.textContent = '';
      RADII.forEach(function (r) { var b = el('button', 'ch' + (r[0] === radius ? ' on' : ''), r[1]); b.type = 'button'; b.onclick = function () { pick(r[0]); }; rr.appendChild(b); });
    }
    function pick(r) { radius = Math.max(10, Math.min(20000, Math.round(r))); inp.value = ''; chips(); load(); }
    go.onclick = function () { var v = Number(inp.value); if (!isFinite(v) || v < 10) { inp.focus(); return; } pick(v); };
    var tm; inp.oninput = function () { clearTimeout(tm); tm = setTimeout(function () { var v = Number(inp.value); if (isFinite(v) && v >= 10) pick(v, true); }, 600); };
    inp.onkeydown = function (e) { if (e.key === 'Enter') go.onclick(); };
    sh.appendChild(lb); sh.appendChild(lm); sh.appendChild(rr); sh.appendChild(cu); sh.appendChild(list); sh.appendChild(foot);
    root.appendChild(sh); document.body.appendChild(root);
    document.addEventListener('keydown', onKey);
    try { history.pushState({ ccz: 1 }, ''); pushed = true; } catch (e) { pushed = false; }
    chips();

    function say(t, extra) { list.textContent = ''; var p = el('p', 'msg', t); list.appendChild(p); if (extra) list.appendChild(extra); }
    function wave() { list.textContent = ''; var w = el('div', 'wv'); for (var i = 0; i < 5; i++) w.appendChild(el('i')); w.setAttribute('role', 'status'); w.setAttribute('aria-label', 'Finding zones'); list.appendChild(w); }
    function render(d) {
      list.textContent = ''; foot.textContent = '';
      if (d.campus && d.campus.name) { h.textContent = 'Best zones near ' + (d.campus.short || d.campus.name); sub.textContent = 'Top places where students live ' + (d.center && d.center.me ? 'around you' : 'around ' + d.campus.name) + ', within ' + fmt(d.radius_m) + '.'; }
      if (!d.zones.length) {
        var n = d.nearest_outside, step = n && STEPS.filter(function (s) { return s >= n.distance_m; })[0];
        var btn = null;
        if (step && step > d.radius_m) { btn = el('button', 'go', 'Look within ' + fmt(step)); btn.type = 'button'; btn.onclick = function () { pick(step); }; }
        else if (!n && d.radius_m < 20000) { btn = el('button', 'go', 'Look wider'); btn.type = 'button'; btn.onclick = function () { pick(Math.min(20000, d.radius_m * 4)); }; }
        say('No zones found within ' + fmt(d.radius_m) + '.' + (n ? ' The closest is ' + (n.name || 'an unnamed area') + ', ' + fmt(n.distance_m) + ' away.' : ''), btn);
      }
      d.zones.forEach(function (z, i) {
        var it = el('div', 'it');
        it.appendChild(el('div', 'rk', String(i + 1)));
        it.appendChild(el('div', 'nm', z.name || 'Unnamed busy area'));
        var sc = el('div', 'sc', String(z.score)); sc.appendChild(el('small', '', 'student signal')); it.appendChild(sc);
        it.appendChild(el('div', 'zmt', (z.distance_m != null ? fmt(z.distance_m) + (z.direction ? ' ' + z.direction : '') + (d.center && d.center.me ? ' from you' : ' from campus') : 'Distance not known') + (z.existing ? ' \u00b7 already a zone' : '')));
        var bar = el('div', 'bar'), fill = el('i'); fill.style.width = Math.max(4, Math.min(100, z.score)) + '%'; bar.appendChild(fill); it.appendChild(bar);
        var e = z.evidence || {}, tg = el('div', 'tg'), add = function (n, one, many) { if (n > 0) tg.appendChild(el('b', '', n + ' ' + (n === 1 ? one : many))); };
        add(e.vacancies, 'vacancy post', 'vacancy posts'); add(e.hostel_reviews, 'hostel review', 'hostel reviews'); add(e.rooms, 'room post', 'room posts'); add(e.wifi, 'Wi-Fi spot', 'Wi-Fi spots'); add(e.services, 'service', 'services'); add(e.buildings, 'mapped home', 'mapped homes');
        if (!tg.children.length) tg.appendChild(el('b', '', z.saved ? 'Saved zone' : 'From the map'));
        it.appendChild(tg);
        if (z.lat != null) { var a = el('a', 'mp', 'See on map'); a.href = 'https://www.google.com/maps/search/?api=1&query=' + z.lat + ',' + z.lng; a.target = '_blank'; a.rel = 'noopener noreferrer'; it.appendChild(a); }
        list.appendChild(it);
      });
      foot.textContent = 'The student signal is an estimate from posts in this app and mapped homes. It is not a head-count.' + (d.attribution ? ' ' + d.attribution + '.' : '') + (d.sources && d.sources.map === 'unavailable' ? ' The map was not reachable, so this list uses app activity only.' : '');
    }
    function load() {
      if (!id) { var b = el('button', 'go', 'Choose a university'); b.type = 'button'; b.onclick = function () { close(); if (window.ccChangeCampus) window.ccChangeCampus(); }; say('Pick one university first, then we can find its zones.', b); return; }
      var key = id + ':' + radius + ':' + (here ? here.lat.toFixed(4) + ',' + here.lng.toFixed(4) : ''); if (memo[key]) return render(memo[key]);
      wave();
      var mine = radius;
      fetch(API() + '/api/zones/suggest?campus=' + encodeURIComponent(id) + '&radius=' + radius + '&limit=7' + (here ? '&lat=' + here.lat + '&lng=' + here.lng : '')).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); }).then(function (o) {
        if (!open || mine !== radius) return;
        if (!o.ok) { say((o.d && o.d.error) || 'Could not find zones right now.'); return; }
        memo[key] = o.d; render(o.d);
      }).catch(function () {
        if (!open || mine !== radius) return;
        var b = el('button', 'go', 'Try again'); b.type = 'button'; b.onclick = load; say('Could not load zones. Check your internet and try again.', b);
      });
    }
    load();
  }
  window.ccZoneSuggest = show;

  /* the chip next to "Kirinyaga University . Change" */
  function chip() {
    var c = document.getElementById('ccLocChip'); if (!c || document.getElementById('ccZoneChip')) return;
    var b = el('button', 'ccc-chip ccc-zchip'); b.id = 'ccZoneChip'; b.type = 'button'; b.setAttribute('aria-label', 'See the best zones around your university');
    b.appendChild(el('span', '', 'Best zones')); b.onclick = show;
    c.parentNode.insertBefore(b, c.nextSibling);
  }
  /* opens once, right after you switch university (cc-campus.js leaves a note) */
  function auto() {
    var p = ls('cc_zs_pending'); if (!p) return;
    try { localStorage.removeItem('cc_zs_pending'); } catch (e) {}
    if (p !== ls('cc_campus') || p === 'all') return;
    var n = 0; (function w() { if ((document.getElementById('ccgate') || document.getElementById('cccov')) && n++ < 100) return setTimeout(w, 300); setTimeout(show, 700); })();
  }
  function start() {
    chip(); var t = 0; new MutationObserver(function () { clearTimeout(t); t = setTimeout(chip, 60); }).observe(document.body, { childList: true, subtree: true });
    auto();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
