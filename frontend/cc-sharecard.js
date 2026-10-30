/* cc-sharecard.js v2: one tap turns a spill, Kura nominee, event, Market item, gig or Ludo win into a branded
   1080x1920 card (WhatsApp Status size) with your own invite link on it. You SEE the card first, then tap
   WhatsApp, Save image or Copy link (like Telegram).
   Call: window.ccShareCard({ tag, title, body, line, cta, photo, hash, filename, share })
     body = long text (a spill): drawn as a big quote, font shrinks to fit.  title/line = short headline cards.
   In the Android app it uses the Share + Filesystem plugins (real share sheet with WhatsApp); in a browser it uses
   the Web Share API or a normal download. Nothing here builds HTML from user text (canvas only). */
(function () {
'use strict';
if (window.ccShareCard && window.ccShareCard.v === 2) return;

var GLYPH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';

function origin() { try { return (window.ccOrigin ? window.ccOrigin() : location.origin).replace(/\/+$/, ''); } catch (e) { return location.origin; } }
function myCode() {
  try { var c = window.ccRef && window.ccRef.code; if (c) { try { localStorage.setItem('cc_mycode', c); } catch (e) {} return c; } } catch (e) {}
  try { return localStorage.getItem('cc_mycode') || ''; } catch (e) { return ''; }
}
function inviteUrl(hash) { var c = myCode(); return origin() + '/' + (c ? '?ref=' + encodeURIComponent(c) : '') + (hash || ''); }
function toast(t) { try { if (window.toast) window.toast(t); } catch (e) {} }
function isNative() { try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); } catch (e) { return false; } }
var PL = {};
function plugin(n) {
  if (PL[n]) return PL[n];
  try { var c = window.Capacitor; PL[n] = (c.Plugins && c.Plugins[n]) || c.registerPlugin(n); } catch (e) { PL[n] = null; }
  return PL[n];
}

function loadImg(src) {
  return new Promise(function (res) {
    if (!src) return res(null);
    var i = new Image(); i.crossOrigin = 'anonymous';
    i.onload = function () { res(i); }; i.onerror = function () { res(null); };
    setTimeout(function () { res(null); }, 6000);
    i.src = src;
  });
}
function wrapAll(x, text, maxW) {
  var paras = String(text || '').replace(/\r/g, '').split(/\n+/), lines = [];
  paras.forEach(function (p) {
    var words = p.replace(/\s+/g, ' ').trim().split(' '), ln = '';
    if (!words[0]) return;
    for (var k = 0; k < words.length; k++) {
      var t = ln ? ln + ' ' + words[k] : words[k];
      if (x.measureText(t).width > maxW && ln) { lines.push(ln); ln = words[k]; } else ln = t;
    }
    if (ln) lines.push(ln);
  });
  return lines;
}
function wrap(x, text, maxW, maxLines) {
  var lines = wrapAll(x, text, maxW);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '...'; }
  return lines;
}
function rr(x, a, b, w, h, r) { x.beginPath(); if (x.roundRect) x.roundRect(a, b, w, h, r); else x.rect(a, b, w, h); }

