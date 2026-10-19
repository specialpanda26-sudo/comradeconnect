/* cc-staff.js v1: admin-only Demo panel and staff check.
   - Asks the server who this phone is signed in as (GET /api/me). Only role "admin" counts.
   - Admins get a small "Demo" button. It plays the checkout, receipt, escrow payment, withdrawal and Face ID
     animations with FAKE data. Nothing is charged, sent, or saved.
   - ccStaff.ok tells cc-site.js to let an admin past the maintenance cover.
   The real admin powers stay on the server. This file only shows or hides screens. */
(function () {
'use strict';
if (window.ccStaff) return;
var API = (typeof CC_API !== 'undefined' ? CC_API : '').replace(/\/$/, '');
var S = { ok: false, handle: '', checked: false };
var $ = function (s, r) { return (r || document).querySelector(s); };
function auth() { try { return window.ccAuth ? window.ccAuth() : null; } catch (e) { return null; } }
function reapply() { try { window.ccSiteApply && window.ccSiteApply(); } catch (e) {} }

function check() {
  var a = auth();
  if (!API || !a || !a.token) { S.ok = false; S.checked = true; draw(); reapply(); return Promise.resolve(false); }
  return fetch(API + '/api/me', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { S.ok = !!(d && d.role === 'admin'); S.handle = (d && d.handle) || ''; })
    .catch(function () { /* offline: keep the last answer from this visit only */ })
    .then(function () { S.checked = true; draw(); reapply(); return S.ok; });
}

/* Staff sign in from the maintenance cover. Only admin accounts are kept signed in. */
function signIn(who, pw) {
  who = String(who || '').trim(); pw = String(pw || '');
  if (!who || !pw) return Promise.reject(new Error('Enter your username and password.'));
  var prev = null; try { prev = localStorage.getItem('cc_auth'); } catch (e) {}
  return fetch(API + '/api/auth/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aid: who, recovery_code: pw }) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Wrong username or password.'); return d; }); })
    .then(function (d) {
      try { localStorage.setItem('cc_auth', JSON.stringify({ aid: d.aid, token: d.token })); } catch (e) {}
      return check().then(function (ok) {
        if (!ok) {                                           // not an admin: put the phone back exactly as it was
          try { if (prev) localStorage.setItem('cc_auth', prev); else localStorage.removeItem('cc_auth'); } catch (e) {}
          S.ok = false; S.handle = ''; draw(); reapply();
          throw new Error('Staff accounts only.');
        }
        return true;
      });
    });
}

/* ---------- Demo panel ---------- */
function css() {
  if ($('#ccst-css')) return;
  var s = document.createElement('style'); s.id = 'ccst-css';
  s.textContent = '#ccst-b{position:fixed;left:14px;bottom:calc(86px + env(safe-area-inset-bottom,0px));z-index:850;border:1px solid var(--gb,rgba(255,255,255,.3));background:var(--bg,#000);color:var(--fg,#fff);border-radius:999px;padding:9px 16px;font:600 12px Poppins,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.35)}'
    + '#ccst-p h3{margin:0 0 4px}#ccst-p .ccst-n{margin:0 0 12px;font-size:12px;color:var(--mut,#bdbdbd);line-height:1.6}'
    + '#ccst-p .ccst-g{display:grid;gap:9px}#ccst-p .btn{width:100%}#ccst-p .ccst-box{margin-top:12px}';
  document.head.appendChild(s);
}
function sheet(html) {
  var T = window.ccTools;
  if (T && T.sheet) return T.sheet(html);
  var m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto';
  m.innerHTML = '<div class="box g" style="max-width:360px;width:100%">' + html + '</div>';
  document.body.appendChild(m); m.close = function () { m.remove(); }; return m;
}
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

function demoCheckout(panel) {
  panel.close();
  if (!window.ccReceipt) return;
  ccReceipt.show({ item: 'Demo: Study desk lamp', amount: 850, credit: 50, ref: 'DEMO' + Math.random().toString(36).slice(2, 6), via: 'M-Pesa' });
}
function demoPay(panel, kind) {
  var T = window.ccSteps; if (!T) return;
  var box = $('#ccst-box', panel); box.innerHTML = '';
  var ps = T.paySteps(box, '0700 000 000', 850, kind);
  sleep(1400).then(function () { ps.go('prompt'); return sleep(3200); })
    .then(function () { ps.go('verify'); return sleep(2200); })
    .then(function () { ps.go('done'); });
}
function demoWithdraw(panel) {
  var T = window.ccSteps; if (!T) return;
  var box = $('#ccst-box', panel); box.innerHTML = '';
  T.withdrawFlow(box, 1200, '0700 000 000',
    function () { return sleep(700).then(function () { return { id: 'demo', status: 'sending' }; }); },
    function () { return sleep(300).then(function () { return { status: 'paid', payout_ref: 'DEMO' + Math.random().toString(36).slice(2, 8).toUpperCase() }; }); }
  ).catch(function () {});
}
function demoFace(panel, mode) {
  if (!window.ccFaceId) return;
  panel.style.display = 'none';
  ccFaceId.scan(mode).then(function () { panel.style.display = ''; }, function () { panel.style.display = ''; });
}
function openPanel() {
  var p = sheet('<div id="ccst-p"><h3>Demo mode</h3>'
    + '<p class="ccst-n">Staff only. Everything here uses fake data. Nothing is charged, sent or saved.</p>'
    + '<div class="ccst-g">'
    + '<button class="btn p" data-d="checkout" type="button">Checkout and receipt</button>'
    + '<button class="btn g" data-d="escrow" type="button">Escrow payment steps</button>'
    + '<button class="btn g" data-d="deposit" type="button">Wallet deposit steps</button>'
    + '<button class="btn g" data-d="withdraw" type="button">Withdrawal steps</button>'
    + '<button class="btn g" data-d="faceverify" type="button">Face ID: verify</button>'
    + '<button class="btn g" data-d="faceenable" type="button">Face ID: turn on</button>'
    + '<button class="btn g" data-d="close" type="button">Close</button></div>'
    + '<div id="ccst-box" class="ccst-box"></div></div>');
  p.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-d]'); if (!b) return;
    var k = b.getAttribute('data-d');
    if (k === 'close') p.close();
    else if (k === 'checkout') demoCheckout(p);
    else if (k === 'escrow') demoPay(p, 'escrow');
    else if (k === 'deposit') demoPay(p, 'deposit');
    else if (k === 'withdraw') demoWithdraw(p);
    else if (k === 'faceverify') demoFace(p, 'verify');
    else if (k === 'faceenable') demoFace(p, 'enable');
  });
}
function draw() {
  var b = $('#ccst-b');
  if (!S.ok) { if (b) b.remove(); return; }
  if (b || !document.body) return;
  css();
  b = document.createElement('button'); b.id = 'ccst-b'; b.type = 'button'; b.textContent = 'Demo'; b.setAttribute('aria-label', 'Open demo mode');
  b.onclick = openPanel; document.body.appendChild(b);
}

window.ccStaff = { check: check, signIn: signIn, demo: openPanel, get ok() { return S.ok; } };
function boot() { check(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
