/* cc-scrollbg.js v1: a scroll-driven video background (the video plays forward and back as you scroll).
   Everything already on the page stays; this only adds the video behind it and makes the glass panels clearer.
   4K file for big or retina screens on a good connection, 1080p for phones and slow data, a still poster otherwise. */
(function () {
  'use strict';
  if (window.__ccBgv) return; window.__ccBgv = 1;
  var bg = document.querySelector('.bg'); if (!bg) return;
  // The admin can switch the video off (Site editor > App look).
  try { var _s = JSON.parse(localStorage.getItem('cc_site_v1') || '{}'); if (_s && _s.scroll_video_off) { window.__ccBgv = 0; return; } } catch (e) {}
  document.addEventListener('cc-site', function (ev) {
    if (ev.detail && ev.detail.scroll_video_off) {
      var vv = document.querySelector('.bgv'), sc = document.querySelector('.bgv-scrim');
      if (vv) vv.remove(); if (sc) sc.remove(); document.body.classList.remove('cc-bgv-on');
    }
  });

  var BASE = (document.currentScript && document.currentScript.src ? document.currentScript.src.replace(/[^\/]*$/, '') : '') || '';
  var SRC4K = BASE + 'media/bg-4k.mp4?v=1', SRC1080 = BASE + 'media/bg-1080.mp4?v=1', POSTER = BASE + 'media/bg-poster.webp?v=1';
  var PX = 2400;                                   // pixels of scrolling for one full pass of the 8 second video (it then plays back the other way)
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- clearer glass: the video shows through the panels ---- */
  var css = document.createElement('style');
  css.textContent = [
    '.bgv{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%;pointer-events:none;background:#0E0F0B}',
    '.bgv-scrim{position:absolute;inset:0;pointer-events:none;background:linear-gradient(rgba(14,15,11,.34),rgba(14,15,11,.46))}',
    ':root[data-theme="light"] .bgv-scrim{background:linear-gradient(rgba(255,255,255,.14),rgba(255,255,255,.24))}',
    ':root{--g:rgba(14,16,22,.22);--gb:rgba(255,255,255,.32);--gh:rgba(255,255,255,.55)}',
    ':root[data-theme="light"]{--g:rgba(255,255,255,.26);--gb:rgba(14,15,11,.12);--gh:rgba(255,255,255,.9)}',
    '.g{-webkit-backdrop-filter:blur(5px) saturate(135%);backdrop-filter:blur(5px) saturate(135%)}',
    ':root:not([data-theme="light"]) :where(.g,h1,h2,h3,p,.sub,b){text-shadow:0 1px 10px rgba(14,15,11,.5)}',
    'body.cc-bgv-on .bg{background:#0E0F0B}'
  ].join('');
  document.head.appendChild(css);

  var v = document.createElement('video');
  v.className = 'bgv'; v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = false; v.preload = 'auto'; v.tabIndex = -1;
  v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.setAttribute('aria-hidden', 'true'); v.setAttribute('disablepictureinpicture', ''); v.setAttribute('disableremoteplayback', '');
  v.poster = POSTER;
  var scrim = document.createElement('div'); scrim.className = 'bgv-scrim';
  bg.insertBefore(scrim, bg.firstChild); bg.insertBefore(v, bg.firstChild);   // the existing background pieces stay on top of the video
  document.body.classList.add('cc-bgv-on');

  /* ---- which file ---- */
  async function pick() {
    var c = navigator.connection || {}, mem = navigator.deviceMemory || 4, wpx = innerWidth * (devicePixelRatio || 1);
    var slow = c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType || '') || mem <= 2;
    if (slow || wpx < 1500) return SRC1080;
    try {
      if (navigator.mediaCapabilities) {
        var r = await navigator.mediaCapabilities.decodingInfo({ type: 'file', video: { contentType: 'video/mp4; codecs="avc1.640033"', width: 2160, height: 3840, bitrate: 3500000, framerate: 24 } });
        if (!r.supported) return SRC1080;
      }
    } catch (e) {}
    return SRC4K;
  }

  /* ---- scroll to video time, eased so it glides ---- */
  var ready = false, dur = 0, pos = 0, cur = 0, lastSet = -1, raf = 0, lastY = new Map(); lastY.set('w', window.scrollY || 0);
  var tri = function (x) { x = ((x % 2) + 2) % 2; return x <= 1 ? x : 2 - x; };
  function kick() { if (ready && !raf && !document.hidden) raf = requestAnimationFrame(tick); }
  function tick() {
    raf = 0; if (!ready || document.hidden) return;
    var tgt = tri(pos / PX) * (dur - 0.06);
    cur += (tgt - cur) * 0.14; if (Math.abs(tgt - cur) < 0.004) cur = tgt;
    if (!v.seeking && Math.abs(cur - lastSet) >= 1 / 48) { try { v.currentTime = cur; lastSet = cur; } catch (e) {} }
    if (innerWidth > innerHeight) v.style.objectPosition = '50% ' + (18 + 64 * (cur / dur)) + '%'; else v.style.objectPosition = '50% 50%';
    if (cur !== tgt || v.seeking) raf = requestAnimationFrame(tick);
  }
  addEventListener('scroll', function (e) {                       // capture: also sees scrolling inside panels
    var t = e.target, isDoc = t === document || t === document.documentElement || t === document.body;
    var y = isDoc ? (window.scrollY || document.documentElement.scrollTop || 0) : (t.scrollTop || 0), key = isDoc ? 'w' : t;
    var prev = lastY.has(key) ? lastY.get(key) : (isDoc ? 0 : 0); lastY.set(key, y);
    var d = y - prev; if (Math.abs(d) > 1200) d = 0;              // a jump to the top when you change tab does not rewind the video
    if (d) { pos += d; kick(); }
  }, { passive: true, capture: true });
  document.addEventListener('visibilitychange', kick);
  addEventListener('resize', kick);

  function load(src, triedFallback) {
    ready = false;
    v.addEventListener('loadedmetadata', function () { dur = v.duration || 0; }, { once: true });
    v.addEventListener('loadeddata', function () {
      if (!(dur > 0.5)) dur = v.duration || 0;
      var p; try { p = v.play(); } catch (e) {}
      var settle = function () { try { v.pause(); v.currentTime = 0.001; } catch (e) {} lastSet = 0.001; cur = 0; ready = true; kick(); };
      if (p && p.then) p.then(settle, settle); else settle();      // a quick play and pause lets iPhones seek frame by frame
    }, { once: true });
    v.addEventListener('error', function () {
      if (src === SRC4K && !triedFallback) return load(SRC1080, true);
      v.remove(); scrim.remove(); document.body.classList.remove('cc-bgv-on');   // anything wrong: the old background simply stays
    }, { once: true });
    v.src = src; v.load();
  }

  if (reduce) return;                                              // reduced motion: the still poster only, no movement
  var start = function () { pick().then(function (s) { load(s, false); }); };
  if (document.readyState === 'complete') setTimeout(start, 300); else addEventListener('load', function () { setTimeout(start, 300); });
})();
