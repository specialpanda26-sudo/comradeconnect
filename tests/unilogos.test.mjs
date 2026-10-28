import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const logos = fs.readFileSync('frontend/cc-unilogos.js', 'utf8');
const campus = fs.readFileSync('frontend/cc-campus.js', 'utf8');
const page = fs.readFileSync('frontend/index.html', 'utf8');
test('every university in the picker has a logo entry', () => {
  const names = [...campus.matchAll(/^\["\w+","(.*?)","/gm)].map(m => m[1]).filter(n => !/^Other /.test(n));
  assert.ok(names.length > 50);
  for (const n of names) assert.ok(logos.includes(n), 'no logo for ' + n);
});
test('logo script is loaded after the picker', () => {
  assert.ok(page.indexOf('cc-unilogos.js') > page.indexOf('cc-campus.js'));
});
