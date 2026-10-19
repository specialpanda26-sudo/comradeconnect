import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { world } from './helpers.mjs';
import { split, objects } from '../backend/src/sqlpanel.js';
import FILES from '../backend/src/sqltext.js';

test('sqltext.js matches the supabase/*.sql files (run: python3 build-sql.py)', () => {
  for (const f of Object.keys(FILES)) assert.equal(FILES[f], readFileSync('supabase/' + f, 'utf8'), f + ' changed, rebuild with build-sql.py');
});
test('every SQL file is cut into sections that together contain every statement', () => {
  for (const [f, t] of Object.entries(FILES)) {
    const parts = split(f, t); assert.ok(parts.length >= 1);
    const norm = (x) => x.replace(/\s+/g, '');
    assert.equal(norm(parts.map((p) => p.sql).join('')), norm(t), f);
  }
  assert.ok(split('schema.sql', FILES['schema.sql']).length > 10, 'schema.sql is split by its version headers');
});
test('tables and columns are found, new-table columns are not double counted', () => {
  const o = objects('create table if not exists a (x int);\nalter table b add column if not exists c int, add column if not exists d text;\nalter table a add column if not exists z int;');
  assert.deepEqual(o.tables, ['a']); assert.deepEqual(o.cols, ['b.c', 'b.d']);
});
test('/api/admin/sql is admin only and lists what is missing', async (t) => {
  const w = world(); t.after(() => w.restore());
  assert.equal((await w.call('GET', '/api/admin/sql')).status, 403);
  const r = await w.call('GET', '/api/admin/sql', { admin: true });
  assert.equal(r.status, 200); assert.ok(Array.isArray(r.data.items) && r.data.items.length > 10);
  assert.ok(r.data.items.every((x) => ['missing', 'installed', 'unknown', 'manual'].includes(x.status)));
  assert.match(r.data.editor_url, /supabase/);
  if (r.data.missing_count) assert.match(r.data.all_missing, /reload schema/);
});
