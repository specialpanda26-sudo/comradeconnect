/* ludo-loader.js: full-screen loading screen with two 3D dice tumbling.
   Add <script src="/ludo-loader.js"></script> in <head>. It shows at once and hides itself when the page has loaded.
   Add the attribute data-hold to keep it up until the page calls LudoLoader.hide(). A safety timer removes it after 9 seconds.
   Colours come from the page's CSS variables (--bg, --fg, --mut, --die, --pip, --r, --b) so it follows light and dark theme. */
(function () {
  'use strict';
  if (window.LudoLoader) return;
  var hold = !!(document.currentScript && document.currentScript.hasAttribute('data-hold'));
  var MIN_MS = 1500, t0 = Date.now(), gone = false, el = null;
  var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  var css = [
    '#ll{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;background:var(--bg,#000);color:var(--fg,#fff);font-family:Poppins,system-ui,sans-serif;transition:opacity .45s ease,transform .45s ease}',
    '#ll.out{opacity:0;transform:scale(1.03);pointer-events:none}',
    '#ll .stage{display:flex;gap:52px;align-items:flex-end;height:150px;perspective:700px;padding:0 10px}',
    '#ll .d{--z:27px;position:relative;width:54px;height:54px;transform-style:preserve-3d}',
    '#ll .hop{position:absolute;inset:0;transform-style:preserve-3d;animation:llhop 1.15s cubic-bezier(.3,0,.4,1) infinite}',
    '#ll .d.b .hop{animation-delay:-.575s;animation-duration:1.15s}',
    '#ll .spin{position:absolute;inset:0;transform-style:preserve-3d;animation:llspin 2.3s linear infinite}',
    '#ll .d.b .spin{animation-name:llspin2;animation-duration:2.9s}',
    '#ll .f{position:absolute;inset:0;border-radius:10px;background:linear-gradient(145deg,var(--die,#f4f4f6),color-mix(in srgb,var(--die,#f4f4f6) 80%,#888));border:1px solid var(--gb,rgba(128,128,128,.4));display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);padding:6px;backface-visibility:hidden;box-shadow:inset 0 0 9px rgba(0,0,0,.18)}',
    '#ll .f i{border-radius:50%}',
    '#ll .f i.on{background:radial-gradient(circle at 35% 30%,#555,var(--pip,#0b0b0d) 62%);transform:scale(.72);box-shadow:inset 0 1px 2px rgba(0,0,0,.6)}',
    '#ll .d.a .f1 i.on{background:radial-gradient(circle at 35% 30%,#ff8a93,var(--r,#e5303d) 65%);transform:scale(.95)}',
    '#ll .d.b .f1 i.on{background:radial-gradient(circle at 35% 30%,#8fb8ff,var(--b,#2f6fe0) 65%);transform:scale(.95)}',
    '#ll .f1{transform:translateZ(var(--z))}#ll .f2{transform:rotateY(90deg) translateZ(var(--z))}#ll .f3{transform:rotateX(90deg) translateZ(var(--z))}',
    '#ll .f4{transform:rotateX(-90deg) translateZ(var(--z))}#ll .f5{transform:rotateY(-90deg) translateZ(var(--z))}#ll .f6{transform:rotateY(180deg) translateZ(var(--z))}',
    '#ll .sh{position:absolute;left:50%;bottom:-16px;width:62px;height:14px;margin-left:-31px;border-radius:50%;background:radial-gradient(rgba(0,0,0,.55),transparent 70%);animation:llsh 1.15s cubic-bezier(.3,0,.4,1) infinite}',
    '#ll .d.b .sh{animation-delay:-.575s}',
    '#ll h1{font:800 22px Unbounded,Poppins,system-ui,sans-serif;letter-spacing:6px;margin:0;padding-left:6px}',
    '#ll p{margin:-22px 0 0;font-size:12px;color:var(--mut,rgba(255,255,255,.6));letter-spacing:.4px}',
    '#ll .bar{width:120px;height:3px;border-radius:3px;background:var(--line,rgba(128,128,128,.3));overflow:hidden;margin-top:-14px}',
    '#ll .bar b{display:block;height:100%;width:40%;border-radius:3px;background:var(--fg,#fff);animation:llbar 1.4s ease-in-out infinite}',
    '@keyframes llhop{0%,100%{transform:translateY(0)}48%{transform:translateY(-88px)}}',
    '@keyframes llspin{to{transform:rotateX(720deg) rotateY(1080deg) rotateZ(360deg)}}',
    '@keyframes llspin2{to{transform:rotateX(-1080deg) rotateY(720deg) rotateZ(-360deg)}}',
    '@keyframes llsh{0%,100%{transform:scale(1);opacity:1}48%{transform:scale(.45);opacity:.35}}',
    '@keyframes llbar{0%{margin-left:-40%}100%{margin-left:100%}}',
    '@media (prefers-reduced-motion:reduce){#ll .hop,#ll .spin,#ll .sh{animation:none!important}#ll .spin{transform:rotateX(-24deg) rotateY(-30deg)}#ll .bar b{animation:none!important;width:100%;opacity:.5}}'
  ].join('');

  function cube(cls) {
    var faces = '';
    for (var n = 1; n <= 6; n++) {
      var dots = '';
      for (var i = 0; i < 9; i++) dots += '<i' + (PIPS[n].indexOf(i) > -1 ? ' class="on"' : '') + '></i>';
      faces += '<div class="f f' + n + '">' + dots + '</div>';
    }
    return '<div class="d ' + cls + '"><span class="sh"></span><div class="hop"><div class="spin">' + faces + '</div></div></div>';
  }
  function show() {
    var st = document.createElement('style'); st.id = 'll-css'; st.textContent = css;
    el = document.createElement('div'); el.id = 'll'; el.setAttribute('role', 'status'); el.setAttribute('aria-label', 'Loading Ludo');
    el.innerHTML = '<div class="stage">' + cube('a') + cube('b') + '</div><h1>LUDO</h1><p>Shaking the dice...</p><div class="bar"><b></b></div>';
    (document.head || document.documentElement).appendChild(st);
    document.documentElement.appendChild(el);
  }
  function hide() {
    if (gone) return; gone = true;
    var wait = Math.max(0, MIN_MS - (Date.now() - t0));
    setTimeout(function () {
      if (!el) return; el.classList.add('out');
      setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); var s = document.getElementById('ll-css'); if (s && s.parentNode) s.parentNode.removeChild(s); }, 520);
    }, wait);
  }
  window.LudoLoader = { hide: hide };
  show();
  if (!hold) { if (document.readyState === 'complete') hide(); else window.addEventListener('load', hide); }
  setTimeout(hide, 9000);
})();