async function draw(o, photo, url) {
  try { await document.fonts.load('700 54px Poppins'); await document.fonts.load('800 52px Unbounded'); } catch (e) {}
  var W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
  var x = c.getContext('2d'), F = 'Poppins,system-ui,sans-serif', U = 'Unbounded,' + F;
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  var g = x.createRadialGradient(220, 200, 0, 220, 200, 950); g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,.07)'; x.beginPath();
  [[0, H], [0, 1580], [200, 1540], [400, 1430], [520, 1330], [560, 1290], [600, 1320], [640, 1260], [700, 1340], [820, 1420], [960, 1510], [W, 1540], [W, H]].forEach(function (q, i) { i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); });
  x.fill();
  x.fillStyle = '#fff'; x.font = '800 44px ' + U; x.textAlign = 'left'; x.fillText('COMRADE CONNECT', 80, 150);
  x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '300 32px ' + F; x.fillText('Student community', 80, 206);

  var y = 300;
  if (o.tag) {
    x.font = '600 30px ' + F; var tg = String(o.tag).toUpperCase(), tw = Math.min(x.measureText(tg).width, 880);
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; rr(x, 80, y, tw + 56, 64, 32); x.stroke();
    x.fillStyle = '#fff'; x.fillText(tg, 108, y + 43, 880); y += 120;
  }

  if (o.body) {
    // a spill: big quote mark, text shrinks until it fits above the invite box
    x.fillStyle = 'rgba(255,255,255,.16)'; x.font = '800 260px ' + U; x.fillText('\u201C', 64, y + 190);
    var sizes = [[76, 108], [66, 94], [58, 84], [52, 76], [46, 68], [40, 60]], room = 1500 - (y + 150), lines = [], fs = 40, lh = 60;
    for (var s = 0; s < sizes.length; s++) {
      fs = sizes[s][0]; lh = sizes[s][1]; x.font = '500 ' + fs + 'px ' + F;
      lines = wrapAll(x, o.body, 900);
      if (lines.length * lh <= room) break;
    }
    var maxL = Math.floor(room / lh);
    if (lines.length > maxL) { lines.length = maxL; lines[maxL - 1] = lines[maxL - 1].replace(/\s*\S*$/, '') + '...'; }
    var ty = y + 150; x.fillStyle = '#fff'; x.font = '500 ' + fs + 'px ' + F;
    lines.forEach(function (l) { x.fillText(l, 90, ty); ty += lh; });
    x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '400 34px ' + F; x.fillText('Spilled anonymously by a comrade', 90, Math.min(ty + 30, 1500));
  } else {
    if (photo) {
      var S = 560, px = (W - S) / 2, k = Math.max(S / photo.width, S / photo.height), dw = photo.width * k, dh = photo.height * k;
      x.save(); rr(x, px, y, S, S, 48); x.clip(); x.drawImage(photo, px + (S - dw) / 2, y + (S - dh) / 2, dw, dh); x.restore();
      x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3; rr(x, px, y, S, S, 48); x.stroke(); y += S + 80;
    } else y += 40;
    x.fillStyle = '#fff'; x.font = '700 78px ' + F;
    wrap(x, o.title, 920, 3).forEach(function (l) { x.fillText(l, 80, y); y += 98; });
    if (o.line) {
      y += 8; x.fillStyle = 'rgba(255,255,255,.72)'; x.font = '400 42px ' + F;
      wrap(x, o.line, 920, 3).forEach(function (l) { x.fillText(l, 80, y); y += 60; });
    }
  }

  // invite box, fixed near the bottom
  var by = 1560; x.fillStyle = 'rgba(255,255,255,.1)'; rr(x, 60, by, W - 120, 270, 36); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; rr(x, 60, by, W - 120, 270, 36); x.stroke();
  x.fillStyle = '#fff'; x.font = '600 40px ' + F; x.fillText(o.cta || 'Join me on Comrade Connect', 100, by + 78, 880);
  x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '300 30px ' + F; x.fillText('Tap my link. It opens in the app.', 100, by + 130, 880);
  x.fillStyle = '#fff'; x.font = '600 34px ' + F; x.fillText(url.replace(/^https?:\/\//, ''), 100, by + 210, 880);
  return c;
}

/* ---- delivery ---- */
async function nativeShare(canvas, name, text) {
  var FS = plugin('Filesystem'), SH = plugin('Share'); if (!FS || !SH) return false;
  var r = await FS.writeFile({ path: name, data: canvas.toDataURL('image/png').split(',')[1], directory: 'CACHE' });
  await SH.share({ title: 'Comrade Connect', text: text, files: [r.uri], dialogTitle: 'Share card' });
  return true;
}
async function nativeSave(canvas, name) {
  var FS = plugin('Filesystem'); if (!FS) return false;
  try {
    await FS.writeFile({ path: 'ComradeConnect/' + name, data: canvas.toDataURL('image/png').split(',')[1], directory: 'DOCUMENTS', recursive: true });
    toast('Saved in Documents/ComradeConnect'); return true;
  } catch (e) { return false; }
}
function webDownload(canvas, name) {
  var a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  toast('Card saved');
}
async function shareOut(canvas, name, text) {
  try {
    if (isNative()) { if (await nativeShare(canvas, name, text)) return; }
    var blob = await new Promise(function (r) { canvas.toBlob(r, 'image/png'); });
    var f = null; try { f = new File([blob], name, { type: 'image/png' }); } catch (e) {}
    if (f && navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text: text }); return; }
  } catch (e) { if (e && (e.name === 'AbortError' || /cancel/i.test(String(e.message || e)))) return; }
  // no file sharing here: save the card, then open WhatsApp with the text and link
  webDownload(canvas, name);
  setTimeout(function () { window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(text), '_blank', 'noopener'); }, 600);
}
async function saveOut(canvas, name, text) {
  if (isNative()) {
    if (await nativeSave(canvas, name)) return;
    try { if (await nativeShare(canvas, name, text)) return; } catch (e) { return; }
  }
  webDownload(canvas, name);
}

