/* cc-motion.js v1 (section 2 of 2): drives the motion in cc-motion.css.
   - scroll reveal (staggered) for cards and rows, including ones drawn later
   - heart pop + particles on likes
   - numbers count up when Me / Rewards open
   - window.ccMotion.busy(button,'Posting') -> pill with label + dots, returns done(true|false) (check or shake)
   - sign-up / log-in pill in the welcome gate (shadow DOM): "Signing you up" + shimmer + shake on error
   - upload card (ccUpload) gets a smoother start/finish
   Nothing here changes accounts, payments or data. If this file fails, the app works exactly as before. */
(function () {
  'use strict';
  if (window.ccMotion) return;
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- busy button ---------- */
  var CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function busy(btn, label) {
    if (!btn || btn.__cmBusy) return function () {};
    var html = btn.innerHTML, w = btn.offsetWidth, h = btn.offsetHeight, t0 = Date.now();
    btn.__cmBusy = 1;
    btn.style.minWidth = w + 'px'; btn.style.minHeight = h + 'px';
    btn.classList.add('cm-busy'); btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = '<span>' + (label || 'Please wait') + '</span><span class="cm-spin" aria-hidden="true"></span>';
    return function done(ok, msg) {
      var wait = Math.max(0, 450 - (Date.now() - t0));   /* never flash: show it for at least a beat */
      setTimeout(function () {
        btn.classList.remove('cm-busy'); btn.removeAttribute('aria-busy');
        if (ok) {
          btn.classList.add('cm-ok'); btn.innerHTML = CHECK;
          setTimeout(function () { btn.classList.remove('cm-ok'); btn.innerHTML = html; btn.style.minWidth = btn.style.minHeight = ''; btn.__cmBusy = 0; }, 1100);
        } else {
          btn.innerHTML = html; btn.style.minWidth = btn.style.minHeight = ''; btn.__cmBusy = 0;
          if (!reduce) { btn.classList.add('cm-shake'); setTimeout(function () { btn.classList.remove('cm-shake'); }, 450); }
        }
      }, wait);
    };
  }
  window.ccMotion = { busy: busy, shake: shake };
  function shake(el) { if (!el || reduce) return; el.classList.remove('cm-shake'); void el.offsetWidth; el.classList.add('cm-shake'); setTimeout(function () { el.classList.remove('cm-shake'); }, 450); }

  /* ---------- upload card ---------- */
  (function wrapUpload() {
    var n = 0, iv = setInterval(function () {
      if (window.ccUpload && !window.ccUpload.__cm) {
        var u = window.ccUpload, p = u.progress;
        u.__cm = 1;
        u.progress = function (v) {   /* ease the number so it never jumps backwards */
          v = Math.max(u.__last || 0, v || 0); u.__last = v; return p.call(u, v);
        };
        var s = u.start; u.start = function () { u.__last = 0; return s.apply(u, arguments); };
        clearInterval(iv);
      }
      if (++n > 40) clearInterval(iv);
    }, 250);
  })();

  if (reduce) return;   /* everything below is pure motion */

  /* ---------- first impression ---------- */
  document.documentElement.classList.add('cm-boot');
  setTimeout(function () { document.documentElement.classList.remove('cm-boot'); }, 1600);

  /* ---------- scroll reveal ---------- */
  var SEL = '.view .pcard,.view .box.g,.view .crd-tile,.view .crd-row,.view .mc,.view .mecard,.view .crd-sec,.view .pulse>*';
  var io = null, batch = 0;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (es) {
      var k = 0;
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target; io.unobserve(el);
        el.style.setProperty('--cm-d', Math.min(k++, 6) * 0.06 + 's');
        el.classList.add('cm-in');
        setTimeout(function () { el.classList.remove('cm-rv', 'cm-in'); el.style.removeProperty('--cm-d'); }, 1200);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -4% 0px' });
  }
  function tag() {
    if (!io) return;
    $$(SEL).forEach(function (el) {
      if (el.__cm || el.closest('#dm') || el.closest('#ccgate')) return;
      el.__cm = 1; el.classList.add('cm-rv'); io.observe(el);
    });
  }
  var raf = 0;
  new MutationObserver(function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; tag(); }); })
    .observe(document.body, { childList: true, subtree: true });
  tag();

  /* ---------- likes: pop + particles (only when it became liked) ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.act.lk,.act.vlk');
    if (!b) return;
    setTimeout(function () {
      b.classList.remove('cm-pop'); void b.offsetWidth; b.classList.add('cm-pop');
      setTimeout(function () { b.classList.remove('cm-pop'); }, 520);
      if (!b.classList.contains('liked')) return;
      var r = b.getBoundingClientRect(), f = document.createElement('div');
      f.className = 'cm-burst'; f.style.left = (r.left + 22) + 'px'; f.style.top = (r.top + r.height / 2) + 'px';
      for (var i = 0; i < 8; i++) {
        var a = (Math.PI * 2 * i) / 8, d = 22 + (i % 2) * 10, p = document.createElement('i');
        p.style.setProperty('--x', Math.cos(a) * d + 'px'); p.style.setProperty('--y', Math.sin(a) * d + 'px'); f.appendChild(p);
      }
      document.body.appendChild(f); setTimeout(function () { f.remove(); }, 750);
    }, 40);
  }, true);

  /* ---------- count up (Me and Rewards) ---------- */
  function count(el) {
    var to = parseInt(el.textContent.replace(/,/g, ''), 10);
    if (!(to > 0) || to > 999999 || el.__cmc === to) return;
    el.__cmc = to; var t0 = performance.now(), D = 800 + Math.min(to, 500);
    (function step(t) {
      var k = Math.min(1, (t - t0) / D), v = Math.round(to * (1 - Math.pow(1 - k, 3)));
      el.textContent = v.toLocaleString('en-US');
      if (k < 1) requestAnimationFrame(step); else el.textContent = to.toLocaleString('en-US');
    })(t0);
  }
  function scanNumbers() {
    var v = document.body.dataset.view;
    if (v !== 'me' && v !== 'rewards') return;
    setTimeout(function () {
      $$('#v-' + v + ' .mecard b,#v-' + v + ' .mecard strong,#v-' + v + ' .mecard span,#v-' + v + ' .mecard div').forEach(function (el) {
        if (!el.children.length && /^\d{1,6}$/.test(el.textContent.trim())) count(el);
      });
    }, 280);
  }
  new MutationObserver(scanNumbers).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });

  /* ---------- welcome gate: Sign up / Log in pill (it lives in a shadow root) ---------- */
  var GATE_CSS =
    '.btn{position:relative}' +
    '.btn.ld{width:min(100%,214px)}' +
    '.btn.ld .t{display:inline;white-space:nowrap}' +
    '.btn.ld .sn{display:inline-flex;margin-left:8px}' +
    '.btn.ld::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 25%,rgba(255,255,255,.25) 50%,transparent 75%);transform:translateX(-100%);animation:cmsh 1.1s linear infinite}' +
    '@keyframes cmsh{to{transform:translateX(100%)}}' +
    '.cmshk{animation:cmshk .42s ease}@keyframes cmshk{20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}' +
    '.in input:focus{box-shadow:0 0 0 4px rgba(255,138,61,.18)}.in input{transition:border-color .2s,box-shadow .25s}' +
    '.err:not(:empty){animation:cgup .35s ease both}';
  function wireGate(host) {
    var root = host.shadowRoot; if (!root || root.__cm) return; root.__cm = 1;
    var st = document.createElement('style'); st.textContent = GATE_CSS; root.appendChild(st);
    $$('.btn[type=submit]', root).forEach(function (b) {
      var t = b.querySelector('.t'); if (!t) return;
      var orig = t.textContent, form = b.closest('form');
      var word = form && form.id === 'pu' ? 'Signing you up' : 'Logging you in';
      new MutationObserver(function () {
        if (b.classList.contains('ld')) { t.textContent = word; }
        else { t.textContent = orig; }
      }).observe(b, { attributes: true, attributeFilter: ['class'] });
    });
    $$('.err', root).forEach(function (er) {
      new MutationObserver(function () {
        if (!er.textContent.trim()) return;
        var f = er.closest('form'); if (!f) return;
        $$('.in', f).forEach(function (i) { i.classList.remove('cmshk'); void i.offsetWidth; i.classList.add('cmshk'); });
      }).observe(er, { childList: true, characterData: true, subtree: true });
    });
  }
  new MutationObserver(function () { var h = document.getElementById('ccgate'); if (h) wireGate(h); })
    .observe(document.body, { childList: true });
  var g0 = document.getElementById('ccgate'); if (g0) wireGate(g0);
})();
