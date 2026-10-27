/* cc-notify.js: the notification centre behind the bell.
   Shows comments on your stories, clips and reels, order and referral news, new events, and the admin's notices.
   Signed-in people get it from the server; guests still see upcoming events. All text goes in with textContent, never as HTML. */
(function () {
'use strict';
if (window.__ccNotify) return; window.__ccNotify = 1;

var API = (typeof CC_API !== 'undefined' ? CC_API : '').replace(/\/$/, '');
var SEEN_KEY = 'cc_notice_seen', EV_KEY = 'ccn_ev_seen', ANN_KEY = 'ccn_announced';
var S = { items: [], events: [], live: [], snap: [], unread: 0, total: 0, loaded: false, tab: 'all', guest: false, lastTotal: -1 };
var panel = null, banner = null, bell = null;

function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

/* ids already announced in the pop-up note: kept for good, so the same news never pops twice */
function announced() { try { var a = JSON.parse(ls(ANN_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function rememberAnnounced(ids) { var a = announced(); ids.forEach(function (x) { if (a.indexOf(x) < 0) a.push(x); }); ls(ANN_KEY, JSON.stringify(a.slice(-400))); }
function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} return null; }
function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
function call(path, body) {
  if (!window.ccCall) return Promise.reject(new Error('not ready'));
  return window.ccCall(path, body ? { body: body, auth: false } : { auth: false });
}

/* ---------- the admin's notices (Site editor in admin.html), same source the old bell used ---------- */
function siteNotices() {
  var C = {}; try { C = JSON.parse(ls('cc_site_v1') || '{}') || {}; } catch (e) {}
  var a = [];
  if (C.notice_on && C.notice_text) a.push({ t: C.notice_title || 'Notice', x: C.notice_text });
  if (C.maintenance_on) a.push({ t: 'Maintenance', x: C.maintenance_text || 'We are fixing something. Please check again in a little while.' });
  if (C.banner_on && C.banner_text) a.push({ t: 'Announcement', x: C.banner_text, l: C.banner_link });
  if (a.length && ls('ccn_cleared') === noticeKey(a)) return [];   // cleared with Clear all
  return a;
}
function noticeKey(a) { return a.map(function (n) { return n.t + n.x; }).join('|'); }
function noticesUnseen() { var a = siteNotices(); return a.length && ls(SEEN_KEY) !== noticeKey(a) ? a.length : 0; }

/* ---------- time and dates ---------- */
function ago(ms) {
  var s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'now'; if (s < 3600) return Math.round(s / 60) + 'm'; if (s < 86400) return Math.round(s / 3600) + 'h';
  if (s < 604800) return Math.round(s / 86400) + 'd'; return new Date(ms).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}
function dayLabel(d) {
  try { return new Date(d + 'T00:00:00+03:00').toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return d; }
}

/* ---------- styles: the same glass look as the rest of the app, nothing new ---------- */
var css = el('style');
css.textContent =
'.ib.ccb>i,#cch .ccb>i{display:none!important}' +
'.ccn-b{position:absolute;top:2px;right:0;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:var(--fg,#fff);color:var(--bg,#101422);font:600 10px/17px Poppins,sans-serif;text-align:center;box-shadow:0 0 0 2px var(--bg,#101422);pointer-events:none}' +
'.ccn{position:fixed;inset:0;z-index:960;display:grid;place-items:end center;background:rgba(16,20,34,.6);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);padding:12px;color:var(--fg,#fff)}' +
'.ccn .bx{width:min(520px,100%);height:min(86vh,720px);display:flex;flex-direction:column;overflow:hidden;border-radius:26px;padding:20px 20px 8px;background:var(--bg,#101422);border:1px solid var(--gb,rgba(255,255,255,.22));animation:ccnup .28s cubic-bezier(.2,.8,.2,1)}' +
'@keyframes ccnup{from{opacity:0;transform:translateY(24px)}}' +
'@media (prefers-reduced-motion:reduce){.ccn .bx{animation:none}}' +
'.ccn .hd{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0}.ccn h2{font-size:20px;font-weight:600;letter-spacing:-.02em;margin:0}' +
'.ccn .hd button{all:unset;cursor:pointer;color:var(--mut,var(--mut));font-size:13px;padding:6px 4px}.ccn .hd button:hover{color:var(--fg,#fff)}.ccn .hd .ib{width:36px;height:36px;display:grid;place-items:center;padding:0}' +
'.ccn .tb{display:flex;gap:6px;margin:14px 0 6px;flex-shrink:0;overflow-x:auto;scrollbar-width:none}.ccn .tb::-webkit-scrollbar{display:none}' +
'.ccn .tb button{all:unset;cursor:pointer;white-space:nowrap;padding:8px 14px;border-radius:999px;font-size:13px;color:var(--mut,var(--mut));border:1px solid var(--gb,rgba(255,255,255,.22))}' +
'.ccn .tb button.on{background:var(--ink,#fff);color:var(--inkfg,#101422);border-color:var(--ink,#fff);font-weight:600}' +
'.ccn .ls{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin:0 -8px;padding:0 8px}' +
'.ccn .it{display:flex;gap:12px;align-items:flex-start;width:100%;box-sizing:border-box;text-align:left;padding:14px 4px;border:0;border-bottom:1px solid var(--line,rgba(255,255,255,.14));background:none;color:inherit;font:inherit;cursor:pointer}' +
'.ccn .it:last-child{border-bottom:0}.ccn .it:focus-visible,.ccn .hd button:focus-visible,.ccn .tb button:focus-visible{outline:2px solid var(--fg,#fff);outline-offset:2px;border-radius:10px}' +
'.ccn .ic{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--gb,rgba(255,255,255,.22));color:var(--mut,var(--mut))}' +
'.ccn .ic svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
'.ccn .tx{flex:1;min-width:0}.ccn .tt{display:flex;justify-content:space-between;gap:10px;font-size:14px;font-weight:500}.ccn .tt time{flex:none;font-size:12px;font-weight:400;color:var(--mut,var(--mut))}' +
'.ccn .bd{margin-top:2px;font-size:13px;line-height:1.5;color:var(--mut,var(--mut));overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}' +
'.ccn .it.un .tt span{font-weight:600}.ccn .it.un .ic{color:var(--fg,#fff);border-color:var(--fg,#fff)}' +
'.ccn .dt{flex:none;width:8px;height:8px;border-radius:50%;background:var(--fg,#fff);margin-top:6px}' +
'.ccn .em{padding:40px 12px;text-align:center;font-size:14px;line-height:1.6;color:var(--mut,var(--mut))}.ccn .em b{display:block;color:var(--fg,#fff);font-weight:500;margin-bottom:4px}' +
'.ccn .gs{flex-shrink:0;margin:8px 0 10px;padding:12px 14px;border-radius:16px;border:1px solid var(--gb,rgba(255,255,255,.22));font-size:13px;line-height:1.5;color:var(--mut,var(--mut))}' +
'.ccn .gs button{all:unset;cursor:pointer;color:var(--fg,#fff);font-weight:600;text-decoration:underline}' +
'#ccnb{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 64px);transform:translateX(-50%);z-index:955;width:min(440px,92vw);box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px 14px 12px 16px;border-radius:18px;background:var(--bg,#101422);border:1px solid var(--gb,rgba(255,255,255,.3));box-shadow:var(--sh,0 10px 30px rgba(16,20,34,.6));color:var(--fg,#fff);font-size:13px;line-height:1.45;animation:ccnup .3s ease}' +
'#ccnb span{flex:1}#ccnb button{all:unset;cursor:pointer;font-size:13px;font-weight:600;padding:8px 14px;border-radius:999px;background:var(--ink,#fff);color:var(--inkfg,#101422)}#ccnb button.x{background:none;color:var(--mut,var(--mut));font-weight:400;padding:8px 6px}' +
'#ccnb button:focus-visible{outline:2px solid var(--fg,#fff);outline-offset:2px}' +
'.ccn-hl{outline:2px solid var(--fg,#fff);outline-offset:3px;transition:outline-color 1.2s}';
document.head.appendChild(css);

/* ---------- icons (same 24px line style as the app) ---------- */
var ICON = {
  comment: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  reel: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>',
  heart: '<path d="M12 21l-1.4-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.2z"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8h14v-8M12 8H8a2 2 0 1 1 0-4c2 0 4 4 4 4zm0 0h4a2 2 0 1 0 0-4c-2 0-4 4-4 4z"/>',
  event: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  story: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  live: '<circle cx="12" cy="12" r="2.5"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9"/>',
  update: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>'
};
function icon(kind) {
  var map = { comment: 'comment', reel_comment: 'reel', clip_comment: 'reel', like_milestone: 'heart', order: 'bag', referral: 'gift', reward: 'gift', event: 'event', notice: 'bell', story_view: 'story', live: 'live', update: 'update' };
  var d = el('span', 'ic'); d.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[map[kind] || 'bell'] + '</svg>'; return d;
}

/* ---------- loading ---------- */
function guestEventsSeen() { try { return JSON.parse(ls(EV_KEY) || '[]') || []; } catch (e) { return []; } }
/* live streams and the "Update available" note: shown in the tab; they count on the bell until you have looked at them once */
function readUpd() { try { var u = JSON.parse(ls('cc_upd_pending') || 'null'); return u && u.n && /^https:\/\//i.test(u.url || '') ? u : null; } catch (e) { return null; } }
function liveKey(s) { return 'l' + s.id; }
function updKey(u) { return 'u' + u.n; }
function extraUnseen() {
  var a = announced(), n = S.live.filter(function (s) { return a.indexOf(liveKey(s)) < 0; }).length, u = readUpd();
  if (u && a.indexOf(updKey(u)) < 0) n++;
  return n;
}
function totalCount() { return S.unread + S.events.length + noticesUnseen() + extraUnseen(); }
function loadLive() {
  return call('/api/live').then(function (d) { S.live = ((d && d.streams) || []).slice(0, 12); }).catch(function () {});
}

function paintBell() {
  bell = bell && bell.isConnected ? bell : document.querySelector('.ccb');
  if (!bell) return;
  var old = bell.querySelector('.ccn-b'); if (old) old.remove();
  var n = totalCount();
  if (n > 0) { var b = el('span', 'ccn-b', n > 9 ? '9+' : String(n)); b.setAttribute('aria-hidden', 'true'); bell.appendChild(b); }
  bell.setAttribute('aria-label', n > 0 ? 'Notifications, ' + n + ' new' : 'Notifications');
}

function loadServer() {
  if (signedIn()) {
    S.guest = false;
    return call('/api/notifications').then(function (d) {
      S.items = d.items || []; S.events = d.events || []; S.unread = d.unread || 0; S.loaded = true;
    });
  }
  S.guest = true; S.items = []; S.unread = 0;
  return call('/api/events').then(function (d) {
    var seen = guestEventsSeen();
    S.events = (d.events || []).filter(function (e) { return seen.indexOf(e.id) < 0; }).slice(0, 5)
      .map(function (e) { return { id: e.id, title: e.title, date: e.date, venue: e.venue || '', details: e.details || '', ticket_price: e.ticket_price || 0, at: Date.now() }; });
    S.loaded = true;
  });
}

function refresh(quiet) {
  return Promise.all([loadServer().catch(function () {}), loadLive()]).then(function () {
    paintBell();
    var n = totalCount();
    S.lastTotal = n;
    if (panel) draw();
  }).catch(function () { if (!quiet) paintBell(); });
}

function systemAlert(extra) {
  try {
    var on = JSON.parse(ls('cs_nt') || '{"n2":1}'); if (on.n2 === 0) return;
    if ('Notification' in window && Notification.permission === 'granted')
      new Notification('Comrade Connect', { body: extra === 1 ? 'You have a new notification' : 'You have ' + extra + ' new notifications', tag: 'cc-notify', icon: 'icon-192.png' });
  } catch (e) {}
}

/* ---------- opening what a notification is about ---------- */
function flash(node) { if (!node) return; try { node.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} node.classList.add('ccn-hl'); setTimeout(function () { node.classList.remove('ccn-hl'); }, 2400); }
function openTarget(n) {
  close();
  var go = window.go; if (typeof go !== 'function') return;
  if (n.ref_type === 'post') { go('feed'); setTimeout(function () { flash(document.querySelector('#feed .card[data-id="' + n.ref_id + '"]')); }, 350); }
  else if (n.ref_type === 'clip') { go('videos'); setTimeout(function () { var c = document.querySelector('#vl .vcard[data-id="' + n.ref_id + '"]'); if (c) { flash(c); setTimeout(function () { c.click(); }, 500); } }, 700); }
  else if (n.ref_type === 'order') go('market');
  else if (n.ref_type === 'referral') go('rewards');
  else if (n.ref_type === 'story') go('feed');
}
function eventSheet(e) {
  var o = el('div', 'ccn ccn-ev'); o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', e.title);
  var bx = el('div', 'bx'); bx.style.height = 'auto'; bx.style.paddingBottom = '20px';
  var hd = el('div', 'hd'); hd.appendChild(el('h2', '', e.title)); var x = el('button', 'ib'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
  x.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'; hd.appendChild(x); bx.appendChild(hd);
  var meta = el('p', 'bd', dayLabel(e.date) + (e.venue ? ', ' + e.venue : '')); meta.style.margin = '10px 0 0'; bx.appendChild(meta);
  if (e.details) { var d = el('p', 'bd', e.details); d.style.cssText = 'margin-top:10px;-webkit-line-clamp:unset;display:block'; bx.appendChild(d); }
  var pr = el('p', 'bd', e.ticket_price > 0 ? 'Ticket: KSh ' + Number(e.ticket_price).toLocaleString('en-KE') : 'Free entry'); pr.style.marginTop = '10px'; bx.appendChild(pr);
  o.appendChild(bx); document.body.appendChild(o);
  function shut() { o.remove(); } x.onclick = shut; o.onclick = function (ev) { if (ev.target === o) shut(); };
}

/* ---------- the panel ---------- */
var TABS = [['all', 'All'], ['comments', 'Comments'], ['events', 'Events'], ['updates', 'Updates']];
function rowsFor(tab) {
  var out = [];
  if (tab === 'all' || tab === 'comments') S.items.forEach(function (n) {
    var isC = /comment/.test(n.kind);
    if (tab === 'comments' && !isC) return;
    out.push({ at: n.at, kind: n.kind, title: n.title, body: n.body, unread: !n.read, srv: n, time: ago(n.at) });
  });
  if (tab === 'all' || tab === 'events') S.events.forEach(function (e) {
    out.push({ at: e.at, kind: 'event', title: 'New event: ' + e.title, body: dayLabel(e.date) + (e.venue ? ', ' + e.venue : ''), unread: true, ev: e, time: ago(e.at) });
  });
  if (tab === 'all' || tab === 'updates') {
    var u = readUpd();
    if (u) out.push({ at: Date.now(), kind: 'update', title: 'Update available', body: 'A new version of Comrade Connect is ready. Tap to update.', unread: S.snap.indexOf(updKey(u)) < 0, upd: u, time: '' });
    S.live.forEach(function (s, i) {
      var h = String((s.host && s.host.handle) || 'Comrade').replace(/^@/, '');
      out.push({ at: Date.now() - 1 - i, kind: 'live', title: '@' + h + ' is live', body: (s.title ? s.title + '. ' : '') + (s.viewers || 0) + ' watching. Tap to join.', unread: S.snap.indexOf(liveKey(s)) < 0, live: s, time: 'now' });
    });
  }
  if (tab === 'all' || tab === 'updates') siteNotices().forEach(function (n, i) {
    out.push({ at: 1e12 - i, kind: 'notice', title: n.t, body: n.x, unread: false, link: n.l, time: '' });
  });
  return out.sort(function (a, b) { return b.at - a.at; });
}
function draw() {
  if (!panel) return;
  var list = panel.querySelector('.ls'); list.textContent = '';
  var tabs = panel.querySelectorAll('.tb button'); [].forEach.call(tabs, function (b) { b.classList.toggle('on', b.dataset.t === S.tab); });
  var rs = rowsFor(S.tab);
  if (!rs.length) {
    var em = el('div', 'em'); em.appendChild(el('b', '', S.tab === 'events' ? 'No new events' : S.tab === 'comments' ? 'No comments yet' : S.tab === 'updates' ? 'No lives or updates right now' : 'You are all caught up'));
    em.appendChild(document.createTextNode(S.tab === 'events' ? 'When someone posts an event, it shows up here.' : 'Comments on your stories, clips and reels show up here, along with orders and invites.'));
    list.appendChild(em); return;
  }
  rs.forEach(function (r) {
    var b = el('button', 'it' + (r.unread ? ' un' : '')); b.type = 'button';
    b.appendChild(icon(r.kind));
    var tx = el('div', 'tx'), tt = el('div', 'tt'); tt.appendChild(el('span', '', r.title)); if (r.time) tt.appendChild(el('time', '', r.time)); tx.appendChild(tt);
    if (r.body) tx.appendChild(el('div', 'bd', r.body)); b.appendChild(tx);
    if (r.unread) { var d = el('span', 'dt'); d.setAttribute('aria-label', 'Unread'); b.appendChild(d); }
    b.onclick = function () {
      if (r.ev) { eventSheet(r.ev); return; }
      if (r.upd) { close(); try { if (window.ccApp && ccApp.showUpdate) ccApp.showUpdate(r.upd.n, r.upd.notes, r.upd.url); else window.open(r.upd.url, '_blank', 'noopener'); } catch (e) {} return; }
      if (r.live) { close(); try { if (window.ccLiveStrip && ccLiveStrip.open) ccLiveStrip.open(r.live); else if (typeof window.go === 'function') window.go('live'); } catch (e) {} return; }
      if (r.srv) { markRead([r.srv.id]); openTarget(r.srv); return; }
      if (/^https:\/\//i.test(r.link || '')) window.open(r.link, '_blank', 'noopener');
    };
    list.appendChild(b);
  });
}
function markRead(ids) {
  S.items.forEach(function (n) { if (ids.indexOf(n.id) >= 0) n.read = true; });
  S.unread = S.items.filter(function (n) { return !n.read; }).length; paintBell();
  if (signedIn()) call('/api/notifications/read', { ids: ids }).catch(function () {});
}
function markAll() {   // now "Clear all": the notifications are removed, not just greyed
  S.items = []; S.unread = 0;
  var a = siteNotices(); if (a.length) { ls(SEEN_KEY, noticeKey(a)); ls('ccn_cleared', noticeKey(a)); }
  if (S.guest) { var seen = guestEventsSeen(); S.events.forEach(function (e) { if (seen.indexOf(e.id) < 0) seen.push(e.id); }); ls(EV_KEY, JSON.stringify(seen.slice(-200))); }
  else call('/api/notifications/clear', { all: true, events: true }).catch(function () {});
  S.events = []; paintBell(); draw();
}
function close() {
  var was = !!panel;
  if (panel) { panel.remove(); panel = null; } document.removeEventListener('keydown', onKey);
  if (was) { S.items.forEach(function (n) { n.read = true; }); S.unread = 0; S.events = []; S.snap = []; paintBell(); }
}
function onKey(e) { if (e.key !== 'Escape') return; var ev = document.querySelector('.ccn-ev'); if (ev) ev.remove(); else close(); }
function open() {
  close(); dismissBanner();
  panel = el('div', 'ccn'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Notifications');
  panel.onclick = function (e) { if (e.target === panel) close(); };
  var bx = el('div', 'bx'), hd = el('div', 'hd'); hd.appendChild(el('h2', '', 'Notifications'));
  var right = el('div'); right.style.cssText = 'display:flex;align-items:center;gap:4px';
  var all = el('button', '', 'Clear all'); all.type = 'button'; all.onclick = markAll; right.appendChild(all);
  var x = el('button', 'ib'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'; x.onclick = close; right.appendChild(x);
  hd.appendChild(right); bx.appendChild(hd);
  var tb = el('div', 'tb'); tb.setAttribute('role', 'tablist');
  TABS.forEach(function (t) { var b = el('button', '', t[1]); b.type = 'button'; b.dataset.t = t[0]; b.setAttribute('role', 'tab'); b.onclick = function () { S.tab = t[0]; draw(); }; tb.appendChild(b); });
  bx.appendChild(tb);
  if (S.guest) {
    var g = el('div', 'gs'); g.appendChild(document.createTextNode('Create an account to get comments, orders and invites here. '));
    var gb = el('button', '', 'Sign in'); gb.type = 'button'; gb.onclick = function () { close(); if (window.CC && CC.signIn) CC.signIn(); }; g.appendChild(gb); bx.appendChild(g);
  }
  bx.appendChild(el('div', 'ls')); panel.appendChild(bx); document.body.appendChild(panel);
  document.addEventListener('keydown', onKey);
  S.snap = announced().slice();
  draw(); refresh(true);
  var a = siteNotices(); if (a.length) { ls(SEEN_KEY, noticeKey(a)); }
  markViewed();
}
/* Everything shown in the panel counts as read the moment it is seen. It stays drawn as new until the panel closes. */
function markViewed() {
  var ids = S.items.filter(function (n) { return !n.read; }).map(function (n) { return n.id; });
  var u = readUpd();
  rememberAnnounced(S.items.map(function (n) { return 'n' + n.id; }).concat(S.events.map(function (e) { return 'e' + e.id; })).concat(S.live.map(liveKey)).concat(u ? [updKey(u)] : []));
  paintBell();
  if (S.guest) { var seen = guestEventsSeen(); S.events.forEach(function (e) { if (seen.indexOf(e.id) < 0) seen.push(e.id); }); ls(EV_KEY, JSON.stringify(seen.slice(-200))); }
  else if (ids.length || S.events.length) { call('/api/notifications/read', ids.length ? { ids: ids, events: true } : { events: true }).catch(function () {}); }
  S.viewed = ids.concat(S.events.map(function (e) { return 'e' + e.id; }));
}

/* ---------- the short note when you open the site ---------- */
function dismissBanner() { if (banner) { banner.remove(); banner = null; } }
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
function showBanner() {
  if (panel) return;
  var seen = announced();
  var fresh = S.items.filter(function (n) { return !n.read && seen.indexOf('n' + n.id) < 0; });
  var evs = S.events.filter(function (e) { return seen.indexOf('e' + e.id) < 0; });
  var cm = fresh.filter(function (n) { return /comment/.test(n.kind); }).length, other = fresh.length - cm;
  var parts = []; if (cm) parts.push(plural(cm, 'new comment')); if (evs.length) parts.push(plural(evs.length, 'new event')); if (other) parts.push(plural(other, 'other update'));
  if (!parts.length) return;
  rememberAnnounced(fresh.map(function (n) { return 'n' + n.id; }).concat(evs.map(function (e) { return 'e' + e.id; })));
  var text = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
  banner = el('div'); banner.id = 'ccnb'; banner.setAttribute('role', 'status');
  banner.appendChild(el('span', '', text)); var v = el('button', '', 'View'); v.type = 'button'; v.onclick = open;
  var x = el('button', 'x', 'Dismiss'); x.type = 'button'; x.onclick = dismissBanner; banner.appendChild(v); banner.appendChild(x); document.body.appendChild(banner);
  setTimeout(dismissBanner, 9000);
}

/* ---------- start ---------- */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('.ccb'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation(); open();
}, true);

function boot() {
  paintBell();
  setTimeout(function () { refresh(true).then(function () { /* no pop-up banner: alerts go to the phone's notification bar */ }); }, 2500);
  setInterval(function () { if (!document.hidden) refresh(true); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(true); });
  window.ccNotifyRefresh = function () { return refresh(true); };
  window.addEventListener('cc-update-pending', function () { paintBell(); if (panel) draw(); });
  window.addEventListener('cc-live-updated', function () { var l = window.ccLiveStrip && ccLiveStrip.list && ccLiveStrip.list(); if (l) { S.live = l.slice(0, 12); paintBell(); if (panel) draw(); } });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
