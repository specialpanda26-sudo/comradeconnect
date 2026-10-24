#!/usr/bin/env python3
"""fix_passkey_extra.py: third passkey patch. Run AFTER fix_passkey_panel.py and fix_passkey_sheet.py, from the repo root:
    python3 fix_passkey_extra.py [repo_root]
Safe to run twice.
  1. The signed-in "Welcome, comrade" screen (the Link Google one) gets an "Add a passkey" button, shown only when this account has no passkey yet.
  2. The server now writes a clear line to its log when a passkey is refused because the site address is not in PASSKEY_ORIGINS
     (students still see the normal short message; you see the real reason in the Render logs).
  3. Bumps cc-passkey.js?v=4 -> v=5.
"""
import sys, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
pk, idx, be = root / 'frontend' / 'cc-passkey.js', root / 'frontend' / 'index.html', root / 'backend' / 'src' / 'passkeys.js'
for p in (pk, idx, be):
    if not p.exists():
        sys.exit(f'Not found: {p}  (run from the repo root, or pass it as the first argument)')


def patch(path, pairs):
    s = path.read_text(encoding='utf-8')
    for old, new, tag in pairs:
        if new in s:
            print(f'  skip  {tag} (already applied)'); continue
        if s.count(old) != 1:
            sys.exit(f'  FAIL  {tag}: expected 1 match in {path}, found {s.count(old)}. Nothing written for this file. (Did you run the first two scripts?)')
        s = s.replace(old, new); print(f'  ok    {tag}')
    path.write_text(s, encoding='utf-8')


print('frontend/cc-passkey.js')
patch(pk, [
    ('  // ---- "Sign in with a passkey" button on the restore screens ----\n',
     """  // ---- "Add a passkey" on the signed-in Welcome screen (next to Link Google), only while this account has none ----
  function mountWelcome() {
    var sec = $('#dm section[data-v="si"]'); if (!sec || sec.hidden || $('.ccpk-si', sec) || !supported()) return;
    var a = window.ccAuth && ccAuth(); if (!a || !a.token) return;
    var skip = $('#siS', sec); if (!skip) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn g ccpk-si'; b.style.cssText = 'width:100%;margin-top:10px;display:none';
    b.innerHTML = KEY + 'Add a passkey'; skip.parentNode.insertBefore(b, skip);
    call('/api/passkey/list', null, 'GET').then(function (d) { if (!(d.passkeys || []).length) b.style.display = ''; }).catch(function () {});
    b.onclick = async function () {
      b.disabled = true;
      try { await register(deviceName()); say('Passkey added'); b.remove(); }
      catch (x) { var m = friendly(x); if (m !== 'Cancelled') say(m); b.disabled = false; }
    };
  }

  // ---- "Sign in with a passkey" button on the restore screens ----
""", 'Welcome screen: Add a passkey button'),
    ("    hookSignup();\n    mountBox();", "    hookSignup();\n    mountBox();\n    mountWelcome();", 'run mountWelcome on every scan'),
])
print('backend/src/passkeys.js')
patch(be, [
    ("  if (!origins(env).includes(String(cd.origin || '').replace(/\\/$/, ''))) return null;",
     "  if (!origins(env).includes(String(cd.origin || '').replace(/\\/$/, ''))) { console.error('passkey refused: site address ' + cd.origin + ' is not in PASSKEY_ORIGINS (' + origins(env).join(', ') + ')'); return null; }",
     'log the real reason for a refused origin'),
])
print('frontend/index.html')
h = idx.read_text(encoding='utf-8')
if 'cc-passkey.js?v=5' in h:
    print('  skip  cache-bust (already v=5)')
elif h.count('cc-passkey.js?v=4') == 1:
    idx.write_text(h.replace('cc-passkey.js?v=4', 'cc-passkey.js?v=5'), encoding='utf-8'); print('  ok    cache-bust v=4 -> v=5')
else:
    sys.exit('  FAIL  could not find cc-passkey.js?v=4 in index.html (run the first two scripts first).')
print('\nDone. Deploy the frontend and the backend.')
