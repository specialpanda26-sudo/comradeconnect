/* Big welcome card at the top of the Feed for people without an account.
   It comes back every visit until they sign up (X hides it for this visit only). */
(function () {
'use strict';
var feed = document.getElementById('v-feed'); if (!feed) return;
var KEY = 'cc_wb';
function signedIn() { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); }
function seen() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
if (seen() || signedIn()) return;
var st = document.createElement('style');
st.textContent = '.ccwb{position:relative;text-align:center;max-width:640px;margin:calc(92px + env(safe-area-inset-top,0px)) auto 6px;padding:36px 22px 26px;border-radius:28px}'
  + '.ccwb img{width:96px;height:96px;border-radius:26px;display:block;margin:0 auto 16px}'
  + '.ccwb h2{font-size:clamp(28px,8vw,42px);line-height:1.1;margin:0 0 10px}'
  + '.ccwb p{margin:0 auto 20px;max-width:420px;opacity:.85;line-height:1.5}'
  + '.ccwb .ccwr{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}.ccwb .ccwr .btn{flex:1 1 150px}'
  + '.ccwb small{display:block;margin-top:18px;opacity:.6;font-size:12px}'
  + '.ccwb .ccwx{position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;border:1px solid rgba(127,127,127,.4);background:rgba(127,127,127,.18);color:inherit;font-size:22px;line-height:1;cursor:pointer;padding:0}';
document.head.appendChild(st);
var box = document.createElement('section');
box.className = 'box g ccwb'; box.setAttribute('aria-label', 'Welcome card');
box.innerHTML = '<button type="button" class="ccwx" aria-label="Close welcome">\u00d7</button>'
  + '<img src="icon-192.png" width="96" height="96" alt="Comrade Connect logo">'
  + '<h2>Welcome to Comrade Connect</h2>'
  + '<p>The campus app for Kirinyaga comrades: spill anonymously, buy and sell safely, and find every event in one place.</p>'
  + '<div class="ccwr"><button type="button" class="btn p" data-wb="start">Create my account</button><button type="button" class="btn g" data-wb="explore">See what is on</button></div>'
  + '<small>Built by Ogolla Tech. Founder and CEO: Henry O. Odhiambo.</small>';
function dismiss() { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} box.remove(); }
box.addEventListener('click', function (e) {
  var b = e.target.closest('button'); if (!b) return;
  if (b.classList.contains('ccwx')) return dismiss();
  if (b.dataset.wb === 'explore') { var t = document.querySelector('[data-v="explore"]'); dismiss(); if (t) t.click(); return; }
  if (b.dataset.wb === 'start') { if (window.ccAuthPanel) window.ccAuthPanel('create'); }
});
feed.insertBefore(box, feed.firstChild);
})();
