/* cc-ptr.js v1: swipe down from the top of any tab to refresh the app.
   A plain circle with the Comrade Connect logo in the middle: black in light mode, white in dark mode (both follow the theme colour).
   Pull until the circle fills, let go, and the app reloads on the same tab. Nothing else is touched. */
(function () {
  'use strict';
  if (window.__ccPtr) return; window.__ccPtr = 1;
  var TH = 76, MAXD = 150, KEY = 'cc_ptr_view', C = 2 * Math.PI * 22;
  var BLOCK = 'input,textarea,select,video,canvas,iframe,[role="dialog"],[aria-modal="true"],#lk,#loader,#ccgate,#ccland,#mbg-room,#dm,#ccfp,#rmedia,#ccl-mini,.leaflet-container,.ccn,.sheet,[class*="sheet"],[class*="modal"]';
  var el, ring, prog, lg, y0 = 0, x0 = 0, dist = 0, on = false, track = false, busy = false;

  var st = document.createElement('style');
  st.textContent = 'html,body{overscroll-behavior-y:contain}'
    + '#ccptr{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 58px);width:52px;height:52px;margin-left:-26px;z-index:300;display:grid;place-items:center;border-radius:50%;'
    + 'background:color-mix(in srgb,var(--bg,#000) 82%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid var(--gb,rgba(255,255,255,.22));color:var(--fg,#fff);'
    + 'opacity:0;transform:translateY(-80px);pointer-events:none;will-change:transform,opacity}'
    + '#ccptr.rel{transition:transform .28s cubic-bezier(.2,.9,.3,1),opacity .2s}'
    + '#ccptr svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}'
    + '#ccptr circle{fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round}'
    + '#ccptr .t{opacity:.18}'
    + '#ccptr .lg{width:26px;height:19px;background:currentColor;-webkit-mask:var(--ptr-mask) center/contain no-repeat;mask:var(--ptr-mask) center/contain no-repeat}'
    + '#ccptr.spin svg{animation:ccptr 0.9s linear infinite}'
    + '@keyframes ccptr{to{transform:rotate(270deg)}}';
  document.head.appendChild(st);

  function maskOf() {                                           // the logo shape the site already uses in its loader and header
    var sel = ['#loader .lgo', 'nav .nb .lgo', '#lk .lgo'];
    for (var i = 0; i < sel.length; i++) {
      var n = document.querySelector(sel[i]); if (!n) continue;
      var cs = getComputedStyle(n), m = cs.webkitMaskImage || cs.maskImage || '';
      if (m && m !== 'none') return m;
    }
    return '';
  }
  function build() {
    if (el) return;
    el = document.createElement('div'); el.id = 'ccptr'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<svg viewBox="0 0 52 52"><circle class="t" cx="26" cy="26" r="22"/><circle class="p" cx="26" cy="26" r="22"/></svg><span class="lg"></span>';
    prog = el.querySelector('.p'); prog.style.strokeDasharray = C + ' ' + C; prog.style.strokeDashoffset = C;
    document.body.appendChild(el);
  }
  function setMask() {
    var m = maskOf(); if (m) el.style.setProperty('--ptr-mask', m); else el.querySelector('.lg').style.display = 'none';
  }
  function top() { var s = document.scrollingElement || document.documentElement; return (s.scrollTop || window.pageYOffset || 0) <= 0; }
  function allowed(t) {
    if (document.body.classList.contains('mbg-on')) return false;
    if (t.closest && t.closest(BLOCK)) return false;
    for (var n = t; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      if (n.scrollTop > 0) return false;                         // a list inside the page is not at its top yet
      var cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 4) return false;   // sideways rows keep their own swipe
    }
    return true;
  }
  function draw(d) {
    var p = Math.min(1, d / TH), shift = Math.min(d, MAXD) * 0.55;
    el.style.opacity = Math.min(1, d / 28);
    el.style.transform = 'translateY(' + (shift - 70) + 'px) scale(' + (0.7 + 0.3 * p) + ')';
    prog.style.strokeDashoffset = C * (1 - p);
    el.querySelector('.lg').style.opacity = 0.45 + 0.55 * p;
  }
  function reset() {
    el.classList.add('rel'); el.classList.remove('spin'); el.style.opacity = 0; el.style.transform = 'translateY(-80px)';
    setTimeout(function () { if (el) el.classList.remove('rel'); }, 320);
  }
  function refresh() {
    if (navigator.onLine === false) { reset(); return; }          // nothing to refresh from: the offline notice already explains
    busy = true;
    el.classList.add('rel', 'spin'); el.style.opacity = 1; el.style.transform = 'translateY(-4px) scale(1)';
    prog.style.strokeDasharray = (C * 0.28) + ' ' + C; prog.style.strokeDashoffset = 0;
    try { sessionStorage.setItem(KEY, (document.body.dataset && document.body.dataset.view) || ''); } catch (e) {}
    setTimeout(function () { location.reload(); }, 850);
  }

  document.addEventListener('touchstart', function (e) {
    track = on = false; dist = 0;
    if (busy || e.touches.length !== 1 || !top() || !allowed(e.target)) return;
    build(); y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; track = true;
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!track || busy) return;
    var dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
    if (!on) {
      if (dy < 0 || Math.abs(dx) > Math.abs(dy)) { if (dy < -6 || Math.abs(dx) > 12) track = false; return; }
      if (dy < 10 || !top()) return;
      on = true; el.classList.remove('rel'); setMask();
    }
    if (!top()) { on = false; track = false; reset(); return; }
    dist = dy; if (e.cancelable) e.preventDefault(); draw(dist);
  }, { passive: false });
  function end() {
    if (!track && !on) return;
    var go = on && dist >= TH; track = false;
    if (!on) return; on = false;
    if (go) refresh(); else reset();
  }
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', function () { if (on) { on = false; track = false; reset(); } }, { passive: true });

  // after the reload, come back to the tab you were on
  var back = ''; try { back = sessionStorage.getItem(KEY) || ''; sessionStorage.removeItem(KEY); } catch (e) {}
  if (back) {
    var n = 0, t = setInterval(function () {
      if (typeof window.go === 'function' && document.getElementById('v-' + back)) {
        clearInterval(t);
        try { if (document.body.dataset.view !== back) window.go(back); } catch (e) {}
      } else if (++n > 40) clearInterval(t);
    }, 250);
  }
})();
