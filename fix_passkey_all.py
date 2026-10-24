#!/usr/bin/env python3
"""fix_passkey_all.py: ALL the passkey fixes in one go. Run from the repo root:   python3 fix_passkey_all.py [repo_root]
Works from any starting point (nothing applied yet, or after any of the earlier scripts) and is safe to run twice.

What you get
  Passkey panel (Me)
    - every new passkey is named, e.g. "Chrome on Android · 2026-10-24" (not "Passkey" every time)
    - Remove asks first, with a styled sheet (Keep is focused, Esc / tap outside = Keep)
    - the page watcher is debounced (one scan per frame)
    - in the Android app the box now has an "Open the website" button (passkeys are made on the website)
  Offers
    - after sign-up (once per phone, website only): styled "Add a passkey?" sheet
    - the signed-in "Welcome, comrade" screen gets an "Add a passkey" button while the account has none
  Server
    - students no longer see "Ask the admin to run the passkeys SQL" (the real reason goes to the server log)
    - a passkey refused because the site is not in PASSKEY_ORIGINS writes the exact reason to the server log
  Cache: cc-passkey.js is set to v=5 in index.html
"""
import re, sys, pathlib

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
pk, idx, be = root / 'frontend' / 'cc-passkey.js', root / 'frontend' / 'index.html', root / 'backend' / 'src' / 'passkeys.js'
for p in (pk, idx, be):
    if not p.exists():
        sys.exit(f'Not found: {p}  (run from the repo root, or pass it as the first argument)')

SITE = 'https://comradeconnect.co.ke'

ASK = """  // ---- a small styled question sheet (same look as the app's other sheets); resolves true / false ----
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

"""
NAME_ANCHOR = "  // ---- a readable name for each passkey, and a one-time offer after sign-up ----\n"
HELPERS = NAME_ANCHOR + """  function deviceName() {
    var ua = navigator.userAgent || '';
    var os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Device';
    var br = /Edg\\//.test(ua) ? 'Edge' : /Chrome\\//.test(ua) ? 'Chrome' : /Safari\\//.test(ua) ? 'Safari' : /Firefox\\//.test(ua) ? 'Firefox' : 'Browser';
    return br + ' on ' + os + ' \\u00b7 ' + new Date().toISOString().slice(0, 10);
  }
  function offerAfterSignup() {
    try { if (!supported() || localStorage.getItem('cc_pk_offered')) return Promise.resolve(); } catch (e) { return Promise.resolve(); }
    var a = window.ccAuth && ccAuth(); if (!a || !a.token) return Promise.resolve();
    try { localStorage.setItem('cc_pk_offered', '1'); } catch (e) {}
    return ask('Add a passkey?', 'Next time you can sign in with your fingerprint, face or screen lock. No password to remember.', 'Add passkey', 'Not now').then(function (yes) {
      if (!yes) return;
      return register(deviceName()).then(function () { say('Passkey added'); }, function (x) { var m = friendly(x); if (m !== 'Cancelled') say(m); });
    });
  }
  function hookSignup() {   // cc-core calls window.ccAskEmailSignup after every new account; offer the passkey right after it
    var f = window.ccAskEmailSignup; if (typeof f !== 'function' || f.__pk) return;
    var w = function () { var r = f.apply(this, arguments); return Promise.resolve(r).then(function (v) { return offerAfterSignup().then(function () { return v; }); }); };
    w.__pk = 1; window.ccAskEmailSignup = w;
  }

"""
WELCOME = """  // ---- "Add a passkey" on the signed-in Welcome screen (next to Link Google), only while this account has none ----
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

"""
SIGNIN_ANCHOR = '  // ---- "Sign in with a passkey" button on the restore screens ----\n'
OLD_CONFIRM_OFFER = "    if (!window.confirm('Add a passkey? Next time you can sign in with your fingerprint, face or screen lock.')) return Promise.resolve();\n    return register(deviceName()).then(function () { say('Passkey added'); }, function (x) { var m = friendly(x); if (m !== 'Cancelled') say(m); });"
NEW_ASK_OFFER = "    return ask('Add a passkey?', 'Next time you can sign in with your fingerprint, face or screen lock. No password to remember.', 'Add passkey', 'Not now').then(function (yes) {\n      if (!yes) return;\n      return register(deviceName()).then(function () { say('Passkey added'); }, function (x) { var m = friendly(x); if (m !== 'Cancelled') say(m); });\n    });"
RM_HEAD = "      var rm = e.target.closest('button[data-id]'); if (!rm) return;\n"
RM_ASK = "      if (!(await ask('Remove this passkey?', 'You will not be able to sign in with it any more. Your account and other passkeys stay as they are.', 'Remove', 'Keep'))) return;\n"
OLD_CONFIRM_RM = "      if (!window.confirm('Remove this passkey? You will not be able to sign in with it any more.')) return;\n"
WEB_BRANCH = "      var b = e.currentTarget;\n      if (b.dataset.web === '1') { try { if (!(window.ccApp && ccApp.open && await ccApp.open('%s'))) window.open('%s', '_blank'); } catch (x) {} return; }\n      b.disabled = true;\n" % (SITE, SITE)

