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
