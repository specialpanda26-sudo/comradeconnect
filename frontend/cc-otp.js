/* cc-otp.js v2: turns every 6-digit code field (autocomplete="one-time-code") into glass boxes and plays the verify animation.
   Section 1 of 2. No page code needs changing: the real input stays in the page and always holds the typed code,
   and the confirm calls are watched through fetch, so the animation plays while the server checks the code. */
(function () {
'use strict';
if (window.ccOtp) return;
var KEY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M17 6l3 3M14.5 8.5l2.5 2.5"/></svg>';
var SHIELD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.1 7.5 9.5 4.4-1.4 7.5-4.9 7.5-9.5V6L12 3z"/><path d="m9 12 2.2 2.2L15.5 10"/></svg>';
var CHECK = '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
var MIN_OK = 1300, MIN_BAD = 800;   /* the blue light runs at least this long (ms) before the answer shows */
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
  var stage = h('div', 'cco-stage'), row = h('div', 'cco-row'), fin = h('div', 'cco-final', CHECK);
  var boxes = [];
  for (var i = 0; i < n; i++) {
    var b = h('input', 'cco-b'); b.type = 'text'; b.inputMode = 'numeric'; b.autocomplete = i === 0 ? 'one-time-code' : 'off'; b.setAttribute('aria-label', 'Digit ' + (i + 1) + ' of ' + n);
    b.setAttribute('autocapitalize', 'off'); b.spellcheck = false; boxes.push(b); row.appendChild(b);
  }
  stage.appendChild(row); stage.appendChild(fin);
  root.appendChild(ic); root.appendChild(t); root.appendChild(s); root.appendChild(stage);
  real.classList.add('cco-real'); real.tabIndex = -1; real.setAttribute('aria-hidden', 'true'); real.__cco = true;
  real.parentNode.insertBefore(root, real.nextSibling);

  var o = { root: root, real: real, state: 'idle', t0: 0, btn: null, auto: 0 };
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
  o.reset = function (keep) {
    var saved = real.value;
    root.classList.add('cco-nt'); requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('cco-nt'); }); });
    root.classList.remove('cco-busy', 'cco-ok', 'cco-err'); o.state = 'idle';
    ic.innerHTML = KEY; setText('Verify <b>code</b>', 'Enter the ' + n + '-digit code we sent you.');
    boxes.forEach(function (x) { x.value = ''; x.readOnly = false; }); sync();
    if (keep === true) real.value = saved;
    if (o.btn) { btnState(null); o.btn = null; }
  };
  function left(min) { return sleep(reduce ? 0 : Math.max(0, min - (Date.now() - o.t0))); }
  o.busy = function () {      /* the blue light starts running round the card */
    if (o.state === 'busy') return;
    if (o.state !== 'idle') o.reset();
    o.state = 'busy'; o.t0 = Date.now(); o.btn = nextButton(root, true);
    boxes.forEach(function (x) { x.readOnly = true; x.blur(); });
    root.classList.add('cco-busy'); setText('Verifying <b>code</b>');
    btnState('cco-bspin', 'Verifying code...');
  };
  o.success = function () {   /* right code: the light settles green and a plain tick draws in */
    if (o.state !== 'busy') return Promise.resolve();
    return left(MIN_OK).then(function () {
      o.state = 'ok'; root.classList.remove('cco-busy'); root.classList.add('cco-ok'); ic.innerHTML = SHIELD;
      setText('Verified <b>Successfully</b>', 'Your security code has been confirmed.'); btnState('cco-bok', 'Verified & Secured');
      return sleep(reduce ? 400 : 1300);
    }).then(function () { setTimeout(function () { btnState(null); }, 80); setTimeout(function () { o.reset(true); }, 1500); });   /* by then the page has moved on */
  };
  o.fail = function () {      /* wrong code: the light turns red and the card shakes */
    if (o.state !== 'busy') return Promise.resolve();
    btnState(null);
    left(MIN_BAD).then(function () {
      o.state = 'err'; root.classList.remove('cco-busy'); root.classList.add('cco-err');
      setText('Wrong <b>code</b>', 'That code did not match. Try again.');
      return sleep(1200);
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