function overlay(canvas, name, text) {
  var old = document.getElementById('ccsc-ov'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'ccsc-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Share card');
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:16px;padding-top:calc(16px + env(safe-area-inset-top,0px));padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))';
  var im = document.createElement('img'); im.src = canvas.toDataURL('image/png'); im.alt = 'Share card';
  im.style.cssText = 'max-height:68vh;max-width:100%;border-radius:18px;border:1px solid rgba(255,255,255,.25);box-shadow:0 10px 40px rgba(0,0,0,.6)';
  var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;width:100%;max-width:420px';
  function btn(label, fn, kind, icon) {
    var b = document.createElement('button'); b.type = 'button';
    var base = 'all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 20px;border-radius:14px;font:600 15px system-ui,sans-serif;-webkit-tap-highlight-color:transparent;';
    b.style.cssText = base + (kind === 'wa' ? 'background:#25D366;color:#fff;flex:1 1 100%' : kind === 'solid' ? 'background:#fff;color:#000;flex:1 1 40%' : 'border:1px solid rgba(255,255,255,.7);color:#fff;flex:1 1 40%');
    if (icon) b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#fff" d="' + GLYPH + '"/></svg>';
    b.appendChild(document.createTextNode(label));
    b.onclick = function () { fn(b); }; row.appendChild(b);
  }
  btn('Share to WhatsApp', function () { shareOut(canvas, name, text); }, 'wa', true);
  btn('Save image', function () { saveOut(canvas, name, text); }, 'solid');
  btn('Copy link', function () { try { navigator.clipboard.writeText(text).then(function () { toast('Link copied'); }); } catch (e) {} });
  btn('Close', function () { ov.remove(); });
  ov.appendChild(im); ov.appendChild(row); ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}

var busy = false;
window.ccShareCard = async function (o) {
  if (busy || !o || !(o.title || o.body)) return; busy = true;
  try {
    toast('Making your card...');
    var url = inviteUrl(o.hash), photo = await loadImg(o.photo), canvas;
    try { canvas = await draw(o, photo, url); canvas.toDataURL('image/png'); }          // a photo from another site can taint the canvas: retry without it
    catch (e) { canvas = await draw(o, null, url); }
    overlay(canvas, (o.filename || 'comrade-connect') + '.png', (o.share || o.title || 'Comrade Connect') + ' ' + url);
  } catch (e) { toast('Could not make the card. Try again.'); }
  finally { busy = false; }
};
window.ccShareCard.v = 2;

// Buttons added by other files: Market item, event.
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-mks],[data-evs]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (b.hasAttribute('data-mks')) {
    var l = window.__ccMk; if (!l) return;
    window.ccShareCard({ tag: 'Market · Escrow protected', title: l.title, line: 'KSh ' + Number(l.price || 0).toLocaleString('en-KE') + (l.zone ? '   @' + l.zone : ''), cta: 'Buy safely on Comrade Connect', photo: (l.photos || [])[0], filename: 'comrade-market', share: 'Check this out on Comrade Connect:' });
  } else {
    var d = b.dataset, p = Number(d.p || 0);
    window.ccShareCard({ tag: 'Campus event', title: d.t, line: [d.d, d.v, p ? 'Ticket KSh ' + p.toLocaleString('en-KE') : 'Free entry'].filter(Boolean).join('  ·  '), cta: p ? 'Get your ticket on Comrade Connect' : 'See you there. Comrade Connect', filename: 'comrade-event', share: d.t + ' on Comrade Connect:' });
  }
}, true);
})();
