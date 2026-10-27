/* cc-receipt.js v4: the checkout finish screen. One calm success screen: a green check pops inside a circle and draws itself,
then "You have successfully paid ..." and a Download receipt button. No terminal, card or printing animation.
Use: ccReceipt.show({ item, amount, credit, ref, via, onDone }). Follows the site's light or dark theme. */
(function () {
'use strict';
if (window.ccReceipt) return;
var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}
var $ = function (s, r) { return (r || document).querySelector(s); };
var money = function (n) { try { return typeof kes === 'function' ? kes(n) : 'KSh ' + Number(n || 0).toLocaleString('en-KE'); } catch (e) { return 'KSh ' + n; } };
var el = function (t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
var INK = '#16130f', PEACH = '#ffd9b8', SAGE = '#a9b8a2';   /* the site's own palette: warm ink, cream, peach, sage */
var SVGNS = 'http://www.w3.org/2000/svg';
function css() {
if ($('#rc-css')) return;
var s = document.createElement('style'); s.id = 'rc-css';
s.textContent = [
'#ccrc{--rcF:var(--fg,var(--ink,#16130f));--rcM:var(--mut,#6a625a);--rcI:var(--ink,#16130f);--rcIF:var(--inkfg,var(--bg,#fff));--rcL:var(--line,rgba(22,19,15,.1));position:fixed;inset:0;z-index:10050;display:flex;flex-direction:column;align-items:center;background:var(--bg,#fbf1ed);color:var(--rcF);font-family:Manrope,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden auto;opacity:0;transition:opacity .25s ease;-webkit-tap-highlight-color:transparent;isolation:isolate}',
'#ccrc,#ccrc *,#ccrc *::before,#ccrc *::after{box-sizing:border-box}',
'#ccrc::before,#ccrc::after{content:"";position:fixed;z-index:-1;border-radius:50%;filter:blur(46px);pointer-events:none}',
'#ccrc::before{width:300px;height:300px;right:-110px;top:-90px;background:#ffd9b8;opacity:.75}',
'#ccrc::after{width:280px;height:280px;left:-120px;bottom:-100px;background:#c4727a;opacity:.2}',
'#ccrc.on{opacity:1}',
'html[data-theme="dark"] #ccrc::before{opacity:.2}html[data-theme="dark"] #ccrc::after{opacity:.14}',
'#ccrc .rc-bar{width:100%;max-width:440px;flex:none;display:flex;padding:calc(14px + env(safe-area-inset-top,0px)) 18px 0}',
'#ccrc .rc-x{width:44px;height:44px;border-radius:50%;border:0;background:var(--g,rgba(255,255,255,.86));box-shadow:var(--sh,0 10px 28px rgba(140,80,50,.11));color:var(--rcF);display:grid;place-items:center;cursor:pointer}',
'#ccrc .rc-x svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}',
'#ccrc .rc-top{flex:none;width:100%;max-width:440px;padding:10px 22px 0;text-align:center}',
'#ccrc .rc-av{width:68px;height:68px;border-radius:50%;margin:0 auto 12px;display:grid;place-items:center;background:#ffd9b8;color:#16130f;font:800 24px/1 Manrope,system-ui,sans-serif;letter-spacing:-.01em}',
'#ccrc .rc-nm{margin:0;font:800 16px/1.3 Manrope,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.02em;overflow-wrap:anywhere}',
'#ccrc .rc-am{margin:6px 0 0;font-size:13px;font-weight:500;color:var(--rcM)}#ccrc .rc-am b{color:var(--rcF);font-weight:800}',
'#ccrc .rc-chip{display:inline-block;margin-top:12px;padding:8px 14px;border-radius:999px;background:rgba(255,138,61,.13);color:var(--rcF);font:800 11px/1 Manrope,system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}',
'#ccrc .rc-mid{flex:1 0 auto;width:100%;max-width:440px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 22px;text-align:center}',
'#ccrc .rc-ck{width:88px;height:88px;display:block;transform-origin:50% 50%}',
'#ccrc .rc-ck .h{fill:rgba(169,184,162,.38)}',
'#ccrc .rc-ck .c{fill:var(--rcI)}',
'#ccrc .rc-ck .k{fill:none;stroke:var(--rcIF);stroke-width:6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:44;stroke-dashoffset:0}',
'#ccrc.go .rc-ck{animation:rc-pop .5s cubic-bezier(.2,.9,.3,1.25) both}',
'#ccrc.go .rc-ck .k{animation:rc-draw .35s ease-out .22s both}',
'#ccrc h2{margin:22px 0 0;font:800 22px/1.25 Manrope,system-ui,sans-serif;letter-spacing:-.02em}',
'#ccrc .rc-msg{margin:8px 0 0;font-size:14px;font-weight:500;line-height:1.55;color:var(--rcM);max-width:320px;overflow-wrap:anywhere}#ccrc .rc-msg b{color:var(--rcF);font-weight:800}',
'#ccrc .rc-id{margin-top:18px;border:0;cursor:pointer;display:inline-flex;align-items:center;gap:8px;padding:11px 16px;border-radius:999px;background:var(--g,rgba(255,255,255,.86));box-shadow:var(--sh,0 10px 28px rgba(140,80,50,.11));color:var(--rcF);font:800 14px/1 Manrope,system-ui,sans-serif;letter-spacing:.01em}',
'#ccrc .rc-id svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
'#ccrc .rc-txt{opacity:0;transform:translateY(8px)}',
'#ccrc.go .rc-txt{animation:rc-up .4s ease-out .5s both}',
'#ccrc .rc-bt{flex:none;width:100%;max-width:440px;padding:8px 22px calc(18px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:center;gap:14px}',
'#ccrc .rc-dl{border:0;background:none;color:var(--rcF);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 14px;font:800 12px/1.2 Manrope,system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase}',
'#ccrc .rc-dl svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}',
'#ccrc .rc-done{width:100%;height:54px;border:0;border-radius:999px;background:var(--rcI);color:var(--rcIF);font:800 15px/1 Manrope,system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;transition:transform .15s ease}',
'#ccrc .rc-done:active,#ccrc .rc-dl:active{transform:scale(.97)}',
'#ccrc .rc-done:focus-visible,#ccrc .rc-dl:focus-visible,#ccrc .rc-x:focus-visible,#ccrc .rc-id:focus-visible{outline:2px solid currentColor;outline-offset:3px}',
'#ccrc.rm *{animation:none!important;transition:none!important}#ccrc.rm .rc-txt{opacity:1;transform:none}',
'@keyframes rc-pop{0%{transform:scale(.5);opacity:0}100%{transform:scale(1);opacity:1}}',
'@keyframes rc-draw{from{stroke-dashoffset:44}to{stroke-dashoffset:0}}',
'@keyframes rc-up{to{opacity:1;transform:none}}',
'@media(max-height:640px){#ccrc .rc-av{width:54px;height:54px;font-size:20px}#ccrc .rc-ck{width:68px;height:68px}#ccrc .rc-mid{padding:16px 22px}}'
].join('\n');
document.head.appendChild(s);
}
function svg(html, vb) { var s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', vb || '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = html; return s; }
function initials(t) { var w = String(t || '').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/); return ((w[0] || 'C')[0] + (w[1] ? w[1][0] : '')).toUpperCase(); }

/* The downloadable receipt: drawn on a canvas and saved as a PNG. Nothing leaves the phone. */
function drawReceipt(d) {
var W = 720, pad = 52, rows = [['Item', d.item], ['Amount paid', money(d.amount)]];
if (d.credit > 0) rows.push(['Points used', '-' + money(d.credit)]);
rows.push(['Paid with', d.via], ['Status', d.status]);
if (d.buyer) rows.push(['Buyer', d.buyer]);
rows.push(['Date', d.when], ['Receipt no.', d.ref]);
var H = 400 + rows.length * 66 + 130, c = document.createElement('canvas'); c.width = W; c.height = H;
var x = c.getContext('2d'), F = 'Manrope, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
x.fillStyle = '#fbf1ed'; x.fillRect(0, 0, W, H);
x.textAlign = 'center'; x.fillStyle = INK; x.font = '800 26px ' + F; x.fillText('Comrade Connect', W / 2, 78);
x.beginPath(); x.arc(W / 2, 170, 54, 0, Math.PI * 2); x.fillStyle = 'rgba(169,184,162,.4)'; x.fill();
x.beginPath(); x.arc(W / 2, 170, 43, 0, Math.PI * 2); x.fillStyle = INK; x.fill();
x.beginPath(); x.moveTo(W / 2 - 17, 171); x.lineTo(W / 2 - 5, 183); x.lineTo(W / 2 + 18, 158); x.lineWidth = 7; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#fff'; x.stroke();
x.fillStyle = INK; x.font = '800 30px ' + F; x.fillText('Payment successful', W / 2, 272);
x.fillStyle = INK; x.font = '800 52px ' + F; x.fillText(money(d.amount), W / 2, 340);
var y = 390; x.setLineDash([8, 8]); x.lineWidth = 2; x.strokeStyle = 'rgba(22,19,15,.22)'; x.beginPath(); x.moveTo(pad, y); x.lineTo(W - pad, y); x.stroke(); x.setLineDash([]);
y += 52; x.textAlign = 'left';
rows.forEach(function (r) {
x.font = '500 22px ' + F; x.fillStyle = 'rgba(22,19,15,.62)'; x.fillText(r[0], pad, y);
x.font = '800 22px ' + F; x.fillStyle = INK; x.textAlign = 'right';
var t = String(r[1]), max = W - pad * 2 - 190; while (t.length > 1 && x.measureText(t).width > max) t = t.slice(0, -2) + '…';
x.fillText(t, W - pad, y); x.textAlign = 'left'; y += 66;
});
x.setLineDash([8, 8]); x.strokeStyle = 'rgba(22,19,15,.22)'; x.beginPath(); x.moveTo(pad, y - 28); x.lineTo(W - pad, y - 28); x.stroke(); x.setLineDash([]);
x.textAlign = 'center'; x.font = '400 19px ' + F; x.fillStyle = 'rgba(22,19,15,.62)';
x.fillText('Thank you for choosing Comrade Connect.', W / 2, y + 16);
x.font = '400 16px ' + F; x.fillText('Keep this receipt. Disputes are reviewed by an admin.', W / 2, y + 46);
return c;
}
function saveBlob(b, name) {
var f = null; try { f = new File([b], name, { type: 'image/png' }); } catch (e) {}
var ios = /iPhone|iPad|iPod/i.test(navigator.userAgent), app = !!window.Capacitor;
if (f && (ios || app) && navigator.canShare && navigator.canShare({ files: [f] })) {
navigator.share({ files: [f], title: 'Receipt' }).catch(function (e) { if (!e || e.name !== 'AbortError') link(b, name); });
return;
}
link(b, name);
}
function link(b, name) {
var u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
}

function show(o) {
o = o || {}; css(); var old = $('#ccrc'); if (old) old.remove();
var amount = Number(o.amount) || 0, credit = Number(o.credit) || 0;
var ref = String(o.ref || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || Math.random().toString(36).slice(2, 10).toUpperCase();
ref = 'CC-' + ref;
var item = String(o.item || 'Marketplace item').slice(0, 60), via = o.via || 'M-Pesa', status = 'Held safely in escrow';
var buyer = ''; try { buyer = window.ME && ME.handle ? '@' + ME.handle : ''; } catch (e) {}
var d = new Date(), when = d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
var buzz = function (p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

var root = el('div'); root.id = 'ccrc'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Payment successful'); if (reduce) root.classList.add('rm');
var bar = el('div', 'rc-bar'), x = el('button', 'rc-x'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.appendChild(svg('<path d="M6 6l12 12M18 6L6 18"/>')); bar.append(x);

var top = el('div', 'rc-top'); top.append(el('div', 'rc-av', initials(item)), el('p', 'rc-nm', item));
var am = el('p', 'rc-am'); am.append(el('b', '', money(amount)), document.createTextNode(' · via ' + via)); top.append(am, el('span', 'rc-chip', status));

var mid = el('div', 'rc-mid');
var ck = svg('<circle class="h" cx="50" cy="50" r="49"/><circle class="c" cx="50" cy="50" r="39"/><path class="k" d="M33 52l12 12 23-25"/>', '0 0 100 100'); ck.setAttribute('class', 'rc-ck'); ck.setAttribute('aria-hidden', 'true');
var h = el('h2', 'rc-txt', 'Payment successful'), msg = el('p', 'rc-msg rc-txt');
msg.append(document.createTextNode('You have successfully paid '), el('b', '', money(amount)), document.createTextNode(' for '), el('b', '', item), document.createTextNode('.'));
var note = el('p', 'rc-msg rc-txt', 'Your money is held until you confirm the item.'); note.style.marginTop = '4px';
var idb = el('button', 'rc-id rc-txt'); idb.type = 'button'; idb.append(document.createTextNode('ID: ' + ref), svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>'));
mid.append(ck, h, msg, note, idb);

var bt = el('div', 'rc-bt'), dl = el('button', 'rc-dl'); dl.type = 'button';
dl.append(svg('<path d="M12 3v12M7 10l5 5 5-5M5 20h14"/>'), el('span', '', 'Download receipt'));
var done = el('button', 'rc-done', 'DONE'); done.type = 'button'; bt.append(dl, done);

root.append(bar, top, mid, bt); document.body.appendChild(root);

var closed = false;
function close(fin) {
if (closed) return; closed = true; document.removeEventListener('keydown', key);
root.classList.remove('on'); setTimeout(function () { root.remove(); }, 260);
if (fin && typeof o.onDone === 'function') try { o.onDone(); } catch (e) {}
}
function key(e) { if (e.key === 'Escape') close(true); }
document.addEventListener('keydown', key);
x.onclick = done.onclick = function () { close(true); };
idb.onclick = function () {
try { navigator.clipboard.writeText(ref).then(function () { idb.firstChild.nodeValue = 'Copied'; setTimeout(function () { idb.firstChild.nodeValue = 'ID: ' + ref; }, 1400); }); } catch (e) {}
};
dl.onclick = function () {
buzz(10);
try { drawReceipt({ item: item, amount: amount, credit: credit, via: via, status: status, buyer: buyer, when: when, ref: ref }).toBlob(function (b) { if (b) saveBlob(b, 'comrade-connect-receipt-' + ref + '.png'); }, 'image/png'); } catch (e) {}
};
requestAnimationFrame(function () { root.classList.add('on'); requestAnimationFrame(function () { root.classList.add('go'); }); });
setTimeout(function () { buzz(20); }, 150);
return { close: function () { close(false); } };
}
window.ccReceipt = { show: show };
})();
