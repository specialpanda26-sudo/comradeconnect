import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
const fresh = async (t, o) => { const w = world(o); t.after(() => w.restore()); return w; };

test('zones: Kirinyaga keeps its four, another campus starts with On campus', async (t) => {
  const w = await fresh(t);
  const k = (await w.call('GET', '/api/config', { campus: 'kirinyaga' })).data.zones;
  assert.deepEqual(k, ['Kerugoya', 'Kutus', 'Kagio', 'On campus']);
  const u = (await w.call('GET', '/api/config', { campus: 'uon' })).data.zones;
  assert.deepEqual(u, ['On campus']);
});
