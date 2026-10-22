/* cc-stories.js: stories that disappear after 24 hours, shown as a row at the top of the Feed.
   Tap a circle to watch (tap the sides to move, hold to pause, swipe down to close). Everyone is shown by a made-up alias, never by name.
   All text goes in with textContent, never as HTML. */
(function () {
'use strict';
if (window.__ccStories) return; window.__ccStories = 1;

var PHOTO_MS = 5000, MAX_VIDEO = 25 * 1048576, MAX_EDGE = 1080;
var S = { groups: [], hours: 24, loaded: false, at: 0, busy: false };
var V = null;                                                     // the open viewer

function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function svg(d, w) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('width', w || 20); s.setAttribute('height', w || 20); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = d; return s; }
var I = { plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>', cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', img: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 9"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>' };
function tick() { var s = svg('<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M7.5 12.5l3 3 6-7" stroke="var(--bg,#101422)" stroke-width="2.2"/>', 14); s.setAttribute('aria-label', 'Verified'); s.style.cssText = 'margin-left:4px;vertical-align:-2px'; return s; }
function say(t) { try { if (typeof toast === 'function') toast(t); } catch (e) {} }
function call(p, o) { return window.CC ? CC.call(p, o) : Promise.reject(new Error('Not ready yet. Reload the page and try again.')); }
function connected() { return typeof CC_API === 'string' && CC_API.indexOf('YOUR-SUBDOMAIN') < 0; }
function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
function ago(ms) { var s = Math.max(1, Math.round((Date.now() - ms) / 1000)); return s < 60 ? 'now' : s < 3600 ? Math.round(s / 60) + 'm' : Math.round(s / 3600) + 'h'; }

/* ---------- styles ---------- */
var css = el('style');
css.textContent =
'#ccs-tray{max-width:680px;margin:0 auto;padding:84px 6vw 0}' +
'.ccs-on .hero{padding-top:28px}' +
'.ccs-row{display:flex;gap:14px;overflow-x:auto;scrollbar-width:none;padding:4px 2px 10px;margin:0 -2px;-webkit-overflow-scrolling:touch}.ccs-row::-webkit-scrollbar{display:none}' +
'.ccs-b{all:unset;box-sizing:border-box;cursor:pointer;flex:none;width:68px;display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--fg,#fff);-webkit-tap-highlight-color:transparent}' +
'.ccs-b:focus-visible .ccs-ring{outline:2px solid var(--fg,#fff);outline-offset:3px}' +
'.ccs-ring{position:relative;width:64px;height:64px;border-radius:50%;padding:3px;box-sizing:border-box;border:2px solid var(--fg,#fff);transition:transform .15s}.ccs-b:active .ccs-ring{transform:scale(.94)}' +
'.ccs-ring.seen{border-color:var(--line,rgba(255,255,255,.3))}.ccs-ring.add{border-style:dashed;border-color:var(--gb,rgba(255,255,255,.4))}' +
'.ccs-th{width:100%;height:100%;border-radius:50%;overflow:hidden;background:var(--g,rgba(255,255,255,.08));display:grid;place-items:center;color:var(--mut,#bdbdbd)}.ccs-th img,.ccs-th video{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}' +
'.ccs-pl{position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;border-radius:50%;background:var(--fg,#fff);color:var(--bg,#101422);display:grid;place-items:center;border:2px solid var(--bg,#101422)}' +
'.ccs-lb{max-width:68px;font-size:11px;line-height:1.3;color:var(--mut,#bdbdbd);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
'.ccs-hint{margin:0;font-size:12px;line-height:1.5;color:var(--mut,#bdbdbd)}' +
/* viewer */
'.ccs-v{position:fixed;inset:0;z-index:1000;background:#101422;display:flex;justify-content:center;color:#fff;touch-action:pan-y;animation:ccsin .22s ease}@keyframes ccsin{from{opacity:0}}' +
'@media (prefers-reduced-motion:reduce){.ccs-v{animation:none}}' +
'.ccs-st{position:relative;width:100%;max-width:480px;height:100%;background:#101422;overflow:hidden;user-select:none;-webkit-user-select:none}' +
'.ccs-st img,.ccs-st video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#101422}' +
'.ccs-top{position:absolute;left:0;right:0;top:0;z-index:3;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 28px;background:linear-gradient(rgba(16,20,34,.6),transparent)}' +
'.ccs-bars{display:flex;gap:4px}.ccs-bar{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.3);overflow:hidden}.ccs-bar i{display:block;height:100%;width:0;background:#A8DCE7}.ccs-bar.done i{width:100%}' +
'.ccs-hd{display:flex;align-items:center;gap:10px;margin-top:12px}.ccs-who{flex:1;min-width:0;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ccs-who small{font-weight:400;opacity:.7;margin-left:8px;font-size:12px}' +
'.ccs-ib{all:unset;cursor:pointer;width:40px;height:40px;display:grid;place-items:center;border-radius:50%;color:#fff}.ccs-ib:focus-visible,.ccs-act:focus-visible{outline:2px solid #fff;outline-offset:2px}' +
'.ccs-zone{position:absolute;top:84px;bottom:110px;z-index:2}.ccs-zone.l{left:0;width:32%}.ccs-zone.r{right:0;width:68%}' +
'.ccs-bt{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:40px 16px calc(env(safe-area-inset-bottom,0px) + 16px);background:linear-gradient(transparent,rgba(16,20,34,.7))}' +
'.ccs-cap{margin:0;font-size:15px;line-height:1.5;overflow-wrap:anywhere}.ccs-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;font-size:13px;opacity:.9}' +
'.ccs-act{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.4);color:#fff}' +
'.ccs-menu{position:absolute;right:12px;top:calc(env(safe-area-inset-top,0px) + 66px);z-index:5;background:#101422;border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:4px;min-width:160px}' +
'.ccs-menu button{all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;padding:12px;font-size:14px;color:#fff;border-radius:10px}.ccs-menu button:hover,.ccs-menu button:focus-visible{background:rgba(255,255,255,.1)}' +
/* composer */
'.ccs-o{position:fixed;inset:0;z-index:9990;display:grid;place-items:end center;background:rgba(16,20,34,.65);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);padding:12px;color:var(--fg,#fff)}' +
'.ccs-sh{width:min(480px,100%);box-sizing:border-box;max-height:92vh;overflow:auto;border-radius:26px;padding:22px 20px calc(18px + env(safe-area-inset-bottom,0px));background:var(--bg,#101422);border:1px solid var(--gb,rgba(255,255,255,.22))}' +
'.ccs-sh h3{margin:0;font-size:19px;font-weight:600;letter-spacing:-.02em}.ccs-sh p{margin:8px 0 0;font-size:13px;line-height:1.6;color:var(--mut,#bdbdbd)}' +
'.ccs-ch{all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:flex;align-items:center;gap:14px;padding:15px 4px;border-bottom:1px solid var(--line,rgba(255,255,255,.14));font-size:15px;color:var(--fg,#fff)}.ccs-ch:last-of-type{border-bottom:0}.ccs-ch:focus-visible{outline:2px solid var(--fg,#fff);outline-offset:2px;border-radius:10px}' +
'.ccs-pv{margin-top:14px;border-radius:18px;overflow:hidden;background:#101422;max-height:46vh;display:grid;place-items:center}.ccs-pv img,.ccs-pv video{max-width:100%;max-height:46vh;display:block}' +
'.ccs-cp{width:100%;box-sizing:border-box;margin-top:14px;font:inherit;font-size:16px}' +
'.ccs-er{min-height:18px;margin-top:8px;font-size:13px;color:var(--bad,#E58A90)}' +
'.ccs-rw{display:flex;gap:10px;margin-top:14px}.ccs-rw .btn{flex:1}';
document.head.appendChild(css);

/* ---------- loading ---------- */
function load(quiet) {
  if (!connected() || S.busy) return Promise.resolve();
  S.busy = true;
  return call('/api/stories', { auth: false }).then(function (d) { S.groups = d.groups || []; S.hours = d.hours || 24; S.loaded = true; S.at = Date.now(); })
    .catch(function () { if (!quiet) say('Could not load stories.'); })
    .then(function () { S.busy = false; if (V) closeViewer(); drawTray(); });
}

/* ---------- the tray ---------- */
var tray, row;
function thumb(item) {
  var box = el('span', 'ccs-th');
  if (!item) { box.appendChild(svg(I.plus, 22)); return box; }
  if (item.type === 'video') { var v = document.createElement('video'); v.src = item.url + '#t=0.1'; v.muted = true; v.playsInline = true; v.preload = 'metadata'; box.appendChild(v); }
  else { var im = document.createElement('img'); im.src = item.url; im.alt = ''; im.loading = 'lazy'; box.appendChild(im); }
  return box;
}
function bubble(g, idx) {
  var b = el('button', 'ccs-b'); b.type = 'button';
  var ring = el('span', 'ccs-ring' + (g ? (g.seen ? ' seen' : '') : ' add')); ring.appendChild(thumb(g ? g.items[g.items.length - 1] : null));
  if (g && g.mine) { var p = el('span', 'ccs-pl'); p.appendChild(svg(I.plus, 12)); p.setAttribute('role', 'button'); p.setAttribute('aria-label', 'Add to your story'); p.onclick = function (e) { e.stopPropagation(); compose(); }; ring.appendChild(p); }
  b.appendChild(ring); b.appendChild(el('span', 'ccs-lb', g ? g.alias : 'Your story'));
  b.setAttribute('aria-label', g ? (g.mine ? 'Your story' : 'Story by ' + g.alias + (g.seen ? ', seen' : ', new')) : 'Add to your story');
  b.onclick = function () { if (g) openViewer(idx, 0); else compose(); };
  return b;
}
function drawTray() {
  if (!tray) return;
  row.textContent = '';
  var hasMine = S.groups.length && S.groups[0].mine;
  if (!hasMine) row.appendChild(bubble(null));
  S.groups.forEach(function (g, i) { row.appendChild(bubble(g, i)); });
  var hint = tray.querySelector('.ccs-hint');
  if (hint) hint.hidden = S.groups.some(function (g) { return !g.mine; });
}
function mountTray() {
  var feed = document.getElementById('v-feed'), hero = feed && feed.querySelector('.hero');
  if (!feed || !hero || tray) return;
  tray = el('section'); tray.id = 'ccs-tray'; tray.setAttribute('aria-label', 'Stories');
  row = el('div', 'ccs-row'); tray.appendChild(row);
  var hint = el('p', 'ccs-hint', 'Share a photo or short video. It disappears after 24 hours.'); tray.appendChild(hint);
  feed.insertBefore(tray, hero); feed.classList.add('ccs-on'); drawTray();
}

/* ---------- the viewer ---------- */
function openViewer(gi, ii) {
  closeViewer();
  var g = S.groups[gi]; if (!g) return;
  V = { gi: gi, ii: ii, t0: 0, elapsed: 0, dur: PHOTO_MS, paused: false, raf: 0, menu: null, down: null, muted: true };
  var root = el('div', 'ccs-v'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Story');
  var st = el('div', 'ccs-st'); root.appendChild(st); V.root = root; V.st = st;
  document.body.appendChild(root); document.body.style.overflow = 'hidden';
  root.addEventListener('pointerdown', onDown); root.addEventListener('pointerup', onUp); root.addEventListener('pointercancel', onCancel);
  document.addEventListener('keydown', onKey);
  show();
}
function closeViewer() {
  if (!V) return;
  cancelAnimationFrame(V.raf); V.root.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); V = null; drawTray();
}
function cur() { return S.groups[V.gi]; }
function show() {
  var g = cur(), it = g.items[V.ii]; cancelAnimationFrame(V.raf); V.menu = null; V.elapsed = 0; V.paused = false;
  var st = V.st; st.textContent = '';
  var m;
  if (it.type === 'video') {
    m = document.createElement('video'); m.playsInline = true; m.autoplay = true; m.muted = !!V.muted; m.src = it.url;
    m.onloadedmetadata = function () { V.dur = Math.min(30000, Math.max(2000, (m.duration || 5) * 1000)); };
    m.onerror = function () { next(); };
    V.video = m;
  } else { m = document.createElement('img'); m.alt = it.caption || 'Story photo'; m.src = it.url; m.onerror = function () { next(); }; V.video = null; V.dur = PHOTO_MS; }
  st.appendChild(m);
  var top = el('div', 'ccs-top'), bars = el('div', 'ccs-bars');
  g.items.forEach(function (_, i) { var b = el('span', 'ccs-bar' + (i < V.ii ? ' done' : '')); b.appendChild(el('i')); bars.appendChild(b); });
  top.appendChild(bars); V.bars = bars;
  var hd = el('div', 'ccs-hd'), who = el('div', 'ccs-who', g.alias); if (g.verified) who.appendChild(tick()); who.appendChild(el('small', '', ago(it.at)));
  hd.appendChild(who);
  if (it.type === 'video') { var snd = el('button', 'ccs-ib'); snd.type = 'button'; snd.setAttribute('aria-label', V.muted ? 'Sound off' : 'Sound on'); snd.textContent = V.muted ? 'Sound off' : 'Sound on'; snd.style.cssText += ';width:auto;padding:0 10px;font-size:12px'; snd.onclick = function (e) { e.stopPropagation(); V.muted = !V.muted; if (V.video) V.video.muted = V.muted; snd.textContent = V.muted ? 'Sound off' : 'Sound on'; }; hd.appendChild(snd); }
  var more = el('button', 'ccs-ib'); more.type = 'button'; more.setAttribute('aria-label', 'More'); more.appendChild(svg(I.more, 22)); more.onclick = function (e) { e.stopPropagation(); toggleMenu(); }; hd.appendChild(more);
  var x = el('button', 'ccs-ib'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.appendChild(svg(I.x, 22)); x.onclick = function (e) { e.stopPropagation(); closeViewer(); }; hd.appendChild(x);
  top.appendChild(hd); st.appendChild(top);
  var zl = el('div', 'ccs-zone l'), zr = el('div', 'ccs-zone r'); zl.setAttribute('data-z', 'prev'); zr.setAttribute('data-z', 'next'); st.appendChild(zl); st.appendChild(zr);
  var bt = el('div', 'ccs-bt');
  if (it.caption) bt.appendChild(el('p', 'ccs-cap', it.caption));
  if (g.mine) {
    var meta = el('div', 'ccs-meta'), seen = el('span'); seen.appendChild(svg(I.eye, 16)); seen.style.cssText = 'display:inline-flex;align-items:center;gap:6px';
    seen.appendChild(document.createTextNode((it.views || 0) + (it.views === 1 ? ' view' : ' views'))); meta.appendChild(seen);
    var add = el('button', 'ccs-act'); add.type = 'button'; add.appendChild(svg(I.plus, 15)); add.appendChild(document.createTextNode('Add')); add.onclick = function (e) { e.stopPropagation(); pause(true); compose(); }; meta.appendChild(add); bt.appendChild(meta);
  }
  st.appendChild(bt);
  if (!g.mine && signedIn() && !it.seen) { it.seen = true; call('/api/stories/' + it.id + '/view', { body: {}, auth: false }).catch(function () {}); g.seen = g.items.every(function (i) { return i.seen; }); }
  V.t0 = performance.now(); loop();
}
function loop() {
  if (!V) return;
  V.raf = requestAnimationFrame(function tickf(now) {
    if (!V) return;
    var it = cur().items[V.ii], p;
    if (!V.paused) {
      if (it.type === 'video' && V.video && V.video.duration) p = V.video.currentTime / V.video.duration;
      else { V.elapsed += now - (V.last || now); p = V.elapsed / V.dur; }
    } else p = null;
    V.last = now;
    if (p !== null) { var bar = V.bars.children[V.ii]; if (bar) bar.firstChild.style.width = Math.min(100, p * 100) + '%'; if (p >= 1 || (V.video && V.video.ended)) return next(); }
    V.raf = requestAnimationFrame(tickf);
  });
}
function pause(on) { if (!V) return; V.paused = on; if (V.video) { if (on) V.video.pause(); else V.video.play().catch(function () {}); } if (!on) V.last = 0; }
function next() { if (!V) return; var g = cur(); if (V.ii < g.items.length - 1) { V.ii++; show(); } else if (V.gi < S.groups.length - 1) { V.gi++; V.ii = 0; show(); } else closeViewer(); }
function prev() { if (!V) return; if (V.ii > 0) { V.ii--; show(); } else if (V.gi > 0) { V.gi--; V.ii = cur().items.length - 1; show(); } else show(); }
function onDown(e) { if (!V || e.target.closest('button,.ccs-menu')) return; V.down = { x: e.clientX, y: e.clientY, t: Date.now() }; pause(true); }
function onUp(e) {
  if (!V || !V.down) return; var d = V.down; V.down = null; pause(false);
  var dy = e.clientY - d.y, dx = e.clientX - d.x, dt = Date.now() - d.t;
  if (dy > 90 && Math.abs(dx) < 70) return closeViewer();
  if (dt < 260 && Math.abs(dx) < 12 && Math.abs(dy) < 12) { var z = e.target.closest && e.target.closest('[data-z]'); if (z) { if (V.menu) return toggleMenu(); z.getAttribute('data-z') === 'prev' ? prev() : next(); } }
}
function onCancel() { if (V) { V.down = null; pause(false); } }
function onKey(e) { if (!V) return; if (e.key === 'Escape') closeViewer(); else if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev(); }
function toggleMenu() {
  if (V.menu) { V.menu.remove(); V.menu = null; pause(false); return; }
  pause(true);
  var g = cur(), it = g.items[V.ii], m = el('div', 'ccs-menu'); m.setAttribute('role', 'menu');
  function item(icon, label, fn) { var b = el('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.appendChild(svg(icon, 18)); b.appendChild(document.createTextNode(label)); b.onclick = function (e) { e.stopPropagation(); fn(); }; m.appendChild(b); }
  if (g.mine) item(I.trash, 'Delete story', function () {
    if (!confirm('Delete this story?')) return;
    call('/api/stories/' + it.id + '/remove', { body: {} }).then(function () { g.items.splice(V.ii, 1); say('Story deleted'); if (!g.items.length) { S.groups.splice(V.gi, 1); closeViewer(); } else { V.ii = Math.min(V.ii, g.items.length - 1); show(); } }).catch(function (e) { say(e.message); });
  });
  else item(I.flag, 'Report story', function () {
    if (!confirm('Report this story to the admins?')) return;
    call('/api/report', { body: { type: 'clip', id: it.id, reason: 'story' } }).then(function () { say('Reported. Thank you.'); toggleMenu(); }).catch(function (e) { say(e.message); });
  });
  V.st.appendChild(m); V.menu = m; var f = m.querySelector('button'); if (f) f.focus();
}

/* ---------- adding a story ---------- */
function overlay(build) {
  var o = el('div', 'ccs-o'), sh = el('div', 'ccs-sh'); o.appendChild(sh); o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
  function shut() { o.remove(); document.removeEventListener('keydown', k); } function k(e) { if (e.key === 'Escape') shut(); }
  o.onclick = function (e) { if (e.target === o) shut(); }; document.addEventListener('keydown', k);
  build(sh, shut); document.body.appendChild(o); return shut;
}
function pick(accept, capture, done) {
  var i = document.createElement('input'); i.type = 'file'; i.accept = accept; if (capture) i.setAttribute('capture', 'environment'); i.style.display = 'none';
  i.onchange = function () { var f = i.files && i.files[0]; i.remove(); if (f) done(f); }; document.body.appendChild(i); i.click();
}
function compose() {
  if (!connected()) return say('We cannot reach the service right now. Please try again in a moment.');
  overlay(function (sh, shut) {
    sh.appendChild(el('h3', '', 'Add to your story'));
    sh.appendChild(el('p', '', 'A photo or a short video. It disappears after 24 hours and shows under a made-up name, not yours. Please do not film people without their consent.'));
    function choice(icon, label, accept, cap) { var b = el('button', 'ccs-ch'); b.type = 'button'; b.appendChild(svg(icon, 22)); b.appendChild(document.createTextNode(label)); b.onclick = function () { pick(accept, cap, function (f) { shut(); preview(f); }); }; sh.appendChild(b); }
    var wrap = el('div'); wrap.style.marginTop = '8px'; sh.appendChild(wrap);
    choice(I.cam, 'Take a photo or video', 'image/*,video/*', true);
    choice(I.img, 'Choose from your phone', 'image/*,video/mp4,video/webm', false);
    var c = el('button', 'btn g', 'Cancel'); c.type = 'button'; c.style.cssText = 'width:100%;margin-top:10px'; c.onclick = shut; sh.appendChild(c);
  });
}
function toJpeg(file) {
  return new Promise(function (ok, bad) {
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      var r = Math.min(1, MAX_EDGE / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(function (b) { b ? ok(b) : bad(new Error('Could not read that photo')); }, 'image/jpeg', .85);
    };
    im.onerror = function () { URL.revokeObjectURL(url); bad(new Error('Could not read that photo. Try a JPG or PNG.')); }; im.src = url;
  });
}
function preview(file) {
  var isVideo = /^video\//.test(file.type);
  if (isVideo && !/^video\/(mp4|webm)$/.test(file.type)) return say('Please use an MP4 or WebM video. On iPhone, set Camera formats to Most Compatible.');
  if (isVideo && file.size > MAX_VIDEO) return say('That video is over 25 MB. Trim it and try again.');
  if (!isVideo && !/^image\//.test(file.type)) return say('Please choose a photo or a video.');
  var url = URL.createObjectURL(file);
  overlay(function (sh, shut) {
    sh.appendChild(el('h3', '', 'Share to your story'));
    var pv = el('div', 'ccs-pv'), m = isVideo ? document.createElement('video') : document.createElement('img');
    m.src = url; if (isVideo) { m.muted = true; m.controls = true; m.playsInline = true; } else m.alt = 'Preview of your story'; pv.appendChild(m); sh.appendChild(pv);
    var cap = document.createElement('input'); cap.className = 'ccs-cp'; cap.maxLength = 140; cap.placeholder = 'Add a caption (optional)'; cap.setAttribute('aria-label', 'Caption'); cap.autocomplete = 'off'; sh.appendChild(cap);
    var er = el('p', 'ccs-er'); er.setAttribute('role', 'alert'); sh.appendChild(er);
    var rw = el('div', 'ccs-rw'), no = el('button', 'btn g', 'Cancel'), go = el('button', 'btn p', 'Share story'); no.type = go.type = 'button'; rw.appendChild(no); rw.appendChild(go); sh.appendChild(rw);
    no.onclick = function () { URL.revokeObjectURL(url); shut(); };
    go.onclick = async function () {
      go.disabled = no.disabled = true; go.textContent = 'Sharing...'; er.textContent = '';
      try {
        var blob = isVideo ? file : await toJpeg(file), type = isVideo ? file.type : 'image/jpeg';
        var d = await call('/api/media/upload-url', { body: { kind: isVideo ? 'story_video' : 'story_photo', content_type: type, bytes: blob.size, caption: cap.value.trim() } });
        var r = await CC.putFile(d.upload_url, blob, type); if (!r.ok) throw new Error('The upload did not finish. Check your connection and try again.');
        await call('/api/media/' + d.id + '/complete', { body: {} });
        URL.revokeObjectURL(url); shut(); say('Story shared. It disappears in 24 hours.'); load(true);
      } catch (e) { er.textContent = e.message || 'Could not share your story.'; go.disabled = no.disabled = false; go.textContent = 'Share story'; }
    };
  });
}

/* ---------- start ---------- */
function boot() {
  mountTray(); if (!tray) return;
  load(true);
  setInterval(function () { if (!document.hidden && !V) load(true); }, 120000);
  new MutationObserver(function () { if (document.body.dataset.view === 'feed' && Date.now() - S.at > 30000 && !V) load(true); }).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
  window.ccStories = { reload: function () { return load(true); }, add: compose };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
