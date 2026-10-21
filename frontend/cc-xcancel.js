/* cc-xcancel.js v1: gives every full-screen panel a plain X (no circle) when it has no close or cancel of its own.
   Covers payment, M-Pesa waiting, success/processing animations and any other overlay, now and in the future.
   Tapping it first presses the panel's own cancel/close if there is one, then makes sure the panel is gone. */
(function () {
  'use strict';
  if (window.__ccXc) return; window.__ccXc = 1;
  var SKIP = 'nav,header,#tb,#loader,#lk,.toast,#toast,.bg,#ccfrst,#ccfp';
  var HAS = '[aria-label*="lose" i],[aria-label*="ancel" i],[aria-label*="ismiss" i],[data-close],[data-dismiss],.x,.close,.cls,.clx,.xbtn,.cc-x,[data-ccx]';
  var TXT = /^(\u00d7|\u2715|\u2716|\u2717|x|close|cancel|dismiss)$/i;
  var STATIC = new WeakSet(); try { [].forEach.call(document.querySelectorAll('body *'), function (e) { STATIC.add(e); }); } catch (e) {}
  var X = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var st = document.createElement('style');
  st.textContent = '.ccx-plain{position:absolute;top:calc(10px + env(safe-area-inset-top,0px));right:10px;z-index:2147483000;width:44px;height:44px;display:grid;place-items:center;'
    + 'padding:0;margin:0;border:0;border-radius:0;background:none;box-shadow:none;color:var(--fg,#fff);cursor:pointer;-webkit-tap-highlight-color:transparent;opacity:.9}'
    + '.ccx-plain:active{opacity:.5}';
  document.head.appendChild(st);

  function vis(el) {
    if (!el || !el.isConnected) return false;
    var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }
  function hasClose(el) {
    try { if (el.querySelector(HAS)) return true; } catch (e) {}
    var b = el.querySelectorAll('button,a,[role=button]');
    for (var i = 0; i < b.length; i++) if (TXT.test((b[i].textContent || '').trim())) return true;
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
    for (var i = 0; i < all.length; i++) { var t = (all[i].textContent || '').trim(); if (/^(cancel|close|back|not now)$/i.test(t) && !all[i].hasAttribute('data-ccx')) { own = all[i]; break; } }
    if (own) own.click();
    setTimeout(function () { gone(ov); }, 380);
  }
  function addX(ov) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ccx-plain'; b.setAttribute('data-ccx', '1'); b.setAttribute('aria-label', 'Close'); b.innerHTML = X;
    b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); cancel(ov); };
    ov.appendChild(b);
  }
  function scan() {
    var vw = innerWidth, vh = innerHeight, list = document.querySelectorAll('body > *, [role=dialog], [aria-modal=true]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.matches(SKIP)) continue;
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && el.getAttribute('role') !== 'dialog' && el.getAttribute('aria-modal') !== 'true') continue;
      if (!vis(el)) continue;
      var r = el.getBoundingClientRect(); if (r.width * r.height < 0.4 * vw * vh) continue;
      if (hasClose(el)) continue;
      addX(el);
    }
  }
  var t = 0, queue = function () { clearTimeout(t); t = setTimeout(scan, 200); };
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
  queue();
})();
