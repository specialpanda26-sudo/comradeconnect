import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync('frontend/app/index.html', 'utf8');

test('every university in the picker has a logo entry, and the row uses it', () => {
  const unis = vm.runInNewContext(app.match(/const UNIS=(\[.*?\]);/)[1]);
  const dom = vm.runInNewContext('(' + app.match(/const UDOM=(\{.*?\});\n/)[1] + ')');
  for (const u of unis) assert.ok(dom[u] && dom[u][0] && dom[u][1], 'no logo entry for ' + u);
  assert.ok(app.includes('data-u="${esc(u)}">${ulogo(u)}'), 'the row still draws the plain building icon');
  assert.ok(!/data-u="\$\{esc\(u\)\}"><span class="ri">\$\{ic\('building'\)\}/.test(app));
});

test('a logo that cannot load, or is only the tiny default icon, is removed so the short name shows', () => {
  assert.ok(app.includes('onload="if(this.naturalWidth<32)this.remove()"'));
  assert.ok(app.includes('onerror="this.remove()"'));
});
