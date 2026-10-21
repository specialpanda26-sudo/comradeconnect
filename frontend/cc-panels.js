/* cc-panels.js: every pop-up becomes a wide, full-screen sheet (like the Claude Code app) with a top bar:
   the title on the left and ONE close X on the right (no duplicate back arrow: Back lives on the full pages such as Safety).
   Also handles the phone's Back button (Android app and browser): closes the top panel first, then returns to Feed, then leaves.
   Panels that are mid-payment cannot be closed. The lock screen has no close button on purpose. */
(function () {
'use strict';
if (window.__ccPanels) return; window.__ccPanels = 1;

var MODAL = '#md,#dm,#pv,#dcm,#ccp,.cchm,.cxm,.ccl-sh,.ccrp,.ccm-sh,.ccp-sheet,.ccdl-m,#cchp';
var SCREEN = '#wfov,#ccrc,.ccr,#hszoom,#ccfind,#ccfid';
var QUIT = /^(cancel|close|not now|later|no thanks|back|done|dismiss)$/i;
var native = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());

var X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

var st = document.createElement('style');
st.textContent = [
  '.ccpb{position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px;background:var(--bg,#000);color:var(--fg,#fff);border-bottom:1px solid var(--line,rgba(255,255,255,.14));-webkit-backdrop-filter:none;backdrop-filter:none}',
  '.ccpb h4{flex:1;min-width:0;margin:0;font:600 15px/1.2 Poppins,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;padding-left:4px}',
  '.ccpb button,.ccpf button{flex:none;width:38px;height:38px;border-radius:50%;border:1px solid var(--gb,rgba(255,255,255,.22));background:var(--g,rgba(255,255,255,.07));color:inherit;display:grid;place-items:center;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}',
  '.ccpb button:active,.ccpf button:active{transform:scale(.94)}',
  '.ccpb svg,.ccpf svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}',
  '.ccpf{position:absolute;left:0;right:0;top:0;z-index:30;display:flex;justify-content:space-between;padding:calc(12px + env(safe-area-inset-top,0px)) 14px 0;pointer-events:none}',
  '.ccpf button{pointer-events:auto;background:rgba(0,0,0,.55);color:#fff;border-color:rgba(255,255,255,.3);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}',
  '.ccp-box{position:relative;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}',
  /* phones: the sheet fills the whole screen */
  '@media(max-width:700px){',
  '.ccp-ov{padding:0!important;align-items:stretch!important;justify-content:stretch!important;place-items:stretch!important;background:var(--bg,#000)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}',
  '.ccp-ov>.ccp-box,.ccp-ov .ccp-box{width:100%!important;max-width:none!important;height:100%!important;max-height:none!important;min-height:100%;margin:0!important;border-radius:0!important;border-left:0!important;border-right:0!important;box-shadow:none!important;animation:none!important;box-sizing:border-box}',
  '.ccdl-s{padding-bottom:calc(22px + env(safe-area-inset-bottom,0px))!important}',
  '}',
  /* bigger screens: wide sheet instead of a small centred card */
  '@media(min-width:701px){',
  '.ccp-ov .ccp-box{width:min(980px,100%)!important;max-width:none!important;max-height:94vh!important;box-sizing:border-box}',
  '.ccp-ov{align-items:center!important;justify-content:center!important;place-items:center!important}',
  '.hero,.pg,.tabs,.pulse,.vt{max-width:min(1100px,100%)!important}',
  '#feed{max-width:min(1100px,100%)!important}',
  '#feed:not(.grid){grid-template-columns:repeat(auto-fill,minmax(400px,1fr))}',
  '}',
  '.ccp-ov .ccx-b{display:none!important}'
].join('');
document.head.appendChild(st);

function shown(ov) {
  if (!ov || !ov.isConnected) return false;
  var c = getComputedStyle(ov);
  return c.display !== 'none' && c.visibility !== 'hidden' && ov.getClientRects().length > 0;
}
function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
function openList() {
  return all(MODAL + ',' + SCREEN).filter(shown).sort(function (a, b) {
    return (parseInt(getComputedStyle(a).zIndex, 10) || 0) - (parseInt(getComputedStyle(b).zIndex, 10) || 0);
  });
}
function locked() { var l = document.getElementById('lk'); return !!(l && l.classList.contains('on')); }

function closeIt(ov) {
  if (ov.querySelector('.cs-l')) { try { toast('Please wait, this is still going through'); } catch (e) {} return; }
  var own = ov.querySelector('.fid-x,.ccx-b,[aria-label="Close"]');
  if (own && shown(own) && !own.closest('.ccpb,.ccpf')) { own.click(); return; }
  if (window.ccShut) return window.ccShut(ov);
  var b = Array.prototype.filter.call(ov.querySelectorAll('button'), function (n) { return QUIT.test((n.textContent || '').trim()) && !n.disabled && n.getClientRects().length; })[0];
  if (b) b.click(); else if (ov.classList.contains('on')) ov.classList.remove('on'); else ov.remove();
}

function titleOf(ov, box) {
  var h = Array.prototype.filter.call(box.querySelectorAll('h1,h2,h3'), function (n) { return n.getClientRects().length && !n.closest('.ccpb'); })[0];
  var t = h && (h.textContent || '').trim();
  return (t && t.length < 60) ? t : (ov.getAttribute('aria-label') || 'Comrade Connect');
}
function mkBtn(label, svg, fn) {
  var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', label); b.innerHTML = svg;
  b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); fn(); }; return b;
}

