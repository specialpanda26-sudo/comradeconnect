/* cc-streak-fx.js v1: full-screen streak celebration (grey flame lights up, bursts, orange floods, number rolls up, week row pops in).
   window.ccStreakPlay({from, to, days:[{done}] x7}). Text via textContent only. Honors reduced motion. */
(function () {
'use strict';
if (window.ccStreakPlay) return;
var NS = 'http://www.w3.org/2000/svg';
function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
var css = el('style'); css.textContent =
'#ccfx{position:fixed;inset:0;z-index:1100;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;overflow:hidden;background:var(--bg,#101422);color:var(--fg,#fff);padding:24px 24px calc(24px + env(safe-area-inset-bottom,0px));animation:fxin .3s ease both}' +
'@keyframes fxin{from{opacity:0}}' +
'#ccfx .fx-flood{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:#A8DCE7;transform:scale(0);transition:transform .9s cubic-bezier(.65,0,.2,1)}' +
'#ccfx.s2 .fx-flood{transform:scale(70)}' +
'#ccfx .fx-flame{position:relative;width:128px;height:166px;transition:transform .4s}' +
'#ccfx .fx-flame svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}' +
'#ccfx .fx-col{opacity:0;transition:opacity .5s}#ccfx.s1 .fx-col{opacity:1}' +
'#ccfx.s1 .fx-flame{animation:fxpop .5s ease}' +
'@keyframes fxpop{50%{transform:scale(1.14)}}' +
'#ccfx.s2 .fx-flame{animation:fxsq .9s ease both}' +
'@keyframes fxsq{0%{transform:scale(1)}30%{transform:scale(.7,.8)}65%{transform:scale(1.18)}100%{transform:scale(1)}}' +
'#ccfx .fx-sp{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px;border-radius:50%;background:#FFD27A;opacity:0}' +
'#ccfx.s2 .fx-sp{animation:fxsp .9s ease-out both}' +
'@keyframes fxsp{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.2)}}' +
'#ccfx .fx-num{position:relative;height:84px;font-size:72px;line-height:84px;font-weight:700;letter-spacing:-.04em;overflow:hidden;min-width:90px;text-align:center;transition:color .4s}' +
'#ccfx .fx-num span{position:absolute;left:0;right:0;transition:transform .55s cubic-bezier(.3,.9,.3,1),opacity .55s}' +
'#ccfx .fx-o{top:0;color:rgba(255,255,255,.35)}#ccfx .fx-n{top:0;transform:translateY(100%);opacity:0}' +
'#ccfx.s2 .fx-o{color:rgba(255,255,255,.9)}' +
'#ccfx.s3 .fx-o{transform:translateY(-100%);opacity:0}#ccfx.s3 .fx-n{transform:none;opacity:1}' +
'#ccfx.s2 .fx-num,#ccfx.s2{color:#fff}' +
'#ccfx .fx-lbl{position:relative;font-size:17px;font-weight:600;opacity:0;transform:translateY(10px);transition:all .5s}#ccfx.s4 .fx-lbl{opacity:.95;transform:none}' +
'#ccfx .fx-week{position:relative;display:flex;gap:10px;margin-top:26px}' +
'#ccfx .fx-d{display:flex;flex-direction:column;align-items:center;gap:7px;font-size:11px;font-weight:600;opacity:0;transform:scale(.4);transition:all .45s cubic-bezier(.3,1.5,.5,1)}' +
'#ccfx.s5 .fx-d{opacity:1;transform:none}' +
'#ccfx .fx-c{width:30px;height:30px;border-radius:50%;box-sizing:border-box;display:grid;place-items:center;border:2px solid rgba(255,255,255,.45);color:#A8DCE7}' +
'#ccfx .fx-c.on{background:#fff;border-color:#fff}#ccfx .fx-c svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}' +
'#ccfx .fx-c.td{box-shadow:0 0 0 4px rgba(255,255,255,.35)}' +
'#ccfx .fx-go{all:unset;position:relative;box-sizing:border-box;cursor:pointer;margin-top:34px;padding:14px 46px;border-radius:999px;font-size:15px;font-weight:700;letter-spacing:.04em;color:#A8DCE7;background:#fff;box-shadow:0 14px 30px -10px rgba(0,0,0,.35);opacity:0;transform:translateY(14px);pointer-events:none;transition:all .5s}' +
'#ccfx.s6 .fx-go{opacity:1;transform:none;pointer-events:auto}#ccfx .fx-go:focus-visible{outline:2px solid #fff;outline-offset:3px}' +
'@media(prefers-reduced-motion:reduce){#ccfx *,#ccfx{animation:none!important;transition:none!important}}';
document.head.appendChild(css);

function flame(col) {
  var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 100 130'); s.setAttribute('aria-hidden', 'true');
  var body = 'M50 4C58 28 86 44 86 84C86 110 70 126 50 126C30 126 14 110 14 84C14 62 28 52 34 36C40 46 42 54 46 56C46 36 44 20 50 4Z';
  if (!col) { s.innerHTML = '<path d="' + body + '" fill="rgba(255,255,255,.2)"/>'; return s; }
  s.innerHTML = '<defs><linearGradient id="fxg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF3C4"/><stop offset="1" stop-color="#FFB93D"/></linearGradient></defs>' +
    '<path d="' + body + '" fill="url(#fxg)"/><path d="M50 62C60 76 70 84 70 98C70 110 61 118 50 118C39 118 30 110 30 98C30 88 40 78 50 62Z" fill="#fff" opacity=".85"/>' +
    '<circle cx="42" cy="92" r="3.4" fill="#101422"/><circle cx="58" cy="92" r="3.4" fill="#101422"/><path d="M43 102Q50 108 57 102" fill="none" stroke="#101422" stroke-width="2.6" stroke-linecap="round"/>';
  return s;
}
function end() { var o = document.getElementById('ccfx'); if (o) { o.style.transition = 'opacity .25s'; o.style.opacity = '0'; setTimeout(function () { o.remove(); }, 260); } document.removeEventListener('keydown', esc); }
function esc(e) { if (e.key === 'Escape') end(); }

window.ccStreakPlay = function (o) {
  if (document.getElementById('ccfx')) return;
  o = o || {}; var to = Math.max(1, o.to | 0), from = Math.max(0, o.from == null ? to - 1 : o.from | 0), days = o.days || [];
  var r = el('div'); r.id = 'ccfx'; r.setAttribute('role', 'dialog'); r.setAttribute('aria-modal', 'true'); r.setAttribute('aria-label', 'Daily streak');
  var flood = el('div', 'fx-flood'); r.appendChild(flood);
  var fl = el('div', 'fx-flame'); fl.appendChild(flame(false)); var cw = el('div', 'fx-col'); cw.style.cssText = 'position:absolute;inset:0'; cw.appendChild(flame(true)); fl.appendChild(cw);
  for (var i = 0; i < 12; i++) { var sp = el('i', 'fx-sp'), a = i / 12 * 6.283, d = 90 + (i % 3) * 30; sp.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px'); sp.style.setProperty('--dy', Math.round(Math.sin(a) * d) + 'px'); fl.appendChild(sp); }
  r.appendChild(fl);
  var num = el('div', 'fx-num'); num.setAttribute('aria-label', to + ' day streak'); num.appendChild(el('span', 'fx-o', String(from))); num.appendChild(el('span', 'fx-n', String(to))); r.appendChild(num);
  r.appendChild(el('div', 'fx-lbl', to === 1 ? 'day streak' : 'day streak'));
  var wk = el('div', 'fx-week');
  for (var k = 0; k < 7; k++) {
    var d2 = el('div', 'fx-d'); d2.style.transitionDelay = (k * 70) + 'ms';
    d2.appendChild(el('span', '', new Date(Date.now() - (6 - k) * 864e5).toLocaleDateString(undefined, { weekday: 'narrow' })));
    var c = el('div', 'fx-c' + (days[k] && days[k].done ? ' on' : '') + (k === 6 ? ' td' : ''));
    if (days[k] && days[k].done) { var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = '<path d="M5 12.5l4.5 4.5L19 7.5"/>'; c.appendChild(s); }
    d2.appendChild(c); wk.appendChild(d2);
  }
  r.appendChild(wk);
  var go = el('button', 'fx-go', 'Continue'); go.type = 'button'; go.onclick = end; r.appendChild(go);
  document.body.appendChild(r); document.addEventListener('keydown', esc);
  var b = fl.getBoundingClientRect(); flood.style.left = (b.left + b.width / 2) + 'px'; flood.style.top = (b.top + b.height * .6) + 'px';
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  [['s1', 500], ['s2', 1500], ['s3', 2600], ['s4', 3200], ['s5', 3600], ['s6', 4500]].forEach(function (s) { setTimeout(function () { if (r.parentNode) r.classList.add(s[0]); }, still ? 0 : s[1]); });
  setTimeout(function () { try { go.focus(); } catch (e) {} }, still ? 50 : 4600);
};
})();
