/* cc-otp-full.js v2: ONE full-screen overlay for every verification: dots + message, then tick + message. */
(function () {
  var ov = null, fx = '', fxMsg = '', last = '', tmr = 0;
  var CODE = /\/api\/(verify\/email\/confirm|recovery-email\/confirm|auth\/reset\/confirm)(\?|#|$)/;
  var PASS = /\/api\/passkey\/(register|login)\/verify(\?|#|$)/;
  var ID = /\/api\/verify\/submit(\?|#|$)/;
  function make() {
    if (ov && ov.isConnected) return ov;
    ov = document.createElement('div'); ov.id = 'cc-fullov'; ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = '<div class="c"><div class="d"><i></i><i></i><i></i><i></i><i></i></div><div class="t"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><p class="m"></p></div>';
    document.body.appendChild(ov); return ov;
  }
  function shown(sel) { var l = document.querySelectorAll(sel); for (var i = 0; i < l.length; i++) if (l[i].tagName !== 'BUTTON') return true; return false; }
  function render() {
    var st = fx === 'ok' || shown('.cco-ok') ? 'ok' : fx === 'busy' || shown('.cco-busy') ? 'busy' : '';
    var msg = st === 'ok' ? (fx === 'ok' && fxMsg ? fxMsg : 'Verified') : (fx === 'busy' && fxMsg ? fxMsg : 'Verifying code…');
    var key = st + '|' + msg; if (key === last) return; var prev = last.split('|')[0]; last = key;
    if (!st) { if (ov) ov.className = ''; return; }
    var o = make(); o.querySelector('.m').textContent = msg;
    if (st === 'ok' && prev === 'busy') { o.classList.add('ok'); return; }
    if (st === prev) return;
    o.className = ''; void o.offsetWidth; o.className = 'on' + (st === 'ok' ? ' ok' : '');
  }
  function setFx(s, m) { fx = s; fxMsg = m || ''; render(); }
  function hasBoxes() { var l = document.querySelectorAll('.cco'); for (var i = 0; i < l.length; i++) if (l[i].getClientRects && l[i].getClientRects().length) return true; return false; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function start() {
    new MutationObserver(render).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] }); render();
    var f0 = window.fetch; if (!f0) return;
    window.fetch = function (input) {
      var url = typeof input === 'string' ? input : String((input && (input.url || input.href)) || '');
      var kind = PASS.test(url) ? 'pass' : ID.test(url) ? 'id' : CODE.test(url) && !hasBoxes() ? 'code' : '';
      var p = f0.apply(this, arguments);
      if (!kind) return p;
      var t0 = Date.now(); clearTimeout(tmr); setFx('busy', kind === 'id' ? 'Sending your ID…' : kind === 'pass' ? 'Verifying…' : '');
      return p.then(function (res) {
        if (!res.ok) { setFx(''); return res; }
        return sleep(Math.max(0, 700 - (Date.now() - t0))).then(function () {
          setFx('ok', kind === 'id' ? 'Sent for review' : '');
          tmr = setTimeout(function () { setFx(''); }, 1400); return res;
        });
      }, function (err) { setFx(''); throw err; });
    };
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
