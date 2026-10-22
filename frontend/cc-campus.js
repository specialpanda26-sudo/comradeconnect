/* cc-campus.js: which campus are you on?
   You pick it once (or let your location suggest it) and the Feed, Events, Wi-Fi, Hostels, Roommates, Services and Land spots show that campus.
   The Market, rewards, messages and everything else stay shared. The choice is kept on the phone and sent with every call as X-Campus
   (the fetch shim in index.html adds the header). Nothing about where you are is stored on the server. */
(function () {
'use strict';
if (window.__ccCampus) return; window.__ccCampus = 1;

var KEY = 'cc_campus';
var LIST = [
  { id: 'kirinyaga', name: 'Kirinyaga University', short: 'Kirinyaga', lat: -0.4986, lng: 37.2806 },
  { id: 'uon', name: 'University of Nairobi', short: 'UoN', lat: -1.2794, lng: 36.8167 }
];
var NEAR_KM = 30;

function get() { try { var v = localStorage.getItem(KEY); return LIST.some(function (c) { return c.id === v; }) ? v : ''; } catch (e) { return ''; } }
function find(id) { return LIST.filter(function (c) { return c.id === id; })[0] || null; }
function say(t) { try { if (typeof toast === 'function') toast(t); } catch (e) {} }
function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function km(a, b) {
  var R = 6371, rad = Math.PI / 180, dLa = (b.lat - a.lat) * rad, dLo = (b.lng - a.lng) * rad;
  var h = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
function nearest(lat, lng) {
  var best = null;
  LIST.forEach(function (c) { var d = km({ lat: lat, lng: lng }, c); if (!best || d < best.d) best = { c: c, d: d }; });
  return best && best.d <= NEAR_KM ? best.c : null;
}
function locate() {
  return new Promise(function (res, rej) {
    if (!navigator.geolocation) return rej(new Error('Your phone did not share a location'));
    navigator.geolocation.getCurrentPosition(function (p) { res({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      function () { rej(new Error('Location is off or blocked. Pick your campus below.')); }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  });
}

function set(id) {
  var c = find(id); if (!c) return;
  var was = get();
  try { localStorage.setItem(KEY, id); } catch (e) {}
  try { if (window.ccClearOffline) window.ccClearOffline(); } catch (e) {}
  document.dispatchEvent(new CustomEvent('cc-campus', { detail: { id: id, name: c.name } }));
  paintChips();
  if (was !== id) { say('Showing ' + c.short); setTimeout(function () { location.reload(); }, 450); }
}
window.ccCampus = { get: get, list: LIST, name: function () { var c = find(get()); return c ? c.name : ''; }, short: function () { var c = find(get()); return c ? c.short : ''; }, set: set, choose: function () { return choose(true); } };

var css = el('style');
css.textContent =
  '.ccc-chip{display:inline-flex;align-items:center;gap:8px;margin:0 0 12px;padding:8px 14px 8px 12px;border-radius:999px;border:1px solid var(--gb,rgba(255,255,255,.28));background:var(--g,rgba(255,255,255,.07));color:inherit;font:600 13px Poppins,system-ui,sans-serif;cursor:pointer;touch-action:manipulation}' +
  '.ccc-chip svg{width:16px;height:16px;flex:none}.ccc-chip small{font-weight:500;opacity:.65}' +
  '.ccc-ov{position:fixed;inset:0;z-index:9500;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(0,0,0,.7);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}' +
  '.ccc-sh{width:100%;max-width:420px;max-height:92vh;overflow:auto;border-radius:24px;padding:24px 20px calc(18px + env(safe-area-inset-bottom,0px));background:var(--bg,#000);color:var(--fg,#fff);border:1px solid var(--gb,rgba(255,255,255,.25));font-family:Poppins,system-ui,sans-serif}' +
  '@media(min-width:700px){.ccc-ov{align-items:center}}' +
  '.ccc-sh h2{margin:0 0 6px;font-size:22px;font-weight:700;letter-spacing:-.02em}.ccc-sh p{margin:0 0 14px;font-size:14px;line-height:1.5;color:var(--mut,#bdbdbd)}' +
  '.ccc-opt{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;margin:0 0 10px;padding:16px;border-radius:18px;border:1px solid var(--gb,rgba(255,255,255,.28));background:var(--g,rgba(255,255,255,.07));color:inherit;font:600 15px Poppins,system-ui,sans-serif;text-align:left;cursor:pointer;touch-action:manipulation}' +
  '.ccc-opt small{display:block;margin-top:2px;font-weight:400;font-size:12px;opacity:.65}.ccc-opt[aria-pressed=true]{border-color:#ff5a00;box-shadow:0 0 0 2px rgba(255,90,0,.3)}' +
  '.ccc-go{width:100%;margin:0 0 10px;padding:14px;border-radius:999px;border:0;background:#ff5a00;color:#fff;font:700 15px Poppins,system-ui,sans-serif;cursor:pointer}.ccc-go[disabled]{opacity:.6}' +
  '.ccc-no{display:block;width:100%;padding:12px;border:0;background:none;color:var(--mut,#bdbdbd);font:500 14px Poppins,system-ui,sans-serif;cursor:pointer}' +
  '.ccc-note{margin:4px 0 0!important;font-size:12px!important}';
document.head.appendChild(css);

var open = null;
function choose(manual) {
  if (open) return;
  var cur = get();
  var ov = el('div', 'ccc-ov'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Choose your campus'); ov.dataset.noclose = '1';
  var sh = el('div', 'ccc-sh');
  sh.appendChild(el('h2', '', manual && cur ? 'Switch campus' : 'Which campus are you on?'));
  sh.appendChild(el('p', '', 'Your Feed, Events, Wi-Fi, Hostels, Roommates, Services and Land spots will come from your campus. The Market is open to everyone.'));
  var note = el('p', 'ccc-note', '');
  var shut = function () { open = null; ov.remove(); };
  var pick = function (id) { shut(); set(id); };
  var geo = el('button', 'ccc-go', 'Use my location'); geo.type = 'button';
  geo.onclick = function () {
    geo.disabled = true; geo.textContent = 'Finding you...'; note.textContent = '';
    locate().then(function (p) {
      var c = nearest(p.lat, p.lng);
      if (c) return pick(c.id);
      note.textContent = 'You are not near a supported campus right now. Pick one below.';
    }, function (e) { note.textContent = e.message; }).then(function () { geo.disabled = false; geo.textContent = 'Use my location'; });
  };
  sh.appendChild(geo);
  LIST.forEach(function (c) {
    var b = el('button', 'ccc-opt'); b.type = 'button'; b.setAttribute('aria-pressed', String(c.id === cur));
    var s = el('span'); s.appendChild(document.createTextNode(c.short)); s.appendChild(el('small', '', c.name)); b.appendChild(s);
    if (c.id === cur) b.appendChild(el('span', '', 'Current'));
    b.onclick = function () { pick(c.id); };
    sh.appendChild(b);
  });
  sh.appendChild(note);
  var no = el('button', 'ccc-no', cur ? 'Cancel' : 'Not now'); no.type = 'button'; no.onclick = shut; sh.appendChild(no);
  ov.appendChild(sh);
  ov.addEventListener('click', function (e) { if (e.target === ov) shut(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' && open === ov) { shut(); document.removeEventListener('keydown', esc); } });
  document.body.appendChild(ov); open = ov;
}

/* ---------- the chip on Feed and Explore ---------- */
var PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
function chipLabel() { var c = find(get()); return c ? c.short : 'Pick campus'; }
function paintChips() {
  [].forEach.call(document.querySelectorAll('.ccc-chip'), function (b) { var s = b.querySelector('span'); if (s) s.firstChild.textContent = chipLabel(); });
}
function mkChip() {
  var b = el('button', 'ccc-chip'); b.type = 'button'; b.setAttribute('aria-label', 'Change campus');
  b.innerHTML = PIN + '<span></span>'; var s = b.querySelector('span'); s.appendChild(document.createTextNode(chipLabel())); s.appendChild(el('small', '', ' · change'));
  b.onclick = function () { choose(true); };
  return b;
}
function place() {
  var ex = document.getElementById('v-explore');
  if (ex && !ex.querySelector('.ccc-chip')) { var h = ex.querySelector('.ph'); var c1 = mkChip(); if (h && h.nextSibling) h.parentNode.insertBefore(c1, h.nextSibling); else ex.insertBefore(c1, ex.firstChild); }
  var fd = document.getElementById('v-feed');
  if (fd && !fd.querySelector('.ccc-chip')) {
    var anchor = fd.querySelector('#ccs-tray') || fd.querySelector('.hero'); var c2 = mkChip();
    var wrap = el('div'); wrap.style.cssText = 'max-width:640px;margin:0 auto;padding:0 16px'; wrap.appendChild(c2);
    if (anchor) anchor.parentNode.insertBefore(wrap, anchor); else fd.insertBefore(wrap, fd.firstChild);
  }
}
[400, 1500, 3500].forEach(function (ms) { setTimeout(place, ms); });

/* first visit: ask once, after the sign-in panel is out of the way */
var asked = 0;
function loading() { var l = document.getElementById('loader'); if (!l || l.classList.contains('done')) return false; var cs = getComputedStyle(l); return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05 && l.getClientRects().length > 0; }
function firstAsk() {
  if (get() || open || asked > 60) return;
  asked++;
  if (document.getElementById('ccfrst') || document.getElementById('lk') && document.getElementById('lk').classList.contains('on') || loading()) return setTimeout(firstAsk, 900);
  try { if (sessionStorage.getItem('cc_campus_asked') === '1') return; sessionStorage.setItem('cc_campus_asked', '1'); } catch (e) {}
  choose(false);
}
setTimeout(firstAsk, 2200);
})();
