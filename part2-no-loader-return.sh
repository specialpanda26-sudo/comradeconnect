#!/bin/bash
set -e
[ -f wrangler.toml ] && [ -d frontend ] && [ -d backend/src ] && [ -f frontend/index.html ] || { echo "Run this inside the comradeconnect folder."; exit 1; }

python3 - <<'CC_PY_2'
def sub(path, old, new, mark):
    s = open(path, encoding='utf-8').read()
    if mark in s: print('skip   ', path, '(already done)'); return
    assert old in s, 'anchor missing in ' + path + ': ' + old[:60]
    open(path, 'w', encoding='utf-8').write(s.replace(old, new, 1)); print('patched', path)

sub('frontend/index.html',
    "/* cc-loader-v2 */(function(){var L=document.getElementById('loader'),t0=Date.now(),gone=false;",
    "/* cc-loader-v3 */(function(){var L=document.getElementById('loader'),t0=Date.now(),gone=false;"
    "try{var seen=sessionStorage.getItem('cc_ran');sessionStorage.setItem('cc_ran','1');"
    "if(seen&&L){L.style.display='none';setTimeout(function(){if(L.parentNode)L.parentNode.removeChild(L)},0);return}}catch(e){}",
    'cc-loader-v3')
CC_PY_2

cat > tests/loader.test.mjs <<'CC_EOF_2'
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('frontend/index.html', 'utf8');
const SRC = (html.match(/<script>(\/\* cc-loader-v3 \*\/.*?)<\/script>/s) || [])[1];

function load(store, { broken = false } = {}) {
  const timers = [], classes = new Set(); let removed = false;
  const L = { style: {}, classList: { add: (c) => classes.add(c) }, parentNode: { removeChild() { removed = true; } } };
  const storage = broken ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }
    : { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const ctx = { document: { getElementById: (id) => (id === 'loader' ? L : null), readyState: 'loading' }, sessionStorage: storage,
    window: { addEventListener() {} }, setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, Date, Math };
  vm.runInNewContext(SRC, ctx);
  return { L, timers, removed: () => removed, classes };
}

test('the loader script exists in index.html', () => { assert.ok(SRC, 'cc-loader-v3 script not found'); });

test('first start of the app: the loader plays as before', () => {
  const store = {}; const r = load(store);
  assert.notEqual(r.L.style.display, 'none', 'loader must be visible on the first start');
  assert.ok(r.timers.some((t) => t.ms === 9500), 'the safety timer that ends the loader must be set');
  assert.equal(store.cc_ran, '1', 'the app remembers it already started');
});

test('moving around (Safety, Refunds, Back, Open the app, sign in, change campus): no loader again', () => {
  const store = {}; load(store);
  for (let i = 0; i < 3; i++) {
    const r = load(store);
    assert.equal(r.L.style.display, 'none', 'loader must be hidden at once on a later load');
    assert.ok(!r.timers.some((t) => t.ms === 9500), 'no 8 second loader timers on a later load');
    r.timers.forEach((t) => t.f());
    assert.ok(r.removed(), 'the loader element is removed from the page');
  }
});

test('if the phone blocks storage, the loader still plays and nothing breaks', () => {
  const r = load({}, { broken: true });
  assert.notEqual(r.L.style.display, 'none');
  assert.ok(r.timers.some((t) => t.ms === 9500));
});
CC_EOF_2

echo "--- test"
node --test tests/loader.test.mjs 2>&1 | grep -E "^# (tests|pass|fail)"
node --test tests/loader.test.mjs >/dev/null 2>&1 || { echo "TEST FAILED, nothing was pushed"; exit 1; }

git add -A -- . ':(exclude)part*.sh'
git commit -m "Loading screen plays once per app start, not on every page change" || echo "nothing new to commit"
git push origin main
echo "Part 2 done. No SQL to run."
