/* cc-live-strip.js v1: "Live now" circles at the top of Home, above the Stories row.
   Anyone who opens the site sees who is live right now: the host's picture with a red LIVE ring, the biggest lives first.
   Tap a circle to join that live. Nothing shows when nobody is live.
   Data: GET /api/live (public). Loaded after cc-live.js and cc-stories.js. All text goes in with textContent, never as HTML. */
(function () {
  'use strict';
  if (window.__ccLiveStrip) return; window.__ccLiveStrip = 1;

  var LIST = [], box = null, row = null, head = null, busy = false, lastAt = 0;
  var AVATAR = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
  var POLL_MS = 30000;

  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function call(p, o) { return window.CC ? CC.call(p, o) : Promise.reject(new Error('not ready')); }
  function compact(n) { n = +n || 0; return n >= 1000 ? (Math.round(n / 100) / 10) + 'K' : String(n); }

  /* ---------- styles ---------- */
  var css = el('style');
  css.textContent = [
    '#ccl-strip{margin:0 0 6px}',
    '#ccl-strip.solo{max-width:680px;margin:0 auto;padding:84px 6vw 0;box-sizing:border-box}',
    '.cls-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 2px 8px}',
    '.cls-t{display:inline-flex;align-items:center;gap:8px;font:800 14px Manrope,Poppins,sans-serif;letter-spacing:-.01em;color:var(--fg,#16130f)}',
    '.cls-dot{width:9px;height:9px;border-radius:50%;background:#d9334a;box-shadow:0 0 0 0 rgba(217,51,74,.55);animation:clsp 1.6s infinite}',
    '@keyframes clsp{70%{box-shadow:0 0 0 8px rgba(217,51,74,0)}100%{box-shadow:0 0 0 0 rgba(217,51,74,0)}}',
    '.cls-all{all:unset;cursor:pointer;font:700 12px Manrope,Poppins,sans-serif;color:var(--mut,#6b645c);padding:6px 4px}',
    '.cls-all:focus-visible,.cls-b:focus-visible .cls-ring{outline:2px solid var(--fg,#16130f);outline-offset:3px}',
    '.cls-row{display:flex;gap:14px;overflow-x:auto;scrollbar-width:none;padding:4px 2px 10px;margin:0 -2px;-webkit-overflow-scrolling:touch}',
    '.cls-row::-webkit-scrollbar{display:none}',
    '.cls-b{all:unset;box-sizing:border-box;cursor:pointer;flex:none;width:74px;display:flex;flex-direction:column;align-items:center;gap:5px;color:var(--fg,#16130f);-webkit-tap-highlight-color:transparent}',
    '.cls-ring{position:relative;width:70px;height:70px;border-radius:50%;padding:3px;box-sizing:border-box;background:conic-gradient(from 200deg,#d9334a,#ff8a3d,#ffd9b8,#ff8a3d,#d9334a);transition:transform .15s}',
    '.cls-b:active .cls-ring{transform:scale(.94)}',
    '.cls-in{width:100%;height:100%;border-radius:50%;border:3px solid var(--bg,#fbf1ed);box-sizing:border-box;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#ffa05a,#c4727a);color:#16130f;font:800 22px Manrope,Poppins,sans-serif}',
    '.cls-in img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}',
    '.cls-pill{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);background:#d9334a;color:#fff;font:800 9px Manrope,Poppins,sans-serif;letter-spacing:.08em;padding:2px 7px;border-radius:999px;border:2px solid var(--bg,#fbf1ed);line-height:1.2}',
    '.cls-lb{max-width:74px;font:700 11px/1.25 Manrope,Poppins,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px}',
    '.cls-vw{font:600 10px/1 Manrope,Poppins,sans-serif;color:var(--mut,#6b645c)}',
    '@media (prefers-reduced-motion:reduce){.cls-dot{animation:none}}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- build and mount ---------- */
  function build() {
    box = el('section'); box.id = 'ccl-strip'; box.setAttribute('aria-label', 'Live now'); box.hidden = true;
    head = el('div', 'cls-h');
    var t = el('span', 'cls-t'); t.appendChild(el('i', 'cls-dot')); t.appendChild(el('span', '', 'Live now')); t.lastChild.id = 'cls-n';
    var all = el('button', 'cls-all', 'See all'); all.type = 'button'; all.onclick = function () { try { go('live'); } catch (e) {} };
    head.appendChild(t); head.appendChild(all);
    row = el('div', 'cls-row'); row.setAttribute('role', 'list');
    box.appendChild(head); box.appendChild(row);
  }
  function mount() {
    if (!box) build();
    var tray = document.getElementById('ccs-tray');
    if (box.isConnected && (!tray || box.parentNode === tray)) return true;
    if (tray) { box.classList.remove('solo'); tray.insertBefore(box, tray.firstChild); return true; }       // right above the Stories circles
    var feed = document.getElementById('v-feed'), hero = feed && feed.querySelector('.hero');
    if (feed && hero) { box.classList.add('solo'); feed.insertBefore(box, hero); return true; }            // Stories not there: still show it
    return false;
  }

  /* ---------- draw ---------- */
  function circle(s, i) {
    var h = (s.host && s.host.handle) || 'Comrade';
    var b = el('button', 'cls-b'); b.type = 'button'; b.setAttribute('role', 'listitem');
    b.setAttribute('aria-label', h + ' is live: ' + (s.title || 'Live') + '. ' + (s.viewers || 0) + ' watching. Tap to join.');
    var ring = el('span', 'cls-ring'), inn = el('span', 'cls-in');
    var av = s.host && s.host.avatar;
    if (av && AVATAR.test(av)) { var im = new Image(); im.alt = ''; im.decoding = 'async'; im.src = av; inn.appendChild(im); }
    else inn.textContent = String(h).replace(/^@/, '').charAt(0).toUpperCase() || 'C';
    ring.appendChild(inn); ring.appendChild(el('span', 'cls-pill', 'LIVE'));
    b.appendChild(ring);
    b.appendChild(el('span', 'cls-lb', '@' + String(h).replace(/^@/, '')));
    b.appendChild(el('span', 'cls-vw', compact(s.viewers) + ' watching'));
    b.onclick = function () { open(s); };
    return b;
  }
  function draw() {
    if (!mount()) return;
    row.textContent = '';
    LIST.slice(0, 12).forEach(function (s, i) { row.appendChild(circle(s, i)); });
    var n = document.getElementById('cls-n'); if (n) n.textContent = 'Live now' + (LIST.length > 1 ? ' · ' + LIST.length : '');
    box.hidden = !LIST.length;
    try { window.dispatchEvent(new Event('cc-live-updated')); } catch (e) {}
  }

  /* ---------- open a live ---------- */
  function open(s) {
    try {
      var me = window.ccLiveMe && window.ccLiveMe();
      if (me && me.id === s.id) { go('live'); return; }                  // my own live is already running: just go back to it
      go('live');
      setTimeout(function () { try { openRoom(s); } catch (e) { go('live'); } }, 250);
    } catch (e) {}
  }

  /* ---------- fetch ---------- */
  function load(force) {
    if (busy || document.hidden) return;
    if (!force && Date.now() - lastAt < 8000) return;
    busy = true;
    call('/api/live', { auth: false }).then(function (d) {
      LIST = (d && d.streams) || []; lastAt = Date.now(); draw();
    }).catch(function () {}).then(function () { busy = false; });
  }
  window.ccLiveStrip = { refresh: function () { load(true); }, list: function () { return LIST.slice(); } };

  function onFeed() { return (document.body.dataset.view || 'feed') === 'feed'; }
  function start() {
    mount(); load(true);
    setInterval(function () { mount(); if (onFeed()) load(false); }, POLL_MS);
    try { new MutationObserver(function () { if (onFeed()) { mount(); load(false); } }).observe(document.body, { attributes: true, attributeFilter: ['data-view'] }); } catch (e) {}
    document.addEventListener('visibilitychange', function () { if (!document.hidden && onFeed()) load(false); });
    window.addEventListener('cc-live-changed', function () { setTimeout(function () { load(true); }, 700); });
    var n = 0, iv = setInterval(function () { mount(); if (++n > 40) clearInterval(iv); }, 500);   // the Stories tray mounts a little later
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
