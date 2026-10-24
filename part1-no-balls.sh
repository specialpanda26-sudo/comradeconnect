#!/bin/bash
set -e
[ -f wrangler.toml ] && [ -d frontend ] && [ -d backend/src ] && [ -f frontend/cc-glass.js ] || { echo "Run this inside the comradeconnect folder."; exit 1; }

python3 - <<'CC_PY_1'
import re, glob

def sub(path, old, new, mark):
    s = open(path, encoding='utf-8').read()
    if mark in s: print('skip   ', path, '(already done)'); return
    assert old in s, 'anchor missing in ' + path + ': ' + old[:60]
    open(path, 'w', encoding='utf-8').write(s.replace(old, new, 1)); print('patched', path)

def rsub(path, pattern, repl, mark, flags=0):
    s = open(path, encoding='utf-8').read()
    if mark in s: print('skip   ', path, '(already done)'); return
    n, c = re.subn(pattern, repl, s, count=1, flags=flags)
    assert c == 1, 'pattern missing in ' + path + ': ' + pattern[:60]
    open(path, 'w', encoding='utf-8').write(n); print('patched', path)

rsub('frontend/cc-glass.js', r"function orbs\(\) \{.*?\n\}\n",
     "function orbs() { [].forEach.call(document.querySelectorAll('.cc-orbs'), function (n) { n.remove(); }); }   /* cc-noballs */\n",
     'cc-noballs', re.S)
rsub('frontend/cc-glass.js', r"\n/\* lock orbs:.*\Z",
     "\n/* the lock screen has no balls either */\n", 'the lock screen has no balls', re.S)

css = 'frontend/cc-glass.css'
s = open(css, encoding='utf-8').read()
if 'cc-noballs-css' in s: print('skip   ', css, '(already done)')
else:
    s = s.replace(".bg>.cc-orbs{position:absolute;z-index:1}#ccbgi{z-index:0}", "#ccbgi{z-index:0}")
    s, c = re.subn(r"^(?:\.cc-orbs|@keyframes ccfl|@media\(prefers-reduced-motion:reduce\)\{\.cc-orbs).*\n", '', s, flags=re.M)
    assert c >= 4, 'expected to remove the ball styles, removed ' + str(c)
    s += "\n/* cc-noballs-css */\n.cc-orbs,.cc-orbs *{display:none!important}\n"
    open(css, 'w', encoding='utf-8').write(s); print('patched', css, '(balls removed, hide rule added)')

for f in glob.glob('frontend/*.html'):
    t = open(f, encoding='utf-8').read()
    n = re.sub(r"(cc-glass\.(?:css|js))\?v=\d+", r"\1?v=5", t)
    if n != t: open(f, 'w', encoding='utf-8').write(n); print('bumped ', f)
CC_PY_1

cat > tests/noballs.test.mjs <<'CC_EOF_1'
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const F = (n) => fs.readFileSync('frontend/' + n, 'utf8');

test('no coloured balls: the script never builds them and the style never draws them', () => {
  const js = F('cc-glass.js'), css = F('cc-glass.css');
  assert.ok(!js.includes("className = 'cc-orbs'"), 'cc-glass.js still builds the balls');
  assert.ok(!js.includes('class="o1"'), 'cc-glass.js still has ball markup');
  assert.ok(!/\.cc-orbs\s+\.o1/.test(css), 'cc-glass.css still paints the balls');
  assert.ok(!css.includes('@keyframes ccfl'), 'the floating animation is still there');
  assert.ok(/\.cc-orbs[^{]*\{display:none!important\}/.test(css), 'the hide rule is missing');
  assert.ok(css.includes('#ccbgi{z-index:0}'), 'the landing picture rule must stay');
});

test('every page asks for the new glass files, so phones drop the old saved copy', () => {
  let seen = 0;
  for (const f of fs.readdirSync('frontend').filter((x) => x.endsWith('.html'))) {
    for (const m of F(f).matchAll(/cc-glass\.(?:css|js)\?v=(\d+)/g)) { seen++; assert.ok(Number(m[1]) >= 5, f + ' still loads an old cc-glass file'); }
  }
  assert.ok(seen >= 20, 'expected the glass files on the app and the static pages');
});

test('running cc-glass.js adds no balls and removes the ones already on the page (Safety, Refunds, lock screen)', () => {
  let created = 0; const removed = [];
  const old = [{ remove() { removed.push('a'); } }, { remove() { removed.push('b'); } }];
  const mk = () => ({ style: { setProperty() {} }, setAttribute() {}, appendChild() {}, insertBefore() {}, classList: { add() {}, contains: () => false }, querySelector: () => null });
  const el = () => { created++; return mk(); };
  const doc = {
    readyState: 'complete', body: mk(), documentElement: { classList: { contains: () => false, add() {} } },
    querySelector: () => null, getElementById: () => mk(), createElement: el, addEventListener() {},
    querySelectorAll: (s) => (s === '.cc-orbs' ? old : []),
  };
  const ctx = { document: doc, window: { addEventListener() {} }, location: { pathname: '/safety.html' }, getComputedStyle: () => ({ backgroundColor: '' }),
    MutationObserver: class { observe() {} }, setTimeout, clearTimeout, console };
  ctx.window.document = doc;
  vm.runInNewContext(F('cc-glass.js'), ctx);
  assert.equal(created, 0, 'the script created page elements (balls)');
  assert.deepEqual(removed.sort(), ['a', 'b'], 'old balls on the page were not removed');
});
CC_EOF_1

echo "--- test"
node --test tests/noballs.test.mjs 2>&1 | grep -E "^# (tests|pass|fail)"
node --test tests/noballs.test.mjs >/dev/null 2>&1 || { echo "TEST FAILED, nothing was pushed"; exit 1; }

git add -A -- . ':(exclude)part*.sh'
git commit -m "Remove the coloured balls from every page" || echo "nothing new to commit"
git push origin main
echo "Part 1 done. No SQL to run."