# Each step: (tag, skip_if_any_present, [(old, new), ...]) -> first alternative whose `old` occurs exactly once is applied.
STEPS = [
    ('helpers: deviceName / sign-up offer', ['function deviceName('],
        [("  // ---- add one ----\n", HELPERS + "  // ---- add one ----\n")]),
    ('helper: styled question sheet', ['function ask('],
        [(NAME_ANCHOR, ASK + NAME_ANCHOR)]),
    ('sign-up offer uses the sheet', ["return ask('Add a passkey?'"],
        [(OLD_CONFIRM_OFFER, NEW_ASK_OFFER)]),
    ('name new passkeys', ["await register(deviceName()); say('Passkey added'); } catch (x)"],
        [("try { await register(''); say('Passkey added'); }", "try { await register(deviceName()); say('Passkey added'); }")]),
    ('Remove asks first (styled sheet)', ["await ask('Remove this passkey?'"],
        [(OLD_CONFIRM_RM, RM_ASK),
         (RM_HEAD + "      rm.disabled = true;", RM_HEAD + RM_ASK + "      rm.disabled = true;")]),
    ('debounce the page watcher', ['var queued = false;'],
        [("  new MutationObserver(function () { scan(); }).observe(document.documentElement, { childList: true, subtree: true });",
          "  var queued = false;   // one scan per frame, however many DOM changes happen\n  new MutationObserver(function () { if (queued) return; queued = true; (window.requestAnimationFrame || setTimeout)(function () { queued = false; scan(); }); }).observe(document.documentElement, { childList: true, subtree: true });")]),
    ('Welcome screen: Add a passkey button', ['function mountWelcome('],
        [(SIGNIN_ANCHOR, WELCOME + SIGNIN_ANCHOR)]),
    ('scan() runs the sign-up hook and the Welcome button', ['mountBox();\n    mountWelcome();'],
        [("  function scan() {\n    mountBox();", "  function scan() {\n    hookSignup();\n    mountBox();\n    mountWelcome();"),
         ("    hookSignup();\n    mountBox();", "    hookSignup();\n    mountBox();\n    mountWelcome();")]),
    ('Android app: "Open the website" button', ["add.dataset.web = '1'"],
        [("keeps its own fingerprint lock above.'; add.hidden = true; list.innerHTML = ''; return; }",
          "keeps its own fingerprint lock above.'; add.hidden = false; add.dataset.web = '1'; add.textContent = 'Open the website'; list.innerHTML = ''; return; }")]),
    ('web button: reset label in the browser', ["add.dataset.web = ''"],
        [("No password to remember.'; add.hidden = false;", "No password to remember.'; add.hidden = false; add.dataset.web = ''; add.innerHTML = KEY + 'Add a passkey';")]),
    ('web button: click opens the website', ["b.dataset.web === '1'"],
        [("      var b = e.currentTarget; b.disabled = true;\n", WEB_BRANCH)]),
]
BACKEND = [
    ('students no longer see the admin/SQL wording', ['passkey save failed'],
        [("return err(env, 'Could not save the passkey. Ask the admin to run the passkeys SQL.', 500);",
          "{ console.error('passkey save failed: run supabase/passkeys-and-device-lock.sql', res.status); return err(env, 'Could not save the passkey right now. Please try again later.', 500); }")]),
    ('log the real reason for a refused site address', ['passkey refused'],
        [("  if (!origins(env).includes(String(cd.origin || '').replace(/\\/$/, ''))) return null;",
          "  if (!origins(env).includes(String(cd.origin || '').replace(/\\/$/, ''))) { console.error('passkey refused: site address ' + cd.origin + ' is not in PASSKEY_ORIGINS (' + origins(env).join(', ') + ')'); return null; }")]),
]


def run(path, steps):
    s = path.read_text(encoding='utf-8')
    for tag, skip_if, alts in steps:
        if any(m in s for m in skip_if):
            print(f'  skip  {tag} (already applied)'); continue
        for old, new in alts:
            if s.count(old) == 1:
                s = s.replace(old, new); print(f'  ok    {tag}'); break
        else:
            sys.exit(f'  FAIL  {tag}: could not find its place in {path}. Nothing was written to this file. Send me the file and I will adjust.')
    path.write_text(s, encoding='utf-8')


print('frontend/cc-passkey.js'); run(pk, STEPS)
print('backend/src/passkeys.js'); run(be, BACKEND)
print('frontend/index.html')
h = idx.read_text(encoding='utf-8')
m = re.findall(r'cc-passkey\.js\?v=(\d+)', h)
if len(m) != 1:
    sys.exit('  FAIL  expected exactly one cc-passkey.js?v=N tag in index.html')
if m[0] == '5':
    print('  skip  cache-bust (already v=5)')
else:
    idx.write_text(h.replace('cc-passkey.js?v=' + m[0], 'cc-passkey.js?v=5'), encoding='utf-8'); print(f'  ok    cache-bust v={m[0]} -> v=5')
print('\nDone. Deploy the frontend AND the backend, then hard-refresh once.')
