/* An X button on every pop-up panel (sign in, create account, edit profile, wallet sheets...). Escape closes the top one too.
   Panels that are mid-payment cannot be closed. The X taps the panel's own Cancel button when it has one, so nothing is left half done. */
(function () {
'use strict';
var css = document.createElement('style');
css.textContent = '.ccx-host{position:relative}.ccx-host>h2:first-child,.ccx-host>h3:first-child{padding-right:42px}'
  + '.ccx-b{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:1px solid color-mix(in srgb,currentColor 25%,transparent);background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer;padding:0;z-index:2;transition:background .2s}'
  + '.ccx-b:hover{background:color-mix(in srgb,currentColor 12%,transparent)}.ccx-b svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}';
document.head.appendChild(css);
var X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
var QUIT = /^(cancel|close|not now|later|no thanks|back|done|dismiss)$/i;

function shut(ov) {
  if (ov.querySelector('.cs-l')) { try { toast('Please wait, this is still going through'); } catch (e) {} return; }     // a payment is in progress
  var b = Array.prototype.filter.call(ov.querySelectorAll('button'), function (n) { return QUIT.test((n.textContent || '').trim()) && !n.disabled; })[0];
  if (b) b.click(); else if (typeof ov.close === 'function') ov.close(); else ov.remove();
}
function addX(ov, onClose) {
  var box = ov.querySelector('.box, .dsheet, .bx'); if (!box || box.querySelector('.ccx-b')) return;
  box.classList.add('ccx-host');
  var x = document.createElement('button'); x.type = 'button'; x.className = 'ccx-b'; x.setAttribute('aria-label', 'Close'); x.innerHTML = X;
  x.onclick = function (e) { e.stopPropagation(); if (onClose) onClose(); else shut(ov); };
  box.insertBefore(x, box.firstChild);
}
window.ccAddX = addX;

function isPanel(n) {
  if (!n || n.nodeType !== 1 || n.parentNode !== document.body || n.dataset.noclose || n.id === 'dm' || n.id === 'md') return false;
  if (!n.querySelector('.box, .dsheet')) return false;
  var p = getComputedStyle(n).position; return p === 'fixed';
}
new MutationObserver(function (list) {
  list.forEach(function (r) { Array.prototype.forEach.call(r.addedNodes, function (n) { if (isPanel(n)) addX(n); }); });
}).observe(document.body, { childList: true });
Array.prototype.forEach.call(document.body.children, function (n) { if (isPanel(n)) addX(n); });

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  var all = Array.prototype.filter.call(document.body.children, isPanel); if (!all.length) return;
  shut(all[all.length - 1]);
});
})();
