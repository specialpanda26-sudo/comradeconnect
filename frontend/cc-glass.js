/* cc-glass.js v2 */
(function () {
'use strict';
if (window.__ccGl) return; window.__ccGl = 1;
var H = document.documentElement;
if (/admin/i.test(location.pathname)) H.classList.add('cc-adm');
function orbs() {
  if (document.querySelector('.cc-orbs')) return;
  var o = document.createElement('div'); o.className = 'cc-orbs'; o.setAttribute('aria-hidden', 'true'); o.innerHTML = '<i class="o1"></i><i class="o2"></i><i class="o3"></i>';
  var bg = !H.classList.contains('cc-adm') && document.querySelector('.bg'); (bg || document.body).appendChild(o);
}
var SEL = 'button,.btn,.ib,#fab,.chip,.pill,.tag,.badge,[class*="badge"],[class*="chip"]';
function rgba(s) { var m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; var p = m[1].split(/[ ,\/]+/).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 && !isNaN(p[3]) ? p[3] : 1 }; }
function tint() {
  var list = document.querySelectorAll(SEL), n = list.length > 900 ? 900 : list.length;
  for (var i = 0; i < n; i++) {
    var el = list[i], c = rgba(getComputedStyle(el).backgroundColor);
    if (c && c.a >= .6) { el.setAttribute('data-gs', '1'); el.style.setProperty('--tint', 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'); }
  }
}
var t = 0, q = function () { clearTimeout(t); t = setTimeout(tint, 600); };
function go() { orbs(); tint(); try { new MutationObserver(q).observe(document.body, { childList: true, subtree: true }); } catch (e) {} }
if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
document.addEventListener('cc-site', q); document.addEventListener('cc-ready', q);
})();
