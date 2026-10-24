/* Tiny QR maker for tickets: digits only (up to 30), version 1, level M. Use: ccQR.svg('12345678', 170) */
(function () {
'use strict';
var EXP = [], LOG = [], x = 1, i;
for (i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 285; }
function mul(a, b) { return a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0; }
function ecc(data, n) {
  var g = [1], j, k, f, r;
  for (i = 0; i < n; i++) { var ng = []; for (j = 0; j <= g.length; j++) ng[j] = (g[j] || 0) ^ (j ? mul(g[j - 1], EXP[i]) : 0); g = ng; }
  r = []; for (i = 0; i < n; i++) r[i] = 0;
  data.forEach(function (b) { f = b ^ r.shift(); r.push(0); for (k = 0; k < n; k++) r[k] ^= mul(g[k + 1], f); });
  return r;
}
function matrix(text) {
  var d = String(text);
  if (!/^\d{1,30}$/.test(d)) throw new Error('digits only');
  var bits = [];
  function put(v, n) { for (var b = n - 1; b >= 0; b--) bits.push((v >> b) & 1); }
  put(1, 4); put(d.length, 10);
  for (i = 0; i < d.length; i += 3) { var g = d.substr(i, 3); put(parseInt(g, 10), g.length === 3 ? 10 : g.length === 2 ? 7 : 4); }
  for (i = 0; i < 4 && bits.length < 128; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  var cw = [], pad = [236, 17];
  for (i = 0; i < bits.length; i += 8) { var v = 0; for (var b = 0; b < 8; b++) v = v * 2 + bits[i + b]; cw.push(v); }
  for (i = 0; cw.length < 16; i++) cw.push(pad[i % 2]);
  cw = cw.concat(ecc(cw, 10));
  var N = 21, m = [], fn = [], y, c;
  for (y = 0; y < N; y++) { m[y] = []; fn[y] = []; for (c = 0; c < N; c++) { m[y][c] = 0; fn[y][c] = 0; } }
  function set(cx, cy, dark) { m[cy][cx] = dark ? 1 : 0; fn[cy][cx] = 1; }
  for (i = 0; i < N; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  [[3, 3], [N - 4, 3], [3, N - 4]].forEach(function (p) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var xx = p[0] + dx, yy = p[1] + dy, ds = Math.max(Math.abs(dx), Math.abs(dy)); if (xx >= 0 && xx < N && yy >= 0 && yy < N) set(xx, yy, ds !== 2 && ds !== 4); } });
  for (i = 0; i <= 5; i++) set(8, i, 0);   // reserve the format-bit cells (filled in per mask below)
  set(8, 7, 0); set(8, 8, 0); set(7, 8, 0);
  for (i = 9; i < 15; i++) set(14 - i, 8, 0);
  for (i = 0; i < 8; i++) set(N - 1 - i, 8, 0);
  for (i = 8; i < 15; i++) set(8, N - 15 + i, 0);
  set(8, N - 8, 1);
  var bi = 0, right, vert, j, up;
  for (right = N - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (vert = 0; vert < N; vert++) for (j = 0; j < 2; j++) {
      c = right - j; up = ((right + 1) & 2) === 0; y = up ? N - 1 - vert : vert;
      if (!fn[y][c] && bi < cw.length * 8) { m[y][c] = (cw[bi >> 3] >> (7 - (bi & 7))) & 1; bi++; }
    }
  }
  function withMask(k) {   // copy with mask k applied and its format bits written
    var q = m.map(function (r) { return r.slice(); }), yy, cc, rem = k, F, n;
    for (yy = 0; yy < N; yy++) for (cc = 0; cc < N; cc++) if (!fn[yy][cc] && ((k === 0 && (yy + cc) % 2 === 0) || (k === 1 && yy % 2 === 0) || (k === 2 && cc % 3 === 0) || (k === 3 && (yy + cc) % 3 === 0) || (k === 4 && (Math.floor(yy / 2) + Math.floor(cc / 3)) % 2 === 0) || (k === 5 && ((yy * cc) % 2) + ((yy * cc) % 3) === 0) || (k === 6 && (((yy * cc) % 2) + ((yy * cc) % 3)) % 2 === 0) || (k === 7 && (((yy + cc) % 2) + ((yy * cc) % 3)) % 2 === 0))) q[yy][cc] ^= 1;
    for (n = 0; n < 10; n++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
    F = ((k << 10) | rem) ^ 0x5412;   // level M = 00, then the mask number
    function fb(t) { return (F >> t) & 1; }
    function st(px, py, v) { q[py][px] = v; }
    for (n = 0; n <= 5; n++) st(8, n, fb(n));
    st(8, 7, fb(6)); st(8, 8, fb(7)); st(7, 8, fb(8));
    for (n = 9; n < 15; n++) st(14 - n, 8, fb(n));
    for (n = 0; n < 8; n++) st(N - 1 - n, 8, fb(n));
    for (n = 8; n < 15; n++) st(8, N - 15 + n, fb(n));
    st(8, N - 8, 1);
    return q;
  }
  function penalty(q) {
    var p = 0, yy, cc, dark = 0, lines = [], l1, l2;
    for (yy = 0; yy < N; yy++) { l1 = ''; l2 = ''; for (cc = 0; cc < N; cc++) { l1 += q[yy][cc]; l2 += q[cc][yy]; dark += q[yy][cc]; } lines.push(l1, l2); }
    lines.forEach(function (l) {
      (l.match(/0{5,}|1{5,}/g) || []).forEach(function (r) { p += 3 + r.length - 5; });
      var t = '0000' + l + '0000', at;
      ['10111010000', '00001011101'].forEach(function (pat) { for (at = t.indexOf(pat); at >= 0; at = t.indexOf(pat, at + 1)) p += 40; });
    });
    for (yy = 0; yy < N - 1; yy++) for (cc = 0; cc < N - 1; cc++) { var v = q[yy][cc]; if (v === q[yy][cc + 1] && v === q[yy + 1][cc] && v === q[yy + 1][cc + 1]) p += 3; }
    return p + (Math.ceil(Math.abs(dark * 20 - N * N * 10) / (N * N)) - 1) * 10;
  }
  var best = null, bs = 1e9, k;
  for (k = 0; k < 8; k++) { var cand = withMask(k), sc = penalty(cand); if (sc < bs) { bs = sc; best = cand; } }
  return best;
}
window.ccQR = {
  matrix: matrix,
  svg: function (text, px) {
    var m = matrix(text), n = m.length, pad = 4, s = n + pad * 2, d = '', r, c;
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (m[r][c]) d += 'M' + (c + pad) + ' ' + (r + pad) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '" width="' + (px || 170) + '" height="' + (px || 170) + '" shape-rendering="crispEdges" role="img" aria-label="Ticket QR code"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
};
})();
