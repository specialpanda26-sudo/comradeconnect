/* Alerts permission only after sign-in. Signed out: "Allow alerts" asks you to sign in first and nothing is requested from the phone.
   Signed in: a friendly one-time question ("Turn on alerts?"), then the phone's own permission prompt. Text is set with textContent only. */
(function () {
'use strict';
if (window.__ccAlerts) return; window.__ccAlerts = 1;
var KEY = 'cc_alerts_asked', asking = false;
var $ = function (s) { return document.querySelector(s); };
function signed() { try { var a = window.ccAuth && window.ccAuth(); return !!(a && a.token); } catch (e) { return false; } }
function can() { return 'Notification' in window && Notification.permission === 'default'; }
function asked() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
function mark() { try { localStorage.setItem(KEY, '1'); } catch (e) {} }
function refresh() { try { if (typeof nstat === 'function') nstat(); } catch (e) {} label(); }
function ask() {
  if (!signed() || !('Notification' in window)) return Promise.resolve();
  mark(); return Promise.resolve().then(function () { return Notification.requestPermission(); }).catch(function () {}).then(refresh);
}
function label() { var b = $('#nen'); if (b && !signed()) b.textContent = 'Sign in to allow alerts'; else if (b && b.textContent === 'Sign in to allow alerts') b.textContent = 'Allow alerts'; }

function sheet() {
  if (asking || !signed() || !can() || asked() || $('#ccal')) return; asking = true;
  var w = document.createElement('div'); w.id = 'ccal'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-label', 'Turn on alerts');
  w.style.cssText = 'position:fixed;inset:0;z-index:10150;display:grid;place-items:center;padding:22px;background:rgba(0,0,0,.72)';
  var b = document.createElement('div'); b.style.cssText = 'position:relative;width:100%;max-width:340px;border-radius:24px;padding:26px 22px 18px;background:var(--bg,#000);color:var(--fg,#fff);border:1px solid var(--gb,rgba(255,255,255,.28));text-align:center;font-family:Poppins,system-ui,sans-serif';
  var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.textContent = '\u00d7'; x.style.cssText = 'position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:50%;border:1px solid var(--gb,rgba(255,255,255,.28));background:transparent;color:inherit;font-size:20px;cursor:pointer';
  var h = document.createElement('h2'); h.textContent = 'Turn on alerts?'; h.style.cssText = 'margin:0 0 8px;font-size:21px';
  var p = document.createElement('p'); p.textContent = 'Get a ping for replies, messages and verified campus notices. You can change this any time in Me, Notifications.'; p.style.cssText = 'margin:0;font-size:14px;line-height:1.55;color:var(--mut,#bdbdbd)';
  var y = document.createElement('button'); y.type = 'button'; y.textContent = 'Turn on'; y.style.cssText = 'width:100%;margin-top:18px;border:0;border-radius:999px;padding:14px;background:var(--fg,#fff);color:var(--bg,#000);font:600 15px Poppins,system-ui,sans-serif;cursor:pointer';
  var n = document.createElement('button'); n.type = 'button'; n.textContent = 'Not now'; n.style.cssText = 'width:100%;margin-top:8px;border:0;background:none;color:var(--mut,#bdbdbd);padding:12px;font:500 14px Poppins,system-ui,sans-serif;cursor:pointer';
  function done() { asking = false; document.removeEventListener('keydown', esc); w.remove(); }
  function esc(e) { if (e.key === 'Escape') { mark(); done(); } }
  y.onclick = function () { done(); ask(); }; n.onclick = function () { mark(); done(); }; x.onclick = n.onclick; document.addEventListener('keydown', esc);
  b.appendChild(x); b.appendChild(h); b.appendChild(p); b.appendChild(y); b.appendChild(n); w.appendChild(b); document.body.appendChild(w);
}

document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('#nen'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (signed()) return void ask();
  if (window.CC && CC.ensureAccount) CC.ensureAccount().then(function () { setTimeout(function () { if (signed()) ask(); label(); }, 400); }).catch(function () {});
  else if (typeof toast === 'function') toast('Sign in first, then you can allow alerts.');
}, true);

function tick() { label(); sheet(); }
setInterval(tick, 2500); setTimeout(tick, 3000);
})();
