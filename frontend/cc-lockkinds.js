/* cc-lockkinds.js v1: Fingerprint and Face ID as two separate switches (section 1: the engine).
   The lock is still ME.bio (on or off). This file remembers WHICH ways are allowed (cc_lock_kinds) and makes the phone
   screen and the lock screen offer only those. The Settings switches are in cc-lockkinds-ui.js (section 2).
   Android app only: in a plain browser the site's own single lock runs as before. */
(function () {
  'use strict';
  if (window.__ccLockKinds) return; window.__ccLockKinds = 1;
  var KEY = 'cc_lock_kinds', NAMES = { fingerprint: 'Fingerprint', face: 'Face ID' };
  var bio = window.ccNativeBio, orig = null, only = '', busy = false;
  var none = { fingerprint: false, face: false, credential: false, any: false };
  var copy = function (c) { var o = {}; for (var p in c) o[p] = c[p]; return o; };
  var me = function () { try { return ME; } catch (e) { return null; } };
  var lockOn = function () { var m = me(); return !!(m && m.bio); };
  var say = function (t) { try { if (window.ccTools && ccTools.toast) ccTools.toast(t); else if (window.toast) window.toast(t); } catch (e) {} };

  function read() {                                   // which ways are allowed right now
    if (!lockOn()) { try { localStorage.removeItem(KEY); } catch (e) {} return { fingerprint: false, face: false }; }
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object' && (o.fingerprint || o.face)) return { fingerprint: !!o.fingerprint, face: !!o.face };
    } catch (e) {}
    return { fingerprint: true, face: true };         // lock was turned on by the old single button: both ways work
  }
  function write(k) { try { localStorage.setItem(KEY, JSON.stringify(k)); } catch (e) {} }
  function rawCaps() { return orig ? orig.call(bio) : Promise.resolve(copy(none)); }

  if (bio && bio.caps && !bio.__lk) {                 // the phone screen and the lock screen ask caps(): hand them only the allowed ways
    bio.__lk = 1; orig = bio.caps;
    bio.caps = function () {
      return orig.apply(bio, arguments).then(function (c) {
        if (only) { var a = copy(c); a.fingerprint = !!c.fingerprint && only === 'fingerprint'; a.face = !!c.face && only === 'face'; a.credential = false; a.any = a.fingerprint || a.face; return a; }
        if (!lockOn()) return c;
        var k = read(), b = copy(c); b.fingerprint = !!c.fingerprint && k.fingerprint; b.face = !!c.face && k.face; b.any = b.fingerprint || b.face || !!c.credential; return b;
      });
    };
  }

  function finish() {
    try { if (typeof saveMe === 'function') saveMe(); } catch (e) {}
    try { if (typeof drawSec === 'function') drawSec(); } catch (e) {}
    applyLock();
    try { window.dispatchEvent(new CustomEvent('cc-lockkinds')); } catch (e) {}
  }

  /* want = true: turn this way on (the phone checks it once). want = false: turn it off (the phone checks it first).
     Turning off the last way switches the whole lock off. Resolves true when it changed. */
  async function toggle(kind, want) {
    if (busy || !bio || !orig || !window.ccFp || !NAMES[kind]) return false;
    busy = true;
    try {
      var name = NAMES[kind], on = lockOn(), k = read();
      if (want === (on && k[kind])) return true;
      var ok;
      if (want) {
        var c = await rawCaps();
        if (!c[kind]) { say('No ' + name + ' is set up on this phone yet'); return false; }
        only = kind; ok = await window.ccFp.scan('Turn on ' + name, 'enable', kind); only = '';
        if (!ok) { say(name + ' was not turned on'); return false; }
        var n = on ? k : { fingerprint: false, face: false }; n[kind] = true;
        write(n); me().bio = 'native'; finish(); say(name + ' is on'); return true;
      }
      only = kind; ok = await window.ccFp.scan('Confirm it is really you', 'verify', kind); only = '';
      if (!ok) { say(name + ' is still on'); return false; }
      var m = read(); m[kind] = false;
      if (!m.fingerprint && !m.face) { delete me().bio; try { localStorage.removeItem(KEY); } catch (e) {} say('The lock is off'); }
      else { write(m); say(name + ' is off'); }
      finish(); return true;
    } catch (e) { return false; }
    finally { only = ''; busy = false; }
  }

  /* lock screen: hide the button of a way that is switched off, and say which ways are left */
  function applyLock() {
    var lk = document.getElementById('lk'); if (!lk || !bio) return;
    var on = lockOn(), k = read();
    [['lku', 'fingerprint'], ['lkf', 'face']].forEach(function (p) {
      var b = document.getElementById(p[0]), w = b && b.closest && b.closest('.lkb');
      if (w) w.style.display = on && !k[p[1]] ? 'none' : '';
    });
    rawCaps().then(function (c) {
      var fp = c.fingerprint && (!on || k.fingerprint), fc = c.face && (!on || k.face);
      var lab = lk.querySelector('.lkh'), note = lk.querySelector('.note');
      if (!lab || !note || !on || !(fp || fc)) return;
      lab.textContent = fp && fc ? 'Continue with Fingerprint or Face ID' : fc ? 'Continue with Face ID' : 'Continue with Fingerprint';
      note.textContent = fp && fc ? 'Choose how to unlock' : fc ? 'Look at your phone to unlock' : 'Touch the sensor to unlock';
    }, function () {});
  }
  [700, 1600, 3200].forEach(function (t) { setTimeout(applyLock, t); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(applyLock, 300); });

  window.ccLockKinds = { kinds: read, supported: rawCaps, toggle: toggle, apply: applyLock, names: NAMES, native: !!(bio && orig) };
})();
