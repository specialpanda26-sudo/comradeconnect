/* cc-verify.js v1: adds the new look to the reset-password page (#ccfgt) and to every code card (.cco).
   It only adds things around the existing logic: an envelope or lock picture, dots then one tick, and the new-password meter.
   cc-core.js, cc-otp.js and cc-emailask.js are not changed. */
(function () {
'use strict';
if (window.__ccv) return; window.__ccv = 1;

var ILL = '<div class="ccv-ill" aria-hidden="true">'
  + '<div class="ccv-env"><span class="d"></span><span class="e"><svg viewBox="0 0 46 34"><path d="M5 7l18 14L41 7"/></svg></span><span class="bb">***</span></div>'
  + '<div class="ccv-lock"><span class="d"></span><svg class="l" viewBox="0 0 46 46"><path class="sh" d="M15 21v-5a8 8 0 0 1 16 0v5"/><rect class="bd" x="10" y="21" width="26" height="19" rx="5"/><circle class="kh" cx="23" cy="30" r="2.6"/></svg></div></div>';
var OV = '<div class="ccv-ov" aria-hidden="true"><div class="ccv-dots"><i></i><i></i><i></i><i></i><i></i></div>'
  + '<div class="ccv-tk"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div></div>';
var PW = '<div class="ccv-pw" data-lv="0"><div class="ccv-meter"><i></i><i></i><i></i><i></i></div><p class="ccv-lvl">Type at least 8 characters</p>'
  + '<ul class="ccv-rules"><li data-r="len">8 or more characters</li><li data-r="mix">A letter and a number</li><li data-r="cas">Upper and lower case</li><li data-r="big">12 characters, or a symbol</li></ul>'
  + '<p class="ccv-note">Only the first rule is required. The others make it stronger.</p></div>';
var LABEL = ['Type at least 8 characters', 'Weak. Add more below', 'Okay', 'Good', 'Strong'];

function h(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstChild; }
function okMail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim()); }

function rules(v) {
  var r = { len: v.length >= 8, mix: /[A-Za-z]/.test(v) && /\d/.test(v), cas: /[a-z]/.test(v) && /[A-Z]/.test(v), big: v.length >= 12 || /[^A-Za-z0-9]/.test(v) };
  return { r: r, lv: r.len ? 1 + (r.mix ? 1 : 0) + (r.cas ? 1 : 0) + (r.big ? 1 : 0) : 0 };
}

/* every code card gets the dots and the tick on top of its boxes */
function overlays(root) {
  [].forEach.call(root.querySelectorAll('.cco-stage'), function (s) { if (!s.querySelector('.ccv-ov')) s.appendChild(h(OV)); });
}

function stepOf(pg) { var m = /Step\s+(\d)/.exec((pg.querySelector('#ccfg-st') || {}).textContent || ''); return m ? +m[1] : 1; }

/* the main button looks grey until the step can be done */
function paintButton(pg) {
  var go = pg.querySelector('#ccfg-go'), n = stepOf(pg); if (!go) return;
  var m = pg.querySelector('#ccfg-m'), p = pg.querySelector('#ccfg-p'), off = false;
  if (n === 1) off = !okMail(m && m.value);
  else if (n === 3) off = !(p && p.value.length >= 8);
  go.classList.toggle('ccv-off', off);
}

function paintPassword(pg) {
  var p = pg.querySelector('#ccfg-p'), box = pg.querySelector('.ccv-pw'); if (!p || !box) return;
  var s = rules(p.value || '');
  box.setAttribute('data-lv', s.lv);
  box.querySelector('.ccv-lvl').textContent = LABEL[s.lv];
  [].forEach.call(box.querySelectorAll('li'), function (li) { li.classList.toggle('ok', !!s.r[li.getAttribute('data-r')]); });
  pg.classList.toggle('ccv-ok', s.r.len);   /* the little padlock opens once the password is long enough */
  paintButton(pg);
}

function sync(pg) {
  var h1 = pg.querySelector('#ccfg-h');
  if (h1 && !pg.querySelector('.ccv-ill')) h1.parentNode.insertBefore(h(ILL), h1);
  pg.setAttribute('data-ccv', stepOf(pg));
  overlays(pg);
  var p = pg.querySelector('#ccfg-p');
  if (p && !p.__ccv) {
    p.__ccv = 1;
    var holder = p.closest('.fp-f'); if (holder) holder.appendChild(h(PW));
    p.addEventListener('input', function () { paintPassword(pg); });
  }
  var m = pg.querySelector('#ccfg-m');
  if (m && !m.__ccv) { m.__ccv = 1; m.addEventListener('input', function () { paintButton(pg); }); }
  paintPassword(pg); paintButton(pg);
}

var queued = 0;
function scan() {
  overlays(document);
  var pg = document.getElementById('ccfgt'); if (pg) sync(pg);
}
function start() {
  scan();
  new MutationObserver(function () {
    if (queued) return;
    queued = requestAnimationFrame(function () { queued = 0; scan(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
