/* cc-xcancel.js v2: gives every popup, sheet, form and flow step a plain X (no circle) when it has no visible close of its own.
   Covers add event, payments, M-Pesa waiting, processing animations and anything added later.
   Centered dialogs get the X on the dialog itself, full-screen panels get it in the top-right corner.
   Tapping it presses the panel's own cancel/close if there is one, then makes sure the panel is gone. */
(function () {
  'use strict';
  if (window.__ccXc) return; window.__ccXc = 1;
  var SKIP = 'nav,header,#tb,#tkb,#ccl,#loader,#lk,.toast,#toast,.bg,#ccfrst,#ccfp,#ck,#cookie,.cookie,.ccx-plain';
  var HAS = '[aria-label*="lose" i],[aria-label*="ancel" i],[aria-label*="ismiss" i],[data-close],[data-dismiss],.x,.close,.cls,.clx,.xbtn,.cc-x,[data-ccx]';
  var LOOKS = '[class*="modal"],[class*="sheet"],[class*="dialog"],[class*="popup"],[class*="drawer"],[class*="dlg"],[id*="modal"],[id*="sheet"],[id*="dialog"]';
  var TXT = /^(\u00d7|\u2715|\u2716|\u2717|x|close|cancel|dismiss)$/i;
  var STATIC = new WeakSet(); try { [].forEach.call(document.querySelectorAll('body *'), function (e) { STATIC.add(e); }); } catch (e) {}
  var X = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var st = document.createElement('style');
  st.textContent = '.ccx-plain{position:absolute;top:calc(8px + var(--ccx-top,0px));right:8px;z-index:2147483000;width:44px;height:44px;display:grid;place-items:center;'
    + 'padding:0;margin:0;border:0;border-radius:0;background:none;box-shadow:none;color:var(--fg,#fff);cursor:pointer;-webkit-tap-highlight-color:transparent;opacity:.9}'
    + '.ccx-plain:active{opacity:.5}';
  document.head.appendChild(st);

  function vis(el) {
    if (!el || !el.isConnected) return false;
    var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }
  function area(el) { var r = el.getBoundingClientRect(); return r.width * r.height; }
  function hasClose(el) {
    var n; try { n = el.querySelectorAll(HAS); } catch (e) { n = []; }
    for (var i = 0; i < n.length; i++) if (vis(n[i])) return true;
    var b = el.querySelectorAll('button,a,[role=button]');
    for (var j = 0; j < b.length; j++) if (TXT.test((b[j].textContent || '').trim()) && vis(b[j])) return true;
    return false;
  }
  var mo = new MutationObserver(function (recs) {
    recs.forEach(function (r) { var t = r.target; if (t.getAttribute && t.getAttribute('data-ccxh')) { t.style.removeProperty('display'); t.removeAttribute('data-ccxh'); } });
    mo.takeRecords();
  });
  function gone(ov) {
    if (!ov.isConnected || !vis(ov)) return;
    if (!STATIC.has(ov)) { ov.remove(); }
    else {
      ['on', 'open', 'show', 'active', 'shown', 'visible', 'is-open'].forEach(function (c) { ov.classList.remove(c); });
      ov.style.setProperty('display', 'none', 'important'); ov.setAttribute('data-ccxh', '1');
      mo.observe(ov, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] }); mo.takeRecords();
    }
    try { document.body.style.overflow = ''; } catch (e) {}
  }
  function cancel(ov) {
    try { ov.dispatchEvent(new CustomEvent('cc-cancel', { bubbles: true })); } catch (e) {}
    try { if (typeof window.ccPayCancel === 'function') window.ccPayCancel(); } catch (e) {}
    var own = null, all = ov.querySelectorAll('button,a,[role=button]');
    for (var i = 0; i < all.length; i++) { var t = (all[i].textContent || '').trim(); if (/^(cancel|close|not now)$/i.test(t) && !all[i].hasAttribute('data-ccx')) { own = all[i]; break; } }
    if (own) own.click();
    setTimeout(function () { gone(ov); }, 380);
  }
  // a centered dialog inside a bigger backdrop: put the X on the dialog itself
  function host(ov) {
    var kids = ov.children, best = null, ba = 0, oa = area(ov);
    for (var i = 0; i < kids.length; i++) { var k = kids[i]; if (k.matches && k.matches('.ccx-plain,script,style') || !vis(k)) continue; var a = area(k); if (a > ba) { ba = a; best = k; } }
    if (best && ba < 0.9 * oa && ba > 0.08 * oa) { if (getComputedStyle(best).position === 'static') best.style.position = 'relative'; return best; }
    return ov;
  }
  function addX(ov) {
    var h = host(ov), b = document.createElement('button');
    b.type = 'button'; b.className = 'ccx-plain'; b.setAttribute('data-ccx', '1'); b.setAttribute('aria-label', 'Close'); b.innerHTML = X;
    if (h === ov) b.style.setProperty('--ccx-top', 'env(safe-area-inset-top,0px)');
    b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); cancel(ov); };
    h.appendChild(b);
  }
  // a panel that has a visible Cancel button gets no X: take back any X we drew earlier (it comes back if the Cancel goes away)
  function prune() {
    [].forEach.call(document.querySelectorAll('.ccx-plain'), function (x) {
      var p = x.parentElement; if (!p) return;
      var c = [].some.call(p.querySelectorAll('button,a,[role=button]'), function (n) { return n !== x && /^cancel$/i.test((n.textContent || '').trim()) && vis(n); });
      if (c) x.remove();
    });
  }
  function scan() {
    prune();
    var vw = innerWidth, vh = innerHeight, min = 0.12 * vw * vh;
    var list = document.querySelectorAll('body *');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'SVG' || el.matches(SKIP) || el.closest('nav,header,#tb,#tkb,#ccl,#loader,#lk')) continue;
      var cs = getComputedStyle(el), pos = cs.position;
      var role = el.getAttribute('role') === 'dialog' || el.getAttribute('aria-modal') === 'true';
      var looks = false; try { looks = el.matches(LOOKS); } catch (e) {}
      if (!(pos === 'fixed' || role || (looks && pos === 'absolute'))) continue;
      var z = parseInt(cs.zIndex, 10) || 0;
      if (pos === 'fixed' && !role && !looks && z < 50) continue;                 // ordinary fixed bits of the page (buttons, bars) stay as they are
      if (!vis(el)) continue;
      var r = el.getBoundingClientRect();
      if (r.height < 120 || r.width * r.height < min) continue;                  // bars, toasts and small floating buttons are not panels
      if (hasClose(el)) continue;
      addX(el);
    }
  }
  var t = 0, queue = function () { clearTimeout(t); t = setTimeout(scan, 250); };
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
  queue();
})();
