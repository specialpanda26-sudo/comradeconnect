import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const js = fs.readFileSync('frontend/cc-unilogos.js', 'utf8');
test('every bundled logo file exists and is mapped', () => {
  for (const id of ['uon','seku','tmu','cuk','kabianga','pueac','spu','panac','turkana','bomet']) {
    assert.ok(js.includes("'" + id + "'"), 'not mapped: ' + id);
    assert.ok(fs.statSync('frontend/img/unilogos/' + id + '.webp').size > 500, 'missing file: ' + id);
  }
});
