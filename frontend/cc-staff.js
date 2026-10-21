/* cc-staff.js v2: staff check only.
   - Asks the server who this phone is signed in as (GET /api/me). Only role "admin" counts.
   - ccStaff.ok tells cc-site.js to let an admin past the maintenance cover.
   The real admin powers stay on the server. This file only shows or hides screens.
   (The old fake-data "Demo" panel was removed: real users never see demo screens.) */
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
  if (!API || !a || !a.token) { S.ok = false; S.checked = true; reapply(); return Promise.resolve(false); }
  return fetch(API + '/api/me', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { S.ok = !!(d && d.role === 'admin'); S.handle = (d && d.handle) || ''; })
    .catch(function () { /* offline: keep the last answer from this visit only */ })
    .then(function () { S.checked = true; reapply(); return S.ok; });
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
          S.ok = false; S.handle = ''; reapply();
          throw new Error('Staff accounts only.');
        }
        return true;
      });
    });
}

window.ccStaff = { check: check, signIn: signIn, get ok() { return S.ok; } };
function boot() { check(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
