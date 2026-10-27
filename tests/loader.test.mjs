import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const gate = fs.readFileSync('frontend/cc-gate.js', 'utf8');
const nav = fs.readFileSync('frontend/cc-nav.js', 'utf8');
const html = fs.readFileSync('frontend/index.html', 'utf8');

test('the splash is loaded by index.html through cc-gate.js', () => {
  assert.ok(/cc-gate\.js/.test(html), 'index.html must load cc-gate.js');
});

test('first start of the app: the splash plays once and the app remembers it started', () => {
  assert.ok(gate.includes("var ran = ss('cc_ran'); ss('cc_ran', '1');"), 'cc_ran must be read then set');
  assert.ok(gate.includes("if (!ran) build('s');"), 'the splash must only build when cc_ran was not set');
});

test('moving around: the old loader never comes back once the app runs', () => {
  assert.ok(nav.includes('function unloader()'), 'cc-nav.js must hide the loader again');
  assert.ok(nav.includes("addEventListener('pageshow'") && nav.includes("addEventListener('popstate'"), 'back and history jumps must hide it');
});

test('if the phone blocks storage, the splash code does not throw', () => {
  const m = gate.match(/function ss\([^)]*\)\s*\{[\s\S]*?\n\}/);
  assert.ok(m && /try\s*\{/.test(m[0]), 'ss() must wrap storage in try/catch');
});
