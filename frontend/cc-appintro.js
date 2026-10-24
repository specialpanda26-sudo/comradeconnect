/* cc-appintro.js v1: the animated "Get started" cards. ANDROID APP ONLY.
   cc-landing.js calls window.ccAppIntro.mount() only when window.ccApp.native is true (set by cc-native.js inside the app).
   On the website this file does nothing: no CSS is added and nothing is drawn.
   What moves: every card floats and tilts on its own, the round icons drift, the sparkles twinkle,
   cards fly in and out with a bounce when you swipe or tap Next, and the picture follows your finger while you drag. */
(function () {
'use strict';
if (window.ccAppIntro) return;

var INK = '#101422';
var DEF = [
  ['Spill it. Nobody will know it was you.', 'The anonymous campus feed for Kirinyaga comrades. No name, no trace.'],
  ['Buy and sell safely.', 'Your money stays in escrow until you confirm the item with your handover code.'],
  ['Find your people.', 'Roommates, study groups, hostels, events and Kura, all in one place.']
];
var LABELS = ['Show me around', 'Next', 'Get started'];

/* three cards per slide, then the round icons that float around them */
var SL = [
  { cards: ['feed1', 'feed2', 'feed3'], ic: [['chat', '#A8DCE7'], ['cup', '#6FB1F2'], ['heart', '#FF8FA3'], ['mega', '#FFD25A']] },
  { cards: ['mkt1', 'mkt2', 'mkt3'],    ic: [['bag', '#FE813C'], ['shield', '#9BDB8C'], ['coin', '#FFD25A'], ['tag', '#B9A6F5']] },
  { cards: ['ppl1', 'ppl2', 'ppl3'],    ic: [['home', '#A8DCE7'], ['book', '#B9A6F5'], ['cal', '#FF8FA3'], ['star', '#9BDB8C']] }
];
/* card spots in a 300 x 250 box: x, y, tilt */
var LAY = [
  [[4, 62, -9], [160, 46, 8], [82, 2, -2]],
  [[160, 60, 9], [6, 44, -8], [80, 4, 3]],
  [[10, 56, -6], [156, 58, 11], [84, 0, -4]]
];
/* where each card flies in from (x, y in px, tilt in deg); the sign follows the swipe direction */
var FLY = [[130, 90, 26], [190, -50, -22], [50, 150, 12]];
/* the four round icons: x, y, size, delay */
var BUB = [[-8, 26, 46], [252, -4, 46], [2, 196, 42], [254, 188, 44]];

function ico(n) {
  var P = {
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    cup: '<path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2M8 3.5v2M12 3.5v2"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    mega: '<path d="M4 10v4h3l7 4V6L7 10z"/><path d="M17 9.5a4 4 0 0 1 0 5"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><path d="M7.5 8.5h.01"/>',
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10M10 20v-5h4v5"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 5v16"/>',
    cal: '<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>'
  };
  return '<svg viewBox="0 0 24 24" fill="none" stroke="' + INK + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || '') + '</svg>';
}
var SPARK = '<svg viewBox="0 0 24 24" fill="#fff" stroke="' + INK + '" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z"/></svg>';

var CSS = [
  /* the page: warm off-white with a soft aqua glow, always light (like the design), whatever the site theme is */
  '#ccland.ccapp{background:radial-gradient(120% 46% at 50% -6%,rgba(168,220,231,.6),transparent 64%),#F1F0EB;color:' + INK + ';font-family:Poppins,system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;touch-action:pan-y;user-select:none;-webkit-user-select:none}',
  '#ccland.ccapp:before{display:none}',
  '#ccland.ccapp .ai-top{flex:none;display:flex;align-items:center;gap:9px;padding-top:calc(22px + env(safe-area-inset-top,0px));font:700 15px Poppins,system-ui,sans-serif;letter-spacing:.02em}',
  '#ccland.ccapp .ai-top img{height:22px;width:auto;filter:invert(1)}',
  '#ccland.ccapp .ai-stage{position:relative;flex:1 1 auto;min-height:0;width:100%}',
  '#ccland.ccapp .ai-sl{position:absolute;inset:0;display:grid;place-items:center;visibility:hidden;pointer-events:none}',
  '#ccland.ccapp .ai-sl.on,#ccland.ccapp .ai-sl.lv{visibility:visible}',
  '#ccland.ccapp .ai-art{--W:min(88vw,340px);position:relative;width:var(--W);aspect-ratio:300/250;--u:calc(var(--W)/300);transition:transform .5s cubic-bezier(.2,.9,.3,1);transform:translateX(calc(var(--dx,0)*.45px)) rotate(calc(var(--dx,0)*.04deg))}',
  '#ccland.ccapp.drag .ai-art{transition:none}',
  '@media(max-height:720px){#ccland.ccapp .ai-art{--W:min(76vw,268px)}}',
  /* cards */
  '#ccland.ccapp .ai-c{position:absolute;left:calc(var(--u)*var(--x));top:calc(var(--u)*var(--y));width:calc(var(--u)*128);height:calc(var(--u)*170);z-index:var(--z,1);transform:rotate(var(--r))}',
  '#ccland.ccapp .ai-in{position:absolute;inset:0;border-radius:calc(var(--u)*18);border:3px solid ' + INK + ';overflow:hidden;background:#fff;box-shadow:0 calc(var(--u)*12) calc(var(--u)*18) calc(var(--u)*-10) rgba(16,20,34,.5);animation:aifa 5.8s ease-in-out infinite;animation-delay:var(--fd,0s)}',
  '#ccland.ccapp .ai-in img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}',
  '@keyframes aifa{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-10px) rotate(2deg)}}',
  '#ccland.ccapp .ai-sl.on .ai-c{animation:aici .95s cubic-bezier(.2,1.3,.35,1) both;animation-delay:var(--d,0s)}',
  '@keyframes aici{from{opacity:0;transform:translate(calc(var(--dir,1)*var(--ex)*1px),calc(var(--ey)*1px)) rotate(calc(var(--r) + var(--dir,1)*var(--er)*1deg)) scale(.55)}to{opacity:1;transform:rotate(var(--r))}}',
  '#ccland.ccapp .ai-sl.lv .ai-c{animation:aicl .5s cubic-bezier(.55,0,.8,.45) both;animation-delay:calc(var(--d,0s)*.4)}',
  '@keyframes aicl{from{opacity:1;transform:rotate(var(--r))}to{opacity:0;transform:translate(calc(var(--dir,1)*var(--ex)*-1px),calc(var(--ey)*-.6px)) rotate(calc(var(--r) - var(--dir,1)*var(--er)*1deg)) scale(.6)}}',
  /* round icons */
  '#ccland.ccapp .ai-b{position:absolute;left:calc(var(--u)*var(--x));top:calc(var(--u)*var(--y));width:calc(var(--u)*var(--s));aspect-ratio:1;z-index:4}',
  '#ccland.ccapp .ai-bi{width:100%;height:100%;border-radius:50%;border:3px solid ' + INK + ';background:var(--bg);display:grid;place-items:center;box-shadow:0 4px 0 rgba(16,20,34,.85);animation:aibo 6.5s ease-in-out infinite;animation-delay:var(--fd,0s)}',
  '#ccland.ccapp .ai-bi svg{width:52%;height:52%}',
  '@keyframes aibo{0%,100%{transform:translate(0,0) rotate(0deg)}30%{transform:translate(8px,-12px) rotate(8deg)}65%{transform:translate(-7px,-5px) rotate(-6deg)}}',
  '#ccland.ccapp .ai-sl.on .ai-b{animation:aipop .7s cubic-bezier(.2,1.7,.4,1) both;animation-delay:var(--d,0s)}',
  '@keyframes aipop{from{opacity:0;transform:scale(0) rotate(-50deg)}to{opacity:1;transform:scale(1) rotate(0deg)}}',
  '#ccland.ccapp .ai-sl.lv .ai-b{animation:aiout .35s ease-in both}',
  '@keyframes aiout{to{opacity:0;transform:scale(0) rotate(40deg)}}',
  /* sparkles and dots */
  '#ccland.ccapp .ai-s{position:absolute;left:calc(var(--u)*var(--x));top:calc(var(--u)*var(--y));width:calc(var(--u)*var(--s));z-index:4;animation:aitw 2.8s ease-in-out infinite;animation-delay:var(--fd,0s)}',
  '#ccland.ccapp .ai-s svg{display:block;width:100%;height:auto}',
  '@keyframes aitw{0%,100%{transform:scale(.8) rotate(0deg);opacity:.65}50%{transform:scale(1.2) rotate(90deg);opacity:1}}',
  '#ccland.ccapp .ai-d{position:absolute;left:calc(var(--u)*var(--x));top:calc(var(--u)*var(--y));width:calc(var(--u)*var(--s));aspect-ratio:1;border-radius:50%;border:2.5px solid ' + INK + ';background:var(--bg);z-index:4;animation:aifa 4.2s ease-in-out infinite;animation-delay:var(--fd,0s)}',
  '#ccland.ccapp .ai-sl.lv .ai-s,#ccland.ccapp .ai-sl.lv .ai-d{opacity:0;transition:opacity .3s}',
  /* text and buttons */
  '#ccland.ccapp .ai-bt{box-sizing:border-box;flex:none;width:100%;max-width:480px;padding:0 24px calc(18px + env(safe-area-inset-bottom,0px));text-align:center}',
  '#ccland.ccapp .ai-dots{display:flex;justify-content:center;gap:8px;margin:2px 0 16px}',
  '#ccland.ccapp .ai-dots b{width:11px;height:11px;border-radius:9px;border:2.5px solid ' + INK + ';background:transparent;transition:width .35s cubic-bezier(.2,.9,.3,1),background .3s;cursor:pointer;box-sizing:border-box}',
  '#ccland.ccapp .ai-dots b.on{width:38px;background:' + INK + '}',
  '#ccland.ccapp .ai-tx{min-height:10.5em}',
  '#ccland.ccapp .ai-tx h1{display:block;margin:0 0 10px;min-height:0;font:700 clamp(20px,6.2vw,26px)/1.18 Unbounded,Poppins,system-ui,sans-serif;letter-spacing:-.02em;color:' + INK + '}',
  '#ccland.ccapp .ai-tx p{margin:0 auto;max-width:300px;min-height:0;font-size:13.5px;line-height:1.55;color:rgba(16,20,34,.62)}',
  '#ccland.ccapp .ai-tx.cap{animation:aitx .55s cubic-bezier(.2,.9,.3,1)}',
  '@keyframes aitx{from{opacity:0;transform:translateX(calc(var(--dir,1)*28px))}}',
  'html #ccland.ccapp .ai-go{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:min(100%,300px);height:54px;margin:14px auto 0;border-radius:999px;border:2.5px solid ' + INK + ';background:#fff;color:' + INK + ';font:700 16px Poppins,system-ui,sans-serif;box-shadow:0 5px 0 ' + INK + ';cursor:pointer;transition:transform .12s,box-shadow .12s,background .3s;-webkit-tap-highlight-color:transparent}',
  'html #ccland.ccapp .ai-go:active{transform:translateY(4px);box-shadow:0 1px 0 ' + INK + '}',
  'html #ccland.ccapp .ai-go.fin{background:#A8DCE7}',
  'html #ccland.ccapp .ai-go:focus-visible{outline:3px solid #6FB1F2;outline-offset:3px}',
  '#ccland.ccapp .ai-lg{margin-top:16px;font-size:14px;color:rgba(16,20,34,.62)}',
  '#ccland.ccapp .ai-lg button{all:unset;cursor:pointer;color:' + INK + ';font-weight:700;text-decoration:underline;text-underline-offset:3px}',
  '#ccland.ccapp .ai-gu{all:unset;display:block;margin:10px auto 0;cursor:pointer;font-size:12.5px;color:rgba(16,20,34,.55);padding:6px 10px}',
  '@media(max-height:720px){#ccland.ccapp .ai-tx{min-height:6.4em}#ccland.ccapp .ai-tx p{display:none}#ccland.ccapp .ai-gu{display:none}}',
  '@media(prefers-reduced-motion:reduce){#ccland.ccapp .ai-in,#ccland.ccapp .ai-bi,#ccland.ccapp .ai-s,#ccland.ccapp .ai-d{animation:none}#ccland.ccapp .ai-sl.on .ai-c,#ccland.ccapp .ai-sl.on .ai-b{animation-duration:.01s}}'
].join('');

function slideHtml(s, i) {
  var h = '<div class="ai-sl" data-i="' + i + '"><div class="ai-art">';
  s.cards.forEach(function (n, k) {
    var L = LAY[i][k], F = FLY[k];
    h += '<div class="ai-c" style="--x:' + L[0] + ';--y:' + L[1] + ';--r:' + L[2] + 'deg;--z:' + (k === 2 ? 2 : 1) + ';--ex:' + F[0] + ';--ey:' + F[1] + ';--er:' + F[2] + ';--d:' + (0.05 + k * 0.12) + 's;--fd:-' + (k * 1.7) + 's">'
      + '<div class="ai-in"><img src="img/intro/' + n + '.webp" alt="" draggable="false" decoding="async"></div></div>';
  });
  s.ic.forEach(function (c, k) {
    var B = BUB[k];
    h += '<div class="ai-b" style="--x:' + B[0] + ';--y:' + B[1] + ';--s:' + B[2] + ';--bg:' + c[1] + ';--d:' + (0.35 + k * 0.1) + 's;--fd:-' + (k * 1.9) + 's"><div class="ai-bi">' + ico(c[0]) + '</div></div>';
  });
  h += '<div class="ai-s" style="--x:186;--y:-14;--s:26;--fd:-.4s">' + SPARK + '</div>'
    + '<div class="ai-s" style="--x:262;--y:120;--s:20;--fd:-1.5s">' + SPARK + '</div>'
    + '<div class="ai-s" style="--x:30;--y:-6;--s:18;--fd:-2.2s">' + SPARK + '</div>'
    + '<div class="ai-d" style="--x:112;--y:-16;--s:11;--bg:#6FB1F2;--fd:-.8s"></div>'
    + '<div class="ai-d" style="--x:236;--y:236;--s:12;--bg:#FFD25A;--fd:-2s"></div>';
  return h + '</div></div>';
}

function mount(L, o) {
  o = o || {};
  if (!document.getElementById('ccai-css')) { var st = document.createElement('style'); st.id = 'ccai-css'; st.textContent = CSS; document.head.appendChild(st); }
  var caps = (o.caps && o.caps.length ? o.caps : DEF).slice(0, 3);
  while (caps.length < 3) caps.push(DEF[caps.length]);

  L.classList.add('ccapp');
  L.innerHTML = '<div class="ai-top"><img src="cc-mark.png" alt="" width="30" height="22">Comrade Connect</div>'
    + '<div class="ai-stage">' + SL.map(slideHtml).join('') + '</div>'
    + '<div class="ai-bt"><div class="ai-dots" role="tablist" aria-label="Intro pages"><b role="tab"></b><b role="tab"></b><b role="tab"></b></div>'
    + '<div class="ai-tx" aria-live="polite"><h1></h1><p></p></div>'
    + '<button type="button" class="ai-go"></button>'
    + '<div class="ai-lg">Already a comrade? <button type="button" data-l>Log in</button></div>'
    + '<button type="button" class="ai-gu">Just looking around</button></div>';

  var slides = [].slice.call(L.querySelectorAll('.ai-sl')), dots = [].slice.call(L.querySelectorAll('.ai-dots b')),
      tx = L.querySelector('.ai-tx'), h1 = tx.querySelector('h1'), pp = tx.querySelector('p'), go = L.querySelector('.ai-go'),
      stage = L.querySelector('.ai-stage'), cur = -1, auto = null, touched = false;

  function paint(i, dir) {
    L.style.setProperty('--dir', dir);
    dots.forEach(function (d, k) { d.classList.toggle('on', k === i); d.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    h1.textContent = caps[i][0]; pp.textContent = caps[i][1];
    tx.classList.remove('cap'); void tx.offsetWidth; tx.classList.add('cap');
    go.textContent = LABELS[i]; go.classList.toggle('fin', i === 2);
  }
  function show(i, dir) {
    i = Math.max(0, Math.min(2, i)); if (i === cur) return;
    dir = dir || (i > cur ? 1 : -1);
    var prev = slides[cur];
    if (prev) { prev.classList.remove('on'); prev.classList.add('lv'); setTimeout(function () { prev.classList.remove('lv'); }, 650); }
    cur = i; slides[cur].classList.remove('lv'); slides[cur].classList.add('on'); paint(cur, dir);
    schedule();
  }
  function schedule() {
    clearTimeout(auto);
    if (touched || cur >= 2) return;
    auto = setTimeout(function () { show(cur + 1, 1); }, 5200);       // plays through once by itself, stops the moment you touch it
  }
  function user(i) { touched = true; clearTimeout(auto); show(i); }

  dots.forEach(function (d, k) { d.onclick = function () { user(k); }; });
  go.onclick = function () { touched = true; clearTimeout(auto); if (cur < 2) show(cur + 1, 1); else if (o.start) o.start(); };
  L.querySelector('[data-l]').onclick = function () { if (o.login) o.login(); };
  L.querySelector('.ai-gu').onclick = function () { if (o.skip) o.skip(); };

  /* swipe: the cluster follows your finger, then flips to the next page */
  var x0 = null, y0 = 0, dx = 0, lock = '';
  stage.addEventListener('touchstart', function (e) { var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; dx = 0; lock = ''; }, { passive: true });
  stage.addEventListener('touchmove', function (e) {
    if (x0 === null) return; var t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
    if (!lock) lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
    if (lock !== 'x') return; dx = mx; L.classList.add('drag');
    var a = slides[cur].querySelector('.ai-art'); if (a) a.style.setProperty('--dx', Math.max(-160, Math.min(160, dx)));
  }, { passive: true });
  function end() {
    if (x0 === null) return; var d = dx; x0 = null; L.classList.remove('drag');
    var a = slides[cur].querySelector('.ai-art'); if (a) a.style.removeProperty('--dx');
    if (lock === 'x' && Math.abs(d) > 45) user(cur + (d < 0 ? 1 : -1));
  }
  stage.addEventListener('touchend', end, { passive: true }); stage.addEventListener('touchcancel', end, { passive: true });
  document.addEventListener('keydown', function k(e) {
    if (!document.body.contains(L)) return document.removeEventListener('keydown', k);
    if (e.key === 'ArrowRight') user(cur + 1); else if (e.key === 'ArrowLeft') user(cur - 1);
  });

  show(0, 1);
  return { show: user, destroy: function () { clearTimeout(auto); } };
}

window.ccAppIntro = { mount: mount };
})();
