/* cc-sharecard.js: one tap turns a Kura nominee, an event, a Market item or a Ludo win into a branded
   1080x1920 image (WhatsApp Status size) with your own invite link on it.
   Call: window.ccShareCard({ tag, title, line, cta, photo, hash, filename })
   Other pages (Kura, events, Market, Ludo) call this; nothing here builds HTML from user text (canvas only). */
(function () {
'use strict';
if (window.ccShareCard) return;

function origin() { try { return (window.ccOrigin ? window.ccOrigin() : location.origin).replace(/\/+$/, ''); } catch (e) { return location.origin; } }
function myCode() {
  try { var c = window.ccRef && window.ccRef.code; if (c) { try { localStorage.setItem('cc_mycode', c); } catch (e) {} return c; } } catch (e) {}
  try { return localStorage.getItem('cc_mycode') || ''; } catch (e) { return ''; }
}
function inviteUrl(hash) { var c = myCode(); return origin() + '/' + (c ? '?ref=' + encodeURIComponent(c) : '') + (hash || ''); }
function toast(t) { try { if (window.toast) window.toast(t); } catch (e) {} }

function loadImg(src) {
  return new Promise(function (res) {
    if (!src) return res(null);
    var i = new Image(); i.crossOrigin = 'anonymous';
    i.onload = function () { res(i); }; i.onerror = function () { res(null); };
    setTimeout(function () { res(null); }, 6000);
    i.src = src;
  });
}
function wrap(x, text, maxW, maxLines) {
  var words = String(text || '').replace(/\s+/g, ' ').trim().split(' '), lines = [], ln = '';
  for (var k = 0; k < words.length; k++) {
    var t = ln ? ln + ' ' + words[k] : words[k];
    if (x.measureText(t).width > maxW && ln) { lines.push(ln); ln = words[k]; } else ln = t;
  }
  if (ln) lines.push(ln);
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
  x.fillStyle = '#fff'; x.font = '800 44px ' + U; x.fillText('COMRADE CONNECT', 80, 150);
  x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '300 32px ' + F; x.fillText('Student community', 80, 206);

  var y = 300;
  if (o.tag) {
    x.font = '600 30px ' + F; var tg = String(o.tag).toUpperCase(), tw = x.measureText(tg).width;
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; rr(x, 80, y, tw + 56, 64, 32); x.stroke();
    x.fillStyle = '#fff'; x.fillText(tg, 108, y + 43); y += 120;
  }
  if (photo) {
    var S = 560, px = (W - S) / 2, k = Math.max(S / photo.width, S / photo.height), dw = photo.width * k, dh = photo.height * k;
    x.save(); rr(x, px, y, S, S, 48); x.clip(); x.drawImage(photo, px + (S - dw) / 2, y + (S - dh) / 2, dw, dh); x.restore();
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3; rr(x, px, y, S, S, 48); x.stroke(); y += S + 80;
  } else y += 40;

  x.fillStyle = '#fff'; x.font = '700 78px ' + F; x.textAlign = 'left';
  wrap(x, o.title, 920, 3).forEach(function (l) { x.fillText(l, 80, y); y += 98; });
  if (o.line) {
    y += 8; x.fillStyle = 'rgba(255,255,255,.72)'; x.font = '400 42px ' + F;
    wrap(x, o.line, 920, 3).forEach(function (l) { x.fillText(l, 80, y); y += 60; });
  }

  // invite box, fixed near the bottom
  var by = 1560; x.fillStyle = 'rgba(255,255,255,.1)'; rr(x, 60, by, W - 120, 270, 36); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; rr(x, 60, by, W - 120, 270, 36); x.stroke();
  x.fillStyle = '#fff'; x.font = '600 40px ' + F; x.fillText(o.cta || 'Join me on Comrade Connect', 100, by + 78, 880);
  x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '300 30px ' + F; x.fillText('Tap my link. It opens in the app.', 100, by + 130, 880);
  x.fillStyle = '#fff'; x.font = '600 34px ' + F; x.fillText(url.replace(/^https?:\/\//, ''), 100, by + 210, 880);
  return c;
}

function overlay(canvas, name, text) {
  var old = document.getElementById('ccsc-ov'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'ccsc-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px';
  var im = document.createElement('img'); im.src = canvas.toDataURL('image/png'); im.alt = 'Share card';
  im.style.cssText = 'max-height:70vh;max-width:100%;border-radius:18px;border:1px solid rgba(255,255,255,.25)';
  var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center';
  function btn(label, fn, solid) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    b.style.cssText = 'all:unset;cursor:pointer;padding:14px 22px;border-radius:14px;font:600 15px system-ui,sans-serif;border:1px solid #fff;' + (solid ? 'background:#fff;color:#000' : 'color:#fff');
    b.onclick = fn; row.appendChild(b);
  }
  btn('Save image', function () { var a = document.createElement('a'); a.href = im.src; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }, true);
  btn('Copy link', function () { try { navigator.clipboard.writeText(text).then(function () { toast('Link copied'); }); } catch (e) {} });
  btn('Close', function () { ov.remove(); });
  ov.appendChild(im); ov.appendChild(row); ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}

var busy = false;
window.ccShareCard = async function (o) {
  if (busy || !o || !o.title) return; busy = true;
  try {
    toast('Making your card...');
    var url = inviteUrl(o.hash), photo = await loadImg(o.photo), canvas;
    try { canvas = await draw(o, photo, url); canvas.toDataURL('image/png'); }          // a photo from another site can taint the canvas: retry without it
    catch (e) { canvas = await draw(o, null, url); }
    var name = (o.filename || 'comrade-connect') + '.png', text = (o.share || o.title) + ' ' + url;
    var blob = await new Promise(function (r) { canvas.toBlob(r, 'image/png'); });
    var f = null; try { f = new File([blob], name, { type: 'image/png' }); } catch (e) {}
    if (f && navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], text: text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    overlay(canvas, name, text);
  } catch (e) { toast('Could not make the card. Try again.'); }
  finally { busy = false; }
};

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
