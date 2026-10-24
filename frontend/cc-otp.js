/* cc-otp.js v1: turns every 6-digit code field (autocomplete="one-time-code") into glass boxes and plays the verify animation.
   No page code needs changing: the real input stays in the page and always holds the typed code,
   and the confirm calls are watched through fetch, so the animation plays while the server checks the code. */
(function () {
'use strict';
if (window.ccOtp) return;
var KEY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M17 6l3 3M14.5 8.5l2.5 2.5"/></svg>';
var SHIELD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.1 7.5 9.5 4.4-1.4 7.5-4.9 7.5-9.5V6L12 3z"/><path d="m9 12 2.2 2.2L15.5 10"/></svg>';
var CHECK = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
var SPIN_MS = 1100, ORBIT = 34;
var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var list = [];
function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function enhance(real) {
  if (real.__cco || real.type === 'hidden' || real.classList.contains('cco-b')) return;
  var n = parseInt(real.maxLength, 10); if (!(n >= 4 && n <= 8)) n = 6;
  var root = h('div', 'cco'); root.setAttribute('role', 'group'); root.setAttribute('aria-label', n + '-digit code');
  var ic = h('div', 'cco-ic', KEY), t = h('p', 'cco-t', 'Verify <b>code</b>'), s = h('p', 'cco-s', 'Enter the ' + n + '-digit code we sent you.');
  t.setAttribute('aria-live', 'polite');
  var stage = h('div', 'cco-stage'), row = h('div', 'cco-row'), fin = h('div', 'cco-final', CHECK), r1 = h('span', 'cco-ring'), r2 = h('span', 'cco-ring r2');
  var boxes = [];
  for (var i = 0; i < n; i++) {
    var b = h('input', 'cco-b'); b.type = 'text'; b.inputMode = 'numeric'; b.autocomplete = i === 0 ? 'one-time-code' : 'off'; b.setAttribute('aria-label', 'Digit ' + (i + 1) + ' of ' + n);
    b.style.setProperty('--i', i); b.setAttribute('autocapitalize', 'off'); b.spellcheck = false; boxes.push(b); row.appendChild(b);
  }
  stage.appendChild(row); stage.appendChild(fin); stage.appendChild(r1); stage.appendChild(r2);
  root.appendChild(ic); root.appendChild(t); root.appendChild(s); root.appendChild(stage);
  real.classList.add('cco-real'); real.tabIndex = -1; real.setAttribute('aria-hidden', 'true'); real.__cco = true;
  real.parentNode.insertBefore(root, real.nextSibling);

  var o = { root: root, real: real, state: 'idle', anim: null, ready: Promise.resolve(), btn: null, auto: 0 };
  var syncing = false;
  function code() { return boxes.map(function (x) { return x.value; }).join(''); }
  function sync() {
    boxes.forEach(function (x) { x.classList.toggle('cco-f', !!x.value); });
    syncing = true; real.value = code(); real.dispatchEvent(new Event('input', { bubbles: true })); syncing = false;
  }
  function fill(from, digits) {
    for (var k = 0; k < digits.length && from + k < n; k++) boxes[from + k].value = digits.charAt(k);
    sync(); boxes[Math.min(from + digits.length, n - 1)].focus();
    clearTimeout(o.auto);
    if (code().length === n) o.auto = setTimeout(submit, 300);
  }
  function submit() {
    if (o.state !== 'idle' || code().length !== n || !root.getClientRects().length) return;
    var b = nextButton(root, false); if (b && !b.disabled) b.click();
  }
  boxes.forEach(function (b, i) {
    b.addEventListener('input', function () {
      var v = b.value.replace(/\D/g, ''); b.value = '';
      if (v) fill(i, v); else sync();
    });
    b.addEventListener('keydown', function (ev) {
      if (ev.key === 'Backspace') {
        if (!b.value && i > 0) { ev.preventDefault(); boxes[i - 1].value = ''; boxes[i - 1].focus(); sync(); }
      } else if (ev.key === 'ArrowLeft' && i > 0) { ev.preventDefault(); boxes[i - 1].focus(); }
      else if (ev.key === 'ArrowRight' && i < n - 1) { ev.preventDefault(); boxes[i + 1].focus(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); submit(); }
    });
    b.addEventListener('paste', function (ev) {
      var d = ((ev.clipboardData || window.clipboardData).getData('text') || '').replace(/\D/g, '');
      if (d) { ev.preventDefault(); fill(0, d.slice(0, n)); }
    });
    b.addEventListener('focus', function () { if (!b.value) { var e = boxes.findIndex(function (x) { return !x.value; }); if (e >= 0 && e < i) boxes[e].focus(); } else b.select(); });
  });
  real.addEventListener('focus', function () { var e = boxes.findIndex(function (x) { return !x.value; }); boxes[e < 0 ? 0 : e].focus(); });
  real.addEventListener('input', function () {   /* SMS autofill or other code filling the real input */
    if (syncing) return;
    var d = real.value.replace(/\D/g, '');
    if (d !== code()) { boxes.forEach(function (x) { x.value = ''; }); if (d) fill(0, d.slice(0, n)); else sync(); }
  });

  function setText(title, sub) { t.innerHTML = title; if (sub) s.textContent = sub; }
  function btnState(cls, label) {
    var b = o.btn; if (!b) return;
    b.classList.remove('cco-bspin', 'cco-bok'); if (cls) b.classList.add(cls); if (label) b.textContent = label;
  }
  o.reset = function () {
    root.classList.add('cco-nt'); requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('cco-nt'); }); });
    root.classList.remove('cco-busy', 'cco-merge', 'cco-ok', 'cco-err'); o.state = 'idle';
    if (o.anim) { try { o.anim.cancel(); } catch (e) {} o.anim = null; }
    ic.innerHTML = KEY; setText('Verify <b>code</b>', 'Enter the ' + n + '-digit code we sent you.');
    boxes.forEach(function (x) { x.value = ''; x.readOnly = false; }); sync();
    if (o.btn) { btnState(null); o.btn = null; }
  };
  o.busy = function () {
    if (o.state === 'busy') return;
    if (o.state !== 'idle') o.reset();
    o.state = 'busy'; o.btn = nextButton(root, true);
    var rr = row.getBoundingClientRect(), cx = rr.left + rr.width / 2;
    boxes.forEach(function (x, i) {
      var br = x.getBoundingClientRect(), ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      x.style.setProperty('--dx', (cx - (br.left + br.width / 2)) + 'px'); x.style.setProperty('--ox', (Math.cos(ang) * ORBIT) + 'px');
      x.style.setProperty('--oy', (Math.sin(ang) * ORBIT) + 'px'); x.style.setProperty('--r', (i * 40) + 'deg'); x.readOnly = true; x.blur();
    });
    root.classList.remove('cco-err'); root.classList.add('cco-busy'); setText('Verifying <b>code</b>');
    btnState('cco-bspin', 'Verifying code...');
    o.ready = sleep(reduce ? 0 : 480).then(function () {
      if (o.state !== 'busy' || reduce || !row.animate) return;
      o.anim = row.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: SPIN_MS, iterations: Infinity });
    });
  };
  function endSpin() {   /* let the current turn finish so the boxes land exactly where they started */
    return o.ready.then(function () {
      var a = o.anim; if (!a) return;
      var it = Math.max(1, Math.ceil((a.currentTime || 0) / SPIN_MS));
      a.effect.updateTiming({ iterations: it });
      return a.finished.catch(function () {}).then(function () { o.anim = null; });
    });
  }
  o.success = function () {
    if (o.state !== 'busy') return Promise.resolve();
    return endSpin().then(function () {
      o.state = 'ok'; root.classList.add('cco-merge');
      return sleep(reduce ? 0 : 480);
    }).then(function () {
      root.classList.add('cco-ok'); ic.innerHTML = SHIELD; setText('Verified <b>Successfully</b>', 'Your security code has been confirmed.');
      btnState('cco-bok', 'Verified & Secured');
      return sleep(reduce ? 400 : 1150);
    }).then(function () { setTimeout(function () { btnState(null); }, 80); setTimeout(function () { o.reset(); }, 1500); });
  };
  o.fail = function () {
    if (o.state !== 'busy') return Promise.resolve();
    btnState(null);
    endSpin().then(function () {
      o.state = 'err'; root.classList.remove('cco-busy'); root.classList.add('cco-err');
      boxes.forEach(function (x) { x.value = ''; x.readOnly = false; }); sync(); btnState(null);
      return sleep(650);
    }).then(function () { if (o.state === 'err') { o.reset(); boxes[0].focus(); } });
    return Promise.resolve();
  };
  list.push(o);
  if (real.value) fill(0, real.value.replace(/\D/g, '').slice(0, n));
}

