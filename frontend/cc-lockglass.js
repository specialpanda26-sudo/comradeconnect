/* cc-lockglass.js v1: builds the password view of the lock screen (#lk) like the reference:
   label, glass field with show/hide eye, "Forgot your Password?", Continue (grey until typed) + fingerprint button.
   Only ADDS to the page. Every old id (lku, lkpw, lkc, lkr, lksw, lkhelp) and its handler stays. Section 1 of 4. */
(function () {
  'use strict';
  var lk = document.getElementById('lk'); if (!lk || lk.__lkg) return; lk.__lkg = 1;
  lk.classList.add('lkg');
  var $ = function (s) { return lk.querySelector(s); };
  var hero = $('.lkhero'), card = $('.lkcard'), rec = $('.lkrec'), inp = document.getElementById('lkc'), go = document.getElementById('lkr');
  if (!hero || !card || !rec || !inp || !go) return;

  var pill = document.createElement('i'); pill.className = 'lkpill'; pill.setAttribute('aria-hidden', 'true'); hero.parentNode.insertBefore(pill, hero.nextSibling);

  var lab = document.createElement('label'); lab.className = 'lklab'; lab.setAttribute('for', 'lkc'); lab.textContent = 'Sign in with Password';
  rec.insertBefore(lab, rec.firstChild);

  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYEOFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4"/><path d="M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  var fld = inp.closest('.fld') || inp.parentNode;
  var eye = document.createElement('button'); eye.type = 'button'; eye.className = 'lkeye'; eye.setAttribute('aria-label', 'Show password'); eye.innerHTML = EYEOFF;
  eye.onclick = function () { var show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; eye.innerHTML = show ? EYE : EYEOFF; eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); inp.focus(); };
  fld.appendChild(eye);

  var fg = document.createElement('a'); fg.className = 'lkforgot'; fg.href = 'contact.html'; fg.textContent = 'Forgot your Password?';
  fg.onclick = function (e) { if (window.CC && window.CC.forgot) { e.preventDefault(); window.CC.forgot(); } };   // email-only reset; the page falls back to Contact if the app is not ready
  fld.insertAdjacentElement('afterend', fg);

  var act = document.createElement('div'); act.className = 'lkact';
  go.parentNode.insertBefore(act, go); act.appendChild(go);
  var FP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></svg>';
  var fp2 = document.createElement('button'); fp2.type = 'button'; fp2.className = 'lkfp2'; fp2.id = 'lkfp2'; fp2.setAttribute('aria-label', 'Use fingerprint or face unlock instead'); fp2.innerHTML = FP;
  fp2.onclick = function () { lk.classList.remove('rec'); var u = document.getElementById('lku'); if (u) u.click(); };
  act.appendChild(fp2);

  // Continue stays grey until something is typed
  function sync() { var empty = !inp.value.trim(); if (go.disabled !== empty) go.disabled = empty; }
  inp.addEventListener('input', sync);
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !go.disabled) { e.preventDefault(); go.click(); } });
  new MutationObserver(sync).observe(go, { attributes: true, attributeFilter: ['disabled'] });
  new MutationObserver(function () { if (lk.classList.contains('rec')) { sync(); } else { inp.value = ''; inp.type = 'password'; eye.innerHTML = EYEOFF; sync(); } }).observe(lk, { attributes: true, attributeFilter: ['class'] });
  // the old script writes "Unlock" on the button; the reference says "Continue"
  setTimeout(function () { go.textContent = 'Continue'; sync(); }, 0);
  sync();
  // "Hi, HENRY": the name shows in orange like the reference
  var hi = document.getElementById('lkhi');
  function tint() {
    if (!hi || hi.querySelector('b')) return;
    var m = /^Hi,\s*(.+)$/.exec(hi.textContent || ''); if (!m) return;
    var b = document.createElement('b'); b.textContent = m[1]; hi.textContent = 'Hi, '; hi.appendChild(b);
  }
  if (hi) { tint(); new MutationObserver(function () { setTimeout(tint, 0); }).observe(hi, { childList: true, characterData: true, subtree: true }); }
})();
