#!/usr/bin/env python3
"""fix_passkey_panel.py: polish the passkey panel. Run from the repo root:  python3 fix_passkey_panel.py [repo_root]
Safe to run twice (it skips what is already applied). Changes:
  1. Each new passkey gets a readable name ("Chrome on Android · 2026-10-24") instead of "Passkey".
  2. Remove asks "Remove this passkey?" first.
  3. The page watcher is debounced (one scan per frame instead of one per DOM change).
  4. After sign-up, once per phone, offers "Add a passkey?" (web only; the Android app is skipped).
  5. Students no longer see "Ask the admin to run the passkeys SQL".
  6. Bumps cc-passkey.js?v=2 -> v=3 so phones fetch the new file.
"""
import sys, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
pk = root / 'frontend' / 'cc-passkey.js'
idx = root / 'frontend' / 'index.html'
be = root / 'backend' / 'src' / 'passkeys.js'
for p in (pk, idx, be):
    if not p.exists():
        sys.exit(f'Not found: {p}  (run from the repo root, or pass it as the first argument)')


def patch(path, pairs):
    s = path.read_text(encoding='utf-8')
    for old, new, tag in pairs:
        if new in s:
            print(f'  skip  {tag} (already applied)')
            continue
        if s.count(old) != 1:
            sys.exit(f'  FAIL  {tag}: expected 1 match in {path}, found {s.count(old)}. Nothing written for this file.')
        s = s.replace(old, new)
        print(f'  ok    {tag}')
    path.write_text(s, encoding='utf-8')


print('frontend/cc-passkey.js')
patch(pk, [
    # 1 + 4: helpers (device name, post-signup offer)
    ("  // ---- add one ----\n",
     """  // ---- a readable name for each passkey, and a one-time offer after sign-up ----
  function deviceName() {
    var ua = navigator.userAgent || '';
    var os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Device';
    var br = /Edg\\//.test(ua) ? 'Edge' : /Chrome\\//.test(ua) ? 'Chrome' : /Safari\\//.test(ua) ? 'Safari' : /Firefox\\//.test(ua) ? 'Firefox' : 'Browser';
    return br + ' on ' + os + ' \\u00b7 ' + new Date().toISOString().slice(0, 10);
  }
  function offerAfterSignup() {
    try { if (!supported() || localStorage.getItem('cc_pk_offered')) return Promise.resolve(); } catch (e) { return Promise.resolve(); }
    var a = window.ccAuth && ccAuth(); if (!a || !a.token) return Promise.resolve();
    try { localStorage.setItem('cc_pk_offered', '1'); } catch (e) {}
    if (!window.confirm('Add a passkey? Next time you can sign in with your fingerprint, face or screen lock.')) return Promise.resolve();
    return register(deviceName()).then(function () { say('Passkey added'); }, function (x) { var m = friendly(x); if (m !== 'Cancelled') say(m); });
  }
  function hookSignup() {   // cc-core calls window.ccAskEmailSignup after every new account; offer the passkey right after it
    var f = window.ccAskEmailSignup; if (typeof f !== 'function' || f.__pk) return;
    var w = function () { var r = f.apply(this, arguments); return Promise.resolve(r).then(function (v) { return offerAfterSignup().then(function () { return v; }); }); };
    w.__pk = 1; window.ccAskEmailSignup = w;
  }

  // ---- add one ----
""", 'helpers: deviceName + offerAfterSignup'),
    # 1: name on the Add button
    ("try { await register(''); say('Passkey added'); }",
     "try { await register(deviceName()); say('Passkey added'); }", 'name new passkeys'),
    # 2: confirm before remove
    ("      var rm = e.target.closest('button[data-id]'); if (!rm) return;\n      rm.disabled = true;",
     "      var rm = e.target.closest('button[data-id]'); if (!rm) return;\n      if (!window.confirm('Remove this passkey? You will not be able to sign in with it any more.')) return;\n      rm.disabled = true;",
     'confirm before remove'),
    # 4: hook on every scan
    ("  function scan() {\n    mountBox();",
     "  function scan() {\n    hookSignup();\n    mountBox();", 'hook sign-up offer into scan'),
    # 3: debounce the observer
    ("  new MutationObserver(function () { scan(); }).observe(document.documentElement, { childList: true, subtree: true });",
     "  var queued = false;   // one scan per frame, however many DOM changes happen\n  new MutationObserver(function () { if (queued) return; queued = true; (window.requestAnimationFrame || setTimeout)(function () { queued = false; scan(); }); }).observe(document.documentElement, { childList: true, subtree: true });",
     'debounce MutationObserver'),
])

print('backend/src/passkeys.js')
patch(be, [
    ("return err(env, 'Could not save the passkey. Ask the admin to run the passkeys SQL.', 500);",
     "{ console.error('passkey save failed: run supabase/passkeys-and-device-lock.sql', res.status); return err(env, 'Could not save the passkey right now. Please try again later.', 500); }",
     'hide admin wording from students'),
])

print('frontend/index.html')
patch(idx, [
    ('<script src="cc-passkey.js?v=2" defer></script>', '<script src="cc-passkey.js?v=3" defer></script>', 'cache-bust cc-passkey.js'),
])
print('\nDone. Deploy the frontend and backend, then hard-refresh once.')