/* the confirm button is the first visible button after the boxes; while the page's own code is working it is the disabled one */
function nextButton(root, preferDisabled) {
  var bs = [].slice.call(document.querySelectorAll('button')).filter(function (b) { return (root.compareDocumentPosition(b) & 4) && b.getClientRects().length; });
  if (preferDisabled) { var d = bs.filter(function (b) { return b.disabled; })[0]; if (d) return d; }
  return bs.filter(function (b) { return !b.disabled; })[0] || bs[0] || null;
}
function visible() { for (var i = list.length - 1; i >= 0; i--) if (list[i].root.isConnected && list[i].root.getClientRects().length) return list[i]; return null; }

var CONFIRM = /\/(verify\/email\/confirm|recovery-email\/confirm|auth\/reset\/confirm)(\?|#|$)/;
var _fetch = window.fetch;
if (_fetch) window.fetch = function (input) {
  var url = typeof input === 'string' ? input : String((input && (input.url || input.href)) || '');
  var p = _fetch.apply(this, arguments);
  if (!CONFIRM.test(url)) return p;
  var o = visible(); if (!o) return p;   /* e.g. the "choose a new password" call: no code boxes on screen, so no animation */
  o.busy();
  return p.then(function (res) { return (res.ok ? o.success() : o.fail()).then(function () { return res; }); },
    function (err) { o.fail(); throw err; });
};

function scan(node) {
  var q = node.querySelectorAll ? node.querySelectorAll('input[autocomplete="one-time-code"]') : [];
  [].forEach.call(q, enhance);
}
function start() {
  scan(document);
  new MutationObserver(function (ms) { ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (nd) { if (nd.nodeType === 1) scan(nd); }); }); }).observe(document.documentElement, { childList: true, subtree: true });
}
window.ccOtp = { enhance: enhance, list: list };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
