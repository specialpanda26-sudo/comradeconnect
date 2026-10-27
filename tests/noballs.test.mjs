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
  assert.ok(seen >= 10, 'expected the glass files on the app and the pages that still use them');
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
