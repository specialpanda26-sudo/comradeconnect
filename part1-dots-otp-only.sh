#!/bin/bash
set -e
[ -f wrangler.toml ] && [ -d frontend/app ] && [ -f frontend/cc-dots.css ] || { echo "Run this inside the comradeconnect folder."; exit 1; }

python3 - <<'CC_PY_1'
import glob, re

def sub(path, old, new, mark):
    s = open(path, encoding='utf-8').read()
    if mark in s:
        print('skip   ', path, '(already done)'); return
    assert old in s, 'anchor missing in ' + path + ': ' + old[:70]
    open(path, 'w', encoding='utf-8').write(s.replace(old, new, 1)); print('patched', path)

css = 'frontend/cc-dots.css'
s = open(css, encoding='utf-8').read()
if 'cc-dots-otp-only' in s:
    print('skip   ', css, '(already done)')
else:
    kf = [l for l in s.split('\n') if l.startswith('@keyframes ccdw')]
    assert len(kf) == 1, 'wave keyframes not found in cc-dots.css'
    head = (
        "/* cc-dots-otp-only: the five wave dots are used on the OTP code check and nowhere else.\n"
        "   Payment checks, buttons, uploads, the lock screen and the full-screen loader keep their plain ring and tick. */\n"
        "button.cco-bspin::before{\n"
        "  --d:6px;--p:10px;--y:6px;--c2:#c4727a;--c3:#a9b8a2;--c4:currentColor;--c5:#e8744f;\n"
        "  --p2:calc(var(--p)*2);--p3:calc(var(--p)*3);--p4:calc(var(--p)*4);\n"
        "  --y0:0px;--y1:calc(var(--y)*-.33);--y2:calc(var(--y)*-.67);--y3:calc(var(--y)*-1);\n"
        "  content:\"\";display:inline-block!important;vertical-align:middle!important;margin-right:calc(var(--p)*4 + 10px)!important;\n"
        "  box-sizing:content-box!important;width:var(--d)!important;height:var(--d)!important;min-width:0!important;\n"
        "  border:0!important;border-radius:50%!important;background:#ff8a3d!important;\n"
        "  box-shadow:var(--p) 0 0 var(--c2),var(--p2) 0 0 var(--c3),var(--p3) 0 0 var(--c4),var(--p4) 0 0 var(--c5)!important;\n"
        "  animation:ccdw 1.1s ease-in-out infinite!important;transform:none!important}\n"
    )
    tail = "\n@media (prefers-reduced-motion:reduce){button.cco-bspin::before{animation:none!important}}\n"
    open(css, 'w', encoding='utf-8').write(head + kf[0] + tail)
    print('patched', css, '(dots only on the OTP check)')

for f in glob.glob('frontend/*.html'):
    t = open(f, encoding='utf-8').read()
    n = re.sub(r'(cc-dots\.css)\?v=\d+', r'\1?v=2', t)
    if n != t:
        open(f, 'w', encoding='utf-8').write(n); print('bumped ', f)

A = 'frontend/app/index.html'
sub(A, '<link rel="stylesheet" href="cc-proto-fix.css?v=1">',
       '<link rel="stylesheet" href="../cc-dots.css?v=2"><link rel="stylesheet" href="cc-proto-fix.css?v=1">', 'cc-dots.css?v=2')
sub(A, "Promise.resolve().then(()=>CC.verifyResetCode(val())).then(()=>{bx.classList.add('okb');",
       "v.disabled=true;v.classList.add('cco-bspin');v.textContent='Verifying code';Promise.resolve().then(()=>CC.verifyResetCode(val())).then(()=>{v.classList.remove('cco-bspin');bx.classList.add('okb');", "v.classList.add('cco-bspin')")
sub(A, "()=>{tries++;bx.classList.add('badb');",
       "()=>{v.classList.remove('cco-bspin');v.textContent='Verify';tries++;bx.classList.add('badb');", "v.textContent='Verify';tries++")
CC_PY_1

cat > tests/dots-otp-only.test.mjs <<'CC_EOF_1'
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('frontend/cc-dots.css', 'utf8');
const app = fs.readFileSync('frontend/app/index.html', 'utf8');

test('the wave dots are drawn only for the OTP check button', () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')[0].trim()).filter(Boolean);
  const users = rules.filter((r) => !r.startsWith('@') && !/^\d+%$/.test(r) && !/^(0|[1-9]\d?|100)%/.test(r));
  assert.ok(users.every((r) => r === 'button.cco-bspin::before'), 'other selectors still use the dots: ' + users.join(' | '));
});

test('payment checks, buttons and loaders no longer get dots', () => {
  for (const sel of ['.cs-l .cs-s.a .cs-i::after', '.cf-wait::before', '#ccld .ccld-s', '.gb-sp', '#ccu .sp', '.ccspin']) {
    assert.ok(!css.includes(sel), sel + ' is still restyled by cc-dots.css');
  }
});

test('the new app shows the dots while the OTP is checked, and puts the button back after a wrong code', () => {
  assert.ok(app.includes('cc-dots.css?v=2'));
  assert.ok(app.includes("v.classList.add('cco-bspin');v.textContent='Verifying code'"));
  assert.ok(app.includes("v.classList.remove('cco-bspin');v.textContent='Verify'"));
});
CC_EOF_1
echo "Part 1 done."
