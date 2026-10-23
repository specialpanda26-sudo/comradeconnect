/* cc-logos.js: logos chosen by the admin (admin.html > Logos). Main logo = used everywhere a place has no logo of its own.
   Places: header (top bar), loader, lock, landing (Get started page), welcome (welcome card + first-run tour), receipt, popups.
   Built-in logo shows whenever nothing is set. Values only ever go in as https image links, never as HTML. */
(function () {
'use strict';
if (window.__ccLogos) return; window.__ccLogos = 1;
var KEY = 'cc_site_v1', C = {}, RATIO = {}, queued = false;
function cfg() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
function https(u) { return /^https:\/\/[^\s<>"']+$/i.test(u || ''); }
function url(slot) { var u = C['logo_' + slot]; if (https(u)) return u; u = C.logo_main; return https(u) ? u : ''; }
window.ccLogoUrl = function (slot) { C = cfg(); return url(slot); };

function ratioOf(u, cb) {
  if (RATIO[u]) return cb(RATIO[u]);
  var i = new Image();
  i.onload = function () { RATIO[u] = (i.naturalWidth || 1) + '/' + (i.naturalHeight || 1); cb(RATIO[u]); };
  i.onerror = function () { cb(''); };
  i.src = u;
}
/* the little shapes that use a recolourable mask: header, loader, lock screen */
function maskEl(el) {
  var slot = el.closest('#loader') ? 'loader' : el.closest('#lk') ? 'lock' : 'header', u = url(slot);
  if (!window.__ccMask) { try { var cs = getComputedStyle(el), m = cs.webkitMaskImage || cs.maskImage || ''; if (m && m !== 'none') window.__ccMask = m; } catch (e) {} }
  if (!u) {
    if (el.dataset.ccl) { ['-webkit-mask', 'mask', 'background', 'aspect-ratio'].forEach(function (p) { el.style.removeProperty(p); }); delete el.dataset.ccl; }
    return;
  }
  if (el.dataset.ccl === u) return;
  el.dataset.ccl = u;
  ratioOf(u, function (r) {
    if (el.dataset.ccl !== u) return;
    el.style.setProperty('-webkit-mask', 'none'); el.style.setProperty('mask', 'none');
    el.style.setProperty('background', 'url("' + u + '") center/contain no-repeat');
    if (r) el.style.setProperty('aspect-ratio', r);
  });
}
function heroEl(el) {
  var u = url('landing');
  if (!u) { if (el.dataset.ccl) { el.style.removeProperty('background'); delete el.dataset.ccl; } return; }
  if (el.dataset.ccl === u) return;
  el.dataset.ccl = u; el.style.setProperty('background', '#000 url("' + u + '") center/contain no-repeat');
}
function imgEl(el) {
  var orig = el.dataset.cclOrig || el.getAttribute('src');
  var slot = el.closest('#ccland') ? 'landing' : (el.closest('.ccwb') || el.closest('.ccfrst-hd')) ? 'welcome' : 'popups', u = url(slot);
  if (u) {
    if (!el.dataset.cclOrig) el.dataset.cclOrig = orig;
    if (el.getAttribute('src') !== u) el.setAttribute('src', u);
    el.style.objectFit = 'contain';
  } else if (el.dataset.cclOrig) {
    el.setAttribute('src', el.dataset.cclOrig); delete el.dataset.cclOrig; el.style.objectFit = '';
  }
}
function apply() {
  queued = false; C = cfg();
  document.querySelectorAll('.lgo').forEach(maskEl);
  document.querySelectorAll('#ccland .hero i').forEach(heroEl);
  document.querySelectorAll('img[src$="icon-192.png"],img[src$="icon-512.png"],img[data-ccl-orig]').forEach(imgEl);
}
function soon() { if (queued) return; queued = true; (window.requestAnimationFrame || setTimeout)(apply); }

apply();
document.addEventListener('cc-site', soon);
function watch() { if (document.body) new MutationObserver(soon).observe(document.body, { childList: true, subtree: true }); }
if (document.body) watch(); else document.addEventListener('DOMContentLoaded', function () { watch(); soon(); });
})();
