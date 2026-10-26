/* cc-lockpw.js v1: logic for the recreated password view (#lk.rec): avatar initial, lock icon, one spinner, shake on a wrong password,
   Caps Lock hint, friendly sub-line. Only ADDS. All old ids and handlers (lku, lkpw, lkc, lkr, lksw, lkhelp) stay. Section 2 of 2. */
(function () {
  'use strict';
  var lk = document.getElementById('lk'); if (!lk || lk.__pw2) return;
  var card = lk.querySelector('.lkcard'), inp = document.getElementById('lkc'), go = document.getElementById('lkr'), wel = document.getElementById('lkwel'), hi = document.getElementById('lkhi');
  var fld = inp && (inp.closest('.fld') || inp.parentNode);
  if (!card || !inp || !go || !fld) return; lk.__pw2 = 1;
  lk.classList.add('lkv2');

  var av = document.createElement('div'); av.className = 'lkav'; av.setAttribute('aria-hidden', 'true'); card.insertBefore(av, card.firstChild);
  var ico = document.createElement('span'); ico.className = 'lkico'; ico.setAttribute('aria-hidden', 'true');
  ico.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15.5" r="1.1"/></svg>';
  fld.insertBefore(ico, fld.firstChild);
  var caps = document.createElement('p'); caps.className = 'lkcaps'; caps.hidden = true; caps.setAttribute('role', 'status'); caps.textContent = 'Caps Lock is on';
  fld.insertAdjacentElement('afterend', caps);
  inp.setAttribute('autocomplete', 'current-password');

  function initial() { var t = ((hi && hi.textContent) || '').replace(/^Hi,\s*/i, '').trim(); return (t.charAt(0) || 'C').toUpperCase(); }
  var SUB = 'Enter your password to continue', orig = null;
  function view() {
    av.textContent = initial();
    if (!wel) return;
    if (lk.classList.contains('rec')) { if (orig === null && wel.textContent !== SUB) orig = wel.textContent; wel.textContent = SUB; }
    else if (orig !== null) { wel.textContent = orig; orig = null; caps.hidden = true; fld.classList.remove('lkbad'); }
  }
  view();
  new MutationObserver(view).observe(lk, { attributes: true, attributeFilter: ['class'] });
  if (hi) new MutationObserver(function () { av.textContent = initial(); }).observe(hi, { childList: true, characterData: true, subtree: true });

  // one spinner: the old script writes "Checking..." on the button; show a single ring instead of the word
  function busy() { go.classList.toggle('busy', /checking/i.test(go.textContent || '')); }
  new MutationObserver(busy).observe(go, { childList: true, characterData: true, subtree: true }); busy();

  // wrong password: the toast says so, the field shakes
  var toast = document.getElementById('toast');
  if (toast) new MutationObserver(function () {
    if (!lk.classList.contains('rec') || !lk.classList.contains('on')) return;
    if (!/not right|wrong|incorrect|invalid|failed|try again|no match/i.test(toast.textContent || '')) return;
    fld.classList.remove('lkbad'); void fld.offsetWidth; fld.classList.add('lkbad');
    setTimeout(function () { fld.classList.remove('lkbad'); }, 1800);
  }).observe(toast, { childList: true, characterData: true, subtree: true, attributes: true });
  inp.addEventListener('input', function () { fld.classList.remove('lkbad'); });

  // Caps Lock hint
  function capsCheck(e) { try { caps.hidden = !(e.getModifierState && e.getModifierState('CapsLock')); } catch (x) {} }
  inp.addEventListener('keydown', capsCheck); inp.addEventListener('keyup', capsCheck); inp.addEventListener('blur', function () { caps.hidden = true; });
})();
