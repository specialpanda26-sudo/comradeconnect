/* cc-nav.js v1: safety layer for X buttons and the phone back button.
   It never replaces the page's own handlers. It waits for them to run, and only steps in when a panel is still open
   after its X was tapped, or when the back button did nothing. It is loaded BEFORE cc-panels.js so it sees the screen as it was. */
(function () {
  'use strict';
  if (window.__ccNav) return; window.__ccNav = 1;
  var T0 = Date.now();
  var CLOSE_SEL = '[aria-label*="lose" i],[aria-label*="ismiss" i],[data-close],[data-dismiss],.x,.close,.cls,.clx,.xbtn,.cc-x';
  var SKIP = 'nav,header,#tb,#loader,#ccgate,#lk,#ccfp,.toast,#toast,.bg,#rmedia,#ccl-mini';   // the live video is never a stuck popup
  var STATIC = new WeakSet(); try { [].forEach.call(document.querySelectorAll('body *'), function (e) { STATIC.add(e); }); } catch (e) {}

  function vis(el) {
    if (!el || !el.isConnected) return false;
    var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }
  function isCloseEl(b) {
    try { if (b.matches(CLOSE_SEL)) return true; } catch (e) {}
    return /^(\u00d7|\u2715|\u2716|\u2717|x|close|dismiss)$/i.test((b.textContent || '').trim());
  }
  function overlayOf(node) {
    for (var el = node; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (el.matches && el.matches(SKIP)) return null;
      var cs = getComputedStyle(el);
      if (cs.position === 'fixed' || el.getAttribute('role') === 'dialog' || el.getAttribute('aria-modal') === 'true') return el;
    }
    return null;
  }
  function topOverlay() {
    var best = null, bz = -1, vw = innerWidth, vh = innerHeight;
    var list = document.querySelectorAll('body > *, [role=dialog], [aria-modal=true]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.matches(SKIP + ',script,style')) continue;
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && el.getAttribute('role') !== 'dialog' && el.getAttribute('aria-modal') !== 'true') continue;
      if (!vis(el)) continue;
      var r = el.getBoundingClientRect(); if (r.width * r.height < 0.3 * vw * vh) continue;
      var z = parseInt(cs.zIndex, 10) || 0; if (z >= bz) { best = el; bz = z; }
    }
    return best;
  }
  function closeBtnIn(el) {
    var b = null; try { b = el.querySelector(CLOSE_SEL); } catch (e) {}
    if (b) return b;
    var all = el.querySelectorAll('button,a,[role=button]');
    for (var i = 0; i < all.length; i++) if (isCloseEl(all[i])) return all[i];
    return null;
  }

  // forced close: only used when the page's own close did nothing
  var mo = new MutationObserver(function (recs) {
    recs.forEach(function (r) {
      var t = r.target;
      if (t.getAttribute && t.getAttribute('data-ccnav')) { t.style.removeProperty('display'); t.removeAttribute('data-ccnav'); }   // the page opened it again: let it show
    });
    mo.takeRecords();
  });
  function forceHide(el) {
    if (!el || !el.isConnected || (el.matches && el.matches(SKIP))) return;
    if (!STATIC.has(el)) { el.remove(); }
    else {
      ['on', 'open', 'show', 'active', 'shown', 'visible', 'is-open'].forEach(function (c) { el.classList.remove(c); });
      el.style.setProperty('display', 'none', 'important'); el.setAttribute('data-ccnav', '1');
      mo.observe(el, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] }); mo.takeRecords();
    }
    if (!topOverlay()) { try { document.body.style.overflow = ''; document.documentElement.style.overflow = ''; } catch (e) {} }
  }

  // 1) X buttons: after the page's own handler had its turn, a panel that is still open gets closed.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button,a,[role=button],' + CLOSE_SEL);
    if (!b || !isCloseEl(b)) return;
    var ov = overlayOf(b); if (!ov) return;
    setTimeout(function () { if (ov.isConnected && vis(ov)) forceHide(ov); }, 90);
  }, true);

  // 2) Phone back button
  var lastBack = 0;
  var say = function (t) { try { if (window.ccTools && ccTools.toast) ccTools.toast(t); else if (typeof toast === 'function') toast(t); } catch (e) {} };
  function snap() {
    var me = document.getElementById('me');
    return { top: topOverlay(), view: document.body.dataset.view || '', hash: location.hash, href: location.href, me: !!(me && me.classList.contains('ccp')) };
  }
  function changed(a, b) { return a.top !== b.top || a.view !== b.view || a.hash !== b.hash || a.href !== b.href || a.me !== b.me; }
  function act(s, A) {
    if (s.top) {
      var b = closeBtnIn(s.top); if (b) b.click();
      setTimeout(function () { if (s.top.isConnected && vis(s.top)) forceHide(s.top); }, 120);
      return;
    }
    if (s.me) { var bk = document.getElementById('ccback'); if (bk) { bk.click(); return; } }
    if (s.view && s.view !== 'feed') { var tb = document.querySelector('#tb button[data-v="feed"]'); if (tb) { tb.click(); return; } }
    var now = Date.now();
    if (now - lastBack < 2200) { try { A && A.exitApp && A.exitApp(); } catch (e) {} }
    else { lastBack = now; say('Press back again to exit'); }
  }
  var cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
    var A = (cap.Plugins && cap.Plugins.App) || (cap.registerPlugin ? cap.registerPlugin('App') : null);
    if (A && A.addListener) A.addListener('backButton', function () {
      var s = snap();                                                              // taken before the page's own back handler changes anything
      setTimeout(function () { if (!changed(s, snap()) && Date.now() - (window.__cclBackAt || 0) > 800) act(s, A); setTimeout(unloader, 600); }, 120);
    });
  }

  // 3) The loading screen must never come back once the app is running (back button, resume, history jumps)
  function unloader() {
    var l = document.getElementById('loader');
    if (l && Date.now() - T0 > 12000 && vis(l)) l.style.setProperty('display', 'none', 'important');
  }
  window.addEventListener('popstate', function () { setTimeout(unloader, 300); });
  window.addEventListener('pageshow', function () { setTimeout(unloader, 300); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(unloader, 300); });
  setInterval(unloader, 2500);
})();
