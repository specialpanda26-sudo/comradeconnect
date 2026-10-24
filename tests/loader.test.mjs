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
