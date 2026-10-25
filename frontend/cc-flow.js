/* cc-flow.js v1 (section 4 of 4):
   1. one recovery-email panel: every "Recovery email" button opens the same panel (cc-emailask.js), the old Me-page nudge card is gone
   2. no more doubles: repeated rows and cards on the Me / Settings screens are hidden (first one stays)
   3. buttons that talk to the server show a spinner and shimmer until the server answers, then a small pop
   Nothing here changes accounts, payments or data. If this file fails the app works as before. */
(function () {
  'use strict';
  if (window.__ccFlow) return; window.__ccFlow = 1;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- 1. one recovery-email panel ---------- */
  function openPanel(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (window.ccAskEmail) window.ccAskEmail();
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest('#rcgo') || t.closest('#ccrecnudge a')) return openPanel(e);
    var row = t.closest('.mit[data-t="Recovery email"]');
    if (row) return openPanel(e);
    var a = t.closest('a[href$="recovery-email.html"]');
    if (a) return openPanel(e);
  }, true);

  /* ---------- 2. no more doubles ---------- */
  var norm = function (s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); };
  function key(el) {
    if (el.dataset && el.dataset.t) return norm(el.dataset.t);
    var h = el.querySelector('h3,b,strong'); return h ? norm(h.textContent).slice(0, 48) : '';
  }
  function dedupe() {
    var sets = {};   /* Settings sheet: the same row twice anywhere inside it keeps only the first */
    $$('.ccset-card > *').forEach(function (el) {
      var b = el.querySelector('b'); var k = b ? norm(b.textContent) : ''; if (!k) return;
      if (sets[k]) el.classList.add('cf-dupe'); else sets[k] = 1;
    });
    var me = document.getElementById('v-me'); if (!me) return;
    var rc = document.getElementById('rcgo'); if (rc && rc.closest('.box')) rc.closest('.box').classList.add('cf-hide');   /* the panel replaces this card */
    /* only menu rows (.mit) and cards that have a title (h3). Lists such as transactions are never touched. */
    var seenRow = {}, seenBox = {};
    $$('#v-me .mit, #ccmenu .mit').forEach(function (el) {
      if (el.classList.contains('cf-hide') || el.classList.contains('out')) return;
      var k = key(el); if (!k) return;
      if (seenRow[k]) el.classList.add('cf-dupe'); else seenRow[k] = 1;
    });
    $$('#v-me .box.g').forEach(function (el) {
      if (el.classList.contains('cf-hide') || el.closest('#ccmenu')) return;
      var h = el.querySelector(':scope > h3'); if (!h) return;
      var k = norm(h.textContent); if (!k) return;
      if (seenBox[k]) el.classList.add('cf-dupe'); else seenBox[k] = 1;
    });
  }
  var raf = 0;
  function later() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; try { dedupe(); } catch (e) {} }); }
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  later();

  /* ---------- 3. waiting buttons ---------- */
  var BTN = '.btn:not(.g):not(.xb),button.btn.p,#dm button.btn:not(.g)', pending = null, live = 0;
  function finish(btn, ok) {
    if (!btn || !btn.classList.contains('cf-wait')) return;
    var wait = Math.max(0, 600 - (Date.now() - btn.__cfT));
    setTimeout(function () {
      btn.classList.remove('cf-wait'); btn.removeAttribute('aria-busy');
      if (!reduce) { btn.classList.add(ok ? 'cf-fine' : 'cm-shake'); setTimeout(function () { btn.classList.remove('cf-fine', 'cm-shake'); }, 520); }
    }, wait);
  }
  function arm(btn) {
    if (btn.classList.contains('cf-wait')) return;
    btn.__cfT = Date.now(); btn.classList.add('cf-wait'); btn.setAttribute('aria-busy', 'true');
    setTimeout(function () { finish(btn, true); }, 20000);   /* never stuck */
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest(BTN);
    if (!b || b.closest('#ccgate') || b.disabled || b.classList.contains('cf-wait')) return;
    var txt = (b.textContent || '').trim(); if (!txt || txt.length > 40) return;
    pending = { b: b, t: Date.now() }; live = 0;
    setTimeout(function () { if (pending && pending.b === b) pending = null; }, 350);   /* only a request that starts right after the tap counts */
  }, true);
  if (typeof window.fetch === 'function' && !window.fetch.__cf) {
    var of = window.fetch;
    window.fetch = function (input, init) {
      var p = of.apply(this, arguments), pd = pending, m = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (pd && m !== 'GET' && Date.now() - pd.t < 350 && document.contains(pd.b)) {
        arm(pd.b); live++;
        var end = function (ok) { live--; if (live <= 0) finish(pd.b, ok); };
        p.then(function (r) { end(!!(r && r.ok)); }, function () { end(false); });
      }
      return p;
    };
    window.fetch.__cf = 1;
  }
})();