function dress(ov) {
  var box = ov.querySelector(':scope > .bx,:scope > .box,:scope > .dsheet,:scope > .ccdl-s') || ov.querySelector('.bx,.box,.dsheet,.ccdl-s') || ov.firstElementChild;
  if (!box || box.nodeType !== 1) return;
  ov.classList.add('ccp-ov'); box.classList.add('ccp-box');
  Array.prototype.forEach.call(ov.querySelectorAll('.ccx-b'), function (n) { n.remove(); });
  var bar = box.querySelector(':scope > .ccpb');
  // The panel already has its own X (plain icon in its heading row): keep THAT one and draw no bar, so there is only one X.
  var own = Array.prototype.filter.call(box.querySelectorAll('button[aria-label="Close"],button.xb,.fid-x,[data-close]'), function (n) { return !n.closest('.ccpb,.ccpf') && shown(n); })[0];
  if (own) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement('div'); bar.className = 'ccpb';
    var h = document.createElement('h4');
    bar.append(h, mkBtn('Close', X, function () { closeIt(ov); }));
    box.insertBefore(bar, box.firstChild);
    var cs = getComputedStyle(box);                                         // pull the bar to the edges of the box
    bar.style.margin = '-' + cs.paddingTop + ' -' + cs.paddingRight + ' 14px -' + cs.paddingLeft;
    if (parseFloat(cs.paddingTop) < 1) bar.style.margin = '0 0 14px';
  }
  var hh = bar.querySelector('h4'), t = titleOf(ov, box); if (hh.textContent !== t) hh.textContent = t;
}

function floaters(ov) {
  if (ov.querySelector('.ccpf')) return;
  var has = ov.querySelector('.ccx-b,.fid-x,[data-close],[aria-label*="lose" i],[aria-label*="ack" i]');
  if (has && shown(has)) return;
  var quit = Array.prototype.filter.call(ov.querySelectorAll('button,a'), function (n) { return QUIT.test((n.textContent || '').trim()) && n.getClientRects().length; })[0];
  if (quit) return;
  var f = document.createElement('div'); f.className = 'ccpf';
  f.style.justifyContent = 'flex-end';
  f.append(mkBtn('Close', X, function () { closeIt(ov); }));
  ov.appendChild(f);
}

var pushed = false, ignore = false, queued = false;
function scan() {
  queued = false;
  all(MODAL).forEach(function (ov) { if (shown(ov)) dress(ov); });
  all(SCREEN).forEach(function (ov) { if (shown(ov) && ov.id !== 'ccfid') floaters(ov); });
  if (!native) {                                                            // browser Back button closes the top panel
    var n = openList().length;
    if (n && !pushed) { try { history.pushState({ ccp: 1 }, ''); pushed = true; } catch (e) {} }
    else if (!n && pushed) { pushed = false; ignore = true; try { history.back(); } catch (e) { ignore = false; } }
  }
}
function queue() { if (!queued) { queued = true; requestAnimationFrame(scan); } }
new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
queue();

function goBack() {
  if (locked()) return false;
  var o = openList();
  if (o.length) { closeIt(o[o.length - 1]); return true; }
  var on = document.querySelector('#tb button.on');
  if (on && on.dataset.v !== 'feed') { var f = document.querySelector('#tb button[data-v="feed"]'); if (f) { f.click(); window.scrollTo(0, 0); return true; } }
  return false;
}
window.ccGoBack = goBack;

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape' || locked()) return;
  var o = openList(); if (o.length) closeIt(o[o.length - 1]);
});

if (!native) {
  window.addEventListener('popstate', function () {
    if (ignore) { ignore = false; return; }
    if (!pushed) return;
    pushed = false; var o = openList(); if (o.length) closeIt(o[o.length - 1]); queue();
  });
} else {
  var A = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
  if (A && A.addListener) A.addListener('backButton', function () {
    if (goBack()) return;
    try { A.exitApp(); } catch (e) {}
  });
}
})();
