/* cc-receipt.js v3: the checkout finish animation. A Comrade Connect card slides into a payment terminal,
the terminal approves it, then a paper receipt prints out with a barcode and a PAID stamp.
Use: ccReceipt.show({ item, amount, credit, ref, via, onDone }). Matches the site: logo, wordmark, black and white, light or dark. */
(function () {
'use strict';
if (window.ccReceipt) return;
var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}
var P = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232'.split(' ');
function code128(text) {
var v = [104], sum = 104, i, c;
for (i = 0; i < text.length; i++) { c = text.charCodeAt(i) - 32; if (c < 0 || c > 94) c = 0; v.push(c); sum += c * (i + 1); }
v.push(sum % 103);
var s = ''; v.forEach(function (n) { s += P[n]; }); s += '2331112';
var x = 0, bars = '';
for (i = 0; i < s.length; i++) { var w = +s[i]; if (i % 2 === 0) bars += '<rect x="' + x + '" y="0" width="' + w + '" height="40"/>'; x += w; }
return '<svg viewBox="0 0 ' + x + ' 40" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="Barcode ' + text + '" fill="#111">' + bars + '</svg>';
}
var $ = function (s, r) { return (r || document).querySelector(s); };
var money = function (n) { try { return typeof kes === 'function' ? kes(n) : 'KSh ' + Number(n || 0).toLocaleString('en-KE'); } catch (e) { return 'KSh ' + n; } };
var el = function (t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
function css() {
if ($('#rc-css')) return;
var s = document.createElement('style'); s.id = 'rc-css';
s.textContent = [
'#ccrc{position:fixed;inset:0;z-index:10050;display:flex;flex-direction:column;align-items:center;background:var(--bg,#000);color:var(--fg,#fff);font-family:Poppins,system-ui,sans-serif;overflow:hidden;opacity:0;transition:opacity .35s,background .7s,color .7s;-webkit-tap-highlight-color:transparent}',
'#ccrc,#ccrc *,#ccrc *::before,#ccrc *::after{box-sizing:border-box}',
'#ccrc.on{opacity:1}#ccrc.dk{background:#09090b;color:#fff}',
'#ccrc .rc-bar{width:100%;max-width:440px;display:flex;align-items:center;justify-content:space-between;padding:calc(14px + env(safe-area-inset-top,0px)) 18px 0;font-size:13px;color:var(--mut,#bdbdbd)}',
'#ccrc.dk .rc-bar{color:#bdbdbd}',
'#ccrc .rc-x{width:38px;height:38px;border-radius:50%;border:1px solid var(--line,rgba(255,255,255,.2));background:none;color:inherit;display:grid;place-items:center;cursor:pointer}',
'#ccrc .rc-x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}',
'#ccrc .rc-pg{flex:1;width:100%;max-width:440px;position:relative;min-height:0}',
'#ccrc .rc-ph{position:absolute;inset:0;padding:0 22px calc(18px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:center;opacity:0;visibility:hidden;transform:translateY(14px);transition:opacity .45s,transform .45s,visibility 0s .45s;overflow:hidden auto}',
'#ccrc .rc-ph.on{opacity:1;visibility:visible;transform:none;transition:opacity .45s,transform .45s}',
'#ccrc h2{margin:6px 0 2px;font:600 24px/1.2 Poppins,sans-serif;letter-spacing:-.02em;text-align:center}',
'#ccrc .rc-sub{margin:0;color:var(--mut,#bdbdbd);font-size:13px;text-align:center;min-height:20px}',
'#ccrc .rc-t{transition:opacity .35s}#ccrc .rc-t.o{opacity:0}',
'#ccrc .rc-st{position:relative;flex:none;width:280px;height:190px;margin:26px auto 0}',
'#ccrc .rc-card{position:absolute;z-index:1;left:15px;top:0;width:250px;height:142px;border-radius:18px;padding:14px 16px;color:#fff;overflow:hidden;background:linear-gradient(135deg,#202024,#050506 58%,#1a1a1e);border:1px solid rgba(255,255,255,.22);box-shadow:0 18px 40px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.25);transition:transform 1.05s cubic-bezier(.65,0,.35,1),opacity .45s}',
'#ccrc .rc-card::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.16) 50%,transparent 65%);transform:translateX(-120%);animation:rc-shine 2.6s ease-in-out .3s}',
'#ccrc.rm .rc-card::after{display:none}',
'#ccrc .rc-lg{display:flex;align-items:center;gap:9px}',
'#ccrc .rc-lgo{width:34px;aspect-ratio:440/324;background:#fff;-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}',
'#ccrc .rc-wm{font:800 11.5px/1 Unbounded,Poppins,sans-serif;text-transform:uppercase;letter-spacing:.03em;white-space:nowrap}',
'#ccrc .rc-chip{position:absolute;left:16px;top:58px;width:36px;height:27px;border-radius:6px;background:linear-gradient(135deg,#e9e9ea,#8d8d92 55%,#d6d6d9);box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}',
'#ccrc .rc-chip::before{content:"";position:absolute;inset:6px 9px;border:1px solid rgba(0,0,0,.35);border-radius:3px}',
'#ccrc .rc-nfc{position:absolute;right:16px;top:60px;width:24px;height:24px;fill:none;stroke:rgba(255,255,255,.7);stroke-width:1.8;stroke-linecap:round}',
'#ccrc .rc-cf{position:absolute;left:16px;right:16px;bottom:12px;display:flex;justify-content:space-between;align-items:flex-end}',
'#ccrc .rc-cf small{display:block;font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6)}',
'#ccrc .rc-cf b{font:600 15px/1.2 Poppins,sans-serif;letter-spacing:.02em}',
'#ccrc .rc-pill{font-size:9px;font-weight:600;letter-spacing:.14em;border:1px solid rgba(255,255,255,.4);border-radius:99px;padding:3px 9px}',
'#ccrc .rc-bd{position:absolute;z-index:3;left:50%;top:142px;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:var(--bg,#000);border:1px solid var(--gb,rgba(255,255,255,.3));display:grid;place-items:center;opacity:0;transform:scale(.6);transition:opacity .3s,transform .45s cubic-bezier(.2,.9,.3,1.4),background .3s,border-color .3s}',
'#ccrc .rc-bd.on{opacity:1;transform:none}#ccrc .rc-bd.ok{background:#3ddc84;border-color:#3ddc84}',
'#ccrc .rc-bd i{position:absolute;inset:8px;border-radius:50%;border:3px solid var(--line,rgba(255,255,255,.2));border-top-color:var(--fg,#fff);animation:rc-spin .8s linear infinite}#ccrc .rc-bd.ok i{display:none}',
'#ccrc .rc-bd svg{width:28px;height:28px;fill:none;stroke:#04130a;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:30;stroke-dashoffset:30;transition:stroke-dashoffset .45s .1s}#ccrc .rc-bd.ok svg{stroke-dashoffset:0}',
'#ccrc .rc-rows{width:100%;margin:12px 0 0;border:1px solid var(--gb,rgba(255,255,255,.22));background:var(--g,rgba(255,255,255,.07));border-radius:18px;padding:4px 16px;opacity:0;transform:translateY(12px);transition:opacity .5s .15s,transform .5s .15s}',
'#ccrc .rc-rows div{display:flex;justify-content:space-between;gap:14px;padding:9px 0;font-size:13px;border-bottom:1px solid var(--line,rgba(255,255,255,.14))}',
'#ccrc .rc-rows div:last-child{border:0}#ccrc .rc-rows span{color:var(--mut,#bdbdbd);flex:none}#ccrc .rc-rows b{font-weight:600;text-align:right;overflow-wrap:anywhere}',
'#ccrc .rc-act{width:100%;display:grid;gap:10px;margin-top:14px;opacity:0;transform:translateY(12px);transition:opacity .5s .3s,transform .5s .3s}',
'#ccrc .rc-ph.ready .rc-rows,#ccrc .rc-ph.ready .rc-act{opacity:1;transform:none}',
'#ccrc .rc-b{border:1px solid var(--gb,rgba(255,255,255,.3));background:transparent;color:inherit;border-radius:999px;padding:14px 22px;font:600 14px Poppins,sans-serif;cursor:pointer;transition:transform .25s}',
'#ccrc .rc-b:active{transform:scale(.97)}#ccrc .rc-b.p{background:var(--fg,#fff);color:var(--bg,#000);border-color:var(--fg,#fff)}',
'#ccrc.dk .rc-b.p{background:#fff;color:#000;border-color:#fff}#ccrc.dk .rc-b{border-color:rgba(255,255,255,.3)}',
'#ccrc .rc-b:focus-visible,#ccrc .rc-x:focus-visible{outline:2px solid currentColor;outline-offset:3px}',
'#ccrc .rc-prt{position:relative;z-index:3;flex:none;width:300px;max-width:100%;height:40px;margin-top:20px;border-radius:16px 16px 12px 12px;background:linear-gradient(#34363e,#17181d);border:1px solid rgba(255,255,255,.18);box-shadow:0 10px 24px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.3)}',
'#ccrc .rc-prt::before{content:"";position:absolute;left:14px;right:14px;bottom:8px;height:6px;border-radius:3px;background:#000;box-shadow:0 1px 0 rgba(255,255,255,.12),0 0 10px rgba(255,255,255,.2)}',
'#ccrc .rc-prt i{position:absolute;right:16px;top:9px;width:6px;height:6px;border-radius:50%;background:#3ddc84;box-shadow:0 0 8px #3ddc84;animation:rc-blink 1s steps(2) infinite}',
'#ccrc .rc-prt.run{animation:rc-buzz .22s linear infinite}',
'#ccrc .rc-feed{position:relative;z-index:2;flex:none;width:252px;margin-top:-9px;overflow:hidden;padding-bottom:8px}',
'#ccrc .rc-paper{position:relative;transform:translateY(-100%);background:#f6f4ee;color:#1b1b1b;padding:18px 18px 30px;font:11px/1.5 "Courier New",ui-monospace,monospace;-webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/12px 100%;mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/12px 100%;box-shadow:0 0 0 1px rgba(0,0,0,.05)}',
'#ccrc .rc-paper.print{animation:rc-feed var(--pt,3.4s) steps(34,end) forwards}',
'#ccrc .rc-paper.done{transform:none}',
'#ccrc .rp-h{text-align:center}#ccrc .rp-lgo{width:38px;aspect-ratio:440/324;margin:0 auto 6px;background:#1b1b1b;-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}',
'#ccrc .rp-wm{font:800 12px/1.1 Unbounded,Poppins,sans-serif;text-transform:uppercase;letter-spacing:.02em}#ccrc .rp-ed{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#6b6b6b;margin-top:3px}',
'#ccrc .rp-hr{border:0;border-top:1.5px dashed #9b9b9b;margin:11px 0}',
'#ccrc .rp-t{text-align:center;font-weight:700;letter-spacing:.22em;font-size:11px}',
'#ccrc .rp-m{display:flex;justify-content:space-between;gap:10px;margin-top:2px;color:#555;font-size:10px}',
'#ccrc .rp-r{display:flex;justify-content:space-between;gap:12px;margin:3px 0}#ccrc .rp-r span{flex:none;color:#555}#ccrc .rp-r b{font-weight:700;text-align:right;overflow-wrap:anywhere}',
'#ccrc .rp-tot{display:flex;justify-content:space-between;align-items:baseline;font-weight:700;font-size:15px;margin-top:6px}',
'#ccrc .rp-bc{height:46px;margin:12px 6px 4px}#ccrc .rp-bc svg{width:100%;height:100%;display:block}#ccrc .rp-bn{text-align:center;font-size:10px;letter-spacing:.18em;color:#444}',
'#ccrc .rp-ty{text-align:center;margin-top:12px;font:italic 14px Georgia,serif;color:#222}#ccrc .rp-fn{text-align:center;margin-top:6px;font-size:9px;color:#6b6b6b;line-height:1.45}',
'#ccrc .rp-sp{position:relative;height:62px}',
'#ccrc .rp-stamp{position:absolute;right:4px;top:-4px;width:70px;height:70px;border-radius:50%;border:3px double #1a8f4f;color:#1a8f4f;display:grid;place-items:center;text-align:center;font:800 15px/1 Poppins,sans-serif;letter-spacing:.1em;transform:rotate(-14deg) scale(2.6);opacity:0;mix-blend-mode:multiply;filter:contrast(1.1)}',
'#ccrc .rp-stamp small{display:block;font:600 7px/1.2 Poppins,sans-serif;letter-spacing:.14em;margin-top:3px}',
'#ccrc .rp-stamp.hit{animation:rc-stamp .32s cubic-bezier(.2,.9,.3,1.1) forwards}',
'#ccrc .rc-fa{display:flex;gap:10px;width:100%;max-width:300px;margin-top:18px;opacity:0;transform:translateY(10px);transition:opacity .5s,transform .5s}',
'#ccrc .rc-fa.on{opacity:1;transform:none}#ccrc .rc-fa .rc-b{flex:1}',
'#ccrc.rm *{animation-duration:.01s!important;transition-duration:.01s!important}',
'@keyframes rc-shine{to{transform:translateX(120%)}}@keyframes rc-spin{to{transform:rotate(360deg)}}@keyframes rc-draw{to{stroke-dashoffset:0}}',
'@keyframes rc-blink{50%{opacity:.25}}@keyframes rc-buzz{25%{transform:translateX(-1.5px)}75%{transform:translateX(1.5px)}}',
'@keyframes rc-feed{to{transform:translateY(0)}}',
'@keyframes rc-stamp{to{transform:rotate(-14deg) scale(1);opacity:.88}}',
'@media(max-height:690px){#ccrc .rc-st{transform:scale(.84);transform-origin:top center;margin-bottom:-52px}#ccrc h2{font-size:21px}}'
].join('\n');
document.head.appendChild(s);
}
function logoMask() {
try {
var l = $('nav .nb .lgo') || $('.lgo'); if (!l) return '';
var cs = getComputedStyle(l), m = cs.webkitMaskImage || cs.maskImage || '';
return m && m !== 'none' ? m : '';
} catch (e) { return ''; }
}
var WAVES = '<svg class="rc-nfc" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7c3 3 3 7 0 10M11 5c4.5 4 4.5 10 0 14M15 3c6 5.5 6 12.5 0 18"/></svg>';
function show(o) {
o = o || {}; css(); var old = $('#ccrc'); if (old) old.remove();
var amount = Number(o.amount) || 0, credit = Number(o.credit) || 0;
var ref = String(o.ref || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || Math.random().toString(36).slice(2, 10).toUpperCase();
ref = 'CC-' + ref;
var item = String(o.item || 'Marketplace item').slice(0, 60), via = o.via || 'M-Pesa', mask = logoMask();
var buyer = ''; try { buyer = window.ME && ME.handle ? '@' + ME.handle : ''; } catch (e) {}
var d = new Date(), when = d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
var timers = [], T = function (f, ms) { timers.push(setTimeout(f, reduce ? Math.min(ms, 60) : ms)); };
var buzz = function (p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
var root = el('div'); root.id = 'ccrc'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Order receipt'); if (reduce) root.classList.add('rm');
var bar = el('div', 'rc-bar'); var bt = el('span', '', 'Comrade Connect'); var x = el('button', 'rc-x'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
x.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'; bar.append(bt, x);
var pg = el('div', 'rc-pg'), A = el('section', 'rc-ph on'), B = el('section', 'rc-ph'); pg.append(A, B); root.append(bar, pg);
var h = el('h2', 'rc-t', 'Confirm order'), sub = el('p', 'rc-sub rc-t', 'Holding your payment safely in escrow'); A.append(h, sub);
var st = el('div', 'rc-st'), card = el('div', 'rc-card'), lg = el('div', 'rc-lg'), lgo = el('span', 'rc-lgo');
if (mask) { lgo.style.webkitMaskImage = mask; lgo.style.maskImage = mask; }
lg.append(lgo, el('span', 'rc-wm', 'Comrade Connect')); card.append(lg, el('span', 'rc-chip'));
card.insertAdjacentHTML('beforeend', WAVES);
var cf = el('div', 'rc-cf'), l = el('div'), sm = el('small', '', 'Escrow hold'), bb = el('b', '', money(amount)); l.append(sm, bb); cf.append(l, el('span', 'rc-pill', 'ESCROW')); card.append(cf);
var pos = el('div', 'rc-bd'); pos.innerHTML = '<i></i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
st.append(card, pos); A.append(st);
var rows = el('div', 'rc-rows'); [['Paid', money(amount)], ['Status', 'Held safely in escrow'], ['Item', item], ['Receipt', ref]].forEach(function (r) { var dv = el('div'); dv.append(el('span', '', r[0]), el('b', '', r[1])); rows.append(dv); });
var act = el('div', 'rc-act'), vb = el('button', 'rc-b p', 'View receipt'), dn = el('button', 'rc-b', 'Done'); vb.type = dn.type = 'button'; act.append(vb, dn); A.append(rows, act);
var prt = el('div', 'rc-prt'); prt.append(el('i')); var feed = el('div', 'rc-feed'), paper = el('div', 'rc-paper'); feed.append(paper);
var ph = el('div', 'rp-h'), pl = el('div', 'rp-lgo'); if (mask) { pl.style.webkitMaskImage = mask; pl.style.maskImage = mask; }
ph.append(pl, el('div', 'rp-wm', 'Comrade Connect'), el('div', 'rp-ed', 'Kirinyaga Edition')); paper.append(ph, el('hr', 'rp-hr'), el('div', 'rp-t', 'ESCROW RECEIPT'));
var pm = el('div', 'rp-m'); pm.append(el('span', '', ref), el('span', '', when)); paper.append(pm, el('hr', 'rp-hr'));
var line = function (a, b) { var r = el('div', 'rp-r'); r.append(el('span', '', a), el('b', '', b)); paper.append(r); };
line('Item', item); if (buyer) line('Buyer', buyer); line('Paid with', via); line('Status', 'Held in escrow');
if (credit > 0) line('Points used', '-' + money(credit));
paper.append(el('hr', 'rp-hr'));
var tot = el('div', 'rp-tot'); tot.append(el('span', '', 'TOTAL PAID'), el('span', '', money(amount))); paper.append(tot);
var sp = el('div', 'rp-sp'), stamp = el('div', 'rp-stamp', 'PAID'); stamp.append(el('small', '', 'ESCROW')); sp.append(stamp); paper.append(sp, el('hr', 'rp-hr'));
var bc = el('div', 'rp-bc'); bc.innerHTML = code128(ref); paper.append(bc, el('div', 'rp-bn', ref));
paper.append(el('div', 'rp-ty', 'Thank you for choosing Comrade Connect.'), el('div', 'rp-fn', 'Share your handover code only after you have checked the item.'));
var fa = el('div', 'rc-fa'), again = el('button', 'rc-b', 'Print again'), dn2 = el('button', 'rc-b p', 'Done'); again.type = dn2.type = 'button'; fa.append(again, dn2);
B.append(prt, feed, fa);
document.body.appendChild(root);
var closed = false;
function close(done) {
if (closed) return; closed = true; timers.forEach(clearTimeout); document.removeEventListener('keydown', key);
root.classList.remove('on'); setTimeout(function () { root.remove(); }, 380);
if (done && typeof o.onDone === 'function') try { o.onDone(); } catch (e) {}
}
function key(e) { if (e.key === 'Escape') close(true); }
document.addEventListener('keydown', key);
x.onclick = dn.onclick = dn2.onclick = function () { close(true); };
function print() {
timers.forEach(clearTimeout); timers = [];
fa.classList.remove('on'); stamp.classList.remove('hit'); paper.classList.remove('print', 'done'); void paper.offsetWidth;
feed.style.height = paper.offsetHeight + 8 + 'px';
var secs = reduce ? 0.01 : 3.4; paper.style.setProperty('--pt', secs + 's');
paper.classList.add('print'); prt.classList.add('run');
T(function () { prt.classList.remove('run'); paper.classList.add('done'); }, secs * 1000 + 100);
T(function () { stamp.classList.add('hit'); buzz(30); }, secs * 1000 + 350);
T(function () { fa.classList.add('on'); }, secs * 1000 + 800);
}
vb.onclick = function () { buzz(15); root.classList.add('dk'); A.classList.remove('on'); B.classList.add('on'); T(print, 450); };
again.onclick = function () { buzz(15); print(); };
requestAnimationFrame(function () { root.classList.add('on'); });
T(function () { pos.classList.add('on'); buzz(15); }, 1100);
T(function () { pos.classList.add('ok'); buzz([30, 40, 30]); }, 2600);
T(function () { h.classList.add('o'); sub.classList.add('o'); }, 3700);
T(function () { h.textContent = 'Order placed'; sub.textContent = 'Your money is held until you confirm the item'; h.classList.remove('o'); sub.classList.remove('o'); A.classList.add('ready'); }, 4050);
return { close: function () { close(false); } };
}
window.ccReceipt = { show: show, barcode: code128 };
})();