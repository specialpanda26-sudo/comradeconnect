#!/usr/bin/env python3
"""use_releases_repo.py: point the website and the Android app at a separate PUBLIC releases repo.
Run from the repo root:   python3 use_releases_repo.py [owner/repo] [repo_root]
Default releases repo: specialpanda26-sudo/comradeconnect-releases
Changes the REPO line in frontend/cc-getapp.js, frontend/cc-native.js, frontend/cc-update.js and clean_releases.sh,
and bumps those three script versions in frontend/index.html so phones fetch the new files. Safe to run twice."""
import re, sys, pathlib

new = sys.argv[1] if len(sys.argv) > 1 else 'specialpanda26-sudo/comradeconnect-releases'
root = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else '.')
if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', new):
    sys.exit('Give the repo as owner/name, e.g. specialpanda26-sudo/comradeconnect-releases')
targets = [
    (root / 'frontend' / 'cc-getapp.js',  r"(var REPO = ')[^']+(';)"),
    (root / 'frontend' / 'cc-native.js',  r"(var REPO = ')[^']+(';)"),
    (root / 'frontend' / 'cc-update.js',  r"(var REPO = ')[^']+(';)"),
    (root / 'clean_releases.sh',          r"(REPO=)[^\s]+()"),
]
changed = []
for path, rx in targets:
    if not path.exists():
        sys.exit(f'Not found: {path}  (run from the repo root, or pass it as the second argument)')
    s = path.read_text(encoding='utf-8')
    if len(re.findall(rx, s)) != 1:
        sys.exit(f'FAIL: expected exactly one REPO line in {path}. Nothing written.')
    out = re.sub(rx, lambda m: m.group(1) + new + m.group(2), s)
    if out == s:
        print(f'  skip  {path.name} (already {new})'); continue
    path.write_text(out, encoding='utf-8'); changed.append(path.name); print(f'  ok    {path.name} -> {new}')

idx = root / 'frontend' / 'index.html'
if changed and idx.exists():
    h = idx.read_text(encoding='utf-8')
    for name in ('cc-getapp', 'cc-native', 'cc-update'):
        if name + '.js' not in ' '.join(changed):
            continue
        m = re.findall(re.escape(name) + r'\.js\?v=(\d+)', h)
        if len(m) == 1:
            h = h.replace(f'{name}.js?v={m[0]}', f'{name}.js?v={int(m[0]) + 1}'); print(f'  ok    index.html {name}.js v={m[0]} -> v={int(m[0]) + 1}')
        else:
            print(f'  note  could not bump {name}.js in index.html (found {len(m)} tags); it still works, phones may keep the old copy for a while')
    idx.write_text(h, encoding='utf-8')
print('\nDone. Now commit, push and deploy the frontend.')
