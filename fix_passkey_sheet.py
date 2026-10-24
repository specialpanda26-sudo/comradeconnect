#!/usr/bin/env python3
"""fix_passkey_sheet.py: replace the plain browser pop-ups in the passkey panel with a styled sheet that matches the app.
Run AFTER fix_passkey_panel.py, from the repo root:  python3 fix_passkey_sheet.py [repo_root]
Safe to run twice. Changes frontend/cc-passkey.js and bumps its version in index.html (v=3 -> v=4).
  - "Remove this passkey?"  -> styled sheet with Keep / Remove (Esc or a tap outside = Keep)
  - "Add a passkey?" after sign-up -> styled sheet with Not now / Add passkey
"""
import sys, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
pk = root / 'frontend' / 'cc-passkey.js'
idx = root / 'frontend' / 'index.html'
for p in (pk, idx):
    if not p.exists():
        sys.exit(f'Not found: {p}  (run from the repo root, or pass it as the first argument)')

s = pk.read_text(encoding='utf-8')
if 'function ask(' in s:
    print('  skip  styled sheet (already applied)')
else:
    if 'window.confirm(' not in s:
        sys.exit('Run fix_passkey_panel.py first (cc-passkey.js does not have the confirm() calls this script replaces).')
    pairs = [
        ("  // ---- a readable name for each passkey, and a one-time offer after sign-up ----\n",
         """  // ---- a small styled question sheet (same look as the app's other sheets); resolves true / false ----
  function ask(title, text, okLabel, noLabel) {
    return new Promise(function (done) {
      if (!$('#ccpk-css')) {
        var st = document.createElement('style'); st.id = 'ccpk-css';
        st.textContent = '.ccpk-sheet{position:fixed;inset:0;z-index:99999;background:rgba(16,20,34,.8);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}.ccpk-card{max-width:360px;width:100%}';
        document.head.appendChild(st);
      }
      var m = document.createElement('div'); m.className = 'ccpk-sheet'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', title);
      m.innerHTML = '<div class="box g ccpk-card"><h3>' + esc(title) + '</h3><p class="sub" style="margin-top:6px">' + esc(text) + '</p>'
        + '<div class="two" style="margin-top:14px"><button type="button" class="btn g" data-r="0">' + esc(noLabel || 'Cancel') + '</button><button type="button" class="btn p" data-r="1">' + esc(okLabel || 'OK') + '</button></div></div>';
      var key = function (e) { if (e.key === 'Escape') { e.stopPropagation(); fin(false); } };
      var fin = function (v) { document.removeEventListener('keydown', key, true); m.remove(); done(v); };
      m.addEventListener('click', function (e) { var b = e.target.closest('button[data-r]'); if (b) fin(b.getAttribute('data-r') === '1'); else if (e.target === m) fin(false); });
      document.addEventListener('keydown', key, true);
      document.body.appendChild(m);
      var safe = m.querySelector('[data-r="0"]'); if (safe) safe.focus();   // focus the safe choice, so a stray Enter never deletes
    });
  }

  // ---- a readable name for each passkey, and a one-time offer after sign-up ----
""", 'helper: ask()'),
        ("    if (!window.confirm('Add a passkey? Next time you can sign in with your fingerprint, face or screen lock.')) return Promise.resolve();\n    return register(deviceName()).then(function () { say('Passkey added'); }, function (x) { var m = friendly(x); if (m !== 'Cancelled') say(m); });",
         "    return ask('Add a passkey?', 'Next time you can sign in with your fingerprint, face or screen lock. No password to remember.', 'Add passkey', 'Not now').then(function (yes) {\n      if (!yes) return;\n      return register(deviceName()).then(function () { say('Passkey added'); }, function (x) { var m = friendly(x); if (m !== 'Cancelled') say(m); });\n    });",
         'sign-up offer uses the sheet'),
        ("      if (!window.confirm('Remove this passkey? You will not be able to sign in with it any more.')) return;",
         "      if (!(await ask('Remove this passkey?', 'You will not be able to sign in with it any more. Your account and other passkeys stay as they are.', 'Remove', 'Keep'))) return;",
         'remove uses the sheet'),
    ]
    for old, new, tag in pairs:
        if s.count(old) != 1:
            sys.exit(f'  FAIL  {tag}: expected 1 match, found {s.count(old)}. Nothing written.')
        s = s.replace(old, new); print(f'  ok    {tag}')
    pk.write_text(s, encoding='utf-8')

h = idx.read_text(encoding='utf-8')
if 'cc-passkey.js?v=4' in h:
    print('  skip  cache-bust (already v=4)')
elif h.count('cc-passkey.js?v=3') == 1:
    idx.write_text(h.replace('cc-passkey.js?v=3', 'cc-passkey.js?v=4'), encoding='utf-8'); print('  ok    cache-bust v=3 -> v=4')
else:
    sys.exit('  FAIL  could not find cc-passkey.js?v=3 in index.html (run fix_passkey_panel.py first).')
print('\nDone. Deploy the frontend, then hard-refresh once.')
